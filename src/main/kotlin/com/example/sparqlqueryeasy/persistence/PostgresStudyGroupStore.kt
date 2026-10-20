package com.example.sparqlqueryeasy.persistence

import com.example.sparqlqueryeasy.application.auth.Role
import com.example.sparqlqueryeasy.application.study.GroupResult
import com.example.sparqlqueryeasy.application.study.GroupTask
import com.example.sparqlqueryeasy.application.study.Participant
import com.example.sparqlqueryeasy.application.study.StudyGroup
import com.example.sparqlqueryeasy.application.study.StudyGroupStore
import com.example.sparqlqueryeasy.application.study.StudyTask
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.ReferenceOption
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.neq
import org.jetbrains.exposed.v1.javatime.timestamp
import org.jetbrains.exposed.v1.jdbc.JdbcTransaction
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insertIgnore
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.update
import org.jetbrains.exposed.v1.jdbc.upsert
import java.time.Instant

internal object StudyGroups : Table("study_group") {
    val id = long("id").autoIncrement()
    val name = varchar("name", 100).uniqueIndex()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

private object StudyGroupTasks : Table("study_group_task") {
    val groupId = long("group_id").references(StudyGroups.id, onDelete = ReferenceOption.CASCADE)
    val taskId = long("task_id").references(StudyTasks.id)
    val position = integer("position")
    override val primaryKey = PrimaryKey(groupId, taskId)
}

internal object StudyGroupMembers : Table("study_group_member") {
    val userId = long("user_id").references(AppUsers.id, onDelete = ReferenceOption.CASCADE)
    val groupId = long("group_id").references(StudyGroups.id)
    val assignedAt = timestamp("assigned_at")
    override val primaryKey = PrimaryKey(userId)
}

/** [StudyGroupStore] on the migrated PostgreSQL database (V5__study_groups.sql). */
@Suppress("TooManyFunctions") // The port's operations plus three query helpers.
class PostgresStudyGroupStore(private val connector: DatabaseConnector) : StudyGroupStore {
    override suspend fun create(
        name: String,
        now: Instant,
    ): StudyGroup? =
        use {
            val inserted =
                StudyGroups.insertIgnore {
                    it[StudyGroups.name] = name
                    it[createdAt] = now
                    it[updatedAt] = now
                }
            if (inserted.insertedCount == 1) findGroup(inserted[StudyGroups.id]) else null
        }

    override suspend fun rename(
        id: Long,
        name: String,
        now: Instant,
    ): GroupResult =
        use {
            when {
                !exists(id) -> GroupResult.NotFound
                StudyGroups.selectAll().where { (StudyGroups.name eq name) and (StudyGroups.id neq id) }.any() ->
                    GroupResult.NameTaken
                else -> {
                    StudyGroups.update({ StudyGroups.id eq id }) {
                        it[StudyGroups.name] = name
                        it[updatedAt] = now
                    }
                    GroupResult.Done(checkNotNull(findGroup(id)))
                }
            }
        }

    override suspend fun find(id: Long): StudyGroup? = use { findGroup(id) }

    override suspend fun list(): List<StudyGroup> =
        use {
            StudyGroups.selectAll().orderBy(StudyGroups.name).map { it[StudyGroups.id] }.mapNotNull(::findGroup)
        }

    override suspend fun setTasks(
        id: Long,
        taskKeys: List<String>,
        now: Instant,
    ): GroupResult =
        use {
            val ids =
                StudyTasks.select(StudyTasks.id, StudyTasks.key)
                    .where { StudyTasks.key inList taskKeys }
                    .associate { it[StudyTasks.key] to it[StudyTasks.id] }
            val unknown = taskKeys.filterNot(ids::containsKey)
            when {
                !exists(id) -> GroupResult.NotFound
                unknown.isNotEmpty() -> GroupResult.Invalid("Unknown tasks: ${unknown.joinToString()}")
                else -> {
                    StudyGroupTasks.deleteWhere { groupId eq id }
                    StudyGroupTasks.batchInsert(taskKeys.withIndex()) { (index, key) ->
                        this[StudyGroupTasks.groupId] = id
                        this[StudyGroupTasks.taskId] = ids.getValue(key)
                        this[StudyGroupTasks.position] = index
                    }
                    touch(id, now)
                    GroupResult.Done(checkNotNull(findGroup(id)))
                }
            }
        }

    override suspend fun assign(
        id: Long,
        usernameKey: String,
        now: Instant,
    ): GroupResult =
        use {
            val user = AppUsers.selectAll().where { AppUsers.usernameKey eq usernameKey }.singleOrNull()
            when {
                !exists(id) -> GroupResult.NotFound
                user == null -> GroupResult.Invalid("No account has this username")
                user[AppUsers.role] != Role.PARTICIPANT.wire -> GroupResult.Invalid("Only participants join groups")
                else -> {
                    StudyGroupMembers.upsert {
                        it[userId] = user[AppUsers.id]
                        it[groupId] = id
                        it[assignedAt] = now
                    }
                    touch(id, now)
                    GroupResult.Done(checkNotNull(findGroup(id)))
                }
            }
        }

    override suspend fun unassign(
        id: Long,
        usernameKey: String,
    ): GroupResult =
        use {
            val user = AppUsers.select(AppUsers.id).where { AppUsers.usernameKey eq usernameKey }.singleOrNull()
            val removed =
                user?.let { row ->
                    StudyGroupMembers.deleteWhere { (userId eq row[AppUsers.id]) and (groupId eq id) }
                } ?: 0
            when {
                !exists(id) -> GroupResult.NotFound
                removed == 0 -> GroupResult.Invalid("This user is not in the group")
                else -> GroupResult.Done(checkNotNull(findGroup(id)))
            }
        }

    override suspend fun delete(id: Long): GroupResult =
        use {
            when {
                !exists(id) -> GroupResult.NotFound
                StudyGroupMembers.selectAll().where { StudyGroupMembers.groupId eq id }.any() -> GroupResult.HasMembers
                else -> {
                    StudyGroups.deleteWhere { StudyGroups.id eq id }
                    GroupResult.Deleted
                }
            }
        }

    override suspend fun participants(): List<Participant> =
        use {
            AppUsers
                .join(StudyGroupMembers, JoinType.LEFT, AppUsers.id, StudyGroupMembers.userId)
                .join(StudyGroups, JoinType.LEFT, StudyGroupMembers.groupId, StudyGroups.id)
                .select(AppUsers.username, AppUsers.usernameKey, StudyGroups.id, StudyGroups.name)
                .where { AppUsers.role eq Role.PARTICIPANT.wire }
                .orderBy(AppUsers.usernameKey)
                .map { Participant(it[AppUsers.username], it[StudyGroups.id], it[StudyGroups.name]) }
        }

    override suspend fun activeTasksFor(userId: Long): List<StudyTask> =
        use {
            StudyGroupMembers
                .join(StudyGroupTasks, JoinType.INNER, StudyGroupMembers.groupId, StudyGroupTasks.groupId)
                .join(StudyTasks, JoinType.INNER, StudyGroupTasks.taskId, StudyTasks.id)
                .selectAll()
                .where { (StudyGroupMembers.userId eq userId) and (StudyTasks.active eq true) }
                .orderBy(StudyGroupTasks.position, SortOrder.ASC)
                .map { it.toTask() }
        }

    private fun exists(id: Long): Boolean = StudyGroups.selectAll().where { StudyGroups.id eq id }.any()

    private fun touch(
        id: Long,
        now: Instant,
    ) {
        StudyGroups.update({ StudyGroups.id eq id }) { it[updatedAt] = now }
    }

    private fun findGroup(id: Long): StudyGroup? {
        val row = StudyGroups.selectAll().where { StudyGroups.id eq id }.singleOrNull() ?: return null
        val tasks =
            (StudyGroupTasks innerJoin StudyTasks)
                .select(StudyTasks.key, StudyTasks.title, StudyTasks.active)
                .where { StudyGroupTasks.groupId eq id }
                .orderBy(StudyGroupTasks.position)
                .map { GroupTask(it[StudyTasks.key], it[StudyTasks.title], it[StudyTasks.active]) }
        val members =
            (StudyGroupMembers innerJoin AppUsers)
                .select(AppUsers.username)
                .where { StudyGroupMembers.groupId eq id }
                .orderBy(AppUsers.usernameKey)
                .map { it[AppUsers.username] }
        val name = row[StudyGroups.name]
        return StudyGroup(id, name, tasks, members, row[StudyGroups.createdAt], row[StudyGroups.updatedAt])
    }

    private suspend fun <T> use(block: JdbcTransaction.() -> T): T = connector.inTransaction(block)
}

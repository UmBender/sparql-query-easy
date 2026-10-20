package com.example.sparqlqueryeasy.persistence

import com.example.sparqlqueryeasy.application.study.StudyProgressStore
import org.jetbrains.exposed.v1.core.ReferenceOption
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.javatime.timestamp
import org.jetbrains.exposed.v1.jdbc.insertIgnore
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.time.Instant

internal object StudyTaskOpens : Table("study_task_open") {
    val userId = long("user_id").references(AppUsers.id, onDelete = ReferenceOption.CASCADE)
    val taskId = long("task_id").references(StudyTasks.id)
    val openedAt = timestamp("opened_at")
    override val primaryKey = PrimaryKey(userId, taskId)
}

internal object StudyCompletions : Table("study_completion") {
    val userId = long("user_id").references(AppUsers.id, onDelete = ReferenceOption.CASCADE)
    val finishedAt = timestamp("finished_at")
    override val primaryKey = PrimaryKey(userId)
}

/** [StudyProgressStore] on the migrated PostgreSQL database (V6__study_task_opens.sql, V8__study_completion.sql). */
class PostgresStudyProgressStore(private val connector: DatabaseConnector) : StudyProgressStore {
    override suspend fun recordOpen(
        userId: Long,
        taskId: Long,
        now: Instant,
    ): Instant =
        connector.inTransaction {
            StudyTaskOpens.insertIgnore {
                it[StudyTaskOpens.userId] = userId
                it[StudyTaskOpens.taskId] = taskId
                it[openedAt] = now
            }
            checkNotNull(openedAt(userId, taskId))
        }

    override suspend fun finish(
        userId: Long,
        now: Instant,
    ): Instant =
        connector.inTransaction {
            StudyCompletions.insertIgnore {
                it[StudyCompletions.userId] = userId
                it[finishedAt] = now
            }
            checkNotNull(completedAt(userId))
        }

    override suspend fun finishedAt(userId: Long): Instant? = connector.inTransaction { completedAt(userId) }

    private fun completedAt(userId: Long): Instant? {
        val row = StudyCompletions.selectAll().where { StudyCompletions.userId eq userId }.singleOrNull()
        return row?.get(StudyCompletions.finishedAt)
    }

    override suspend fun firstOpen(
        userId: Long,
        taskId: Long,
    ): Instant? = connector.inTransaction { openedAt(userId, taskId) }

    private fun openedAt(
        userId: Long,
        taskId: Long,
    ): Instant? =
        StudyTaskOpens.selectAll()
            .where { (StudyTaskOpens.userId eq userId) and (StudyTaskOpens.taskId eq taskId) }
            .singleOrNull()
            ?.get(StudyTaskOpens.openedAt)
}

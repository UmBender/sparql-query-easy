package com.example.sparqlqueryeasy.application.study

import com.example.sparqlqueryeasy.application.auth.AuthService
import java.time.Clock
import java.time.Instant

/** A participant group (STUDY-007): its tasks in the order participants see them, and its members' usernames. */
data class StudyGroup(
    val id: Long,
    val name: String,
    val tasks: List<GroupTask>,
    val members: List<String>,
    val createdAt: Instant,
    val updatedAt: Instant,
)

data class GroupTask(val key: String, val title: String, val active: Boolean)

/** A participant account and the group it is in, if any. */
data class Participant(val username: String, val groupId: Long?, val groupName: String?)

sealed interface GroupResult {
    data class Done(val group: StudyGroup) : GroupResult

    data class Invalid(val message: String) : GroupResult

    data object NotFound : GroupResult

    data object NameTaken : GroupResult

    /** A group with members is never deleted. */
    data object HasMembers : GroupResult

    data object Deleted : GroupResult
}

/**
 * Storage port for groups. Implementations throw
 * [com.example.sparqlqueryeasy.application.persistence.PersistenceUnavailableException] when the database
 * cannot be used.
 */
interface StudyGroupStore {
    /** Creates the group, or returns null when [name] is taken. */
    suspend fun create(
        name: String,
        now: Instant,
    ): StudyGroup?

    suspend fun rename(
        id: Long,
        name: String,
        now: Instant,
    ): GroupResult

    suspend fun find(id: Long): StudyGroup?

    /** Every group, by name. */
    suspend fun list(): List<StudyGroup>

    /** Replaces the group's tasks with [taskKeys] in that order; unknown keys are reported, nothing changes. */
    suspend fun setTasks(
        id: Long,
        taskKeys: List<String>,
        now: Instant,
    ): GroupResult

    /** Puts the participant with [usernameKey] in the group, moving them out of any other one. */
    suspend fun assign(
        id: Long,
        usernameKey: String,
        now: Instant,
    ): GroupResult

    /** Takes the user out of the group; [GroupResult.Invalid] when they are not in it. */
    suspend fun unassign(
        id: Long,
        usernameKey: String,
    ): GroupResult

    suspend fun delete(id: Long): GroupResult

    /** Every participant account, by username, with its group. */
    suspend fun participants(): List<Participant>

    /** The active tasks of [userId]'s group in group order; none without a group. */
    suspend fun activeTasksFor(userId: Long): List<StudyTask>
}

/**
 * Admin management of participant groups (STUDY-007, DEC-014): the admin assigns participants (no random
 * assignment); a participant is in at most one group and sees only its active tasks. Moving a participant keeps
 * their submissions.
 */
class StudyGroupService(
    private val store: StudyGroupStore,
    private val clock: Clock = Clock.systemUTC(),
) {
    suspend fun list(): List<StudyGroup> = store.list()

    suspend fun find(id: Long): StudyGroup? = store.find(id)

    suspend fun participants(): List<Participant> = store.participants()

    /** STUDY-003: what a participant may open. */
    suspend fun activeTasksFor(userId: Long): List<StudyTask> = store.activeTasksFor(userId)

    suspend fun create(name: String): GroupResult {
        val clean = name.trim()
        validateName(clean)?.let { return GroupResult.Invalid(it) }
        val created = store.create(clean, clock.instant())
        return if (created == null) GroupResult.NameTaken else GroupResult.Done(created)
    }

    suspend fun rename(
        id: Long,
        name: String,
    ): GroupResult {
        val clean = name.trim()
        return validateName(clean)?.let(GroupResult::Invalid) ?: store.rename(id, clean, clock.instant())
    }

    suspend fun setTasks(
        id: Long,
        taskKeys: List<String>,
    ): GroupResult =
        if (taskKeys.distinct().size != taskKeys.size) {
            GroupResult.Invalid("A task can appear only once in a group")
        } else {
            store.setTasks(id, taskKeys, clock.instant())
        }

    suspend fun assign(
        id: Long,
        username: String,
    ): GroupResult = store.assign(id, AuthService.usernameKey(username.trim()), clock.instant())

    suspend fun unassign(
        id: Long,
        username: String,
    ): GroupResult = store.unassign(id, AuthService.usernameKey(username.trim()))

    suspend fun delete(id: Long): GroupResult = store.delete(id)

    companion object {
        const val MAX_NAME_LENGTH = 100

        private fun validateName(name: String): String? =
            if (name.length !in 1..MAX_NAME_LENGTH) "Name must have 1 to $MAX_NAME_LENGTH characters" else null
    }
}

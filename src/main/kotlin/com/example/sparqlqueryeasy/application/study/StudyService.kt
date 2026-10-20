package com.example.sparqlqueryeasy.application.study

import java.time.Clock
import java.time.Instant

/**
 * Storage port for a participant's progress. Implementations throw
 * [com.example.sparqlqueryeasy.application.persistence.PersistenceUnavailableException] when the database
 * cannot be used.
 */
interface StudyProgressStore {
    /** Records [now] as the user's first open of the task; a later open keeps the first time. Returns it. */
    suspend fun recordOpen(
        userId: Long,
        taskId: Long,
        now: Instant,
    ): Instant

    /** When the user first opened the task, or null when they never did. */
    suspend fun firstOpen(
        userId: Long,
        taskId: Long,
    ): Instant?
}

/**
 * What a participant does with the proposed tasks (STUDY-003…005): only the active tasks of their group
 * (STUDY-007), never the reference query or the expected result.
 */
class StudyService(
    private val groups: StudyGroupStore,
    private val progress: StudyProgressStore,
    private val clock: Clock = Clock.systemUTC(),
) {
    /** The user's group's active tasks in group order; none without a group. */
    suspend fun tasks(userId: Long): List<StudyTask> = groups.activeTasksFor(userId)

    /** The task when the user may open it (in their group and active), recording the first open; else null. */
    suspend fun open(
        userId: Long,
        key: String,
    ): StudyTask? {
        val task = tasks(userId).singleOrNull { it.key == key } ?: return null
        progress.recordOpen(userId, task.id, clock.instant())
        return task
    }
}

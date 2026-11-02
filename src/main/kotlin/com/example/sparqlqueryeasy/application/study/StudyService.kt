package com.example.sparqlqueryeasy.application.study

import com.example.sparqlqueryeasy.application.query.GeneralQueryRequest
import com.example.sparqlqueryeasy.wikidata.query.TriplePattern
import java.time.Clock
import java.time.Duration
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

    /** Records the final submission at [now] unless one exists; returns the stored time either way. */
    suspend fun finish(
        userId: Long,
        now: Instant,
    ): Instant

    /** When the user made the final submission, or null. */
    suspend fun finishedAt(userId: Long): Instant?
}

/** A task in the participant's list with their own status (STUDY-014, DEC-020 C8): never correctness. */
data class TaskProgress(
    val task: StudyTask,
    /** When the user last saved an answer to the task, at any revision; null when they never did. */
    val lastSavedAt: Instant?,
) {
    val status: StudyTaskStatus
        get() = if (lastSavedAt == null) StudyTaskStatus.NOT_STARTED else StudyTaskStatus.ANSWERED
}

/**
 * What a participant does with the proposed tasks (STUDY-003…005, STUDY-016): only the active tasks of their group
 * (STUDY-007), never the reference query, the expected result or the automatic check of their answers (DEC-020).
 * [referencePatterns] reads the triples of a task's stored reference request (the HTTP layer owns its format).
 */
class StudyService(
    private val groups: StudyGroupStore,
    private val progress: StudyProgressStore,
    private val submissions: StudySubmissionStore,
    private val runner: StudyQueryRunner,
    private val referencePatterns: (StudyTask) -> List<TriplePattern>,
    private val clock: Clock = Clock.systemUTC(),
) {
    /**
     * The final submission (STUDY-005, D6): afterwards the user can no longer list, open or answer the tasks.
     * Finishing again keeps the first time.
     */
    suspend fun finish(userId: Long): Instant = progress.finish(userId, clock.instant())

    suspend fun finishedAt(userId: Long): Instant? = progress.finishedAt(userId)

    /** The user's group's active tasks in group order; none without a group. */
    suspend fun tasks(userId: Long): List<StudyTask> = groups.activeTasksFor(userId)

    /** [tasks] with the user's own progress on each: answered after any save, at any revision of the task. */
    suspend fun tasksWithProgress(userId: Long): List<TaskProgress> {
        val tasks = tasks(userId)
        val saved = if (tasks.isEmpty()) emptyMap() else submissions.lastSaveByTask(userId)
        return tasks.map { TaskProgress(it, saved[it.id]) }
    }

    /** The task when the user may open it (in their group and active), recording the first open; else null. */
    suspend fun open(
        userId: Long,
        key: String,
    ): StudyTask? {
        val task = tasks(userId).singleOrNull { it.key == key } ?: return null
        progress.recordOpen(userId, task.id, clock.instant())
        return task
    }

    /**
     * Saves [answer] with the task's revision (STUDY-016) and the admin-only automatic check (DEC-020 C1, C2): an
     * answer without variables is compared structurally with the reference; one with variables runs each of its
     * first [MAX_CHECKED_VARIABLES] variables on the task's endpoint with the task's cap. A query that cannot run
     * is still saved. Null when the user may not open the task.
     */
    suspend fun save(
        userId: Long,
        key: String,
        answer: DrawnAnswer,
    ): Submission? {
        val task = tasks(userId).singleOrNull { it.key == key } ?: return null
        val now = clock.instant()
        val firstOpen = progress.recordOpen(userId, task.id, now)
        return submissions.add(
            Submission(
                id = 0,
                userId = userId,
                taskId = task.id,
                taskRevision = task.revision,
                graphJson = answer.graphJson,
                requestJson = answer.requestJson,
                check = check(task, answer),
                createdAt = now,
                timeSpentMillis = Duration.between(firstOpen, now).toMillis(),
            ),
        )
    }

    /**
     * The user's own saves of the task, oldest first; null, like [open], unless the task is an active task of
     * the user's group, so the answer never tells whether another group's task exists (QUAL-019).
     */
    suspend fun saves(
        userId: Long,
        key: String,
    ): List<Submission>? {
        val task = tasks(userId).singleOrNull { it.key == key } ?: return null
        return submissions.list(userId, task.id)
    }

    private suspend fun check(
        task: StudyTask,
        answer: DrawnAnswer,
    ): AnswerCheck {
        val variables = answer.variables
        if (variables.isEmpty()) return AnswerComparison.compareStructure(referencePatterns(task), answer.patterns)
        val checked =
            variables.take(MAX_CHECKED_VARIABLES).map { variable ->
                val request = GeneralQueryRequest(variable, answer.patterns, variableFilters = answer.variableFilters)
                val run = runner.run(task.endpoint, request, task.maxResults)
                AnswerComparison.checkVariable(variable.render(), run, task.expected.values, task.comparison)
            }
        return AnswerCheck.ByVariable(checked, variables.drop(MAX_CHECKED_VARIABLES).map { it.render() })
    }
}

package com.example.sparqlqueryeasy.application.study

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

/**
 * What a participant does with the proposed tasks (STUDY-003…005): only the active tasks of their group
 * (STUDY-007), never the reference query or the expected result.
 */
class StudyService(
    private val groups: StudyGroupStore,
    private val progress: StudyProgressStore,
    private val submissions: StudySubmissionStore,
    private val taskStore: StudyTaskStore,
    private val runner: StudyQueryRunner,
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
     * Checks [answer] against the task (DEC-014 Q5): runs its request on the task's endpoint with the task's
     * cap, compares with the stored expected result and stores the attempt with the task's revision. A query
     * that cannot run is stored as an invalid attempt. Null when the user may not open the task.
     */
    suspend fun submit(
        userId: Long,
        key: String,
        answer: DrawnQuery,
    ): Submission? {
        val task = tasks(userId).singleOrNull { it.key == key } ?: return null
        val now = clock.instant()
        val firstOpen = progress.recordOpen(userId, task.id, now)
        val checked = check(task, runner.run(task.endpoint, answer.request, task.maxResults))
        return submissions.add(
            Submission(
                id = 0,
                userId = userId,
                taskId = task.id,
                taskRevision = task.revision,
                graphJson = answer.graphJson,
                requestJson = answer.requestJson,
                answerVariable = answer.request.variable.render(),
                sparql = checked.sparql,
                result = checked.result,
                correct = checked.result?.outcome?.correct ?: false,
                feedback = checked.feedback,
                createdAt = now,
                timeSpentMillis = Duration.between(firstOpen, now).toMillis(),
            ),
        )
    }

    /** The user's own attempts at the task, oldest first; null when no task has this key. */
    suspend fun attempts(
        userId: Long,
        key: String,
    ): List<Submission>? {
        val task = taskStore.find(key) ?: return null
        return submissions.list(userId, task.id)
    }

    private fun check(
        task: StudyTask,
        run: AnswerRun,
    ): Checked =
        when (run) {
            is AnswerRun.Failed -> Checked(null, run.sparql, "The query could not run: ${run.diagnostic}")
            is AnswerRun.Complete -> {
                val outcome = AnswerComparison.compare(task.expected.values, run.result.values, task.comparison)
                val result = AttemptResult(outcome, run.result.values, truncated = false)
                Checked(result, run.result.sparql, outcome.feedback)
            }
            is AnswerRun.Truncated -> {
                val outcome =
                    AnswerComparison.compare(task.expected.values, run.values, task.comparison).copy(correct = false)
                val feedback =
                    "Incorrect: the query returns more than ${task.maxResults} results; the expected answer has " +
                        "${outcome.expectedCount}."
                Checked(AttemptResult(outcome, run.values, truncated = true), run.sparql, feedback)
            }
        }

    private data class Checked(
        val result: AttemptResult?,
        val sparql: String?,
        val feedback: String,
    )
}

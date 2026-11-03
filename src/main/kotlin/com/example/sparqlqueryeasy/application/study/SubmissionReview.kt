package com.example.sparqlqueryeasy.application.study

import java.time.Instant

/** A task as it was at one revision (STUDY-017, DEC-020 C3): what a save of that revision is reviewed against. */
data class TaskRevision(
    val taskId: Long,
    val revision: Int,
    val title: String,
    val statement: String,
    val endpoint: String,
    val referenceGraphJson: String,
    val referenceRequestJson: String,
    val expected: ExpectedResult,
    val comparison: Comparison,
    val maxResults: Int,
    val savedAt: Instant,
)

/** One participant's last save on one task, with what the admin review lists beside it (DEC-020 points 2–3, C9). */
data class LastSave(
    val submission: Submission,
    val username: String,
    val taskKey: String,
    val taskTitle: String,
    /** How many times the participant saved an answer to the task, at any revision. */
    val saves: Int,
    /** The participant made the final submission (STUDY-005). */
    val finished: Boolean,
)

/** The admin-only hint of the automatic check (DEC-020): not a grade. [wire] is the exported spelling. */
enum class AutoCheckHint {
    MATCH,
    NO_MATCH,

    /** No query of the answer could run, so nothing was compared. */
    NOT_CHECKED,
    ;

    val wire: String get() = name.lowercase()

    companion object {
        fun of(check: AnswerCheck): AutoCheckHint =
            when {
                check.match -> MATCH
                check is AnswerCheck.ByVariable && check.invalid -> NOT_CHECKED
                else -> NO_MATCH
            }
    }
}

/** A last save under its participant's pseudonym (C10). */
data class ReviewedSave(
    val pseudonym: String,
    val save: LastSave,
) {
    val hint: AutoCheckHint get() = AutoCheckHint.of(save.submission.check)
}

/** A save with the reference of its revision; [reference] is null when that revision was not kept (C3). */
data class SaveReview(
    val save: ReviewedSave,
    val reference: TaskRevision?,
)

/**
 * Storage port for the admin review. Implementations throw
 * [com.example.sparqlqueryeasy.application.persistence.PersistenceUnavailableException] when the database
 * cannot be used.
 */
interface SubmissionReviewStore {
    /** The last save (latest createdAt, then id) of every user and task with a save. */
    suspend fun lastSaves(): List<LastSave>

    /** [lastSaves] restricted to the save with this id; null when it is not the last save of its user and task. */
    suspend fun lastSave(submissionId: Long): LastSave?

    /** When each user with a save first saved an answer to any task. */
    suspend fun firstSaves(): Map<Long, Instant>

    suspend fun revision(
        taskId: Long,
        revision: Int,
    ): TaskRevision?
}

/**
 * The admin review of saved answers (STUDY-017, DEC-020). Participants appear under a pseudonym: `P` and their
 * position, three digits or more, by the time of their first save among the users with a save. A first save never
 * changes, so pseudonyms stay stable while the study goes on and new participants only add higher numbers (C10).
 */
class SubmissionReviewService(private val store: SubmissionReviewStore) {
    /** Every last save, by pseudonym and task key. */
    suspend fun list(): List<ReviewedSave> {
        val pseudonyms = pseudonyms()
        return store.lastSaves()
            .map { ReviewedSave(pseudonyms.getValue(it.submission.userId), it) }
            .sortedWith(compareBy({ it.pseudonym.length }, { it.pseudonym }, { it.save.taskKey }))
    }

    /** The last save with this id and its revision's reference; null when [submissionId] is no last save. */
    suspend fun review(submissionId: Long): SaveReview? {
        val save = store.lastSave(submissionId) ?: return null
        val submission = save.submission
        val pseudonym = pseudonyms().getValue(submission.userId)
        return SaveReview(ReviewedSave(pseudonym, save), store.revision(submission.taskId, submission.taskRevision))
    }

    /** The reference of [save]'s revision, or null when it was not kept. */
    suspend fun reference(save: LastSave): TaskRevision? {
        val submission = save.submission
        return store.revision(submission.taskId, submission.taskRevision)
    }

    private suspend fun pseudonyms(): Map<Long, String> =
        store.firstSaves().entries
            .sortedWith(compareBy({ it.value }, { it.key }))
            .mapIndexed { index, (userId, _) -> userId to pseudonym(index + 1) }
            .toMap()

    companion object {
        fun pseudonym(position: Int): String = "P" + position.toString().padStart(PSEUDONYM_DIGITS, '0')

        private const val PSEUDONYM_DIGITS = 3
    }
}

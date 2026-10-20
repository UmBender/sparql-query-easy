package com.example.sparqlqueryeasy.application.study

import com.example.sparqlqueryeasy.domain.model.RdfValue
import java.time.Instant

/** The result of a valid attempt: the comparison and the answer variable's terms, one per result row. */
data class AttemptResult(
    val outcome: ComparisonOutcome,
    val values: List<RdfValue>,
    /** The answer returned more rows than the task's cap; it is incorrect whatever the counts say. */
    val truncated: Boolean,
)

/** One stored attempt (STUDY-004). [result] is null for an invalid attempt (the query did not run). */
data class Submission(
    val id: Long,
    val userId: Long,
    val taskId: Long,
    val taskRevision: Int,
    /** The drawn graph and the request derived from it, as the client sent them (DEC-014 Q5). */
    val graphJson: String,
    val requestJson: String,
    val answerVariable: String,
    val sparql: String?,
    val result: AttemptResult?,
    val correct: Boolean,
    val feedback: String,
    val createdAt: Instant,
    val timeSpentMillis: Long,
) {
    val invalid: Boolean get() = result == null
}

/**
 * Storage port for attempts. Implementations throw
 * [com.example.sparqlqueryeasy.application.persistence.PersistenceUnavailableException] when the database
 * cannot be used.
 */
interface StudySubmissionStore {
    /** Stores [submission] (its id is ignored) and returns it with its id. */
    suspend fun add(submission: Submission): Submission

    /** The user's attempts at the task, oldest first. */
    suspend fun list(
        userId: Long,
        taskId: Long,
    ): List<Submission>
}

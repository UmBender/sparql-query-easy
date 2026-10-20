package com.example.sparqlqueryeasy.persistence

import com.example.sparqlqueryeasy.application.study.AttemptResult
import com.example.sparqlqueryeasy.application.study.ComparisonOutcome
import com.example.sparqlqueryeasy.application.study.StudySubmissionStore
import com.example.sparqlqueryeasy.application.study.Submission
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.v1.core.ReferenceOption
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.javatime.timestamp
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll

internal object StudySubmissions : Table("study_submission") {
    val id = long("id").autoIncrement()
    val userId = long("user_id").references(AppUsers.id, onDelete = ReferenceOption.CASCADE)
    val taskId = long("task_id").references(StudyTasks.id)
    val taskRevision = integer("task_revision")
    val graph = jsonb("graph")
    val request = jsonb("request")
    val sparql = text("sparql").nullable()
    val answerVariable = varchar("answer_variable", 64)
    val resultSummary = jsonb("result_summary").nullable()
    val correct = bool("correct")
    val feedback = text("feedback")
    val invalid = bool("invalid")
    val createdAt = timestamp("created_at")
    val timeSpentMs = long("time_spent_ms")
    override val primaryKey = PrimaryKey(id)
}

/** The stored form of [AttemptResult]. */
@Serializable
private data class StoredResult(
    val correct: Boolean,
    val matched: Int,
    val missing: Int,
    val extra: Int,
    val expectedCount: Int,
    val truncated: Boolean,
    val values: List<StoredTerm>,
)

/** [StudySubmissionStore] on the migrated PostgreSQL database (V7__study_submissions.sql). */
class PostgresStudySubmissionStore(private val connector: DatabaseConnector) : StudySubmissionStore {
    override suspend fun add(submission: Submission): Submission =
        connector.inTransaction {
            val id =
                StudySubmissions.insert {
                    it[userId] = submission.userId
                    it[taskId] = submission.taskId
                    it[taskRevision] = submission.taskRevision
                    it[graph] = submission.graphJson
                    it[request] = submission.requestJson
                    it[sparql] = submission.sparql
                    it[answerVariable] = submission.answerVariable
                    it[resultSummary] = submission.result?.let { result -> storedJson.encodeToString(result.stored()) }
                    it[correct] = submission.correct
                    it[feedback] = submission.feedback
                    it[invalid] = submission.invalid
                    it[createdAt] = submission.createdAt
                    it[timeSpentMs] = submission.timeSpentMillis
                }[StudySubmissions.id]
            submission.copy(id = id)
        }

    override suspend fun list(
        userId: Long,
        taskId: Long,
    ): List<Submission> =
        connector.inTransaction {
            StudySubmissions.selectAll()
                .where { (StudySubmissions.userId eq userId) and (StudySubmissions.taskId eq taskId) }
                .orderBy(StudySubmissions.createdAt to SortOrder.ASC, StudySubmissions.id to SortOrder.ASC)
                .map { it.toSubmission() }
        }

    private fun AttemptResult.stored() =
        StoredResult(
            outcome.correct,
            outcome.matched,
            outcome.missing,
            outcome.extra,
            outcome.expectedCount,
            truncated,
            values.map(StoredTerm::of),
        )

    private fun ResultRow.toSubmission(): Submission {
        val result =
            this[StudySubmissions.resultSummary]?.let { json ->
                val stored = storedJson.decodeFromString<StoredResult>(json)
                val outcome = with(stored) { ComparisonOutcome(correct, matched, missing, extra, expectedCount) }
                AttemptResult(
                    outcome,
                    stored.values.map(StoredTerm::toRdfValue),
                    stored.truncated,
                )
            }
        return Submission(
            id = this[StudySubmissions.id],
            userId = this[StudySubmissions.userId],
            taskId = this[StudySubmissions.taskId],
            taskRevision = this[StudySubmissions.taskRevision],
            graphJson = this[StudySubmissions.graph],
            requestJson = this[StudySubmissions.request],
            answerVariable = this[StudySubmissions.answerVariable],
            sparql = this[StudySubmissions.sparql],
            result = result,
            correct = this[StudySubmissions.correct],
            feedback = this[StudySubmissions.feedback],
            createdAt = this[StudySubmissions.createdAt],
            timeSpentMillis = this[StudySubmissions.timeSpentMs],
        )
    }
}

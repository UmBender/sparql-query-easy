package com.example.sparqlqueryeasy.persistence

import com.example.sparqlqueryeasy.application.study.AnswerCheck
import com.example.sparqlqueryeasy.application.study.AttemptResult
import com.example.sparqlqueryeasy.application.study.ComparisonOutcome
import com.example.sparqlqueryeasy.application.study.StudySubmissionStore
import com.example.sparqlqueryeasy.application.study.Submission
import com.example.sparqlqueryeasy.application.study.VariableCheck
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.v1.core.ReferenceOption
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.max
import org.jetbrains.exposed.v1.javatime.timestamp
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.time.Instant

internal object StudySubmissions : Table("study_submission") {
    val id = long("id").autoIncrement()
    val userId = long("user_id").references(AppUsers.id, onDelete = ReferenceOption.CASCADE)
    val taskId = long("task_id").references(StudyTasks.id)
    val taskRevision = integer("task_revision")
    val graph = jsonb("graph")
    val request = jsonb("request")
    val sparql = text("sparql").nullable()
    val answerVariable = varchar("answer_variable", 64).nullable()
    val resultSummary = jsonb("result_summary").nullable()
    val correct = bool("correct")
    val feedback = text("feedback")
    val invalid = bool("invalid")
    val createdAt = timestamp("created_at")
    val timeSpentMs = long("time_spent_ms")
    val autoCheck = jsonb("auto_check").nullable()
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

@Serializable
private data class StoredVariableCheck(
    val variable: String,
    val sparql: String?,
    val diagnostic: String?,
    val result: StoredResult?,
)

/** The stored form of [AnswerCheck] (V12__study_answer_check.sql). */
@Serializable
private data class StoredCheck(
    val kind: String,
    val missing: Int? = null,
    val extra: Int? = null,
    val variables: List<StoredVariableCheck> = emptyList(),
    val unchecked: List<String> = emptyList(),
)

private const val STRUCTURAL = "structural"
private const val VARIABLES = "variables"
private const val COULD_NOT_RUN = "The query could not run: "

/**
 * [StudySubmissionStore] on the migrated PostgreSQL database (V7__study_submissions.sql, V12). The summary columns
 * (correct, invalid, feedback, answer_variable, sparql, result_summary) are derived from the check; rows saved before
 * V12 have no auto_check and are read back from those columns as a single-variable check.
 */
class PostgresStudySubmissionStore(private val connector: DatabaseConnector) : StudySubmissionStore {
    override suspend fun add(submission: Submission): Submission =
        connector.inTransaction {
            val check = submission.check
            val primary = (check as? AnswerCheck.ByVariable)?.primary
            val id =
                StudySubmissions.insert {
                    it[userId] = submission.userId
                    it[taskId] = submission.taskId
                    it[taskRevision] = submission.taskRevision
                    it[graph] = submission.graphJson
                    it[request] = submission.requestJson
                    it[sparql] = primary?.sparql
                    it[answerVariable] = primary?.variable
                    it[resultSummary] = primary?.result?.let { result -> storedJson.encodeToString(result.stored()) }
                    it[correct] = check.match
                    it[feedback] = check.summary
                    it[invalid] = (check as? AnswerCheck.ByVariable)?.invalid ?: false
                    it[createdAt] = submission.createdAt
                    it[timeSpentMs] = submission.timeSpentMillis
                    it[autoCheck] = storedJson.encodeToString(check.stored())
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

    override suspend fun lastSaveByTask(userId: Long): Map<Long, Instant> =
        connector.inTransaction {
            val last = StudySubmissions.createdAt.max()
            StudySubmissions.select(StudySubmissions.taskId, last)
                .where { StudySubmissions.userId eq userId }
                .groupBy(StudySubmissions.taskId)
                .associate { it[StudySubmissions.taskId] to checkNotNull(it[last]) }
        }
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

private fun StoredResult.toAttemptResult() =
    AttemptResult(
        ComparisonOutcome(correct, matched, missing, extra, expectedCount),
        values.map(StoredTerm::toRdfValue),
        truncated,
    )

private fun AnswerCheck.stored(): StoredCheck =
    when (this) {
        is AnswerCheck.Structural -> StoredCheck(STRUCTURAL, missing = missing, extra = extra)
        is AnswerCheck.ByVariable ->
            StoredCheck(
                VARIABLES,
                variables =
                    variables.map {
                        StoredVariableCheck(it.variable, it.sparql, it.diagnostic, it.result?.stored())
                    },
                unchecked = unchecked,
            )
    }

private fun StoredCheck.toCheck(): AnswerCheck =
    when (kind) {
        STRUCTURAL -> AnswerCheck.Structural(checkNotNull(missing), checkNotNull(extra))
        else ->
            AnswerCheck.ByVariable(
                variables.map {
                    VariableCheck(it.variable, it.sparql, it.result?.toAttemptResult(), it.diagnostic)
                },
                unchecked,
            )
    }

/** A row saved before V12: one chosen answer variable, its result, or the failure in feedback. */
private fun ResultRow.legacyCheck(): AnswerCheck {
    val result =
        this[StudySubmissions.resultSummary]?.let { json ->
            storedJson.decodeFromString<StoredResult>(json).toAttemptResult()
        }
    val diagnostic = this[StudySubmissions.feedback].takeIf { result == null }?.removePrefix(COULD_NOT_RUN)
    val variable =
        checkNotNull(this[StudySubmissions.answerVariable]) { "A row saved before V12 has an answer variable" }
    val sparql = this[StudySubmissions.sparql]
    return AnswerCheck.ByVariable(listOf(VariableCheck(variable, sparql, result, diagnostic)))
}

internal fun ResultRow.toSubmission(): Submission =
    Submission(
        id = this[StudySubmissions.id],
        userId = this[StudySubmissions.userId],
        taskId = this[StudySubmissions.taskId],
        taskRevision = this[StudySubmissions.taskRevision],
        graphJson = this[StudySubmissions.graph],
        requestJson = this[StudySubmissions.request],
        check =
            this[StudySubmissions.autoCheck]?.let { storedJson.decodeFromString<StoredCheck>(it).toCheck() }
                ?: legacyCheck(),
        createdAt = this[StudySubmissions.createdAt],
        timeSpentMillis = this[StudySubmissions.timeSpentMs],
    )

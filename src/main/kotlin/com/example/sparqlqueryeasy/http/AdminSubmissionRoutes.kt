@file:OptIn(io.ktor.utils.io.ExperimentalKtorApi::class)

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.study.AnswerCheck
import com.example.sparqlqueryeasy.application.study.ReviewedSave
import com.example.sparqlqueryeasy.application.study.SubmissionReviewService
import com.example.sparqlqueryeasy.application.study.TaskRevision
import com.example.sparqlqueryeasy.application.study.VariableCheck
import io.ktor.http.HttpStatusCode
import io.ktor.openapi.JsonSchema
import io.ktor.openapi.jsonSchema
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.openapi.describe
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

@Serializable
data class AdminSubmissionSummaryHttpResponse(
    @JsonSchema.Description("The save's id; GET /api/admin/submissions/{id} reads it.")
    val id: Long,
    @JsonSchema.Description(
        "The pseudonym (DEC-020 C10): P and the participant's position, at least three digits, by the time of " +
            "their first save. Stable while the study goes on.",
    )
    val participant: String,
    @JsonSchema.Description("The account behind the pseudonym; shown only on the admin review, never exported.")
    val username: String,
    val taskKey: String,
    val taskTitle: String,
    val taskRevision: Int,
    val savedAt: String,
    @JsonSchema.Description("Milliseconds since the participant first opened the task, measured on the server.")
    val timeSpentMs: Long,
    @JsonSchema.Description("How many times the participant saved an answer to the task; this is the last one.")
    val saves: Int,
    @JsonSchema.Description("The participant made the final submission (STUDY-005).")
    val finished: Boolean,
    @JsonSchema.Description("The automatic check's hint for the researcher, not a grade (DEC-020).")
    @JsonSchema.Enum("match", "no_match", "not_checked")
    val autoCheck: String,
)

@Serializable
data class VariableCheckHttpResponse(
    @JsonSchema.Description("The variable with its ?.")
    val variable: String,
    @JsonSchema.Description("The SPARQL generated for this variable; null when no query could be built.")
    val sparql: String?,
    val match: Boolean,
    @JsonSchema.Description("Why the query could not run; null when it ran.")
    val diagnostic: String?,
    @JsonSchema.Description("The variable's typed terms, one per result row; empty when the query did not run.")
    val values: List<RdfTermHttp>,
    val truncated: Boolean,
    val matched: Int?,
    val missing: Int?,
    val extra: Int?,
    val expectedCount: Int?,
)

@Serializable
data class AnswerCheckHttpResponse(
    @JsonSchema.Description(
        "structural: an answer without variables, its triples compared as a set with the reference's (C1); " +
            "variables: each checked variable run and compared with the expected values (C2).",
    )
    @JsonSchema.Enum("structural", "variables")
    val kind: String,
    @JsonSchema.Enum("match", "no_match", "not_checked")
    val hint: String,
    val summary: String,
    @JsonSchema.Description("Structural only: reference triples the answer lacks.")
    val missing: Int?,
    @JsonSchema.Description("Structural only: answer triples the reference lacks.")
    val extra: Int?,
    val variables: List<VariableCheckHttpResponse>,
    @JsonSchema.Description("Variables beyond the checked ones, not run.")
    val unchecked: List<String>,
)

@Serializable
data class TaskRevisionHttpResponse(
    val revision: Int,
    val title: String,
    val statement: String,
    val endpoint: String,
    val referenceGraph: JsonObject,
    val referenceQuery: AnswerQueryHttpRequest,
    val referenceSparql: String,
    val expected: List<RdfTermHttp>,
    val comparison: String,
    val maxResults: Int,
    val savedAt: String,
)

@Serializable
data class AdminSubmissionHttpResponse(
    val summary: AdminSubmissionSummaryHttpResponse,
    @JsonSchema.Description("The saved diagram (formatVersion 1), as the participant's editor sent it.")
    val graph: JsonObject,
    @JsonSchema.Description("The request the participant's editor derived from the diagram.")
    val query: AnswerQueryHttpRequest,
    val check: AnswerCheckHttpResponse,
    @JsonSchema.Description(
        "The task as it was at the save's revision; null when that revision was not kept (saved before STUDY-017).",
    )
    val reference: TaskRevisionHttpResponse?,
)

/** STUDY-017 (DEC-020): the last saved answer of each participant and task, beside its revision's reference. */
internal fun Route.adminSubmissionRoutes(
    auth: AuthHttpDependencies,
    reviews: SubmissionReviewService,
) {
    get("/api/admin/submissions") {
        adminRead(auth) { call.respond(DataResponse(reviews.list().map { it.toSummaryResponse() })) }
    }.documentAdminListSubmissions()
    get("/api/admin/submissions/{id}") {
        adminRead(auth) {
            val review = call.parameters["id"]?.toLongOrNull()?.let { reviews.review(it) }
            if (review == null) {
                call.respond(HttpStatusCode.NotFound, ErrorResponse("Saved answer not found"))
            } else {
                val submission = review.save.save.submission
                call.respond(
                    DataResponse(
                        AdminSubmissionHttpResponse(
                            summary = review.save.toSummaryResponse(),
                            graph = parseJsonObject(submission.graphJson),
                            query = lenientJson.decodeFromString(submission.requestJson),
                            check = submission.check.toResponse(review.save),
                            reference = review.reference?.toResponse(),
                        ),
                    ),
                )
            }
        }
    }.documentAdminGetSubmission()
}

internal fun ReviewedSave.toSummaryResponse(): AdminSubmissionSummaryHttpResponse {
    val submission = save.submission
    return AdminSubmissionSummaryHttpResponse(
        id = submission.id,
        participant = pseudonym,
        username = save.username,
        taskKey = save.taskKey,
        taskTitle = save.taskTitle,
        taskRevision = submission.taskRevision,
        savedAt = submission.createdAt.toString(),
        timeSpentMs = submission.timeSpentMillis,
        saves = save.saves,
        finished = save.finished,
        autoCheck = hint.wire,
    )
}

private fun AnswerCheck.toResponse(save: ReviewedSave): AnswerCheckHttpResponse =
    when (this) {
        is AnswerCheck.Structural ->
            AnswerCheckHttpResponse("structural", save.hint.wire, summary, missing, extra, emptyList(), emptyList())
        is AnswerCheck.ByVariable ->
            AnswerCheckHttpResponse(
                "variables",
                save.hint.wire,
                summary,
                null,
                null,
                variables.map { it.toResponse() },
                unchecked,
            )
    }

private fun VariableCheck.toResponse(): VariableCheckHttpResponse {
    val outcome = result?.outcome
    return VariableCheckHttpResponse(
        variable = variable,
        sparql = sparql,
        match = match,
        diagnostic = diagnostic,
        values = result?.values.orEmpty().map { it.toTermResponse() },
        truncated = result?.truncated ?: false,
        matched = outcome?.matched,
        missing = outcome?.missing,
        extra = outcome?.extra,
        expectedCount = outcome?.expectedCount,
    )
}

private fun TaskRevision.toResponse() =
    TaskRevisionHttpResponse(
        revision = revision,
        title = title,
        statement = statement,
        endpoint = endpoint,
        referenceGraph = parseJsonObject(referenceGraphJson),
        referenceQuery = lenientJson.decodeFromString(referenceRequestJson),
        referenceSparql = expected.sparql,
        expected = expected.values.map { it.toTermResponse() },
        comparison = comparison.wire,
        maxResults = maxResults,
        savedAt = savedAt.toString(),
    )

private const val SUBMISSION_ADMIN_NOTE = "Requires the admin role (401 without a session, 403 for a participant)."

private fun Route.documentAdminListSubmissions(): Route =
    describe {
        operationId = "adminListSubmissions"
        summary = "List the last saved answers"
        description =
            "The last save of every participant and task with a save (DEC-020 points 3 and 4, C9), by pseudonym " +
            "and task key, with the account behind each pseudonym. $SUBMISSION_ADMIN_NOTE"
        tag("Admin")
        responses {
            HttpStatusCode.OK {
                description = "The last saves."
                schema = jsonSchema<DataResponse<List<AdminSubmissionSummaryHttpResponse>>>()
            }
            readErrors()
        }
    }

private fun Route.documentAdminGetSubmission(): Route =
    describe {
        operationId = "adminGetSubmission"
        summary = "Review a last saved answer"
        description =
            "The saved diagram and request, the automatic check with each variable's SPARQL and values, and the " +
            "task as it was at the save's revision (DEC-020 C3). $SUBMISSION_ADMIN_NOTE"
        tag("Admin")
        responses {
            HttpStatusCode.OK {
                description = "The saved answer and its reference."
                schema = jsonSchema<DataResponse<AdminSubmissionHttpResponse>>()
            }
            HttpStatusCode.NotFound {
                description = "No last save has this id (an earlier save is not reviewed)."
                schema = jsonSchema<ErrorResponse>()
            }
            readErrors()
        }
    }

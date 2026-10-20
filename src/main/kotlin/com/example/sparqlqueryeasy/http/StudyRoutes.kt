package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.auth.User
import com.example.sparqlqueryeasy.application.study.StudyService
import com.example.sparqlqueryeasy.application.study.StudyTask
import com.example.sparqlqueryeasy.application.study.Submission
import io.ktor.http.HttpStatusCode
import io.ktor.openapi.JsonSchema
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.RoutingContext
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

@Serializable
data class StudyTaskSummaryHttpResponse(
    val key: String,
    val title: String,
    val summary: String,
)

/** A task as a participant sees it: never the reference query, its SPARQL or the expected result. */
@Serializable
data class StudyTaskHttpResponse(
    val key: String,
    val title: String,
    val statement: String,
    val endpoint: String,
    val startingGraph: JsonObject?,
)

/** One attempt as its author sees it: verdict, feedback and counts, never the expected values (DEC-014 Q2). */
@Serializable
data class StudySubmissionHttpResponse(
    @JsonSchema.Description("1 for the user's first attempt at the task, then 2, 3, …")
    val attempt: Int,
    val correct: Boolean,
    @JsonSchema.Description("The query could not be built or run; the counts are null.")
    val invalid: Boolean,
    val feedback: String,
    val matched: Int?,
    val missing: Int?,
    val extra: Int?,
    val expectedCount: Int?,
    val taskRevision: Int,
    @JsonSchema.Description("Milliseconds since the user first opened the task, measured on the server.")
    val timeSpentMs: Long,
    val createdAt: String,
)

/** The participant's study API (STUDY-003…005); every path below /api/study requires a session. */
internal fun Route.studyRoutes(
    auth: AuthHttpDependencies,
    study: StudyHttpDependencies?,
) {
    study?.let { participantTaskRoutes(auth, it.study) }
    route("/api/study/{...}") {
        handle {
            accountsAvailable {
                withSession(auth) { _, _ -> call.respond(HttpStatusCode.NotFound, ErrorResponse("Not found")) }
            }
        }
    }.also(::hideFromOpenApi)
}

private fun Route.participantTaskRoutes(
    auth: AuthHttpDependencies,
    study: StudyService,
) {
    route("/api/study/tasks") {
        get {
            participantRead(auth) { user -> call.respond(DataResponse(study.tasks(user.id).map { it.toSummary() })) }
        }.documentStudyListTasks()
        get("{key}") {
            participantRead(auth) { user ->
                val task = study.open(user.id, call.parameters["key"].orEmpty())
                if (task == null) studyTaskNotFound() else call.respond(DataResponse(task.toParticipantResponse()))
            }
        }.documentStudyGetTask()
        post("{key}/submissions") {
            participantWrite(auth) { user ->
                val key = call.parameters["key"].orEmpty()
                val answer = receiveLenient<DrawnQueryHttpRequest>().toDrawnQuery("answer")
                val submission = study.submit(user.id, key, answer)
                if (submission == null) {
                    studyTaskNotFound()
                } else {
                    val attempt = study.attempts(user.id, key).orEmpty().size
                    call.respond(HttpStatusCode.Created, DataResponse(submission.toResponse(attempt)))
                }
            }
        }.documentStudySubmit()
    }
    get("/api/study/submissions") {
        participantRead(auth) { user ->
            val key = call.request.queryParameters["task"]
            val attempts = key?.let { study.attempts(user.id, it) }
            when {
                key == null -> call.respond(HttpStatusCode.BadRequest, ErrorResponse("Missing query parameter: task"))
                attempts == null -> studyTaskNotFound()
                else ->
                    call.respond(DataResponse(attempts.mapIndexed { index, item -> item.toResponse(index + 1) }))
            }
        }
    }.documentStudyListSubmissions()
}

/** A study POST: same-origin JSON, the session, and 400 for an invalid body. */
internal suspend fun RoutingContext.participantWrite(
    auth: AuthHttpDependencies,
    block: suspend RoutingContext.(User) -> Unit,
) {
    sameOriginJson { participantRead(auth) { user -> validRequest { block(user) } } }
}

private fun Submission.toResponse(attempt: Int) =
    StudySubmissionHttpResponse(
        attempt = attempt,
        correct = correct,
        invalid = invalid,
        feedback = feedback,
        matched = result?.outcome?.matched,
        missing = result?.outcome?.missing,
        extra = result?.outcome?.extra,
        expectedCount = result?.outcome?.expectedCount,
        taskRevision = taskRevision,
        timeSpentMs = timeSpentMillis,
        createdAt = createdAt.toString(),
    )

/** A study GET: the session, with the persistence-unavailable answer. */
internal suspend fun RoutingContext.participantRead(
    auth: AuthHttpDependencies,
    block: suspend RoutingContext.(User) -> Unit,
) {
    accountsAvailable { withSession(auth) { user, _ -> block(user) } }
}

internal suspend fun RoutingContext.studyTaskNotFound() {
    call.respond(HttpStatusCode.NotFound, ErrorResponse("Task not found"))
}

private const val SUMMARY_LENGTH = 160

private fun StudyTask.toSummary(): StudyTaskSummaryHttpResponse {
    val firstParagraph = statement.substringBefore("\n\n").replace(Regex("\\s+"), " ").trim()
    val summary =
        if (firstParagraph.length <= SUMMARY_LENGTH) firstParagraph else firstParagraph.take(SUMMARY_LENGTH - 1) + "…"
    return StudyTaskSummaryHttpResponse(key, title, summary)
}

private fun StudyTask.toParticipantResponse() =
    StudyTaskHttpResponse(
        key = key,
        title = title,
        statement = statement,
        endpoint = endpoint,
        startingGraph = startingGraphJson?.let { lenientJson.parseToJsonElement(it) as JsonObject },
    )

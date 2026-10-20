package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.auth.User
import com.example.sparqlqueryeasy.application.study.StudyService
import com.example.sparqlqueryeasy.application.study.StudyTask
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.RoutingContext
import io.ktor.server.routing.get
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
    }
}

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

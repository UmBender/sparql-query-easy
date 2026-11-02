package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.auth.User
import com.example.sparqlqueryeasy.application.study.StudyService
import com.example.sparqlqueryeasy.application.study.StudyTask
import com.example.sparqlqueryeasy.application.study.Submission
import com.example.sparqlqueryeasy.application.study.TaskProgress
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
    @JsonSchema.Description(
        "The caller's own progress (DEC-020 C8): not_started (nothing saved) or answered (an answer saved at any " +
            "revision of the task). Never correctness; other users' saves never count.",
    )
    @JsonSchema.Enum("not_started", "answered")
    val status: String,
    @JsonSchema.Description("When the caller last saved an answer to the task; null when not_started.")
    val lastSavedAt: String?,
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

/**
 * One saved answer as its author sees it (STUDY-016, DEC-020): when it was saved, never a verdict, counts or
 * whether its query could run. The automatic check is for the admin only.
 */
@Serializable
data class StudySubmissionHttpResponse(
    @JsonSchema.Description("1 for the user's first save of the task, then 2, 3, …; the last save is the answer.")
    val save: Int,
    val taskRevision: Int,
    @JsonSchema.Description("Milliseconds since the user first opened the task, measured on the server.")
    val timeSpentMs: Long,
    val savedAt: String,
)

@Serializable
data class StudyFinishHttpResponse(val finishedAt: String)

/** The participant's study API (STUDY-003…005, STUDY-008); every path below /api/study requires a session. */
internal fun Route.studyRoutes(
    auth: AuthHttpDependencies,
    study: StudyHttpDependencies?,
) {
    study?.let {
        consentRoutes(auth, it.consent)
        questionnaireRoutes(auth, it)
        participantTaskRoutes(auth, it)
    }
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
    dependencies: StudyHttpDependencies,
) {
    val study = dependencies.study
    route("/api/study/tasks") {
        get {
            studyOpen(auth, dependencies) { user ->
                call.respond(
                    DataResponse(study.tasksWithProgress(user.id).map { it.toSummary() }),
                )
            }
        }.documentStudyListTasks()
        get("{key}") {
            studyOpen(auth, dependencies) { user ->
                val task = study.open(user.id, call.parameters["key"].orEmpty())
                if (task == null) studyTaskNotFound() else call.respond(DataResponse(task.toParticipantResponse()))
            }
        }.documentStudyGetTask()
        post("{key}/submissions") {
            sameOriginJson {
                studyOpen(auth, dependencies) { user ->
                    if (dependencies.submissionLimiter.tryAcquire("user:${user.id}")) {
                        validRequest { submit(study, user) }
                    } else {
                        call.respond(HttpStatusCode.TooManyRequests, ErrorResponse(TOO_MANY_SUBMISSIONS))
                    }
                }
            }
        }.documentStudySubmit()
    }
    get("/api/study/submissions") {
        studyOpen(auth, dependencies) { user ->
            val key = call.request.queryParameters["task"]
            val saves = key?.let { study.saves(user.id, it) }
            when {
                key == null -> call.respond(HttpStatusCode.BadRequest, ErrorResponse("Missing query parameter: task"))
                saves == null -> studyTaskNotFound()
                else -> call.respond(DataResponse(saves.mapIndexed { index, item -> item.toResponse(index + 1) }))
            }
        }
    }.documentStudyListSubmissions()
    post("/api/study/finish") {
        sameOriginJson {
            readyForTasks(auth, dependencies) { user ->
                val finishedAt = study.finish(user.id)
                call.respond(DataResponse(StudyFinishHttpResponse(finishedAt.toString())))
            }
        }
    }.documentStudyFinish()
}

internal const val TOO_MANY_SUBMISSIONS = "Too many saves; try again in a minute"

private suspend fun RoutingContext.submit(
    study: StudyService,
    user: User,
) {
    val key = call.parameters["key"].orEmpty()
    val answer = receiveLenient<DrawnQueryHttpRequest>().toDrawnAnswer("answer")
    val submission = study.save(user.id, key, answer)
    if (submission == null) {
        studyTaskNotFound()
    } else {
        val save = study.saves(user.id, key).orEmpty().size
        call.respond(HttpStatusCode.Created, DataResponse(submission.toResponse(save)))
    }
}

/**
 * A proposed-query route: the session, the consent (STUDY-008) and the before-the-tasks questionnaire
 * (STUDY-010), then 403 once the user has made the final submission (STUDY-005, D6).
 */
private suspend fun RoutingContext.studyOpen(
    auth: AuthHttpDependencies,
    dependencies: StudyHttpDependencies,
    block: suspend RoutingContext.(User) -> Unit,
) {
    readyForTasks(auth, dependencies) { user ->
        if (dependencies.study.finishedAt(user.id) == null) {
            block(user)
        } else {
            call.respond(HttpStatusCode.Forbidden, ErrorResponse(STUDY_FINISHED))
        }
    }
}

private const val STUDY_FINISHED = "You have finished the study; the proposed queries are closed"

private fun Submission.toResponse(save: Int) =
    StudySubmissionHttpResponse(
        save = save,
        taskRevision = taskRevision,
        timeSpentMs = timeSpentMillis,
        savedAt = createdAt.toString(),
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

private fun TaskProgress.toSummary(): StudyTaskSummaryHttpResponse {
    val firstParagraph = task.statement.substringBefore("\n\n").replace(Regex("\\s+"), " ").trim()
    val summary =
        if (firstParagraph.length <= SUMMARY_LENGTH) firstParagraph else firstParagraph.take(SUMMARY_LENGTH - 1) + "…"
    return StudyTaskSummaryHttpResponse(task.key, task.title, summary, status.name.lowercase(), lastSavedAt?.toString())
}

private fun StudyTask.toParticipantResponse() =
    StudyTaskHttpResponse(
        key = key,
        title = title,
        statement = statement,
        endpoint = endpoint,
        startingGraph = startingGraphJson?.let { lenientJson.parseToJsonElement(it) as JsonObject },
    )

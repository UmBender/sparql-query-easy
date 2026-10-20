package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.auth.Role
import com.example.sparqlqueryeasy.application.auth.User
import com.example.sparqlqueryeasy.application.study.PreviewResult
import com.example.sparqlqueryeasy.application.study.StudyTaskService
import com.example.sparqlqueryeasy.application.study.TaskSaveResult
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.RoutingContext
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.put
import io.ktor.server.routing.route

/** The admin API (AUTH-005); every path below /api/admin needs the admin role. */
internal fun Route.adminRoutes(
    auth: AuthHttpDependencies,
    study: StudyHttpDependencies?,
) {
    study?.let { adminTaskRoutes(auth, it.tasks) }
    route("/api/admin/{...}") {
        handle {
            accountsAvailable {
                withAdmin(auth) { _ -> call.respond(HttpStatusCode.NotFound, ErrorResponse("Not found")) }
            }
        }
    }.also(::hideFromOpenApi)
}

/** STUDY-006: create, edit, preview, deactivate and reactivate proposed tasks. */
private fun Route.adminTaskRoutes(
    auth: AuthHttpDependencies,
    tasks: StudyTaskService,
) {
    route("/api/admin/tasks") {
        get {
            adminRead(auth) { call.respond(DataResponse(tasks.list().map { it.toSummaryResponse() })) }
        }.documentAdminListTasks()
        post {
            adminWrite(auth) {
                respondSaved(tasks.create(receiveLenient<AdminTaskHttpRequest>().toDraft()), HttpStatusCode.Created)
            }
        }.documentAdminCreateTask()
        post("preview") {
            adminWrite(auth) {
                val request = receiveLenient<TaskPreviewHttpRequest>()
                val reference = request.reference.toDrawnQuery("reference")
                when (val result = tasks.preview(request.endpoint.orEmpty(), reference, request.maxResults)) {
                    is PreviewResult.Invalid -> call.respond(HttpStatusCode.BadRequest, ErrorResponse(result.message))
                    is PreviewResult.Ready ->
                        call.respond(
                            DataResponse(
                                TaskPreviewHttpResponse(
                                    result.expected.sparql,
                                    result.expected.values.map { it.toTermResponse() },
                                    result.expected.values.distinct().size,
                                ),
                            ),
                        )
                }
            }
        }.documentAdminPreviewTask()
        get("{key}") {
            adminRead(auth) {
                val task = tasks.find(call.parameters["key"].orEmpty())
                if (task == null) taskNotFound() else call.respond(DataResponse(task.toAdminResponse()))
            }
        }.documentAdminGetTask()
        put("{key}") {
            adminWrite(auth) {
                val draft = receiveLenient<AdminTaskHttpRequest>().toDraft()
                respondSaved(tasks.update(call.parameters["key"].orEmpty(), draft), HttpStatusCode.OK)
            }
        }.documentAdminUpdateTask()
        listOf("deactivate" to false, "reactivate" to true).forEach { (action, active) ->
            post("{key}/$action") {
                adminWrite(auth) {
                    val task = tasks.setActive(call.parameters["key"].orEmpty(), active)
                    if (task == null) taskNotFound() else call.respond(DataResponse(task.toSummaryResponse()))
                }
            }.documentAdminSetActive(action, active)
        }
    }
}

private suspend fun RoutingContext.respondSaved(
    result: TaskSaveResult,
    created: HttpStatusCode,
) {
    when (result) {
        is TaskSaveResult.Saved -> call.respond(created, DataResponse(result.task.toAdminResponse()))
        is TaskSaveResult.Invalid -> call.respond(HttpStatusCode.BadRequest, ErrorResponse(result.message))
        TaskSaveResult.KeyTaken -> call.respond(HttpStatusCode.Conflict, ErrorResponse(KEY_TAKEN))
        TaskSaveResult.NotFound -> taskNotFound()
    }
}

private const val KEY_TAKEN = "A task with this key already exists"

private suspend fun RoutingContext.taskNotFound() {
    call.respond(HttpStatusCode.NotFound, ErrorResponse("Task not found"))
}

/** An admin GET: the session and role, with the persistence-unavailable answer. */
private suspend fun RoutingContext.adminRead(
    auth: AuthHttpDependencies,
    block: suspend RoutingContext.() -> Unit,
) {
    accountsAvailable { withAdmin(auth) { _ -> block() } }
}

/** An admin POST/PUT: same-origin JSON, the session and role, and 400 for an invalid body. */
private suspend fun RoutingContext.adminWrite(
    auth: AuthHttpDependencies,
    block: suspend RoutingContext.() -> Unit,
) {
    sameOriginJson { adminRead(auth) { validRequest(block) } }
}

/** Answers 400 with the message of an invalid request body. */
internal suspend fun RoutingContext.validRequest(block: suspend RoutingContext.() -> Unit) {
    try {
        block()
    } catch (failure: HttpRequestValidationFailure) {
        call.respond(HttpStatusCode.BadRequest, ErrorResponse(failure.message ?: "Invalid request"))
    }
}

/** Runs [block] for an admin; 401 without a session, 403 for a participant. */
internal suspend fun RoutingContext.withAdmin(
    auth: AuthHttpDependencies,
    block: suspend RoutingContext.(User) -> Unit,
) {
    withSession(auth) { user, _ ->
        if (user.role == Role.ADMIN) {
            block(user)
        } else {
            call.respond(HttpStatusCode.Forbidden, ErrorResponse("Admin role required"))
        }
    }
}

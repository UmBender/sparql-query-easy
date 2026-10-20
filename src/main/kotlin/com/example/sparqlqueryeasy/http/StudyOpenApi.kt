@file:OptIn(io.ktor.utils.io.ExperimentalKtorApi::class)
@file:Suppress("TooManyFunctions")

package com.example.sparqlqueryeasy.http

import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.openapi.Responses
import io.ktor.openapi.jsonSchema
import io.ktor.server.routing.Route
import io.ktor.server.routing.openapi.describe

private const val ADMIN_NOTE = "Requires the admin role (401 without a session, 403 for a participant)."
private const val WRITE_NOTE =
    "Same origin only: a mismatching Origin is rejected with 403 and a non-JSON body with 415. Unknown body " +
        "fields are ignored; expected rows are never read from the client."

internal fun Route.documentAdminListTasks(): Route =
    describe {
        operationId = "adminListTasks"
        summary = "List the proposed tasks"
        description = "Every task, active or not, ordered by key. $ADMIN_NOTE"
        tag("Admin")
        responses {
            HttpStatusCode.OK {
                description = "The tasks."
                schema = jsonSchema<DataResponse<List<AdminTaskSummaryHttpResponse>>>()
            }
            readErrors()
        }
    }

internal fun Route.documentAdminGetTask(): Route =
    describe {
        operationId = "adminGetTask"
        summary = "Read a proposed task"
        description = "The task with its reference query and the expected result the server stored. $ADMIN_NOTE"
        tag("Admin")
        responses {
            HttpStatusCode.OK {
                description = "The task."
                schema = jsonSchema<DataResponse<AdminTaskHttpResponse>>()
            }
            HttpStatusCode.NotFound {
                description = "No task has this key."
                schema = jsonSchema<ErrorResponse>()
            }
            readErrors()
        }
    }

internal fun Route.documentAdminCreateTask(): Route =
    describe {
        operationId = "adminCreateTask"
        summary = "Create a proposed task"
        description =
            "Runs the reference query on the task's endpoint with the result cap and stores its result as the " +
            "expected one (revision 1). A reference returning more than the cap is rejected. $ADMIN_NOTE $WRITE_NOTE"
        tag("Admin")
        requestBody {
            required = true
            ContentType.Application.Json { schema = jsonSchema<AdminTaskHttpRequest>() }
        }
        responses {
            HttpStatusCode.Created {
                description = "The task is stored."
                schema = jsonSchema<DataResponse<AdminTaskHttpResponse>>()
            }
            HttpStatusCode.Conflict {
                description = "A task with this key exists."
                schema = jsonSchema<ErrorResponse>()
            }
            writeErrors()
        }
    }

internal fun Route.documentAdminUpdateTask(): Route =
    describe {
        operationId = "adminUpdateTask"
        summary = "Edit a proposed task"
        description =
            "Replaces the task's fields (the key stays). The reference runs again when its request, the endpoint or " +
            "the cap changed; changing the statement, reference request, comparison, endpoint or cap increments " +
            "the revision, a title or layout change does not. $ADMIN_NOTE $WRITE_NOTE"
        tag("Admin")
        requestBody {
            required = true
            ContentType.Application.Json { schema = jsonSchema<AdminTaskHttpRequest>() }
        }
        responses {
            HttpStatusCode.OK {
                description = "The updated task."
                schema = jsonSchema<DataResponse<AdminTaskHttpResponse>>()
            }
            HttpStatusCode.NotFound {
                description = "No task has this key."
                schema = jsonSchema<ErrorResponse>()
            }
            writeErrors()
        }
    }

internal fun Route.documentAdminPreviewTask(): Route =
    describe {
        operationId = "adminPreviewTask"
        summary = "Run a reference query without saving"
        description = "The expected result a task with this reference would store. $ADMIN_NOTE $WRITE_NOTE"
        tag("Admin")
        requestBody {
            required = true
            ContentType.Application.Json { schema = jsonSchema<TaskPreviewHttpRequest>() }
        }
        responses {
            HttpStatusCode.OK {
                description = "The generated SPARQL and the answer variable's values."
                schema = jsonSchema<DataResponse<TaskPreviewHttpResponse>>()
            }
            writeErrors()
        }
    }

internal fun Route.documentAdminSetActive(
    action: String,
    active: Boolean,
): Route =
    describe {
        operationId = if (active) "adminReactivateTask" else "adminDeactivateTask"
        summary = if (active) "Reactivate a proposed task" else "Deactivate a proposed task"
        description =
            "Tasks are never deleted. An inactive task stays listed for admins and is hidden from participants. " +
            "The body is `{}`. $ADMIN_NOTE $WRITE_NOTE"
        tag("Admin")
        responses {
            HttpStatusCode.OK {
                description = "The task after the $action."
                schema = jsonSchema<DataResponse<AdminTaskSummaryHttpResponse>>()
            }
            HttpStatusCode.NotFound {
                description = "No task has this key."
                schema = jsonSchema<ErrorResponse>()
            }
            writeErrors()
        }
    }

internal fun Responses.Builder.readErrors() {
    HttpStatusCode.Unauthorized {
        description = "No valid session."
        schema = jsonSchema<ErrorResponse>()
    }
    HttpStatusCode.Forbidden {
        description = "The user lacks the role, or the request came from another site."
        schema = jsonSchema<ErrorResponse>()
    }
    HttpStatusCode.ServiceUnavailable {
        description = "The database is not configured or unreachable."
        schema = jsonSchema<ErrorResponse>()
    }
}

internal fun Responses.Builder.writeErrors() {
    HttpStatusCode.BadRequest {
        description = "Invalid or malformed body, or the query could not run."
        schema = jsonSchema<ErrorResponse>()
    }
    HttpStatusCode.UnsupportedMediaType {
        description = "The body is not application/json."
        schema = jsonSchema<ErrorResponse>()
    }
    readErrors()
}

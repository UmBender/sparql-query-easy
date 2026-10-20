@file:OptIn(io.ktor.utils.io.ExperimentalKtorApi::class)

package com.example.sparqlqueryeasy.http

import io.ktor.http.HttpStatusCode
import io.ktor.openapi.Responses
import io.ktor.openapi.jsonSchema
import io.ktor.server.routing.Route
import io.ktor.server.routing.openapi.describe

private const val SESSION_NOTE = "Requires a session (401 otherwise)."

internal fun Route.documentStudyListTasks(): Route =
    describe {
        operationId = "studyListTasks"
        summary = "List my proposed tasks"
        description =
            "The active tasks of the caller's group, in the group's order; empty without a group. $SESSION_NOTE"
        tag("Study")
        responses {
            HttpStatusCode.OK {
                description = "Key, title and a one-paragraph summary of the statement."
                schema = jsonSchema<DataResponse<List<StudyTaskSummaryHttpResponse>>>()
            }
            sessionErrors()
        }
    }

internal fun Route.documentStudyGetTask(): Route =
    describe {
        operationId = "studyGetTask"
        summary = "Open a proposed task"
        description =
            "The statement, endpoint and optional starting graph (formatVersion 1); never the reference query or " +
            "the expected result. The first open by the caller is recorded (time spent is measured from it). " +
            SESSION_NOTE
        tag("Study")
        responses {
            HttpStatusCode.OK {
                description = "The task."
                schema = jsonSchema<DataResponse<StudyTaskHttpResponse>>()
            }
            HttpStatusCode.NotFound {
                description = "No active task with this key in the caller's group."
                schema = jsonSchema<ErrorResponse>()
            }
            sessionErrors()
        }
    }

internal fun Responses.Builder.sessionErrors() {
    HttpStatusCode.Unauthorized {
        description = "No valid session."
        schema = jsonSchema<ErrorResponse>()
    }
    HttpStatusCode.ServiceUnavailable {
        description = "The database is not configured or unreachable."
        schema = jsonSchema<ErrorResponse>()
    }
}

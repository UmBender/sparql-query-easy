@file:OptIn(io.ktor.utils.io.ExperimentalKtorApi::class)

package com.example.sparqlqueryeasy.http

import io.ktor.http.ContentType
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

internal fun Route.documentStudySubmit(): Route =
    describe {
        operationId = "studySubmitAnswer"
        summary = "Submit a drawn query as an answer"
        description =
            "The body is the drawn graph (formatVersion 1) and the request derived from it, whose variableName is " +
            "the answer variable. The server runs it on the task's endpoint with the task's result cap, compares " +
            "with the stored expected result (set or multiset) and stores the attempt with the task revision and " +
            "the time since the first open. Attempts are unlimited. Unknown fields such as `correct` are ignored. " +
            "A query that cannot run is stored as an invalid attempt (201, invalid true). The response never " +
            "contains expected values. Same origin only (403) and JSON only (415). $SESSION_NOTE"
        tag("Study")
        requestBody {
            required = true
            ContentType.Application.Json { schema = jsonSchema<DrawnQueryHttpRequest>() }
        }
        responses {
            HttpStatusCode.Created {
                description = "The stored attempt."
                schema = jsonSchema<DataResponse<StudySubmissionHttpResponse>>()
            }
            HttpStatusCode.BadRequest {
                description = "Malformed body: missing graph or query, or a request that is not a query."
                schema = jsonSchema<ErrorResponse>()
            }
            HttpStatusCode.NotFound {
                description = "No active task with this key in the caller's group."
                schema = jsonSchema<ErrorResponse>()
            }
            HttpStatusCode.UnsupportedMediaType {
                description = "The body is not application/json."
                schema = jsonSchema<ErrorResponse>()
            }
            sessionErrors()
        }
    }

internal fun Route.documentStudyListSubmissions(): Route =
    describe {
        operationId = "studyListSubmissions"
        summary = "List my attempts at a task"
        description = "The caller's own attempts at the task given by `?task=<key>`, oldest first. $SESSION_NOTE"
        tag("Study")
        parameters {
            query("task") {
                description = "The task key."
                required = true
            }
        }
        responses {
            HttpStatusCode.OK {
                description = "The attempts."
                schema = jsonSchema<DataResponse<List<StudySubmissionHttpResponse>>>()
            }
            HttpStatusCode.BadRequest {
                description = "The task parameter is missing."
                schema = jsonSchema<ErrorResponse>()
            }
            HttpStatusCode.NotFound {
                description = "No task has this key."
                schema = jsonSchema<ErrorResponse>()
            }
            sessionErrors()
        }
    }

internal fun Route.documentStudyFinish(): Route =
    describe {
        operationId = "studyFinish"
        summary = "Make the final submission"
        description =
            "Ends the proposed queries for the caller (D6): afterwards every task and submission route answers 403. " +
            "Finishing again answers 200 with the first time. The body is `{}`. Same origin only (403) and JSON " +
            "only (415). $SESSION_NOTE"
        tag("Study")
        responses {
            HttpStatusCode.OK {
                description = "When the caller finished."
                schema = jsonSchema<DataResponse<StudyFinishHttpResponse>>()
            }
            HttpStatusCode.UnsupportedMediaType {
                description = "The body is not application/json."
                schema = jsonSchema<ErrorResponse>()
            }
            sessionErrors()
        }
    }

internal fun Responses.Builder.sessionErrors() {
    HttpStatusCode.Forbidden {
        description =
            "The caller has made the final submission (task and submission routes), or the request came from " +
            "another site."
        schema = jsonSchema<ErrorResponse>()
    }
    HttpStatusCode.Unauthorized {
        description = "No valid session."
        schema = jsonSchema<ErrorResponse>()
    }
    HttpStatusCode.ServiceUnavailable {
        description = "The database is not configured or unreachable."
        schema = jsonSchema<ErrorResponse>()
    }
}

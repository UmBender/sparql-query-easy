@file:OptIn(io.ktor.utils.io.ExperimentalKtorApi::class)

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.study.MAX_CHECKED_VARIABLES
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
                description = "Key, title, a one-paragraph summary of the statement and the caller's own status."
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
        summary = "Save a drawn answer"
        description =
            "STUDY-016 (DEC-020): the body is the drawn graph (formatVersion 1) and the request derived from it, " +
            "with any number of variables or none; variableName is not read and `where` may be empty. The server " +
            "stores the answer with the task revision, the time since the first open and an admin-only automatic " +
            "check: an answer without variables is compared with the reference as a set of triples; one with " +
            "variables runs each of its first $MAX_CHECKED_VARIABLES variables on the task's endpoint with the " +
            "task's result cap and compares its values with the expected result. A query that cannot run is " +
            "still saved (201). The response never tells correctness, counts, expected values or whether the " +
            "query ran. Saves have no total limit, but at most $SUBMISSIONS_PER_MINUTE a minute per user (429, " +
            "QUAL-023); the last save is the answer. Unknown fields such as `correct` are ignored. Same origin " +
            "only (403) and JSON only (415). $SESSION_NOTE"
        tag("Study")
        requestBody {
            required = true
            ContentType.Application.Json { schema = jsonSchema<DrawnQueryHttpRequest>() }
        }
        responses {
            HttpStatusCode.Created {
                description = "The saved answer: its number and when it was saved."
                schema = jsonSchema<DataResponse<StudySubmissionHttpResponse>>()
            }
            HttpStatusCode.BadRequest {
                description =
                    "Malformed body: missing graph or query, or a request that is not a query; text with U+0000, a " +
                    "variable over ${MAX_ANSWER_VARIABLE_LENGTH - 1} characters or JSON nested deeper than " +
                    "$MAX_JSON_DEPTH levels (QUAL-023)."
                schema = jsonSchema<ErrorResponse>()
            }
            HttpStatusCode.TooManyRequests {
                description = "More than $SUBMISSIONS_PER_MINUTE saves by this user in the last minute."
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
        summary = "List my saved answers to a task"
        description =
            "The caller's own saves of the task given by `?task=<key>`, oldest first, without any correctness " +
            "(DEC-020). $SESSION_NOTE"
        tag("Study")
        parameters {
            query("task") {
                description = "The task key."
                required = true
            }
        }
        responses {
            HttpStatusCode.OK {
                description = "The saves."
                schema = jsonSchema<DataResponse<List<StudySubmissionHttpResponse>>>()
            }
            HttpStatusCode.BadRequest {
                description = "The task parameter is missing."
                schema = jsonSchema<ErrorResponse>()
            }
            HttpStatusCode.NotFound {
                description = "No active task with this key in the caller's group (QUAL-019: as for an unknown key)."
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
            "`consent_required`: the caller has not accepted the current consent text (STUDY-008); " +
            "`profile_required`: the caller has not answered the before-the-tasks questionnaire (task and finish " +
            "routes, STUDY-010); or the caller has made the final submission (task and submission routes); or the " +
            "request came from another site."
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

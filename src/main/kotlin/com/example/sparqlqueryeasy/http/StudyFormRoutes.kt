@file:OptIn(io.ktor.utils.io.ExperimentalKtorApi::class)

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.auth.User
import com.example.sparqlqueryeasy.application.study.FormDefinition
import com.example.sparqlqueryeasy.application.study.FormSubmitResult
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.openapi.JsonSchema
import io.ktor.openapi.jsonSchema
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.RoutingContext
import io.ktor.server.routing.get
import io.ktor.server.routing.openapi.describe
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

/** A questionnaire's place in the study and whether the caller answered it. */
@Serializable
data class StudyFormSummaryHttpResponse(
    val slug: String,
    val title: String,
    val version: Int,
    @JsonSchema.Description(
        "before_tasks: answered before the proposed tasks open; after_finish: answered after the final submission.",
    )
    val phase: String?,
    @JsonSchema.Description("When the caller answered it; null when they have not.")
    val submittedAt: String?,
)

@Serializable
data class StudyFormResponseStatusHttpResponse(
    val answered: Boolean,
    val submittedAt: String?,
)

@Serializable
data class StudyFormAnswersHttpRequest(
    val version: Int? = null,
    @JsonSchema.Description("Question id -> answer: a string, an array of strings or a number; null is unanswered.")
    val answers: JsonObject? = null,
)

@Serializable
data class StudyFormSubmittedHttpResponse(
    val slug: String,
    val version: Int,
    val submittedAt: String,
)

/** A 400 for invalid answers: the error per question id, with the frontend's messages. */
@Serializable
data class StudyFormErrorsHttpResponse(
    val error: String,
    val errors: Map<String, String>,
)

/** The questionnaires (STUDY-009/010): definitions, the caller's responses and submitting one; consent first. */
internal fun Route.questionnaireRoutes(
    auth: AuthHttpDependencies,
    study: StudyHttpDependencies,
) {
    val questionnaires = study.questionnaires
    get("/api/study/forms") {
        consented(auth, study.consent) { user ->
            val phases =
                mapOf(questionnaires.flow.beforeTasks to BEFORE_TASKS, questionnaires.flow.afterFinish to AFTER_FINISH)
            val forms =
                questionnaires.currentForms().map { form ->
                    StudyFormSummaryHttpResponse(
                        slug = form.slug,
                        title = form.title,
                        version = form.version,
                        phase = phases[form.slug],
                        submittedAt = questionnaires.response(user.id, form.slug)?.submittedAt?.toString(),
                    )
                }
            call.respond(DataResponse(forms))
        }
    }.documentStudyListForms()
    route("/api/study/forms/{slug}") {
        get {
            consented(auth, study.consent) {
                val definition = questionnaires.current(call.parameters["slug"].orEmpty())
                if (definition == null) {
                    questionnaireNotFound()
                } else {
                    questionnaires.storedId(definition)
                    call.respond(DataResponse(definition))
                }
            }
        }.documentStudyGetForm()
        get("response") {
            consented(auth, study.consent) { user ->
                val slug = call.parameters["slug"].orEmpty()
                if (questionnaires.current(slug) == null) {
                    questionnaireNotFound()
                } else {
                    val response = questionnaires.response(user.id, slug)
                    val submittedAt = response?.submittedAt?.toString()
                    call.respond(DataResponse(StudyFormResponseStatusHttpResponse(response != null, submittedAt)))
                }
            }
        }.documentStudyFormResponseStatus()
        post("responses") {
            sameOriginJson { consented(auth, study.consent) { user -> validRequest { submitAnswers(study, user) } } }
        }.documentStudySubmitForm()
    }
}

private suspend fun RoutingContext.submitAnswers(
    study: StudyHttpDependencies,
    user: User,
) {
    val slug = call.parameters["slug"].orEmpty()
    val request = receiveLenient<StudyFormAnswersHttpRequest>()
    val answers = request.answers ?: throw HttpRequestValidationFailure("Missing required field: answers")
    val result =
        study.questionnaires.submit(
            userId = user.id,
            slug = slug,
            version = request.version,
            answers = answers,
            consentVersion = study.consent.current.version,
            finished = study.study.finishedAt(user.id) != null,
        )
    when (result) {
        is FormSubmitResult.Stored ->
            call.respond(
                HttpStatusCode.Created,
                DataResponse(
                    StudyFormSubmittedHttpResponse(
                        result.response.slug,
                        result.response.version,
                        result.response.submittedAt.toString(),
                    ),
                ),
            )
        is FormSubmitResult.Invalid ->
            call.respond(HttpStatusCode.BadRequest, StudyFormErrorsHttpResponse(INVALID_ANSWERS, result.errors))
        FormSubmitResult.NotFound -> questionnaireNotFound()
        FormSubmitResult.NotCurrent -> call.respond(HttpStatusCode.Conflict, ErrorResponse(NOT_CURRENT))
        FormSubmitResult.AlreadyAnswered -> call.respond(HttpStatusCode.Conflict, ErrorResponse(ALREADY_ANSWERED))
        FormSubmitResult.FinishRequired -> call.respond(HttpStatusCode.Forbidden, ErrorResponse(FINISH_REQUIRED))
    }
}

private suspend fun RoutingContext.questionnaireNotFound() {
    call.respond(HttpStatusCode.NotFound, ErrorResponse("Questionnaire not found"))
}

private const val BEFORE_TASKS = "before_tasks"
private const val AFTER_FINISH = "after_finish"
private const val INVALID_ANSWERS = "Some answers are not valid"
private const val NOT_CURRENT = "This is not the current version of the questionnaire; reload it"
private const val ALREADY_ANSWERED = "You have already answered this questionnaire"
internal const val FINISH_REQUIRED = "finish_required"

private fun Route.documentStudyListForms(): Route =
    describe {
        operationId = "studyListForms"
        summary = "List the questionnaires"
        description =
            "The current version of every questionnaire, its place in the study (DEC-015 Q3) and when the caller " +
            "answered it. Requires a session (401 otherwise) and the consent (403 `consent_required`)."
        tag("Study")
        responses {
            HttpStatusCode.OK {
                description = "The questionnaires."
                schema = jsonSchema<DataResponse<List<StudyFormSummaryHttpResponse>>>()
            }
            sessionErrors()
        }
    }

private fun Route.documentStudyGetForm(): Route =
    describe {
        operationId = "studyGetForm"
        summary = "Read a questionnaire"
        description =
            "The current version of the questionnaire: pages of questions of type single_choice, " +
            "multiple_choice, likert (1..scaleMax, default 5), short_text (maxLength ≤ 200), long_text " +
            "(maxLength ≤ 2000) or number (min, max, integer). Answers are checked on the server with the same " +
            "rules (STUDY-009). Requires a session (401 otherwise) and the consent (403 `consent_required`)."
        tag("Study")
        responses {
            HttpStatusCode.OK {
                description = "The definition."
                schema = jsonSchema<DataResponse<FormDefinition>>()
            }
            HttpStatusCode.NotFound {
                description = "No questionnaire has this slug."
                schema = jsonSchema<ErrorResponse>()
            }
            sessionErrors()
        }
    }

private fun Route.documentStudyFormResponseStatus(): Route =
    describe {
        operationId = "studyFormResponseStatus"
        summary = "Whether I answered a questionnaire"
        description =
            "Answered or not, and when; never the answers. Requires a session (401 otherwise) and the consent " +
            "(403 `consent_required`)."
        tag("Study")
        responses {
            HttpStatusCode.OK {
                description = "The caller's status."
                schema = jsonSchema<DataResponse<StudyFormResponseStatusHttpResponse>>()
            }
            HttpStatusCode.NotFound {
                description = "No questionnaire has this slug."
                schema = jsonSchema<ErrorResponse>()
            }
            sessionErrors()
        }
    }

private fun Route.documentStudySubmitForm(): Route =
    describe {
        operationId = "studySubmitForm"
        summary = "Answer a questionnaire"
        description =
            "Checks the answers against the current version with the same rules as the frontend and stores them " +
            "once per user and questionnaire (DEC-015 Q6) with the version, the consent version and the server's " +
            "time; only question id -> value is kept (trimmed text, unanswered questions left out). The " +
            "after-the-study questionnaire needs the final submission first (403 `finish_required`). Same origin " +
            "only (403) and JSON only (415). Requires a session (401 otherwise) and the consent (403 " +
            "`consent_required`)."
        tag("Study")
        requestBody {
            required = true
            ContentType.Application.Json { schema = jsonSchema<StudyFormAnswersHttpRequest>() }
        }
        responses {
            HttpStatusCode.Created {
                description = "Stored."
                schema = jsonSchema<DataResponse<StudyFormSubmittedHttpResponse>>()
            }
            HttpStatusCode.BadRequest {
                description = "Invalid answers (the error per question id), or answers missing."
                schema = jsonSchema<StudyFormErrorsHttpResponse>()
            }
            HttpStatusCode.NotFound {
                description = "No questionnaire has this slug."
                schema = jsonSchema<ErrorResponse>()
            }
            HttpStatusCode.Conflict {
                description = "Already answered, or the version is not the current one; nothing is stored."
                schema = jsonSchema<ErrorResponse>()
            }
            HttpStatusCode.UnsupportedMediaType {
                description = "The body is not application/json."
                schema = jsonSchema<ErrorResponse>()
            }
            sessionErrors()
        }
    }

@file:OptIn(io.ktor.utils.io.ExperimentalKtorApi::class)

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.study.ConsentResult
import com.example.sparqlqueryeasy.application.study.ConsentService
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.openapi.JsonSchema
import io.ktor.openapi.jsonSchema
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.openapi.describe
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.Serializable

@Serializable
data class StudyConsentHttpResponse(
    val version: Int,
    @JsonSchema.Description("The consent text (Markdown).")
    val text: String,
    @JsonSchema.Description("When the caller accepted this version; null when they have not.")
    val acceptedAt: String?,
)

@Serializable
data class StudyConsentHttpRequest(val version: Int? = null)

@Serializable
data class StudyConsentAcceptedHttpResponse(
    val version: Int,
    val acceptedAt: String,
)

/** STUDY-008: the current consent text and the caller's acceptance of it. */
internal fun Route.consentRoutes(
    auth: AuthHttpDependencies,
    consent: ConsentService,
) {
    route("/api/study/consent") {
        get {
            participantRead(auth) { user ->
                val current = consent.current
                val acceptedAt = consent.acceptedAt(user.id)?.toString()
                call.respond(DataResponse(StudyConsentHttpResponse(current.version, current.text, acceptedAt)))
            }
        }.documentStudyGetConsent()
        post {
            sameOriginJson {
                participantRead(auth) { user ->
                    validRequest {
                        val version =
                            receiveLenient<StudyConsentHttpRequest>().version
                                ?: throw HttpRequestValidationFailure("Missing required field: version")
                        when (val result = consent.accept(user.id, version)) {
                            is ConsentResult.Accepted ->
                                call.respond(
                                    DataResponse(StudyConsentAcceptedHttpResponse(version, result.acceptedAt.toString())),
                                )
                            ConsentResult.NotCurrent ->
                                call.respond(HttpStatusCode.Conflict, ErrorResponse(CONSENT_NOT_CURRENT))
                        }
                    }
                }
            }
        }.documentStudyAcceptConsent()
    }
}

private const val CONSENT_NOT_CURRENT = "This is not the current consent text; reload it"

private fun Route.documentStudyGetConsent(): Route =
    describe {
        operationId = "studyGetConsent"
        summary = "Read the consent text"
        description =
            "The current version of the study's consent text and whether the caller accepted it. Requires a " +
            "session (401 otherwise)."
        tag("Study")
        responses {
            HttpStatusCode.OK {
                description = "The current consent text."
                schema = jsonSchema<DataResponse<StudyConsentHttpResponse>>()
            }
            sessionErrors()
        }
    }

private fun Route.documentStudyAcceptConsent(): Route =
    describe {
        operationId = "studyAcceptConsent"
        summary = "Accept the consent text"
        description =
            "Stores the caller's consent to the given version with the server's time; nothing else is stored. " +
            "Accepting again answers 200 with the first time. Until then the questionnaire and task routes answer " +
            "403 `consent_required` (DEC-015 Q1). Same origin only (403) and JSON only (415). Requires a session " +
            "(401 otherwise)."
        tag("Study")
        requestBody {
            required = true
            ContentType.Application.Json { schema = jsonSchema<StudyConsentHttpRequest>() }
        }
        responses {
            HttpStatusCode.OK {
                description = "The accepted version and when it was accepted."
                schema = jsonSchema<DataResponse<StudyConsentAcceptedHttpResponse>>()
            }
            HttpStatusCode.BadRequest {
                description = "The version is missing."
                schema = jsonSchema<ErrorResponse>()
            }
            HttpStatusCode.Conflict {
                description = "The version is not the current one; nothing is stored."
                schema = jsonSchema<ErrorResponse>()
            }
            HttpStatusCode.UnsupportedMediaType {
                description = "The body is not application/json."
                schema = jsonSchema<ErrorResponse>()
            }
            sessionErrors()
        }
    }

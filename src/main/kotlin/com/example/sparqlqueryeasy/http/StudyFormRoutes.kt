@file:OptIn(io.ktor.utils.io.ExperimentalKtorApi::class)

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.study.FormDefinition
import io.ktor.http.HttpStatusCode
import io.ktor.openapi.jsonSchema
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.openapi.describe
import io.ktor.server.routing.route

/** The questionnaires (STUDY-009): their definitions; consent first (STUDY-008). */
internal fun Route.questionnaireRoutes(
    auth: AuthHttpDependencies,
    study: StudyHttpDependencies,
) {
    val questionnaires = study.questionnaires
    route("/api/study/forms/{slug}") {
        get {
            consented(auth, study.consent) {
                val definition = questionnaires.current(call.parameters["slug"].orEmpty())
                if (definition == null) {
                    call.respond(HttpStatusCode.NotFound, ErrorResponse("Questionnaire not found"))
                } else {
                    questionnaires.storedId(definition)
                    call.respond(DataResponse(definition))
                }
            }
        }.documentStudyGetForm()
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

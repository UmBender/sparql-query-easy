@file:OptIn(io.ktor.utils.io.ExperimentalKtorApi::class)

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.study.QuestionnaireService
import io.ktor.http.ContentDisposition
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.withCharset
import io.ktor.openapi.jsonSchema
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.response.respondText
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.openapi.describe

/** STUDY-011 (DEC-015 Q5 A): one CSV per questionnaire for the admins; participants never see responses. */
internal fun Route.adminFormRoutes(
    auth: AuthHttpDependencies,
    questionnaires: QuestionnaireService,
) {
    get("/api/admin/forms/{slug}/responses.csv") {
        adminRead(auth) {
            val slug = call.parameters["slug"].orEmpty()
            val csv = questionnaires.exportCsv(slug)
            if (csv == null) {
                call.respond(HttpStatusCode.NotFound, ErrorResponse("Questionnaire not found"))
            } else {
                call.response.header(
                    HttpHeaders.ContentDisposition,
                    ContentDisposition.Attachment
                        .withParameter(ContentDisposition.Parameters.FileName, "$slug-responses.csv")
                        .toString(),
                )
                call.respondText(csv, ContentType.Text.CSV.withCharset(Charsets.UTF_8))
            }
        }
    }.documentAdminExportFormResponses()
}

private fun Route.documentAdminExportFormResponses(): Route =
    describe {
        operationId = "adminExportFormResponses"
        summary = "Download a questionnaire's responses as CSV"
        description =
            "RFC 4180, one row per response, oldest first: response_id, participant (the internal user id, never " +
            "the username), group (the participant's group now), form_version, consent_version, submitted_at " +
            "(UTC ISO-8601), then one column per question id over every version of the questionnaire. Multiple " +
            "choice values are joined with ';' and unanswered questions are empty; text starting with =, +, -, @, " +
            "tab or carriage return gets a leading ' against spreadsheet formulas. Sent as an attachment. " +
            "Requires the admin role (401 without a session, 403 for a participant)."
        tag("Admin")
        responses {
            HttpStatusCode.OK {
                description = "The CSV file."
                ContentType.Text.CSV { schema = jsonSchema<String>() }
            }
            HttpStatusCode.NotFound {
                description = "No questionnaire has this slug."
                schema = jsonSchema<ErrorResponse>()
            }
            readErrors()
        }
    }

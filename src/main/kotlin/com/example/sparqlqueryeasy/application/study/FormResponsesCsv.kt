package com.example.sparqlqueryeasy.application.study

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import java.time.Instant

/** One stored response as the admin export sees it (STUDY-011): no username, only the internal user id. */
data class ExportedResponse(
    val id: Long,
    val userId: Long,
    /** The participant's group at export time; null when in none. */
    val groupName: String?,
    val version: Int,
    val consentVersion: Int,
    val answersJson: String,
    val submittedAt: Instant,
)

/**
 * The CSV of one questionnaire's responses (STUDY-011, DEC-015 Q5 A): RFC 4180 with CRLF line ends, one row
 * per response, the fixed columns and then one column per question id. The question columns are the union over
 * [versions], newest version first and its definition order, then ids only older versions had. Multiple
 * choice values are joined with `;`; an unanswered question is empty. Text cells that a spreadsheet would read
 * as a formula (starting with `=`, `+`, `-`, `@`, tab or carriage return) get a leading `'`; numbers are
 * written as stored.
 */
object FormResponsesCsv {
    val fixedColumns =
        listOf("response_id", "participant", "group", "form_version", "consent_version", "submitted_at")

    fun questionColumns(versions: List<FormDefinition>): List<String> =
        versions.sortedByDescending { it.version }.flatMap { form -> form.questions.map { it.id } }.distinct()

    fun render(
        versions: List<FormDefinition>,
        responses: List<ExportedResponse>,
    ): String {
        val questions = questionColumns(versions)
        val rows =
            responses.map { response ->
                val answers = Json.parseToJsonElement(response.answersJson).jsonObject
                listOf(
                    response.id.toString(),
                    response.userId.toString(),
                    text(response.groupName.orEmpty()),
                    response.version.toString(),
                    response.consentVersion.toString(),
                    response.submittedAt.toString(),
                ) + questions.map { cell(answers, it) }
            }
        return (listOf(fixedColumns + questions) + rows).joinToString("") { row ->
            row.joinToString(",") { quote(it) } + "\r\n"
        }
    }

    private fun cell(
        answers: JsonObject,
        id: String,
    ): String =
        when (val value = answers[id]) {
            null, JsonNull -> ""
            is JsonArray -> text(value.joinToString(";") { (it as JsonPrimitive).content })
            is JsonPrimitive -> if (value.isString) text(value.content) else value.content
            is JsonObject -> text(value.toString())
        }

    private fun text(value: String): String = if (value.firstOrNull() in FORMULA_STARTS) "'$value" else value

    private fun quote(value: String): String =
        if (value.any { it in QUOTED }) {
            "\"" + value.replace("\"", "\"\"") + "\""
        } else {
            value
        }

    private val FORMULA_STARTS = setOf('=', '+', '-', '@', '\t', '\r')
    private val QUOTED = setOf(',', '"', '\n', '\r')
}

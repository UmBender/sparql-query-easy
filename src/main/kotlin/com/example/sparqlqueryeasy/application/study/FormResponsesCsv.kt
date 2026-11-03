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
 * written as stored. When the versions hold the dissertation questionnaire (STUDY-015), two computed columns
 * follow: `usability_score` and `notation_score` ([DissertationScores]), empty for a response without those
 * answers.
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
        val scored = DissertationScores.appliesTo(questions)
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
                ) + questions.map { cell(answers, it) } +
                    if (scored) DissertationScores.cells(answers) else emptyList()
            }
        val header = fixedColumns + questions + if (scored) DissertationScores.columns else emptyList()
        return (listOf(header) + rows).joinToString("") { row ->
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

    internal fun text(value: String): String = if (value.firstOrNull() in FORMULA_STARTS) "'$value" else value

    internal fun quote(value: String): String =
        if (value.any { it in QUOTED }) {
            "\"" + value.replace("\"", "\"\"") + "\""
        } else {
            value
        }

    private val FORMULA_STARTS = setOf('=', '+', '-', '@', '\t', '\r')
    private val QUOTED = setOf(',', '"', '\n', '\r')
}

/**
 * The dissertation's scores (§4.5) over the `usability` v2 answers, Likert 1–5:
 * usability = 2.5 · (Σ (5 − q) over the negative questions 5, 7, 10 + Σ (q − 1) over the positive 3, 6, 8, 9),
 * 0–70; notation = Σ (q − 1) over questions 11–15, 0–20. Questions 1, 2 and 4 are context only.
 */
object DissertationScores {
    val columns = listOf("usability_score", "notation_score")

    private val negative = listOf("q05_needs_support", "q07_inconsistencies", "q10_learn_before")
    private val positive = listOf("q03_ease_of_use", "q06_well_integrated", "q08_learn_quickly", "q09_confident")
    private val notation =
        listOf(
            "q11_symbols_clear",
            "q12_symbols_intuitive",
            "q13_symbol_count",
            "q14_notation_consistent",
            "q15_layout_helps",
        )

    fun appliesTo(questionIds: List<String>): Boolean = questionIds.containsAll(negative + positive + notation)

    /** The two score cells; a score is empty when one of its answers is missing or not a number. */
    fun cells(answers: JsonObject): List<String> {
        val negatives = values(answers, negative)
        val positives = values(answers, positive)
        val usability =
            if (negatives != null && positives != null) {
                (negatives.sumOf { 5 - it } + positives.sumOf { it - 1 }).toBigDecimal() * USABILITY_FACTOR
            } else {
                null
            }
        return listOf(
            usability?.stripTrailingZeros()?.toPlainString().orEmpty(),
            values(answers, notation)?.sumOf { it - 1 }?.toString().orEmpty(),
        )
    }

    private fun values(
        answers: JsonObject,
        ids: List<String>,
    ): List<Int>? =
        ids.map { id ->
            (answers[id] as? JsonPrimitive)?.content?.toIntOrNull() ?: return null
        }

    private val USABILITY_FACTOR = "2.5".toBigDecimal()
}

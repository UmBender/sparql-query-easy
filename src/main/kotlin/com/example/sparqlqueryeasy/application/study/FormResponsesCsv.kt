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
 * written as stored. When the versions hold the dissertation questionnaire (STUDY-015) or the SUS plus
 * notation questionnaire (STUDY-021), computed columns follow ([ScoreColumns]), empty for a response without
 * the answers they need.
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
        val scores = ScoreColumns.of(questions)
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
                    scores.cells(answers)
            }
        val header = fixedColumns + questions + scores.names
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

/**
 * The SUS and notation scores of the v3 questionnaire (STUDY-020/021), Likert 1–5:
 * `sus_score` = 2.5 · (Σ (q − 1) over the positive S1, S3, S5, S7, S9 + Σ (5 − q) over the negative
 * S2, S4, S6, S8, S10), 0–100; `notation_score` = Σ (q − 1) over N1–N5, 0–20.
 */
object SusScores {
    val positive =
        listOf("s01_use_often", "s03_easy_to_use", "s05_well_integrated", "s07_learn_quickly", "s09_confident")
    val negative =
        listOf("s02_too_complex", "s04_needs_support", "s06_inconsistencies", "s08_cumbersome", "s10_learn_much")
    val notation =
        listOf(
            "n1_clear_symbols",
            "n2_distinguishable",
            "n3_appearance_helps",
            "n4_visual_features",
            "n5_symbol_count",
        )

    fun appliesTo(questionIds: List<String>): Boolean = questionIds.containsAll(positive + negative + notation)

    /** The SUS cell; empty when one of the ten answers is missing or not a number. */
    fun sus(answers: JsonObject): String {
        val positives = ScoreAnswers.values(answers, positive)
        val negatives = ScoreAnswers.values(answers, negative)
        if (positives == null || negatives == null) return ""
        return ((positives.sumOf { it - 1 } + negatives.sumOf { 5 - it }).toBigDecimal() * SUS_FACTOR)
            .stripTrailingZeros()
            .toPlainString()
    }

    /** The notation cell; empty when one of the five answers is missing or not a number. */
    fun notation(answers: JsonObject): String {
        val values = ScoreAnswers.values(answers, notation) ?: return ""
        return values.sumOf { it - 1 }.toString()
    }

    private val SUS_FACTOR = "2.5".toBigDecimal()
}

/** The computed export columns: the dissertation's (v2), the SUS ones (v3), or both. */
internal class ScoreColumns private constructor(
    private val v2: Boolean,
    private val v3: Boolean,
) {
    /** `notation_score` is shared: a response takes the v3 value when it has one, else the v2 value. */
    val names: List<String> =
        buildList {
            if (v2) add("usability_score")
            if (v3) add("sus_score")
            if (v2 || v3) add("notation_score")
        }

    fun cells(answers: JsonObject): List<String> {
        val dissertation = if (v2) DissertationScores.cells(answers) else emptyList()
        return buildList {
            if (v2) add(dissertation[0])
            if (v3) add(SusScores.sus(answers))
            if (v2 || v3) {
                val v3Notation = if (v3) SusScores.notation(answers) else ""
                add(v3Notation.ifEmpty { dissertation.getOrElse(1) { "" } })
            }
        }
    }

    companion object {
        fun of(ids: List<String>): ScoreColumns {
            val v2 = DissertationScores.appliesTo(ids)
            val v3 = SusScores.appliesTo(ids)
            return ScoreColumns(v2, v3)
        }
    }
}

internal object ScoreAnswers {
    fun values(
        answers: JsonObject,
        ids: List<String>,
    ): List<Int>? =
        ids.map { id ->
            (answers[id] as? JsonPrimitive)?.content?.toIntOrNull() ?: return null
        }
}

package com.example.sparqlqueryeasy.application.study

import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test
import java.time.Instant

/** STUDY-011: the admin CSV of one questionnaire's responses. */
class FormResponsesCsvTest {
    private fun question(
        id: String,
        type: QuestionType = QuestionType.SHORT_TEXT,
    ) = Question(id = id, type = type, text = id, required = false)

    private fun form(
        version: Int,
        vararg ids: String,
    ) = FormDefinition("profile", version, "Profile", pages = listOf(FormPage("p", "P", ids.map { question(it) })))

    private fun response(
        answers: String,
        version: Int = 1,
        group: String? = "Group A",
    ) = ExportedResponse(7, 42, group, version, 1, answers, Instant.parse("2026-10-20T12:00:00Z"))

    private val header = "response_id,participant,group,form_version,consent_version,submitted_at"

    @Test
    fun `commas, quotes and newlines are quoted per RFC 4180`() {
        val csv =
            FormResponsesCsv.render(
                listOf(form(1, "comment")),
                listOf(response("""{"comment":"a, \"b\"\nc"}""")),
            )
        csv shouldBe "$header,comment\r\n7,42,Group A,1,1,2026-10-20T12:00:00Z,\"a, \"\"b\"\"\nc\"\r\n"
    }

    @Test
    fun `text read as a formula is escaped, numbers are not`() {
        val csv =
            FormResponsesCsv.render(
                listOf(form(1, "a", "b", "c", "d", "n")),
                listOf(response("""{"a":"=1+1","b":"+x","c":"-y","d":"@z","n":-3}""", group = "=HYPERLINK()")),
            )
        csv.lines()[1] shouldBe "7,42,'=HYPERLINK(),1,1,2026-10-20T12:00:00Z,'=1+1,'+x,'-y,'@z,-3"
    }

    @Test
    fun `QUAL-022 text starting with a tab or a carriage return is escaped too`() {
        val csv =
            FormResponsesCsv.render(
                listOf(form(1, "t", "r")),
                listOf(response("""{"t":"\t=1","r":"\r=2"}""")),
            )
        csv.split("\r\n")[1] shouldBe "7,42,Group A,1,1,2026-10-20T12:00:00Z,'\t=1,\"'\r=2\""
    }

    @Test
    fun `multiple choice is joined with semicolons and unanswered questions are empty`() {
        val csv =
            FormResponsesCsv.render(
                listOf(form(1, "langs", "role", "years")),
                listOf(response("""{"langs":["sql","sparql"],"years":4}""", group = null)),
            )
        csv.lines()[1] shouldBe "7,42,,1,1,2026-10-20T12:00:00Z,sql;sparql,,4"
    }

    @Test
    fun `columns are the union over versions, newest order first`() {
        val versions = listOf(form(1, "old", "kept"), form(2, "kept", "new"))
        FormResponsesCsv.questionColumns(versions) shouldBe listOf("kept", "new", "old")
        val csv =
            FormResponsesCsv.render(
                versions,
                listOf(response("""{"old":"o","kept":"k1"}"""), response("""{"kept":"k2","new":"n"}""", version = 2)),
            )
        csv.lines().take(3) shouldBe
            listOf(
                "$header,kept,new,old",
                "7,42,Group A,1,1,2026-10-20T12:00:00Z,k1,,o",
                "7,42,Group A,2,1,2026-10-20T12:00:00Z,k2,n,",
            )
    }

    @Test
    fun `no responses gives the header only`() {
        FormResponsesCsv.render(listOf(form(1, "a")), emptyList()) shouldBe "$header,a\r\n"
    }

    @Test
    fun `the dissertation questionnaire gets its usability and notation scores (STUDY-015)`() {
        val ids =
            listOf(
                "q03_ease_of_use",
                "q05_needs_support",
                "q06_well_integrated",
                "q07_inconsistencies",
                "q08_learn_quickly",
                "q09_confident",
                "q10_learn_before",
                "q11_symbols_clear",
                "q12_symbols_intuitive",
                "q13_symbol_count",
                "q14_notation_consistent",
                "q15_layout_helps",
            )
        // Best answers: positives 5, negatives 1 -> usability 2.5 * (3 * 4 + 4 * 4) = 70, notation 5 * 4 = 20.
        val best = ids.joinToString(",", "{", "}") { id -> "\"$id\":" + if (id in NEGATIVE) 1 else 5 }
        // Q3 = 4 and Q5 = 2 change usability by -2.5 each; Q11 missing leaves the notation score empty.
        val mixed =
            ids.filter { it != "q11_symbols_clear" }.joinToString(",", "{", "}") { id ->
                "\"$id\":" +
                    when (id) {
                        "q03_ease_of_use" -> 4
                        "q05_needs_support" -> 2
                        in NEGATIVE -> 1
                        else -> 5
                    }
            }
        val csv =
            FormResponsesCsv.render(listOf(form(2, *ids.toTypedArray())), listOf(response(best, 2), response(mixed, 2)))
        val lines = csv.split("\r\n")
        lines[0] shouldBe "$header,${ids.joinToString(",")},usability_score,notation_score"
        lines[1].split(",").takeLast(2) shouldBe listOf("70", "20")
        lines[2].split(",").takeLast(2) shouldBe listOf("65", "")
        val unscored = FormResponsesCsv.render(listOf(form(1, "comment")), listOf(response("{}")))
        unscored.lines().first() shouldBe "$header,comment"
    }

    private fun answers(
        sus: (String) -> Int,
        notation: Int,
        skip: String? = null,
    ) = (SusScores.positive + SusScores.negative).map { it to sus(it) }.plus(SusScores.notation.map { it to notation })
        .filter { it.first != skip }
        .joinToString(",", "{", "}") { (id, v) -> "\"$id\":$v" }

    private fun v3Cells(answers: String) =
        FormResponsesCsv
            .render(
                listOf(form(3, *(SusScores.positive + SusScores.negative + SusScores.notation).toTypedArray())),
                listOf(response(answers, 3)),
            )
            .split("\r\n")[1]
            .split(",")
            .takeLast(2)

    @Test
    fun `STUDY-021 SUS and notation scores at the extremes and the mid-point`() {
        val positive = SusScores.positive.toSet()
        // Best: positives 5, negatives 1 -> 2.5 * (5 * 4 + 5 * 4) = 100; notation 5 each -> 20.
        v3Cells(answers({ if (it in positive) 5 else 1 }, 5)) shouldBe listOf("100", "20")
        // All 3s: 2.5 * (5 * 2 + 5 * 2) = 50; notation 3 each -> 10.
        v3Cells(answers({ 3 }, 3)) shouldBe listOf("50", "10")
        // Worst: positives 1, negatives 5 -> 0; notation 1 each -> 0.
        v3Cells(answers({ if (it in positive) 1 else 5 }, 1)) shouldBe listOf("0", "0")
    }

    @Test
    fun `STUDY-021 hand computed oracle`() {
        // S1..S10 = 4,2,5,1,3,3,4,2,5,2: positives (S1,S3,S5,S7,S9) = 4,5,3,4,5 -> 3+4+2+3+4 = 16;
        // negatives (S2,S4,S6,S8,S10) = 2,1,3,2,2 -> 3+4+2+3+3 = 15; 2.5 * 31 = 77.5. N = 5,4,3,2,1 -> 4+3+2+1+0 = 10.
        val s = listOf(4, 2, 5, 1, 3, 3, 4, 2, 5, 2)
        val ids =
            listOf(
                "s01_use_often", "s02_too_complex", "s03_easy_to_use", "s04_needs_support", "s05_well_integrated",
                "s06_inconsistencies", "s07_learn_quickly", "s08_cumbersome", "s09_confident", "s10_learn_much",
            )
        val n = listOf(5, 4, 3, 2, 1).zip(SusScores.notation)
        val pairs = ids.zip(s) + n.map { it.second to it.first }
        val json = pairs.joinToString(",", "{", "}") { (id, v) -> "\"$id\":$v" }
        v3Cells(json) shouldBe listOf("77.5", "10")
    }

    @Test
    fun `STUDY-021 an incomplete S or N block gives an empty cell, not 0`() {
        v3Cells(answers({ 3 }, 3, skip = "s05_well_integrated")) shouldBe listOf("", "10")
        v3Cells(answers({ 3 }, 3, skip = "n3_appearance_helps")) shouldBe listOf("50", "")
        v3Cells("{}") shouldBe listOf("", "")
    }

    @Test
    fun `STUDY-021 a mixed v2 and v3 export keeps the earlier columns and shares notation_score`() {
        val v2Ids =
            listOf(
                "q03_ease_of_use",
                "q05_needs_support",
                "q06_well_integrated",
                "q07_inconsistencies",
                "q08_learn_quickly",
                "q09_confident", "q10_learn_before", "q11_symbols_clear", "q12_symbols_intuitive", "q13_symbol_count",
                "q14_notation_consistent", "q15_layout_helps",
            )
        val v3Ids = SusScores.positive + SusScores.negative + SusScores.notation
        val old = v2Ids.joinToString(",", "{", "}") { id -> "\"$id\":" + if (id in NEGATIVE) 1 else 5 }
        val fresh = answers({ 3 }, 3)
        val csv =
            FormResponsesCsv.render(
                listOf(form(2, *v2Ids.toTypedArray()), form(3, *v3Ids.toTypedArray())),
                listOf(response(old, 2), response(fresh, 3)),
            )
        val lines = csv.split("\r\n")
        lines[0] shouldBe "$header,${(v3Ids + v2Ids).joinToString(",")},usability_score,sus_score,notation_score"
        lines[1].split(",").takeLast(3) shouldBe listOf("70", "", "20")
        lines[2].split(",").takeLast(3) shouldBe listOf("", "50", "10")
    }

    private companion object {
        val NEGATIVE = setOf("q05_needs_support", "q07_inconsistencies", "q10_learn_before")
    }
}

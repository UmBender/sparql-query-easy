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
}

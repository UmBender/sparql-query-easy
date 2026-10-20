package com.example.sparqlqueryeasy.application.study

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldStartWith
import org.junit.jupiter.api.Test

/** STUDY-009: the shipped questionnaires load, and malformed definitions are rejected with a clear message. */
class FormDefinitionsTest {
    private fun definition(
        questions: String,
        pages: String? = null,
    ): String {
        val list = pages ?: """[{"id":"p","title":"P","questions":[$questions]}]"""
        return """{"slug":"demo","version":1,"title":"Demo","pages":$list}"""
    }

    private val choice =
        """{"id":"q","type":"single_choice","text":"Q","required":true,""" +
            """"options":[{"value":"a","label":"A"},{"value":"b","label":"B"}]}"""

    private fun problems(text: String): List<String> =
        FormDefinitions.problems(kotlinx.serialization.json.Json.decodeFromString<FormDefinition>(text))

    @Test
    fun `the shipped profile and usability questionnaires are marked placeholders`() {
        val forms = StudyResources.fromClasspath().currentForms
        forms.keys shouldBe setOf("profile", "usability")
        forms.values.forEach { it.title shouldStartWith "PLACEHOLDER" }
        forms.getValue("profile").questions.map { it.type }.toSet() shouldBe
            setOf(QuestionType.SINGLE_CHOICE, QuestionType.MULTIPLE_CHOICE, QuestionType.NUMBER, QuestionType.LIKERT)
        forms.getValue("usability").pages.size shouldBe 2
    }

    @Test
    fun `a valid definition has no problems`() {
        problems(definition(choice)) shouldBe emptyList()
    }

    @Test
    fun `unknown fields and malformed JSON fail naming the file`() {
        shouldThrow<IllegalArgumentException> {
            FormDefinitions.parse(definition(choice.replace("\"required\"", "\"mandatory\"")), "forms/demo.v1.json")
        }.message shouldStartWith "forms/demo.v1.json: "
        val malformed = shouldThrow<IllegalArgumentException> { FormDefinitions.parse("{", "x.json") }
        malformed.message shouldStartWith "x.json: "
    }

    @Test
    fun `structural problems are reported`() {
        problems(definition(choice, "[]")) shouldContain "there are no pages"
        problems(definition("$choice,$choice")) shouldContain "question id 'q' is repeated"
        val noOptions = choice.replace(""","options":[{"value":"a","label":"A"},{"value":"b","label":"B"}]""", "")
        problems(definition(noOptions)) shouldContain
            "question 'q' needs at least two options"
        problems(definition(choice.replace("\"b\",\"label\":\"B\"", "\"a\",\"label\":\"B\""))) shouldContain
            "question 'q' repeats option 'a'"
        problems(definition(choice.replace("\"id\":\"q\"", "\"id\":\"Bad Id\""))) shouldContain
            "question id 'Bad Id' is not a lowercase identifier"
        problems(definition(choice).replace("\"demo\"", "\"Demo!\"")).first() shouldContain "slug"
    }

    @Test
    fun `type rules are checked`() {
        val likert = """{"id":"l","type":"likert","text":"L","required":true,"scaleMax":11}"""
        val text = """{"id":"t","type":"short_text","text":"T","required":false,"maxLength":300}"""
        val number = """{"id":"n","type":"number","text":"N","required":true,"min":5,"max":1}"""
        val numberWithOptions = """{"id":"o","type":"number","text":"N","required":true,"options":[]}"""
        val multi =
            """{"id":"m","type":"multiple_choice","text":"M","required":true,"minSelected":2,"maxSelected":1,""" +
                """"options":[{"value":"a","label":"A"},{"value":"b","label":"B"}]}"""
        val found = problems(definition(listOf(likert, text, number, numberWithOptions, multi).joinToString(",")))
        found shouldContain "question 'l' scaleMax must be from 2 to 10"
        found shouldContain "question 't' maxLength must be from 1 to 200"
        found shouldContain "question 'n' min exceeds max"
        found shouldContain "question 'o' is not a choice and cannot have options"
        found shouldContain "question 'm' minSelected exceeds maxSelected"
    }
}

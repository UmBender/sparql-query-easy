package com.example.sparqlqueryeasy.application.study

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
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
    fun `the current questionnaires are A1-A3, the complete SUS and the five notation items in order (STUDY-020)`() {
        val resources = StudyResources.fromClasspath()
        val forms = resources.currentForms
        forms.keys shouldBe setOf("profile", "usability")
        forms.values.forEach { it.version shouldBe 3 }
        val profile = forms.getValue("profile").questions
        val usability = forms.getValue("usability").questions
        (profile + usability).map { it.id } shouldBe
            listOf("a1_sparql_knowledge", "a2_tasks_completed", "a3_video_useful") +
            listOf(
                "s01_use_often", "s02_too_complex", "s03_easy_to_use", "s04_needs_support", "s05_well_integrated",
                "s06_inconsistencies", "s07_learn_quickly", "s08_cumbersome", "s09_confident", "s10_learn_much",
                "n1_clear_symbols", "n2_distinguishable", "n3_appearance_helps", "n4_visual_features",
                "n5_symbol_count",
            )
        (profile + usability).forEach { question ->
            question.required shouldBe true
            question.text shouldNotContain "PLACEHOLDER"
        }
        // The v3 ids carry the SUS scores, not the dissertation's (v2) ones.
        FormResponsesCsv.questionColumns(listOf(forms.getValue("usability"))).let {
            DissertationScores.appliesTo(it) shouldBe false
            SusScores.appliesTo(it) shouldBe true
        }
        profile.single().text shouldBe "Qual é o seu nível de conhecimento sobre SPARQL/RDF?"
        val queries = usability.first()
        queries.type shouldBe QuestionType.NUMBER
        listOf(queries.min, queries.max, queries.integer) shouldBe listOf(0.0, 5.0, true)
        usability.drop(1).forEach { question ->
            question.type shouldBe QuestionType.LIKERT
            question.scaleMax shouldBe 5
            question.minLabel.shouldNotBeNull()
            question.maxLabel.shouldNotBeNull()
        }
        forms.getValue("usability").pages.map { page -> page.questions.size } shouldBe listOf(12, 5)
        forms.getValue("usability").pages.map { it.title } shouldBe listOf("Uso da ferramenta", "Notação gráfica")
        // The older files stay so that responses to them are still read and exported.
        resources.forms.map { it.slug to it.version }.toSet() shouldBe
            setOf(
                "profile" to 1, "profile" to 2, "profile" to 3,
                "usability" to 1, "usability" to 2, "usability" to 3,
            )
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

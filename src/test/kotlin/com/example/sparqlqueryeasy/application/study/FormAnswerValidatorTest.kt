package com.example.sparqlqueryeasy.application.study

import io.kotest.matchers.shouldBe
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.TestFactory
import java.io.File

/** STUDY-009: the shared parity fixtures, which the frontend's `validateAnswers` also runs. */
class FormAnswerValidatorTest {
    private val fixture =
        Json.parseToJsonElement(File("frontend/src/lib/domain/fixtures/forms/parity.json").readText()).jsonObject

    @TestFactory
    fun `every parity case gets the expected errors and stored answers`(): List<DynamicTest> {
        val definition = Json.decodeFromJsonElement<FormDefinition>(fixture.getValue("definition"))
        FormDefinitions.problems(definition) shouldBe emptyList()
        return fixture.getValue("cases").jsonArray.map { case ->
            val item = case.jsonObject
            DynamicTest.dynamicTest(item.getValue("name").jsonPrimitive.content) {
                val check = FormAnswerValidator.validate(definition, item.getValue("answers").jsonObject)
                val expected = item.getValue("errors").jsonObject.mapValues { it.value.jsonPrimitive.content }
                check.errors shouldBe expected
                item["stored"]?.let { check.answers shouldBe (it as JsonObject) }
            }
        }
    }
}

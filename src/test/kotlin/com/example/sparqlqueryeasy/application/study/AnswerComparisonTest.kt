@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.application.study

import com.example.sparqlqueryeasy.domain.model.Iri
import com.example.sparqlqueryeasy.domain.model.Literal
import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test

/** STUDY-004: the comparison modes of DEC-014 Q4 on typed terms. */
class AnswerComparisonTest {
    private val pk = "http://easyquery.example.org/pokemon#"
    private val charizard = Iri("${pk}Charizard")
    private val arcanine = Iri("${pk}Arcanine")
    private val rapidash = Iri("${pk}Rapidash")
    private val pikachu = Iri("${pk}Pikachu")
    private val xsdInteger = Iri("http://www.w3.org/2001/XMLSchema#integer")

    private fun set(
        expected: List<com.example.sparqlqueryeasy.domain.model.RdfValue>,
        actual: List<com.example.sparqlqueryeasy.domain.model.RdfValue>,
    ) = AnswerComparison.compare(expected, actual, Comparison.SET)

    private fun multiset(
        expected: List<com.example.sparqlqueryeasy.domain.model.RdfValue>,
        actual: List<com.example.sparqlqueryeasy.domain.model.RdfValue>,
    ) = AnswerComparison.compare(expected, actual, Comparison.MULTISET)

    @Test
    fun `equal sets are correct whatever the order and duplicates`() {
        val outcome = set(listOf(charizard, arcanine, rapidash), listOf(rapidash, charizard, charizard, arcanine))
        outcome shouldBe ComparisonOutcome(correct = true, matched = 3, missing = 0, extra = 0, expectedCount = 3)
        outcome.feedback shouldBe "Correct: all 3 expected results."
    }

    @Test
    fun `a missing value is incorrect and counted`() {
        val outcome = set(listOf(charizard, arcanine, rapidash), listOf(charizard, arcanine))
        outcome shouldBe ComparisonOutcome(false, matched = 2, missing = 1, extra = 0, expectedCount = 3)
        outcome.feedback shouldBe "Incorrect: 2 of 3 expected results."
    }

    @Test
    fun `an extra value is incorrect and counted`() {
        val outcome = set(listOf(charizard), listOf(charizard, pikachu, arcanine))
        outcome shouldBe ComparisonOutcome(false, matched = 1, missing = 0, extra = 2, expectedCount = 1)
        outcome.feedback shouldBe "Incorrect: 1 of 1 expected results; 2 extra."
    }

    @Test
    fun `multiset counts duplicate rows`() {
        multiset(listOf(charizard, charizard, arcanine), listOf(arcanine, charizard, charizard)).correct shouldBe true
        multiset(listOf(charizard, charizard, arcanine), listOf(charizard, arcanine)) shouldBe
            ComparisonOutcome(false, matched = 2, missing = 1, extra = 0, expectedCount = 3)
        multiset(listOf(charizard), listOf(charizard, charizard)) shouldBe
            ComparisonOutcome(false, matched = 1, missing = 0, extra = 1, expectedCount = 1)
    }

    @Test
    fun `literals compare by lexical form, datatype and language`() {
        val typed = Literal("90", xsdInteger)
        set(listOf(typed), listOf(Literal("90"))).correct shouldBe false
        set(listOf(typed), listOf(Literal("90", xsdInteger))).correct shouldBe true
        set(listOf(Literal("Fire", language = "en")), listOf(Literal("Fire", language = "pt"))).correct shouldBe false
        set(listOf(Literal("Fire", language = "en")), listOf(Literal("Fire"))).correct shouldBe false
        set(listOf(Literal("Fire", language = "en-GB")), listOf(Literal("Fire", language = "en-gb"))).correct shouldBe true
        set(listOf(Iri("${pk}Fire")), listOf(Literal("${pk}Fire"))).correct shouldBe false
    }

    @Test
    fun `an empty expected set is matched only by an empty answer`() {
        set(emptyList(), emptyList()) shouldBe ComparisonOutcome(true, 0, 0, 0, 0)
        set(emptyList(), listOf(pikachu)) shouldBe ComparisonOutcome(false, 0, 0, 1, 0)
        multiset(emptyList(), emptyList()).feedback shouldBe "Correct: all 0 expected results."
    }
}

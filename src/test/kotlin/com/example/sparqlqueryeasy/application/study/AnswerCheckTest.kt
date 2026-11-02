@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.application.study

import com.example.sparqlqueryeasy.domain.model.Iri
import com.example.sparqlqueryeasy.wikidata.query.GreaterOrEqual
import com.example.sparqlqueryeasy.wikidata.query.IriTerm
import com.example.sparqlqueryeasy.wikidata.query.LiteralObject
import com.example.sparqlqueryeasy.wikidata.query.QueryVariable
import com.example.sparqlqueryeasy.wikidata.query.TermObject
import com.example.sparqlqueryeasy.wikidata.query.TriplePattern
import com.example.sparqlqueryeasy.wikidata.query.VariableFilter
import com.example.sparqlqueryeasy.wikidata.query.VariableTerm
import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test

/** STUDY-016 (DEC-020 C1, C2): the admin-only automatic check of a saved answer. */
class AnswerCheckTest {
    private val pk = "http://easyquery.example.org/pokemon#"

    private fun iri(name: String) = IriTerm("$pk$name")

    private fun variable(name: String) = VariableTerm(QueryVariable(name))

    private val charizardFire = TriplePattern(iri("Charizard"), iri("hasType"), TermObject(iri("FireType")))
    private val charizardFlying = TriplePattern(iri("Charizard"), iri("hasType"), TermObject(iri("FlyingType")))
    private val charizardFast = TriplePattern(iri("Charizard"), iri("speed"), LiteralObject("90"), GreaterOrEqual("90"))

    // ── Structural comparison (C1) ────────────────────────────────

    @Test
    fun `equal triple sets match`() {
        val check = AnswerComparison.compareStructure(listOf(charizardFire, charizardFast), listOf(charizardFire, charizardFast))
        check shouldBe AnswerCheck.Structural(missing = 0, extra = 0)
        check.match shouldBe true
        check.summary shouldBe "Structural: the same triples as the reference."
    }

    @Test
    fun `the same triples drawn in a different order, or one drawn twice, still match`() {
        AnswerComparison.compareStructure(
            listOf(charizardFire, charizardFast),
            listOf(charizardFast, charizardFire, charizardFire),
        ).match shouldBe true
    }

    @Test
    fun `an extra triple is no match and is counted`() {
        val check = AnswerComparison.compareStructure(listOf(charizardFire), listOf(charizardFire, charizardFlying))
        check shouldBe AnswerCheck.Structural(missing = 0, extra = 1)
        check.match shouldBe false
        check.summary shouldBe "Structural: 0 reference triples missing; 1 extra."
    }

    @Test
    fun `a missing triple is no match and is counted`() {
        AnswerComparison.compareStructure(listOf(charizardFire, charizardFast), listOf(charizardFire)) shouldBe
            AnswerCheck.Structural(missing = 1, extra = 0)
    }

    @Test
    fun `a literal filter is part of the triple`() {
        val atMost = charizardFast.copy(filter = null)
        AnswerComparison.compareStructure(listOf(charizardFast), listOf(atMost)) shouldBe AnswerCheck.Structural(1, 1)
    }

    // ── Per-variable comparison (C2) ──────────────────────────────

    private val charizard = Iri("${pk}Charizard")
    private val arcanine = Iri("${pk}Arcanine")
    private val expected = listOf(charizard, arcanine)

    private fun complete(vararg values: Iri) = AnswerRun.Complete(ExpectedResult("SELECT …", values.toList()))

    @Test
    fun `a variable whose values equal the expected ones matches, whatever the order`() {
        val check = AnswerComparison.checkVariable("?pokemon", complete(arcanine, charizard), expected, Comparison.SET)
        check.match shouldBe true
        check.sparql shouldBe "SELECT …"
        check.summary shouldBe "?pokemon: Correct: all 2 expected results."
    }

    @Test
    fun `a variable with other values, a cut result or a failed run does not match`() {
        AnswerComparison.checkVariable("?p", complete(charizard), expected, Comparison.SET).result!!.outcome.missing shouldBe 1
        val truncated = AnswerComparison.checkVariable("?p", AnswerRun.Truncated("SELECT …", 2, expected), expected, Comparison.SET)
        truncated.match shouldBe false
        truncated.result!!.truncated shouldBe true
        val failed = AnswerComparison.checkVariable("?p", AnswerRun.Failed(null, "boom"), expected, Comparison.SET)
        failed shouldBe VariableCheck("?p", null, null, "boom")
        failed.summary shouldBe "?p: The query could not run: boom"
    }

    @Test
    fun `the answer matches when any checked variable matches, and the matched one is primary`() {
        val speed = AnswerComparison.checkVariable("?speed", complete(charizard), expected, Comparison.SET)
        val pokemon = AnswerComparison.checkVariable("?pokemon", complete(charizard, arcanine), expected, Comparison.SET)

        val check = AnswerCheck.ByVariable(listOf(speed, pokemon))
        check.match shouldBe true
        check.primary shouldBe pokemon
        check.invalid shouldBe false
        check.summary shouldBe
            "?pokemon matches the expected values. ?speed: Incorrect: 1 of 2 expected results. ?pokemon: Correct: all 2 expected results."

        val none = AnswerCheck.ByVariable(listOf(speed))
        none.match shouldBe false
        none.primary shouldBe speed
    }

    @Test
    fun `an answer's variables are listed once each, in order of appearance, filters included`() {
        val answer =
            DrawnAnswer(
                "{}",
                "{}",
                listOf(
                    TriplePattern(variable("pokemon"), iri("speed"), TermObject(variable("speed"))),
                    TriplePattern(variable("pokemon"), variable("relation"), TermObject(iri("FireType"))),
                ),
                listOf(VariableFilter(QueryVariable("speed"), GreaterOrEqual("90")), VariableFilter(QueryVariable("extra"))),
            )
        answer.variables.map { it.name } shouldBe listOf("pokemon", "speed", "relation", "extra")
        DrawnAnswer("{}", "{}", listOf(charizardFire, charizardFast)).variables shouldBe emptyList()
    }
}

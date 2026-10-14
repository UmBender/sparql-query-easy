package com.example.sparqlqueryeasy.wikidata.query

import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import org.apache.jena.query.QueryFactory
import org.junit.jupiter.api.Test
import kotlin.test.assertFailsWith

/** FE-034: a variable object restricted to literals, with an optional filter. */
class VariableFilterGeneratorTest {
    private val generator = CSharpCompatibleWikidataQueryGenerator()
    private val item = QueryVariable("item")
    private val hp = QueryVariable("hp")
    private val hpPattern = TriplePattern(VariableTerm(item), IriTerm("https://e/hp"), TermObject(VariableTerm(hp)))

    @Test
    fun `each filter becomes one isLiteral FILTER on the variable after the patterns`() {
        val cases =
            listOf(
                VariableFilter(hp) to "FILTER (isLiteral(?hp))",
                VariableFilter(hp, exactValue = "9\"0") to "FILTER (isLiteral(?hp) && str(?hp) = \"9\\\"0\")",
                VariableFilter(hp, StartsWith("Pi")) to "FILTER (isLiteral(?hp) && STRSTARTS(STR(?hp), \"Pi\"))",
                VariableFilter(hp, Contains("ka")) to "FILTER (isLiteral(?hp) && CONTAINS(STR(?hp), \"ka\"))",
                VariableFilter(hp, GreaterOrEqual("90")) to "FILTER (isLiteral(?hp) && ?hp >= 90)",
                VariableFilter(hp, LessOrEqual("40")) to "FILTER (isLiteral(?hp) && ?hp <= 40)",
                VariableFilter(hp, Between("40", "80")) to "FILTER (isLiteral(?hp) && ?hp >= 40 && ?hp <= 80)",
            )
        cases.forEach { (filter, expected) ->
            val select = GeneralSelectQuery(item, listOf(hpPattern), 20, variableFilters = listOf(filter))
            val query = generator.generate(select)
            query.lines().filter { it.contains("isLiteral") } shouldBe listOf(expected)
            query.indexOf(expected) shouldBe query.indexOf("}\nLIMIT 20") - expected.length - 1
            QueryFactory.create(query)
        }
    }

    @Test
    fun `stage count profile and display queries carry the variable filter`() {
        val filters = listOf(VariableFilter(hp, GreaterOrEqual("150")))
        val line = "FILTER (isLiteral(?hp) && ?hp >= 150)"
        val queries =
            listOf(
                StageCandidateQuery(item, listOf(hpPattern), emptyList(), 20, 0, false, filters),
                CountQuery(item, listOf(hpPattern), filters),
                NumericProfileQuery(
                    VariableTerm(item),
                    IriTerm("https://e/attack"),
                    listOf(hpPattern),
                    10,
                    useWikidataLabels = false,
                    values = true,
                    variableFilters = filters,
                ),
                DisplaySelectQuery(item, listOf(hpPattern), 20, variableFilters = filters),
            ).map(generator::generate)
        queries.forEach { query ->
            query shouldContain line
            QueryFactory.create(query)
        }
    }

    @Test
    fun `an extreme subquery applies the variable filter too`() {
        val patterns =
            listOf(
                hpPattern,
                TriplePattern(VariableTerm(item), IriTerm("https://e/speed"), LiteralObject("0"), Maximum),
            )
        val query =
            generator.generate(
                GeneralSelectQuery(item, patterns, 20, variableFilters = listOf(VariableFilter(hp, LessOrEqual("50")))),
            )
        query.split("FILTER (isLiteral(?hp) && ?hp <= 50)").size shouldBe 3
        QueryFactory.create(query)
    }

    @Test
    fun `queries without variable filters are unchanged`() {
        generator.generate(GeneralSelectQuery(item, listOf(hpPattern), 20)) shouldNotContain "isLiteral"
    }

    @Test
    fun `invalid variable filters are rejected`() {
        assertFailsWith<IllegalArgumentException> { VariableFilter(hp, Maximum) }
        assertFailsWith<IllegalArgumentException> { VariableFilter(hp, Minimum) }
        assertFailsWith<IllegalArgumentException> { VariableFilter(hp, StartsWith("a"), exactValue = "b") }
        // Only an object variable can be restricted, once.
        assertFailsWith<IllegalArgumentException> {
            GeneralSelectQuery(item, listOf(hpPattern), 20, variableFilters = listOf(VariableFilter(item)))
        }
        assertFailsWith<IllegalArgumentException> {
            CountQuery(item, listOf(hpPattern), listOf(VariableFilter(hp), VariableFilter(hp, GreaterOrEqual("1"))))
        }
    }
}

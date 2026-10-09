package com.example.sparqlqueryeasy.rdf.jena

import com.example.sparqlqueryeasy.domain.model.BoundSparqlBinding
import com.example.sparqlqueryeasy.domain.model.Iri
import com.example.sparqlqueryeasy.domain.model.SparqlSelectResult
import com.example.sparqlqueryeasy.domain.model.SparqlVariable
import com.example.sparqlqueryeasy.wikidata.query.CSharpCompatibleWikidataQueryGenerator
import com.example.sparqlqueryeasy.wikidata.query.GeneralSelectQuery
import com.example.sparqlqueryeasy.wikidata.query.GreaterOrEqual
import com.example.sparqlqueryeasy.wikidata.query.IriTerm
import com.example.sparqlqueryeasy.wikidata.query.LiteralObject
import com.example.sparqlqueryeasy.wikidata.query.Maximum
import com.example.sparqlqueryeasy.wikidata.query.Minimum
import com.example.sparqlqueryeasy.wikidata.query.QueryFilter
import com.example.sparqlqueryeasy.wikidata.query.QueryVariable
import com.example.sparqlqueryeasy.wikidata.query.TermObject
import com.example.sparqlqueryeasy.wikidata.query.TriplePattern
import com.example.sparqlqueryeasy.wikidata.query.VariableTerm
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Test

/** BE-004: Maximum/Minimum keep every tied row, combine, and are capped, on a local Jena graph. */
class ExtremeFilterExecutionTest {
    private val graph =
        JenaTurtleParser().parse(
            """
            @prefix ex: <https://example.test/extreme/> .
            @prefix owl: <http://www.w3.org/2002/07/owl#> .
            ex:a a owl:Class ; ex:score 3 ; ex:speed 5 ; ex:team ex:red .
            ex:b a owl:Class ; ex:score 3.0 ; ex:speed 9 ; ex:team ex:blue .
            ex:c a owl:Class ; ex:score 1 ; ex:speed 9 ; ex:team ex:red .
            ex:d a owl:Class ; ex:score 2 ; ex:speed 7 ; ex:team ex:red .
            """.trimIndent(),
        )

    private fun relation(
        name: String,
        filter: QueryFilter,
    ) = TriplePattern(item, IriTerm("$EX$name"), LiteralObject("ignored"), filter)

    private fun items(
        vararg patterns: TriplePattern,
        limit: Int = 20,
        generator: CSharpCompatibleWikidataQueryGenerator = CSharpCompatibleWikidataQueryGenerator(),
    ): List<String> {
        val query = generator.generate(select(patterns.toList(), limit))
        val result = runBlocking { JenaLocalSparqlExecutor().execute(graph, query) } as SparqlSelectResult
        return result.rows.map { row ->
            ((row.binding(SparqlVariable("item")) as BoundSparqlBinding).value as Iri).value.removePrefix(EX)
        }
    }

    @Test
    fun `maximum keeps every tied entity, comparing numbers by value, and minimum keeps the lowest`() {
        items(relation("score", Maximum)) shouldContainExactlyInAnyOrder listOf("a", "b")
        items(relation("score", Minimum)) shouldBe listOf("c")
    }

    @Test
    fun `the extreme is taken over the rest of the query`() {
        val red = TriplePattern(item, IriTerm("${EX}team"), TermObject(IriTerm("${EX}red")))
        items(red, relation("score", Maximum)) shouldBe listOf("a")
        items(relation("speed", GreaterOrEqual("8")), relation("score", Minimum)) shouldBe listOf("c")
    }

    @Test
    fun `several extremes each take their own extreme and all must hold`() {
        // Highest score: a, b. Highest speed: b, c.
        items(relation("score", Maximum), relation("speed", Maximum)) shouldBe listOf("b")
        // Lowest score: c. Lowest speed: a.
        items(relation("score", Minimum), relation("speed", Minimum)) shouldBe emptyList()
    }

    @Test
    fun `the configured limit caps extreme queries but a smaller caller limit wins`() {
        items(relation("score", Maximum), generator = CSharpCompatibleWikidataQueryGenerator(1)).size shouldBe 1
        items(relation("score", Maximum), limit = 1).size shouldBe 1
        val query = CSharpCompatibleWikidataQueryGenerator(5).generate(select(listOf(relation("score", Maximum)), 50))
        query.endsWith("LIMIT 5\n") shouldBe true
        ("ORDER BY" in query) shouldBe false
    }

    private fun select(
        patterns: List<TriplePattern>,
        limit: Int,
    ) = GeneralSelectQuery(QueryVariable("item"), patterns, limit, useWikidataLabels = false)

    private companion object {
        const val EX = "https://example.test/extreme/"
        val item = VariableTerm(QueryVariable("item"))
    }
}

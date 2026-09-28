package com.example.sparqlqueryeasy.application.querygeneration

import com.example.sparqlqueryeasy.application.endpoints.RemoteSparqlEndpoint
import com.example.sparqlqueryeasy.application.endpoints.RemoteSparqlEndpointContext
import com.example.sparqlqueryeasy.application.endpoints.WikidataEndpointContext
import com.example.sparqlqueryeasy.application.relationships.EndpointExecution
import com.example.sparqlqueryeasy.domain.model.SparqlSelectResult
import com.example.sparqlqueryeasy.rdf.SparqlSyntaxValidation
import com.example.sparqlqueryeasy.rdf.SparqlSyntaxValidator
import com.example.sparqlqueryeasy.rdf.jena.JenaSparqlSyntaxValidator
import com.example.sparqlqueryeasy.wikidata.query.CSharpCompatibleWikidataQueryGenerator
import com.example.sparqlqueryeasy.wikidata.query.GreaterOrEqual
import com.example.sparqlqueryeasy.wikidata.query.IriTerm
import com.example.sparqlqueryeasy.wikidata.query.LessOrEqual
import com.example.sparqlqueryeasy.wikidata.query.LiteralObject
import com.example.sparqlqueryeasy.wikidata.query.Maximum
import com.example.sparqlqueryeasy.wikidata.query.Minimum
import com.example.sparqlqueryeasy.wikidata.query.QueryFilter
import com.example.sparqlqueryeasy.wikidata.query.QueryVariable
import com.example.sparqlqueryeasy.wikidata.query.StartsWith
import com.example.sparqlqueryeasy.wikidata.query.TermObject
import com.example.sparqlqueryeasy.wikidata.query.TriplePattern
import com.example.sparqlqueryeasy.wikidata.query.VariableTerm
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertInstanceOf
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import kotlin.test.assertFailsWith

class SparqlQueryGenerationServiceTest {
    private val generator = CSharpCompatibleWikidataQueryGenerator()
    private val local = endpoint("https://example.test/sparql")

    @Test
    fun `SELECT-BASIC-001 has deterministic exact output`() {
        val result = service().generate(request(), local)
        assertEquals(
            """PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
SELECT DISTINCT ?item ?itemLabel
WHERE {
?item <https://example.test/type> ?kind .
OPTIONAL {
?item rdfs:label ?itemLabel .
FILTER (lang(?itemLabel) = "en")
}
}
LIMIT 20
""",
            (result as SparqlQueryGenerationResult.Success).query,
        )
    }

    @Test
    fun `empty WHERE and limit zero are preserved`() {
        val result = service().generate(SparqlQueryGenerationRequest(QueryVariable("item"), limit = 0), local)
        assertTrue((result as SparqlQueryGenerationResult.Success).query.contains("LIMIT 0"))
        assertTrue(result.query.contains("WHERE {\n}\nLIMIT 0"))
    }

    @Test
    fun `optional and Wikidata generation preserve endpoint dependent prefixes`() {
        val request = SparqlQueryGenerationRequest(QueryVariable("item"), listOf(pattern()))
        val result =
            service().generate(
                request,
                WikidataEndpointContext(
                    RemoteSparqlEndpoint.parse("https://query.wikidata.org/sparql"),
                    RecordingExecution(),
                ),
            ) as SparqlQueryGenerationResult.Success
        assertTrue(result.query.contains("PREFIX wikibase:"))
        assertTrue(result.query.contains("OPTIONAL {"))
        assertTrue(result.query.contains("rdfs:label"))
    }

    @Test
    fun `filter fixtures retain CSharp GetSparqlQuery behavior`() {
        val request =
            SparqlQueryGenerationRequest(
                QueryVariable("item"),
                listOf(pattern().copy(`object` = LiteralObject("A&B"), filter = StartsWith("ignored"))),
            )
        val result = service().generate(request, local) as SparqlQueryGenerationResult.Success
        assertTrue(result.query.contains("str(?literalValue0) = \"A&B\""))
        assertTrue("FILTER (STRSTARTS" !in result.query)
        assertTrue("ORDER BY" !in result.query)
    }

    @Test
    fun `remaining SELECT compatibility fixtures are generated without execution`() {
        val requests =
            listOf(
                "SELECT-OPTIONAL-001" to request(),
                "SELECT-FILTER-CONTAINS-001" to requestWithFilter(StartsWith("ignored")),
                "SELECT-FILTER-GREATER-001" to requestWithFilter(GreaterOrEqual("2")),
                "SELECT-FILTER-LESSER-001" to requestWithFilter(LessOrEqual("2")),
                "SELECT-ORDER-MAX-001" to requestWithFilter(Maximum),
                "SELECT-ORDER-MIN-001" to requestWithFilter(Minimum),
                "SELECT-LIMIT-TWO-001" to SparqlQueryGenerationRequest(QueryVariable("item"), limit = 2),
            )
        requests.forEach { (_, input) ->
            assertInstanceOf(SparqlQueryGenerationResult.Success::class.java, service().generate(input, local))
        }
    }

    @Test
    fun `repeated generation is deterministic`() {
        val first = service().generate(request(), local)
        val second = service().generate(request(), local)
        assertEquals(first, second)
    }

    @Test
    fun `all generated queries are syntax validated and never executed`() {
        val execution = RecordingExecution()
        val context = RemoteSparqlEndpointContext(RemoteSparqlEndpoint.parse("https://example.test/sparql"), execution)
        val result = service(JenaSparqlSyntaxValidator()).generate(request(), context)
        assertInstanceOf(SparqlQueryGenerationResult.Success::class.java, result)
        assertEquals(0, execution.calls)
    }

    @Test
    fun `invalid generator output is an explicit failure`() {
        val result = service(AlwaysInvalidValidator()).generate(request(), local)
        assertInstanceOf(SparqlQueryGenerationResult.InvalidGeneratedQuery::class.java, result)
    }

    @Test
    fun `invalid identifiers and malicious paths are rejected`() {
        assertFailsWith<IllegalArgumentException> { QueryVariable("item;DROP") }
        assertFailsWith<IllegalArgumentException> { IriTerm("https://example.test/a b") }
    }

    @Test
    fun `invalid request values are returned without validation or execution`() {
        val result = service().generate(SparqlQueryGenerationRequest(QueryVariable("item"), limit = -1), local)
        assertInstanceOf(SparqlQueryGenerationResult.InvalidInput::class.java, result)
    }

    private fun request() =
        SparqlQueryGenerationRequest(
            variable = QueryVariable("item"),
            patterns = listOf(pattern()),
        )

    private fun pattern() =
        TriplePattern(
            subject = VariableTerm(QueryVariable("item")),
            predicate = IriTerm("https://example.test/type"),
            `object` = TermObject(VariableTerm(QueryVariable("kind"))),
        )

    private fun requestWithFilter(filter: QueryFilter) =
        SparqlQueryGenerationRequest(
            QueryVariable("item"),
            listOf(pattern().copy(`object` = LiteralObject("2"), filter = filter)),
        )

    private fun endpoint(url: String) =
        RemoteSparqlEndpointContext(
            RemoteSparqlEndpoint.parse(url),
            RecordingExecution(),
        )

    private fun service(validator: SparqlSyntaxValidator = AlwaysValidValidator()): SparqlQueryGenerationService {
        return SparqlQueryGenerationService(generator, validator)
    }
}

private class RecordingExecution : EndpointExecution {
    var calls: Int = 0
    override val isLocal: Boolean = false
    override val isWikidata: Boolean = false

    override suspend fun execute(query: String): SparqlSelectResult {
        calls++
        error("query execution is outside this use case")
    }
}

private class AlwaysValidValidator : SparqlSyntaxValidator {
    override fun validate(query: String) = SparqlSyntaxValidation.Valid
}

private class AlwaysInvalidValidator : SparqlSyntaxValidator {
    override fun validate(query: String) = SparqlSyntaxValidation.Invalid("invalid fixture")
}

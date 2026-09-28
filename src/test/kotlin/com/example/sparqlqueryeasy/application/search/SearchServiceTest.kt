@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.application.search

import com.example.sparqlqueryeasy.application.endpoints.BuiltInGraphEndpointContext
import com.example.sparqlqueryeasy.application.endpoints.EndpointContextResolution
import com.example.sparqlqueryeasy.application.endpoints.RemoteSparqlEndpoint
import com.example.sparqlqueryeasy.application.endpoints.RemoteSparqlEndpointContext
import com.example.sparqlqueryeasy.application.endpoints.WikidataEndpointContext
import com.example.sparqlqueryeasy.application.query.PropertyResult
import com.example.sparqlqueryeasy.application.query.ResultFilteringService
import com.example.sparqlqueryeasy.application.relationships.EndpointExecution
import com.example.sparqlqueryeasy.domain.model.BoundSparqlBinding
import com.example.sparqlqueryeasy.domain.model.Iri
import com.example.sparqlqueryeasy.domain.model.Literal
import com.example.sparqlqueryeasy.domain.model.RdfGraph
import com.example.sparqlqueryeasy.domain.model.SparqlQueryExecutionFailure
import com.example.sparqlqueryeasy.domain.model.SparqlResultRow
import com.example.sparqlqueryeasy.domain.model.SparqlSelectResult
import com.example.sparqlqueryeasy.domain.model.SparqlVariable
import com.example.sparqlqueryeasy.domain.model.UnboundSparqlBinding
import com.example.sparqlqueryeasy.wikidata.entitysearch.WikidataEntitySearchFailure
import com.example.sparqlqueryeasy.wikidata.query.CSharpCompatibleWikidataQueryGenerator
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Test

class SearchServiceTest {
    @Test
    fun `SEARCH-LOCAL-001 filters before Take 20 and preserves first matching order`() =
        runBlocking {
            val rows =
                (1..21).map {
                    row(
                        "property" to Iri("https://example.test/$it"),
                        "propertyLabel" to Literal("Football $it"),
                        "propertyParentType" to Literal("objetoClasse"),
                    )
                }
            val endpoint = BuiltInGraphEndpointContext(RdfGraph(), RecordingExecution(result(*rows.toTypedArray())))
            val service = service()

            val response = service.search(SearchRequest("foo"), endpoint) as SearchResult.Success

            response.values.map(PropertyResult::propertyId) shouldBe (1..20).map { "<https://example.test/$it>" }
            response.sparqlQuery!!.contains("STRSTARTS") shouldBe false
            response.sparqlQuery.contains("LIMIT") shouldBe false
        }

    @Test
    fun `TTL-EMPTY-001 local empty graph returns no values`() =
        runBlocking {
            val response =
                service().search(
                    SearchRequest("football"),
                    BuiltInGraphEndpointContext(RdfGraph(), RecordingExecution(result())),
                ) as SearchResult.Success

            response.values shouldBe emptyList()
        }

    @Test
    fun `local search keeps fewer than twenty matching rows in executor order`() =
        runBlocking {
            val endpoint =
                BuiltInGraphEndpointContext(
                    RdfGraph(),
                    RecordingExecution(
                        result(
                            row(
                                "property" to Iri("https://example.test/second"),
                                "propertyLabel" to Literal("football second"),
                                "propertyParentType" to Literal("objetoClasse"),
                            ),
                            row(
                                "property" to Iri("https://example.test/first"),
                                "propertyLabel" to Literal("Football first"),
                                "propertyParentType" to Literal("objetoClasse"),
                            ),
                        ),
                    ),
                )

            val response = service().search(SearchRequest("FOOT"), endpoint) as SearchResult.Success

            response.values.map(PropertyResult::propertyId) shouldBe
                listOf("<https://example.test/second>", "<https://example.test/first>")
        }

    @Test
    fun `generic remote SPARQL search uses escaped starts filter and requested limit`() =
        runBlocking {
            val execution = RecordingExecution(result(row("property" to Iri("https://example.test/p"), "propertyLabel" to Literal("Ação"))))
            val response = service().search(SearchRequest("A\"ção; } UNION {", 2), remote(execution)) as SearchResult.Success

            response.values shouldBe listOf(PropertyResult("<https://example.test/p>", "Ação"))
            execution.queries.single().contains("STRSTARTS") shouldBe true
            execution.queries.single().contains("\\\"") shouldBe true
            execution.queries.single().endsWith("LIMIT 2\n") shouldBe true
        }

    @Test
    fun `WIKIDATA-SEARCH-RECORD-001 uses MediaWiki instead of endpoint executor`() =
        runBlocking {
            val execution = RecordingExecution(result())
            val client =
                FakeEntitySearchClient(
                    listOf(
                        WikidataEntitySearchRecord(
                            "Q42",
                            conceptUri = "http://www.wikidata.org/entity/Q42",
                            label = "Douglas Adams",
                        ),
                    ),
                )
            val endpoint =
                WikidataEndpointContext(
                    RemoteSparqlEndpoint.parse("https://query.wikidata.org/sparql"),
                    execution,
                )

            val response = service(client).search(SearchRequest("Douglas", 5), endpoint) as SearchResult.Success

            response.values shouldBe
                listOf(
                    PropertyResult(
                        "<http://www.wikidata.org/entity/Q42>",
                        "(Q42) Douglas Adams",
                        "object",
                    ),
                )
            client.requests shouldBe listOf(WikidataEntitySearchRequest("Douglas", 5))
            execution.queries shouldBe emptyList()
        }

    @Test
    fun `WIKIDATA-SEARCH-ERROR-001 missing fields and empty text are explicit`() =
        runBlocking {
            val client = FakeEntitySearchClient(listOf(WikidataEntitySearchRecord()))
            val endpoint =
                WikidataEndpointContext(
                    RemoteSparqlEndpoint.parse("https://query.wikidata.org/sparql"),
                    RecordingExecution(result()),
                )
            val service = service(client)

            (service.search(SearchRequest("x"), endpoint) as SearchResult.Success).values shouldBe
                listOf(PropertyResult("<>", "() ", "object"))
            service.search(SearchRequest(""), endpoint) shouldBe SearchResult.Success(emptyList())
            val failure =
                service(
                    FakeEntitySearchClient(
                        failure = WikidataEntitySearchFailure("https://example.test", 429, "rate limited"),
                    ),
                ).search(SearchRequest("x"), endpoint) as SearchResult.ExecutionFailure
            failure.diagnostic shouldBe "rate limited"
        }

    @Test
    fun `LOCAL-CACHE-MISS-001 and SPARQL execution failure are explicit`() =
        runBlocking {
            service().search(
                SearchRequest("x"),
                EndpointContextResolution.LocalGraphUnavailable("missing"),
            ) shouldBe SearchResult.LocalGraphUnavailable("missing")
            val failure =
                service().search(
                    SearchRequest("x"),
                    remote {
                        throw SparqlQueryExecutionFailure("query", "remote failed")
                    },
                ) as SearchResult.ExecutionFailure
            failure.diagnostic.contains("remote failed") shouldBe true
        }

    @Test
    fun `interleaved endpoint searches do not share state`() =
        runBlocking {
            val first = remote(RecordingExecution(result(row("property" to Literal("first"), "propertyLabel" to Literal("First")))))
            val second = remote(RecordingExecution(result(row("property" to Literal("second"), "propertyLabel" to Literal("Second")))))
            val service = service()

            (service.search(SearchRequest("F"), first) as SearchResult.Success).values.single().propertyId shouldBe "first"
            (service.search(SearchRequest("S"), second) as SearchResult.Success).values.single().propertyId shouldBe "second"
        }

    private fun service(client: WikidataEntitySearchClient = FakeEntitySearchClient()) =
        SearchService(CSharpCompatibleWikidataQueryGenerator(), ResultFilteringService(), client)

    private fun remote(execution: RecordingExecution) =
        RemoteSparqlEndpointContext(
            RemoteSparqlEndpoint.parse("https://example.test/sparql"),
            execution,
        )

    private fun remote(action: suspend (String) -> SparqlSelectResult) = remote(RecordingExecution(action))
}

private class FakeEntitySearchClient(
    private val response: List<WikidataEntitySearchRecord> = emptyList(),
    private val failure: WikidataEntitySearchFailure? = null,
) : WikidataEntitySearchClient {
    val requests = mutableListOf<WikidataEntitySearchRequest>()

    override suspend fun search(request: WikidataEntitySearchRequest): List<WikidataEntitySearchRecord> {
        requests += request
        failure?.let { throw it }
        return response
    }
}

private class RecordingExecution : EndpointExecution {
    private val action: suspend (String) -> SparqlSelectResult
    val queries = mutableListOf<String>()
    override val isLocal: Boolean = false
    override val isWikidata: Boolean = false

    constructor(result: SparqlSelectResult) : this({ result })

    constructor(action: suspend (String) -> SparqlSelectResult) {
        this.action = action
    }

    override suspend fun execute(query: String): SparqlSelectResult {
        queries += query
        return action(query)
    }
}

private fun result(vararg rows: Map<String, com.example.sparqlqueryeasy.domain.model.RdfValue?>): SparqlSelectResult {
    val variables = listOf("property", "propertyLabel", "propertyParentType").map(::SparqlVariable)
    return SparqlSelectResult(
        variables,
        rows.map {
                values ->
            SparqlResultRow(
                variables.map {
                        variable ->
                    values[variable.name]?.let { BoundSparqlBinding(variable, it) } ?: UnboundSparqlBinding(variable)
                },
            )
        },
    )
}

private fun row(
    vararg values: Pair<String, com.example.sparqlqueryeasy.domain.model.RdfValue?>,
): Map<String, com.example.sparqlqueryeasy.domain.model.RdfValue?> =
    mapOf(
        *values,
    )

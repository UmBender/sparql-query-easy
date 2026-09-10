@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.application.query

import com.example.sparqlqueryeasy.application.endpoints.BuiltInGraphEndpointContext
import com.example.sparqlqueryeasy.application.endpoints.EndpointContextResolution
import com.example.sparqlqueryeasy.application.endpoints.RemoteSparqlEndpoint
import com.example.sparqlqueryeasy.application.endpoints.RemoteSparqlEndpointContext
import com.example.sparqlqueryeasy.application.endpoints.UploadedGraphEndpointContext
import com.example.sparqlqueryeasy.application.endpoints.WikidataEndpointContext
import com.example.sparqlqueryeasy.application.relationships.EndpointExecution
import com.example.sparqlqueryeasy.domain.model.BoundSparqlBinding
import com.example.sparqlqueryeasy.domain.model.Iri
import com.example.sparqlqueryeasy.domain.model.Literal
import com.example.sparqlqueryeasy.domain.model.RdfGraph
import com.example.sparqlqueryeasy.domain.model.RdfGraphHandle
import com.example.sparqlqueryeasy.domain.model.SparqlQueryExecutionFailure
import com.example.sparqlqueryeasy.domain.model.SparqlResultRow
import com.example.sparqlqueryeasy.domain.model.SparqlSelectResult
import com.example.sparqlqueryeasy.domain.model.SparqlVariable
import com.example.sparqlqueryeasy.domain.model.UnboundSparqlBinding
import com.example.sparqlqueryeasy.rdf.jena.JenaLocalSparqlExecutor
import com.example.sparqlqueryeasy.rdf.jena.JenaSparqlSyntaxValidator
import com.example.sparqlqueryeasy.rdf.jena.JenaTurtleParser
import com.example.sparqlqueryeasy.wikidata.query.CSharpCompatibleWikidataQueryGenerator
import com.example.sparqlqueryeasy.wikidata.query.Contains
import com.example.sparqlqueryeasy.wikidata.query.GreaterOrEqual
import com.example.sparqlqueryeasy.wikidata.query.IriTerm
import com.example.sparqlqueryeasy.wikidata.query.LessOrEqual
import com.example.sparqlqueryeasy.wikidata.query.LiteralObject
import com.example.sparqlqueryeasy.wikidata.query.Maximum
import com.example.sparqlqueryeasy.wikidata.query.Minimum
import com.example.sparqlqueryeasy.wikidata.query.QueryVariable
import com.example.sparqlqueryeasy.wikidata.query.StartsWith
import com.example.sparqlqueryeasy.wikidata.query.TermObject
import com.example.sparqlqueryeasy.wikidata.query.TriplePattern
import com.example.sparqlqueryeasy.wikidata.query.VariableTerm
import com.example.sparqlqueryeasy.wikidata.query.WikidataQuery
import com.example.sparqlqueryeasy.wikidata.query.WikidataQueryGenerator
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Test

class GeneralQueryServiceTest {
    private val service =
        GeneralQueryService(CSharpCompatibleWikidataQueryGenerator(), JenaSparqlSyntaxValidator(), ResultFilteringService())

    @Test
    fun `SELECT-BASIC-001 executes uploaded local context and preserves RDF mapping`() =
        runBlocking {
            val executor = RecordingExecution(result(row("item" to Iri("https://example.test/item"), "itemLabel" to Literal("Item"))))
            val endpoint =
                UploadedGraphEndpointContext(
                    "00000000-0000-0000-0000-000000000001",
                    RdfGraphHandle("00000000-0000-0000-0000-000000000001"),
                    RdfGraph(),
                    executor,
                )

            val response = service.execute(request(), endpoint) as GeneralQueryResult.Success

            response.values shouldBe listOf(PropertyResult("<https://example.test/item>", "Item"))
            executor.queries.single().contains("SELECT DISTINCT ?item ?itemLabel ?itemRdfType ?itemType") shouldBe true
        }

    @Test
    fun `TTL prefix base unicode blank node and numeric fixtures execute against uploaded graph`() =
        runBlocking {
            val graph =
                JenaTurtleParser().parse(
                    """
                    @base <https://example.test/> .
                    @prefix ex: <https://example.test/> .
                    ex:ação a ex:Class ;
                        ex:predicate 42 ;
                        ex:blank [ ex:label "child" ] .
                    """.trimIndent(),
                )
            val endpoint =
                UploadedGraphEndpointContext(
                    "00000000-0000-0000-0000-000000000002",
                    RdfGraphHandle("00000000-0000-0000-0000-000000000002"),
                    graph,
                    LocalJenaExecution(graph),
                )

            val response = service.execute(request(), endpoint) as GeneralQueryResult.Success

            response.values shouldBe listOf(PropertyResult("<https://example.test/ação>", "<https://example.test/ação>"))
        }

    @Test
    fun `SELECT-OPTIONAL-001 and SELECT-DISTINCT-001 preserve unbound label fallback and duplicate rows`() =
        runBlocking {
            val endpoint = remote(result(row("item" to Iri("https://example.test/item")), row("item" to Iri("https://example.test/item"))))

            val response = service.execute(request(), endpoint) as GeneralQueryResult.Success

            response.values shouldBe
                listOf(
                    PropertyResult("<https://example.test/item>", "<https://example.test/item>"),
                    PropertyResult("<https://example.test/item>", "<https://example.test/item>"),
                )
            response.query.contains("SELECT DISTINCT") shouldBe true
        }

    @Test
    fun `SELECT-EMPTY-001 preserves an empty executor result`() =
        runBlocking {
            val response = service.execute(request(), remote(result())) as GeneralQueryResult.Success

            response.values shouldBe emptyList()
        }

    @Test
    fun `application filtering occurs after generator limit`() =
        runBlocking {
            val endpoint = remote(result(emptyMap(), row("item" to Literal("kept"))))

            val response = service.execute(request(), endpoint) as GeneralQueryResult.Success

            response.query.endsWith("LIMIT 2\n") shouldBe true
            response.values shouldBe listOf(PropertyResult("kept", "kept"))
        }

    @Test
    fun `filter and ordering fixtures are delegated to generator before execution`() =
        runBlocking {
            val filters =
                listOf(
                    "SELECT-FILTER-STARTS-001" to StartsWith("a"),
                    "SELECT-FILTER-CONTAINS-001" to Contains("a"),
                    "SELECT-FILTER-GREATER-001" to GreaterOrEqual("2"),
                    "SELECT-FILTER-LESSER-001" to LessOrEqual("2"),
                    "SELECT-ORDER-MAX-001" to Maximum,
                    "SELECT-ORDER-MIN-001" to Minimum,
                )
            filters.forEach { (_, filter) ->
                val endpoint = remote(result())
                val response = service.execute(request(filter), endpoint) as GeneralQueryResult.Success
                response.query.contains("FILTER") || response.query.contains("ORDER BY") shouldBe true
                if (filter == Maximum || filter == Minimum) response.query.endsWith("LIMIT 1\n") shouldBe true
            }
        }

    @Test
    fun `QUERY-EMPTY-WHERE-001 preserves C sharp unprojected parent type behavior`() =
        runBlocking {
            val endpoint = remote(result(row("item" to Iri("https://example.test/class"), "itemType" to Literal("objetoClasse"))))

            val response = service.execute(GeneralQueryRequest(QueryVariable("item")), endpoint) as GeneralQueryResult.Success

            response.query.contains("?itemParentType") shouldBe true
            response.query.contains("SELECT DISTINCT ?item ?itemLabel ?itemRdfType ?itemType") shouldBe true
            response.values shouldBe emptyList()
        }

    @Test
    fun `built in generic remote and Wikidata contexts select their supplied executor`() =
        runBlocking {
            val builtInExecution = RecordingExecution(result(row("item" to Literal("built-in"))))
            val genericExecution = RecordingExecution(result(row("item" to Literal("generic"))))
            val wikidataExecution = RecordingExecution(result(row("item" to Literal("wikidata"))))
            val builtIn = BuiltInGraphEndpointContext(RdfGraph(), builtInExecution)
            val generic = remote(genericExecution)
            val wikidata = WikidataEndpointContext(RemoteSparqlEndpoint.parse("https://query.wikidata.org/sparql"), wikidataExecution)

            (service.execute(request(), builtIn) as GeneralQueryResult.Success).values.single().propertyId shouldBe "built-in"
            (service.execute(request(), generic) as GeneralQueryResult.Success).values.single().propertyId shouldBe "generic"
            val wikidataResponse = service.execute(request(), wikidata) as GeneralQueryResult.Success
            wikidataResponse.values.single().propertyId shouldBe "wikidata"
            wikidataResponse.query.contains("PREFIX wikibase:") shouldBe true
            val directClaimResponse =
                service.execute(request().copy(ignoreWikidata = false), wikidata) as GeneralQueryResult.Success
            directClaimResponse.query.contains("wikibase:directClaim") shouldBe true
        }

    @Test
    fun `SELECT-INVALID-001 and executor failures are explicit results`() =
        runBlocking {
            val invalidService = GeneralQueryService(InvalidGenerator(), JenaSparqlSyntaxValidator(), ResultFilteringService())
            invalidService.execute(request(), remote(result())).shouldBeInstance<GeneralQueryResult.InvalidQuery>()

            val failing = remote { throw SparqlQueryExecutionFailure("SELECT", "recorded remote failure") }
            val failure = service.execute(request(), failing) as GeneralQueryResult.ExecutionFailure
            failure.diagnostic shouldBe "SPARQL query execution failed: recorded remote failure"
        }

    @Test
    fun `LOCAL-CACHE-MISS-001 is not executed`() =
        runBlocking {
            service.execute(request(), EndpointContextResolution.LocalGraphUnavailable("missing")) shouldBe
                GeneralQueryResult.LocalGraphUnavailable("missing")
        }

    @Test
    fun `interleaved contexts have no shared state leakage`() =
        runBlocking {
            val first = remote(result(row("item" to Literal("first"))))
            val second = remote(result(row("item" to Literal("second"))))

            (service.execute(request(), first) as GeneralQueryResult.Success).values.single().propertyId shouldBe "first"
            (service.execute(request(), second) as GeneralQueryResult.Success).values.single().propertyId shouldBe "second"
        }

    private fun request(filter: com.example.sparqlqueryeasy.wikidata.query.QueryFilter? = null) =
        GeneralQueryRequest(
            QueryVariable("item"),
            listOf(
                TriplePattern(
                    VariableTerm(QueryVariable("item")),
                    IriTerm("https://example.test/predicate"),
                    if (filter == null) TermObject(VariableTerm(QueryVariable("value"))) else LiteralObject("2"),
                    filter,
                ),
            ),
            limit = 2,
        )

    private fun remote(execution: RecordingExecution) =
        RemoteSparqlEndpointContext(RemoteSparqlEndpoint.parse("https://example.test/sparql"), execution)

    private fun remote(results: SparqlSelectResult) = remote(RecordingExecution(results))

    private fun remote(block: suspend (String) -> SparqlSelectResult) =
        RemoteSparqlEndpointContext(RemoteSparqlEndpoint.parse("https://example.test/sparql"), RecordingExecution(block))
}

private class RecordingExecution : EndpointExecution {
    val queries = mutableListOf<String>()
    private val action: suspend (String) -> SparqlSelectResult
    override val isLocal: Boolean = false
    override val isWikidata: Boolean = false

    constructor(results: SparqlSelectResult) : this({ results })

    constructor(action: suspend (String) -> SparqlSelectResult) {
        this.action = action
    }

    override suspend fun execute(query: String): SparqlSelectResult {
        queries += query
        return action(query)
    }
}

private class InvalidGenerator : WikidataQueryGenerator {
    override fun generate(input: WikidataQuery): String = "SELECT WHERE {"
}

private class LocalJenaExecution(
    private val graph: RdfGraph,
) : EndpointExecution {
    private val executor = JenaLocalSparqlExecutor()
    override val isLocal: Boolean = true
    override val isWikidata: Boolean = false

    override suspend fun execute(query: String): SparqlSelectResult = executor.execute(graph, query) as SparqlSelectResult
}

private fun result(vararg rows: Map<String, com.example.sparqlqueryeasy.domain.model.RdfValue?>): SparqlSelectResult {
    val variables = listOf("item", "itemLabel", "itemRdfType", "itemType").map(::SparqlVariable)
    return SparqlSelectResult(
        variables,
        rows.map { values ->
            SparqlResultRow(
                variables.map { variable ->
                    values[variable.name]?.let { BoundSparqlBinding(variable, it) } ?: UnboundSparqlBinding(variable)
                },
            )
        },
    )
}

private fun row(
    vararg values: Pair<String, com.example.sparqlqueryeasy.domain.model.RdfValue?>,
): Map<String, com.example.sparqlqueryeasy.domain.model.RdfValue?> = mapOf(*values)

private inline fun <reified T> Any.shouldBeInstance(): T {
    check(this is T) { "Expected ${T::class.simpleName}, got ${this::class.simpleName}" }
    return this
}

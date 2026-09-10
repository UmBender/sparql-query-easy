@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.endpoints.BRASILEIRAO_ENDPOINT_ID
import com.example.sparqlqueryeasy.application.endpoints.BuiltInGraphProvider
import com.example.sparqlqueryeasy.application.endpoints.EndpointContextResolver
import com.example.sparqlqueryeasy.application.endpoints.EndpointExecutionResolverAdapter
import com.example.sparqlqueryeasy.application.endpoints.LocalEndpointExecutorFactory
import com.example.sparqlqueryeasy.application.endpoints.RemoteEndpointExecutorFactory
import com.example.sparqlqueryeasy.application.localdatabase.InMemoryLocalGraphCache
import com.example.sparqlqueryeasy.application.localdatabase.LocalDatabaseUploadService
import com.example.sparqlqueryeasy.application.query.GeneralQueryService
import com.example.sparqlqueryeasy.application.query.ResultFilteringService
import com.example.sparqlqueryeasy.application.querygeneration.SparqlQueryGenerationService
import com.example.sparqlqueryeasy.application.relationships.ElementRelationshipsService
import com.example.sparqlqueryeasy.application.relationships.EndpointExecution
import com.example.sparqlqueryeasy.application.relationships.RelationshipValueService
import com.example.sparqlqueryeasy.application.search.SearchService
import com.example.sparqlqueryeasy.application.search.WikidataEntitySearchClient
import com.example.sparqlqueryeasy.application.search.WikidataEntitySearchRecord
import com.example.sparqlqueryeasy.application.search.WikidataEntitySearchRequest
import com.example.sparqlqueryeasy.domain.model.BoundSparqlBinding
import com.example.sparqlqueryeasy.domain.model.Iri
import com.example.sparqlqueryeasy.domain.model.Literal
import com.example.sparqlqueryeasy.domain.model.RdfGraph
import com.example.sparqlqueryeasy.domain.model.SparqlQueryExecutionFailure
import com.example.sparqlqueryeasy.domain.model.SparqlResultRow
import com.example.sparqlqueryeasy.domain.model.SparqlSelectResult
import com.example.sparqlqueryeasy.domain.model.SparqlVariable
import com.example.sparqlqueryeasy.domain.model.UnboundSparqlBinding
import com.example.sparqlqueryeasy.rdf.jena.JenaSparqlSyntaxValidator
import com.example.sparqlqueryeasy.rdf.jena.JenaTurtleParser
import com.example.sparqlqueryeasy.wikidata.query.CSharpCompatibleWikidataQueryGenerator
import io.kotest.matchers.shouldBe
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.Test

class QueryRoutesTest {
    @Test
    fun `POST api query maps general-query success to the C sharp data envelope`() =
        testApplication {
            val execution = RecordingExecution(generalResult())
            application { queryTestModule(execution) }

            val response =
                client.post("/api/query") {
                    jsonBody(
                        """{"endpointUrl":"$BRASILEIRAO_ENDPOINT_ID","variableName":"?item","where":[""" +
                            """{"subject":"?item","predicate":"<https://example.test/p>","object":"?value"}]}""",
                    )
                }

            response.status shouldBe HttpStatusCode.OK
            response.bodyAsText() shouldBe
                """{"data":[{"propertyId":"<https://example.test/item>","propertyLabel":"Item","propertyType":"",""" +
                "\"propertyClass\":\"<https://example.test/Class>\"}]}"
        }

    @Test
    fun `SELECT-INVALID-001 returns an explicit validation response without execution`() =
        testApplication {
            val execution = RecordingExecution(generalResult())
            application { queryTestModule(execution) }

            val response =
                client.post("/api/query") {
                    jsonBody("""{"endpointUrl":"$BRASILEIRAO_ENDPOINT_ID","variableName":"?item } UNION {","where":[]}""")
                }

            response.status shouldBe HttpStatusCode.BadRequest
            response.bodyAsText().contains("Invalid SPARQL variable name") shouldBe true
            execution.queries shouldBe emptyList()
        }

    @Test
    fun `LOCAL-CACHE-MISS-001 maps a missing uploaded graph to not found`() =
        testApplication {
            application { queryTestModule(RecordingExecution(generalResult())) }

            val response =
                client.post("/api/query") {
                    jsonBody("""{"endpointUrl":"11111111-1111-1111-1111-111111111111","variableName":"?item","where":[]}""")
                }

            response.status shouldBe HttpStatusCode.NotFound
            response.bodyAsText() shouldBe
                """{"error":"Local RDF graph is unavailable: 11111111-1111-1111-1111-111111111111"}"""
        }

    @Test
    fun `POST api query sparql ignores filter type as C sharp does and never executes`() =
        testApplication {
            val execution = RecordingExecution(generalResult())
            application { queryTestModule(execution) }

            val response =
                client.post("/api/query/sparql") {
                    jsonBody(
                        """{"endpointUrl":"$BRASILEIRAO_ENDPOINT_ID","limit":2,"variableName":"?item","where":[""" +
                            """{"subject":"?item","predicate":"<https://example.test/p>","object":"value","filterType":0}]}""",
                    )
                }

            response.status shouldBe HttpStatusCode.OK
            response.bodyAsText().contains("""str(?literalValue0) = \"value\"""") shouldBe true
            response.bodyAsText().contains("LIMIT 2") shouldBe true
            execution.queries shouldBe emptyList()
        }

    @Test
    fun `POST relationships preserves null omitted C sharp PropertyDto fields`() =
        testApplication {
            val execution = RecordingExecution(relationshipsResult())
            application { queryTestModule(execution) }

            val response =
                client.post("/api/query/relationships") {
                    jsonBody("""{"endpointUrl":"$BRASILEIRAO_ENDPOINT_ID","id":"<https://example.test/item>"}""")
                }

            response.status shouldBe HttpStatusCode.OK
            response.bodyAsText() shouldBe
                """{"data":[{"propertyId":"<https://example.test/p>","propertyLabel":"Property","propertyType":"objeto",""" +
                "\"propertyClass\":null}]}"
        }

    @Test
    fun `POST relationship-value preserves literal mapping and validates missing identifiers`() =
        testApplication {
            val execution = RecordingExecution(valueResult())
            application { queryTestModule(execution) }

            val success =
                client.post("/api/query/relationship-value") {
                    jsonBody(
                        """{"endpointUrl":"$BRASILEIRAO_ENDPOINT_ID","subjectId":"<https://example.test/item>",""" +
                            "\"predicateId\":\"<https://example.test/p>\",\"isLiteral\":true}",
                    )
                }
            val invalid = client.post("/api/query/relationship-value") { jsonBody("{}") }

            success.status shouldBe HttpStatusCode.OK
            success.bodyAsText() shouldBe
                """{"data":[{"propertyId":"literal","propertyLabel":"literal","propertyType":"text","propertyClass":null}]}"""
            invalid.status shouldBe HttpStatusCode.BadRequest
            invalid.bodyAsText() shouldBe """{"error":"Missing required field: subjectId"}"""
        }

    @Test
    fun `POST search preserves empty behavior and maps executor failures to bad gateway`() =
        testApplication {
            val empty = RecordingExecution(generalResult())
            application { queryTestModule(empty) }

            val response =
                client.post("/api/query/search") {
                    jsonBody("""{"endpointUrl":"$BRASILEIRAO_ENDPOINT_ID","search":null}""")
                }

            response.status shouldBe HttpStatusCode.OK
            response.bodyAsText() shouldBe """{"data":[]}"""
            empty.queries shouldBe emptyList()
        }

    @Test
    fun `remote failures become explicit HTTP failures without live traffic`() =
        testApplication {
            val failure = RecordingExecution { throw SparqlQueryExecutionFailure("query", "fake upstream failure") }
            application { queryTestModule(failure) }

            val response =
                client.post("/api/query") {
                    jsonBody("""{"endpointUrl":"https://example.test/sparql","variableName":"?item","where":[]}""")
                }

            response.status shouldBe HttpStatusCode.BadGateway
            response.bodyAsText().contains("fake upstream failure") shouldBe true
        }

    private fun Application.queryTestModule(execution: RecordingExecution) {
        val resolver =
            EndpointContextResolver(
                InMemoryLocalGraphCache(),
                object : BuiltInGraphProvider {
                    override fun graph(): RdfGraph = RdfGraph()
                },
                LocalEndpointExecutorFactory { execution },
                RemoteEndpointExecutorFactory { _, _ -> execution },
            )
        val generator = CSharpCompatibleWikidataQueryGenerator()
        val filtering = ResultFilteringService()
        configureSerialization()
        configureRouting(
            HttpDependencies(
                LocalDatabaseUploadService(JenaTurtleParser(), InMemoryLocalGraphCache()),
                QueryHttpDependencies(
                    resolver,
                    ElementRelationshipsService(EndpointExecutionResolverAdapter(resolver), generator, filtering),
                    RelationshipValueService(EndpointExecutionResolverAdapter(resolver), generator, filtering),
                    SearchService(generator, filtering, EmptyEntitySearchClient),
                    GeneralQueryService(generator, JenaSparqlSyntaxValidator(), filtering),
                    SparqlQueryGenerationService(generator, JenaSparqlSyntaxValidator()),
                ),
            ),
        )
    }

    private fun io.ktor.client.request.HttpRequestBuilder.jsonBody(value: String) {
        headers.append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
        setBody(value)
    }
}

private object EmptyEntitySearchClient : WikidataEntitySearchClient {
    override suspend fun search(request: WikidataEntitySearchRequest): List<WikidataEntitySearchRecord> = emptyList()
}

private class RecordingExecution(
    private val response: suspend (String) -> SparqlSelectResult,
) : EndpointExecution {
    constructor(response: SparqlSelectResult) : this({ response })

    val queries = mutableListOf<String>()
    override val isLocal: Boolean = false
    override val isWikidata: Boolean = false

    override suspend fun execute(query: String): SparqlSelectResult {
        queries += query
        return response(query)
    }
}

private fun generalResult() =
    select(
        listOf("item", "itemLabel", "itemRdfType", "itemType"),
        mapOf(
            "item" to Iri("https://example.test/item"),
            "itemLabel" to Literal("Item"),
            "itemRdfType" to Iri("https://example.test/Class"),
            "itemType" to Literal("objetoClasse"),
        ),
    )

private fun relationshipsResult() =
    select(
        listOf("property", "propertyLabel", "propertyType"),
        mapOf(
            "property" to Iri("https://example.test/p"),
            "propertyLabel" to Literal("Property"),
            "propertyType" to Literal("objeto"),
        ),
    )

private fun valueResult() =
    select(
        listOf("property", "propertyLabel"),
        mapOf("property" to Literal("literal"), "propertyLabel" to Literal("ignored")),
    )

private fun select(
    names: List<String>,
    values: Map<String, com.example.sparqlqueryeasy.domain.model.RdfValue?>,
): SparqlSelectResult {
    val variables = names.map(::SparqlVariable)
    return SparqlSelectResult(
        variables,
        listOf(
            SparqlResultRow(
                variables.map { variable ->
                    values[variable.name]?.let { BoundSparqlBinding(variable, it) }
                        ?: UnboundSparqlBinding(variable)
                },
            ),
        ),
    )
}

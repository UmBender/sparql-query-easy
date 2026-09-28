@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.http

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
import com.example.sparqlqueryeasy.domain.model.RdfGraph
import com.example.sparqlqueryeasy.domain.model.SparqlSelectResult
import com.example.sparqlqueryeasy.rdf.jena.JenaSparqlSyntaxValidator
import com.example.sparqlqueryeasy.rdf.jena.JenaTurtleParser
import com.example.sparqlqueryeasy.wikidata.entitysearch.KtorWikidataEntitySearchClient
import com.example.sparqlqueryeasy.wikidata.query.CSharpCompatibleWikidataQueryGenerator
import io.kotest.matchers.shouldBe
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.HttpRequestData
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.server.application.Application
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.Test
import java.nio.file.Files
import java.nio.file.Path

class RecordedWikidataRoutesTest {
    @Test
    fun `recorded Wikidata success replays through the full search route`() =
        testApplication {
            val requests = mutableListOf<HttpRequestData>()
            application {
                recordedSearchModule(
                    HttpStatusCode.OK,
                    fixture("recorded-WIKIDATA-SEARCH-RECORD-001-body.json"),
                    requests,
                )
            }

            val response = client.postSearch("Douglas Adams", 2)

            response.status shouldBe HttpStatusCode.OK
            val expectedBody =
                """{"data":[{"propertyId":"<http://www.wikidata.org/entity/Q42>",""" +
                    """"propertyLabel":"(Q42) Douglas Adams","propertyType":"object","propertyClass":null},""" +
                    """{"propertyId":"<http://www.wikidata.org/entity/Q28421831>",""" +
                    """"propertyLabel":"(Q28421831) Douglas Adams","propertyType":"object","propertyClass":null}]}"""
            response.bodyAsText() shouldBe expectedBody
            requests.size shouldBe 1
            requests.single().url.host shouldBe "www.wikidata.org"
            requests.single().url.parameters["action"] shouldBe "wbsearchentities"
            requests.single().url.parameters["continue"] shouldBe "0"
            requests.single().url.parameters["format"] shouldBe "json"
            requests.single().url.parameters["language"] shouldBe "en"
            requests.single().url.parameters["origin"] shouldBe "*"
            requests.single().url.parameters["search"] shouldBe "Douglas Adams"
            requests.single().url.parameters["limit"] shouldBe "2"
            requests.single().url.parameters["type"] shouldBe "item"
            requests.single().url.parameters["uselang"] shouldBe "en"
        }

    @Test
    fun `controlled non-success Wikidata response follows approved Kotlin JSON error contract`() =
        testApplication {
            val requests = mutableListOf<HttpRequestData>()
            application {
                recordedSearchModule(
                    HttpStatusCode.TooManyRequests,
                    fixture("controlled-WIKIDATA-SEARCH-ERROR-001-body.txt"),
                    requests,
                    retryAfter = "30",
                )
            }

            val response = client.postSearch("Douglas Adams", 2)

            response.status shouldBe HttpStatusCode.BadGateway
            response.bodyAsText() shouldBe """{"error":"HTTP 429 Too Many Requests: rate limited"}"""
            requests.size shouldBe 1
        }

    @Test
    fun `controlled malformed Wikidata response follows approved Kotlin JSON error contract`() =
        testApplication {
            val requests = mutableListOf<HttpRequestData>()
            application {
                recordedSearchModule(
                    HttpStatusCode.OK,
                    fixture("controlled-WIKIDATA-SEARCH-MALFORMED-001-body.json"),
                    requests,
                )
            }

            val response = client.postSearch("Douglas Adams", 2)

            response.status shouldBe HttpStatusCode.BadGateway
            response.bodyAsText().startsWith("{\"error\":\"Malformed MediaWiki JSON:") shouldBe true
            requests.size shouldBe 1
        }

    private fun Application.recordedSearchModule(
        status: HttpStatusCode,
        body: String,
        requests: MutableList<HttpRequestData>,
        retryAfter: String? = null,
    ) {
        val transport =
            HttpClient(
                MockEngine { request ->
                    requests += request
                    respond(
                        body,
                        status,
                        if (retryAfter == null) {
                            headersOf(HttpHeaders.ContentType, "application/json; charset=utf-8")
                        } else {
                            headersOf(HttpHeaders.RetryAfter, retryAfter)
                        },
                    )
                },
            ) { install(HttpTimeout) }
        val cache = InMemoryLocalGraphCache()
        val parser = JenaTurtleParser()
        val generator = CSharpCompatibleWikidataQueryGenerator()
        val filtering = ResultFilteringService()
        val resolver =
            EndpointContextResolver(
                cache,
                object : BuiltInGraphProvider {
                    override fun graph(): RdfGraph = RdfGraph()
                },
                LocalEndpointExecutorFactory { UnusedSparqlExecution },
                RemoteEndpointExecutorFactory { _, _ -> UnusedSparqlExecution },
            )
        val relationshipResolver = EndpointExecutionResolverAdapter(resolver)
        configureSerialization()
        configureErrorHandling()
        configureRouting(
            HttpDependencies(
                LocalDatabaseUploadService(parser, cache),
                QueryHttpDependencies(
                    resolver,
                    ElementRelationshipsService(relationshipResolver, generator, filtering),
                    RelationshipValueService(relationshipResolver, generator, filtering),
                    SearchService(generator, filtering, KtorWikidataEntitySearchClient("https://www.wikidata.org/w/api.php", transport)),
                    GeneralQueryService(generator, JenaSparqlSyntaxValidator(), filtering),
                    SparqlQueryGenerationService(generator, JenaSparqlSyntaxValidator()),
                ),
                ownedResources = listOf(transport),
            ),
        )
    }

    private fun fixture(name: String): String = Files.readString(Path.of("compatibility", "wikidata-responses", name)).trimEnd('\n')

    private suspend fun io.ktor.client.HttpClient.postSearch(
        search: String,
        limit: Int,
    ) = post("/api/query/search") {
        headers.append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
        setBody("""{"endpointUrl":"https://query.wikidata.org/sparql","search":"$search","limit":$limit}""")
    }

    private object UnusedSparqlExecution : EndpointExecution {
        override val isLocal = false
        override val isWikidata = true

        override suspend fun execute(query: String): SparqlSelectResult = error("Wikidata entity search must not use the SPARQL executor")
    }
}

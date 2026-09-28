@file:Suppress("MaxLineLength", "LongMethod")

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
import com.example.sparqlqueryeasy.domain.model.BoundSparqlBinding
import com.example.sparqlqueryeasy.domain.model.Iri
import com.example.sparqlqueryeasy.domain.model.Literal
import com.example.sparqlqueryeasy.domain.model.RdfGraph
import com.example.sparqlqueryeasy.domain.model.RdfValue
import com.example.sparqlqueryeasy.domain.model.SparqlBinding
import com.example.sparqlqueryeasy.domain.model.SparqlSelectResult
import com.example.sparqlqueryeasy.domain.model.SparqlVariable
import com.example.sparqlqueryeasy.domain.model.UnboundSparqlBinding
import com.example.sparqlqueryeasy.module
import com.example.sparqlqueryeasy.rdf.jena.JenaGraphEndpointExecution
import com.example.sparqlqueryeasy.rdf.jena.JenaSparqlSyntaxValidator
import com.example.sparqlqueryeasy.rdf.jena.JenaTurtleParser
import com.example.sparqlqueryeasy.wikidata.client.RemoteSparqlEndpointExecution
import com.example.sparqlqueryeasy.wikidata.entitysearch.KtorWikidataEntitySearchClient
import com.example.sparqlqueryeasy.wikidata.query.CSharpCompatibleWikidataQueryGenerator
import io.kotest.matchers.shouldBe
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.server.application.Application
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Test
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest

/** Three separately recorded C# retirement cases; the original 34-case corpus is never rewritten. */
class RetirementSuccessCompatibilityTest {
    @Test
    fun `retirement capture index contains exactly three new cases and preserves the 34 original cases`() {
        val ids =
            fixture(
                "compatibility/retirement-expected/index.json",
            ).jsonObject.getValue("cases").jsonArray.map { it.jsonPrimitive.content }
        ids shouldBe listOf("HTTP-HEALTH-001", "WIKIDATA-SEARCH-CSHARP-001", "REMOTE-RELATIONSHIP-CSHARP-001")
        fixture("compatibility/expected/index.json").jsonObject.getValue("cases").jsonArray.size shouldBe 34
    }

    @Test
    fun `HTTP-HEALTH-001 preserves the C sharp host capture and approved JSON difference`() =
        testApplication {
            application { module() }
            val capture = capture("HTTP-HEALTH-001")
            capture.getValue("captureKind").jsonPrimitive.content shouldBe "black-box-host"
            capture.getValue("route").jsonPrimitive.content shouldBe "/health"
            val response = client.get("/health")
            val expected = capture.getValue("http").jsonObject
            response.status.value shouldBe expected.getValue("status").jsonPrimitive.content.toInt()
            expected.getValue("contentType").jsonPrimitive.content shouldBe "text/plain"
            expected.getValue("bodyText").jsonPrimitive.content shouldBe "Healthy"
            // DEC-009 approves this intentional difference, not C# response equivalence.
            ContentType.parse(response.headers[HttpHeaders.ContentType]!!).withoutParameters() shouldBe ContentType.Application.Json
            response.bodyAsText() shouldBe """{"status":"ok"}"""
        }

    @Test
    fun `WIKIDATA-SEARCH-CSHARP-001 matches Kotlin route output with recorded upstream body`() {
        val capture = capture("WIKIDATA-SEARCH-CSHARP-001")
        capture.getValue("http").jsonObject.getValue("contentType") shouldBe JsonNull
        verifyUpstreamHash(capture)
        val requests = mutableListOf<String>()
        val executions = mutableListOf<Pair<String, SparqlSelectResult>>()
        val transport = recordedTransport(capture, requests)
        testApplication {
            application { captureModule(transport, executions) }
            val response = client.postCapture(capture)
            response.status.value shouldBe capture.getValue("http").jsonObject.getValue("status").jsonPrimitive.content.toInt()
            Json.parseToJsonElement(response.bodyAsText()) shouldBe capture.getValue("http").jsonObject.getValue("bodyJson")
        }
        requests.size shouldBe 1
        requests.single().startsWith("https://www.wikidata.org/w/api.php?") shouldBe true
        executions shouldBe emptyList()
    }

    @Test
    fun `REMOTE-RELATIONSHIP-CSHARP-001 matches Kotlin response executed query and raw RDF bindings`() {
        val capture = capture("REMOTE-RELATIONSHIP-CSHARP-001")
        capture.getValue("http").jsonObject.getValue("contentType") shouldBe JsonNull
        verifyUpstreamHash(capture)
        val requests = mutableListOf<String>()
        val executions = mutableListOf<Pair<String, SparqlSelectResult>>()
        val transport = recordedTransport(capture, requests)
        testApplication {
            application { captureModule(transport, executions) }
            val response = client.postCapture(capture)
            response.status.value shouldBe capture.getValue("http").jsonObject.getValue("status").jsonPrimitive.content.toInt()
            Json.parseToJsonElement(response.bodyAsText()) shouldBe capture.getValue("http").jsonObject.getValue("bodyJson")
        }
        requests.size shouldBe 1
        requests.single().startsWith("https://example.test/sparql?") shouldBe true
        executions.size shouldBe 1
        val (query, result) = executions.single()
        query shouldBe capture.getValue("generatedSparql").jsonPrimitive.content
        val expectedRaw = capture.getValue("rawQueries").jsonArray.single().jsonObject
        query shouldBe expectedRaw.getValue("query").jsonPrimitive.content
        val expectedResult = expectedRaw.getValue("result").jsonObject
        result.projectedVariables.map(SparqlVariable::name) shouldBe
            expectedResult.getValue("projectedVariables").jsonArray.map { it.jsonPrimitive.content }
        val expectedRows = expectedResult.getValue("rows").jsonArray
        result.rows.size shouldBe expectedRows.size
        expectedRows.zip(result.rows).forEach { (row, actual) ->
            val bindings = row.jsonObject.getValue("bindings").jsonArray
            actual.bindings.size shouldBe bindings.size
            bindings.zip(actual.bindings).forEach { (binding, value) ->
                assertRawBinding(binding.jsonObject, value)
            }
        }
    }

    private fun assertRawBinding(
        expected: JsonObject,
        actual: SparqlBinding,
    ) {
        actual.variable.name shouldBe expected.getValue("variable").jsonPrimitive.content
        expected.getValue("present").jsonPrimitive.content shouldBe "true"
        when (actual) {
            is BoundSparqlBinding -> {
                expected.getValue("bound").jsonPrimitive.content shouldBe "true"
                assertRawValue(expected.getValue("value").jsonObject, actual.value)
            }
            is UnboundSparqlBinding -> {
                expected.getValue("bound").jsonPrimitive.content shouldBe "false"
                expected.getValue("value") shouldBe JsonNull
            }
        }
    }

    private fun assertRawValue(
        expected: JsonObject,
        actual: RdfValue,
    ) {
        when (actual) {
            is Iri -> {
                expected.getValue("kind").jsonPrimitive.content shouldBe "uri"
                actual.value shouldBe expected.getValue("uri").jsonPrimitive.content
            }
            is Literal -> {
                expected.getValue("kind").jsonPrimitive.content shouldBe "literal"
                actual.lexicalForm shouldBe expected.getValue("lexicalForm").jsonPrimitive.content
                actual.datatype?.value shouldBe expected.getValue("datatype").jsonPrimitive.content
                actual.language shouldBe expected.getValue("language").jsonPrimitive.content
            }
            else -> error("Unexpected RDF term: $actual")
        }
    }

    private fun capture(id: String): JsonObject = fixture("compatibility/retirement-expected/$id/case.json").jsonObject

    private fun fixture(path: String): JsonElement = Json.parseToJsonElement(Files.readString(Path.of(path)))

    private fun verifyUpstreamHash(capture: JsonObject) {
        val upstream = capture.getValue("upstream").jsonObject
        val bytes = Files.readAllBytes(Path.of(upstream.getValue("fixture").jsonPrimitive.content))
        MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) } shouldBe
            upstream.getValue("sha256").jsonPrimitive.content
    }

    private fun recordedTransport(
        capture: JsonObject,
        requests: MutableList<String>,
    ): HttpClient {
        val upstream = capture.getValue("upstream").jsonObject
        val body = Files.readString(Path.of(upstream.getValue("fixture").jsonPrimitive.content))
        val type =
            if (capture.getValue("caseId").jsonPrimitive.content.startsWith("REMOTE-")) {
                "application/sparql-results+json"
            } else {
                "application/json; charset=utf-8"
            }
        return HttpClient(
            MockEngine { request ->
                requests += request.url.toString()
                respond(body, HttpStatusCode.OK, headersOf(HttpHeaders.ContentType, type))
            },
        ) { install(HttpTimeout) }
    }

    private fun Application.captureModule(
        transport: HttpClient,
        executions: MutableList<Pair<String, SparqlSelectResult>>,
    ) {
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
                LocalEndpointExecutorFactory { JenaGraphEndpointExecution(it) },
                RemoteEndpointExecutorFactory { endpoint, wikidata ->
                    val delegate = RemoteSparqlEndpointExecution(endpoint.value, wikidata, transport)
                    object : EndpointExecution {
                        override val isLocal = false
                        override val isWikidata = wikidata

                        override suspend fun execute(query: String): SparqlSelectResult =
                            delegate.execute(query).also {
                                executions += query to it
                            }
                    }
                },
            )
        val executionResolver = EndpointExecutionResolverAdapter(resolver)
        configureSerialization()
        configureErrorHandling()
        configureRouting(
            HttpDependencies(
                LocalDatabaseUploadService(parser, cache),
                QueryHttpDependencies(
                    resolver,
                    ElementRelationshipsService(executionResolver, generator, filtering),
                    RelationshipValueService(executionResolver, generator, filtering),
                    SearchService(generator, filtering, KtorWikidataEntitySearchClient("https://www.wikidata.org/w/api.php", transport)),
                    GeneralQueryService(generator, JenaSparqlSyntaxValidator(), filtering),
                    SparqlQueryGenerationService(generator, JenaSparqlSyntaxValidator()),
                ),
                ownedResources = listOf(transport),
            ),
        )
    }

    private suspend fun io.ktor.client.HttpClient.postCapture(capture: JsonObject) =
        post(capture.getValue("route").jsonPrimitive.content) {
            headers.append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            setBody(capture.getValue("request").toString())
        }
}

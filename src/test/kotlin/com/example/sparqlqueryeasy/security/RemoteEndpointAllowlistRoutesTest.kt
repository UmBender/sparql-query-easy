package com.example.sparqlqueryeasy.security

import com.example.sparqlqueryeasy.application.endpoints.REMOTE_ENDPOINT_REFUSED
import com.example.sparqlqueryeasy.application.localdatabase.InMemoryLocalGraphCache
import com.example.sparqlqueryeasy.application.localdatabase.LocalDatabaseUploadService
import com.example.sparqlqueryeasy.domain.model.WikidataHttpFailure
import com.example.sparqlqueryeasy.http.HttpDependencies
import com.example.sparqlqueryeasy.http.configureErrorHandling
import com.example.sparqlqueryeasy.http.configureRouting
import com.example.sparqlqueryeasy.http.configureSerialization
import com.example.sparqlqueryeasy.rdf.jena.JenaTurtleParser
import com.example.sparqlqueryeasy.wikidata.client.RemoteSparqlEndpointExecution
import com.example.sparqlqueryeasy.wikidata.client.remoteClientPolicy
import io.kotest.assertions.withClue
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.http.headersOf
import io.ktor.server.testing.testApplication
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import org.junit.jupiter.api.Test
import kotlin.test.assertFailsWith

/**
 * QUAL-021 (decision A, 2026-10-27): the server only calls the remote endpoint `https://query.wikidata.org/sparql`,
 * compared as an exact string. Every other URL — internal hosts, cloud metadata, IP spellings, userinfo tricks,
 * another port, path, case or scheme — is 400 on every query route and no query reaches a remote execution.
 * The exact match also makes DNS rebinding and IP-encoding tricks moot: no client-chosen host is ever resolved.
 */
class RemoteEndpointAllowlistRoutesTest {
    private val recorder = QueryRecorder()

    private val refused =
        listOf(
            "http://localhost:8080/api/endpoints",
            "http://127.0.0.1/sparql",
            "http://db:5432/",
            "http://backend:8080/health",
            "http://169.254.169.254/latest/meta-data/",
            "http://[::1]/sparql",
            "http://[::ffff:127.0.0.1]/sparql",
            "http://[fd00::1]/sparql",
            "http://2130706433/sparql",
            "http://0177.0.0.1/sparql",
            "http://0x7f.0.0.1/sparql",
            "http://10.0.0.1/sparql",
            "http://192.168.0.1/sparql",
            "https://query.wikidata.org@127.0.0.1/sparql",
            "https://wikidata@127.0.0.1/sparql",
            "https://query.wikidata.org:8443/sparql",
            "https://query.wikidata.org/sparql/",
            "https://query.wikidata.org/sparql?x=1",
            "https://query.wikidata.org/sparql#x",
            "https://query.wikidata.org/SPARQL",
            "HTTPS://QUERY.WIKIDATA.ORG/sparql",
            "http://query.wikidata.org/sparql",
            "https://query.wikidata.org.evil.test/sparql",
            "https://evil.test/query.wikidata.org/sparql",
            "https://dbpedia.org/sparql",
            "file:///etc/passwd",
            "gopher://127.0.0.1:6379/_INFO",
            "ftp://query.wikidata.org/sparql",
            " https://query.wikidata.org/sparql",
        )

    private fun body(
        route: String,
        endpoint: String,
    ): String {
        val url = Json.encodeToString(JsonPrimitive.serializer(), JsonPrimitive(endpoint))
        return when (route) {
            "/api/query/relationships" -> """{"endpointUrl":$url,"id":"<${PK}pikachu>"}"""
            "/api/query/search" -> """{"endpointUrl":$url,"search":"pika"}"""
            else ->
                """{"endpointUrl":$url,"variableName":"?p",""" +
                    """"where":[{"subject":"?p","predicate":"<${PK}speed>","object":"?v"}]}"""
        }
    }

    @Test
    fun `every query route refuses a non-allowlisted endpoint with 400 and runs no query`() =
        testApplication {
            application {
                configureSerialization()
                configureErrorHandling()
                configureRouting(
                    HttpDependencies(
                        LocalDatabaseUploadService(JenaTurtleParser(), InMemoryLocalGraphCache()),
                        recordingQueryDependencies(recorder),
                    ),
                )
            }
            val routes =
                listOf(
                    "/api/query",
                    "/api/query/sparql",
                    "/api/query/count",
                    "/api/query/relationships",
                    "/api/query/search",
                )
            routes.forEach { route ->
                refused.forEach { endpoint ->
                    withClue("$route $endpoint") {
                        val response =
                            client.post(route) {
                                contentType(ContentType.Application.Json)
                                setBody(body(route, endpoint))
                            }
                        response.status shouldBe HttpStatusCode.BadRequest
                        response.bodyAsText() shouldContain "Remote endpoint is not allowed"
                    }
                }
            }
            recorder.take() shouldBe emptyList()

            // The exact URL still reaches the (recorded, offline) Wikidata execution.
            client.post("/api/query") {
                contentType(ContentType.Application.Json)
                setBody(body("/api/query", WIKIDATA))
            }.status shouldBe HttpStatusCode.OK
            recorder.take().size shouldBe 1
            REMOTE_ENDPOINT_REFUSED shouldContain WIKIDATA
        }

    @Test
    fun `the Wikidata client does not follow a redirect to an internal host`() {
        val requested = mutableListOf<String>()
        val client =
            HttpClient(MockEngine) {
                remoteClientPolicy()
                engine {
                    addHandler { request ->
                        requested += request.url.toString()
                        val location = headersOf(HttpHeaders.Location, "https://169.254.169.254/latest/meta-data/")
                        respond("", HttpStatusCode.Found, location)
                    }
                }
            }
        val execution = RemoteSparqlEndpointExecution(WIKIDATA, true, client)

        assertFailsWith<WikidataHttpFailure> { runBlocking { execution.execute("SELECT * WHERE { ?s ?p ?o }") } }
            .statusCode shouldBe HttpStatusCode.Found.value
        requested.map { it.substringBefore('?') } shouldBe listOf(WIKIDATA)
    }
}

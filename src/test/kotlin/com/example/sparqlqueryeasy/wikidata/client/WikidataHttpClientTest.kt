package com.example.sparqlqueryeasy.wikidata.client

import com.example.sparqlqueryeasy.domain.model.BoundSparqlBinding
import com.example.sparqlqueryeasy.domain.model.Iri
import com.example.sparqlqueryeasy.domain.model.Literal
import com.example.sparqlqueryeasy.domain.model.SparqlSelectResult
import com.example.sparqlqueryeasy.domain.model.SparqlVariable
import com.example.sparqlqueryeasy.domain.model.UnboundSparqlBinding
import com.example.sparqlqueryeasy.domain.model.WikidataHttpFailure
import io.kotest.matchers.shouldBe
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.MockRequestHandleScope
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.HttpRequestTimeoutException
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.HttpRequestData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Test
import kotlin.test.assertFailsWith

class WikidataHttpClientTest {
    @Test
    fun `successful result preserves variables and all RDF metadata`() {
        val client =
            mockClient { request ->
                request.headers[HttpHeaders.UserAgent] shouldBe "QueryEasy-Test/1.0"
                request.headers[HttpHeaders.Accept] shouldBe "application/sparql-results+json"
                request.url.parameters["query"] shouldBe "SELECT * WHERE { ?s ?p ?o }"
                respond(SUCCESS_JSON)
            }

        client.use { http ->
            val result = execute(http)
            result.projectedVariables shouldBe
                listOf(SparqlVariable("item"), SparqlVariable("label"), SparqlVariable("typed"))
            result.rows.size shouldBe 2
            (result.rows[0].binding(SparqlVariable("item")) as BoundSparqlBinding).value shouldBe
                Iri("https://www.wikidata.org/entity/Q42")
            (result.rows[0].binding(SparqlVariable("label")) as BoundSparqlBinding).value shouldBe
                Literal("Douglas Adams", language = "en")
            (result.rows[0].binding(SparqlVariable("typed")) as BoundSparqlBinding).value shouldBe
                Literal("0042", Iri("http://www.w3.org/2001/XMLSchema#integer"))
            result.rows[1].binding(SparqlVariable("label")) shouldBe UnboundSparqlBinding(SparqlVariable("label"))
        }
    }

    @Test
    fun `empty result has projected variables and no rows`() {
        val client = mockClient { respond("""{"head":{"vars":["item"]},"results":{"bindings":[]}}""") }
        client.use { execute(it).rows shouldBe emptyList() }
    }

    @Test
    fun `malformed JSON is an application failure with diagnostic and query`() {
        val client = mockClient { respond("not-json") }
        client.use {
            val failure = assertFailsWith<WikidataHttpFailure> { execute(it) }
            failure.statusCode shouldBe null
            failure.query shouldBe QUERY
            failure.diagnostic.contains("Malformed SPARQL JSON") shouldBe true
        }
    }

    @Test
    fun `HTTP 400 429 and 500 are explicit and never retried`() {
        listOf(
            HttpStatusCode.BadRequest,
            HttpStatusCode.TooManyRequests,
            HttpStatusCode.InternalServerError,
        ).forEach { status ->
            var calls = 0
            val client =
                mockClient { request ->
                    calls++
                    respond("upstream failure", status, headersOf(HttpHeaders.RetryAfter, "30"))
                }
            client.use {
                val failure = assertFailsWith<WikidataHttpFailure> { execute(it) }
                failure.statusCode shouldBe status.value
                failure.retryAfter shouldBe "30"
                failure.retryable shouldBe (status == HttpStatusCode.TooManyRequests)
            }
            calls shouldBe 1
        }
    }

    @Test
    fun `timeout is converted without retrying`() {
        var calls = 0
        val client =
            mockClient { request ->
                calls++
                throw HttpRequestTimeoutException(request)
            }
        client.use {
            val failure = assertFailsWith<WikidataHttpFailure> { execute(it) }
            failure.statusCode shouldBe null
            failure.diagnostic.contains("timed out") shouldBe true
        }
        calls shouldBe 1
    }

    @Test
    fun `endpoint and timeout configuration are explicit`() {
        assertFailsWith<IllegalArgumentException> { KtorWikidataHttpClient("file:///tmp/result", mockClientEngine()) }
        val client =
            KtorWikidataHttpClient(
                "https://example.test/sparql",
                mockClientEngine(),
                requestTimeout = kotlin.time.Duration.ZERO,
            )
        client.close()
    }

    private fun execute(client: WikidataHttpClient): SparqlSelectResult = runBlocking { client.execute(QUERY) }

    private fun mockClient(
        handler: suspend MockRequestHandleScope.(HttpRequestData) -> io.ktor.client.request.HttpResponseData,
    ): KtorWikidataHttpClient {
        val client =
            HttpClient(MockEngine { request -> handler(request) }) {
                install(HttpTimeout)
            }
        return KtorWikidataHttpClient("https://example.test/sparql", client, "QueryEasy-Test/1.0")
    }

    private fun mockClientEngine(): HttpClient =
        HttpClient(MockEngine { respond(SUCCESS_JSON) }) {
            install(HttpTimeout)
        }

    private companion object {
        const val QUERY = "SELECT * WHERE { ?s ?p ?o }"
        const val SUCCESS_JSON =
            """{"head":{"vars":["item","label","typed"]},"results":{"bindings":[""" +
                """{"item":{"type":"uri","value":"https://www.wikidata.org/entity/Q42"},""" +
                """"label":{"type":"literal","xml:lang":"en","value":"Douglas Adams"},""" +
                """"typed":{"type":"typed-literal","datatype":"http://www.w3.org/2001/XMLSchema#integer", """ +
                """"value":"0042"}},""" +
                """{"item":{"type":"bnode","value":"b0"},"typed":{"type":"literal","value":"plain"}}]}}"""
    }
}

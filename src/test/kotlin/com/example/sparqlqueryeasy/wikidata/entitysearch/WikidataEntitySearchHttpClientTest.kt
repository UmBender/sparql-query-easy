@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.wikidata.entitysearch

import com.example.sparqlqueryeasy.application.search.WikidataEntitySearchRequest
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

class WikidataEntitySearchHttpClientTest {
    @Test
    fun `WIKIDATA-SEARCH-RECORD-001 encodes input and maps recorded response`() =
        runBlocking {
            val client =
                mockClient { request ->
                    request.headers[HttpHeaders.UserAgent] shouldBe "QueryEasy-Test/1.0"
                    request.url.parameters["action"] shouldBe "wbsearchentities"
                    request.url.parameters["search"] shouldBe "C++ & ação \"quoted\""
                    request.url.parameters["limit"] shouldBe "20"
                    respond(SUCCESS_JSON)
                }
            client.use {
                it.search(WikidataEntitySearchRequest("C++ & ação \"quoted\"", 20)) shouldBe
                    listOf(
                        com.example.sparqlqueryeasy.application.search.WikidataEntitySearchRecord(
                            id = "Q42",
                            title = "Q42",
                            conceptUri = "http://www.wikidata.org/entity/Q42",
                            label = "Douglas Adams",
                            description = "English writer",
                        ),
                        com.example.sparqlqueryeasy.application.search.WikidataEntitySearchRecord(),
                    )
            }
        }

    @Test
    fun `HTTP 400 429 and 500 are explicit without retry`() =
        runBlocking {
            listOf(HttpStatusCode.BadRequest, HttpStatusCode.TooManyRequests, HttpStatusCode.InternalServerError).forEach { status ->
                var calls = 0
                mockClient {
                    calls++
                    respond("failure", status, headersOf(HttpHeaders.RetryAfter, "30"))
                }.use { client ->
                    val failure = assertFailsWith<WikidataEntitySearchFailure> { client.search(WikidataEntitySearchRequest("x", 20)) }
                    failure.statusCode shouldBe status.value
                    failure.retryAfter shouldBe "30"
                }
                calls shouldBe 1
            }
        }

    @Test
    fun `timeout malformed JSON and invalid endpoint are explicit`() =
        runBlocking {
            mockClient { request -> throw HttpRequestTimeoutException(request) }.use { client ->
                assertFailsWith<WikidataEntitySearchFailure> { client.search(WikidataEntitySearchRequest("x", 20)) }
            }
            mockClient { respond("not-json") }.use { client ->
                val failure = assertFailsWith<WikidataEntitySearchFailure> { client.search(WikidataEntitySearchRequest("x", 20)) }
                failure.diagnostic.contains("Malformed MediaWiki JSON") shouldBe true
            }
            assertFailsWith<IllegalArgumentException> { KtorWikidataEntitySearchClient("file:///tmp/api", mockClientEngine()) }
        }

    private fun mockClient(
        handler: suspend MockRequestHandleScope.(HttpRequestData) -> io.ktor.client.request.HttpResponseData,
    ): KtorWikidataEntitySearchClient {
        val client = HttpClient(MockEngine { request -> handler(request) }) { install(HttpTimeout) }
        return KtorWikidataEntitySearchClient("https://example.test/w/api.php", client, "QueryEasy-Test/1.0")
    }

    private fun mockClientEngine(): HttpClient = HttpClient(MockEngine { respond(SUCCESS_JSON) }) { install(HttpTimeout) }

    private companion object {
        const val SUCCESS_JSON =
            """{"search":[{"id":"Q42","title":"Q42","concepturi":"http://www.wikidata.org/entity/Q42",""" +
                """"label":"Douglas Adams","description":"English writer"},{}]}"""
    }
}

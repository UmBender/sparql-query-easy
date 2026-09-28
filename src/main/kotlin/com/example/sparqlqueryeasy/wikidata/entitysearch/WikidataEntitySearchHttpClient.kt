package com.example.sparqlqueryeasy.wikidata.entitysearch

import com.example.sparqlqueryeasy.application.search.WikidataEntitySearchClient
import com.example.sparqlqueryeasy.application.search.WikidataEntitySearchRecord
import com.example.sparqlqueryeasy.application.search.WikidataEntitySearchRequest
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.HttpRequestTimeoutException
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.timeout
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.request.url
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import java.io.IOException
import java.net.URI
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

class WikidataEntitySearchFailure(
    val endpoint: String,
    val statusCode: Int?,
    val diagnostic: String,
    val retryAfter: String? = null,
    cause: Throwable? = null,
) : RuntimeException("Wikidata entity search failed: $diagnostic", cause)

/** Transport-only MediaWiki wbsearchentities client; it does not execute SPARQL. */
class KtorWikidataEntitySearchClient(
    endpoint: String,
    private val httpClient: HttpClient,
    private val userAgent: String = DEFAULT_USER_AGENT,
    private val requestTimeout: Duration = DEFAULT_REQUEST_TIMEOUT,
) : WikidataEntitySearchClient, AutoCloseable {
    private val endpoint = validateEndpoint(endpoint)
    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun search(request: WikidataEntitySearchRequest): List<WikidataEntitySearchRecord> =
        try {
            val response =
                httpClient.get {
                    url(endpoint)
                    parameter("action", "wbsearchentities")
                    parameter("continue", "0")
                    parameter("format", "json")
                    parameter("language", "en")
                    parameter("limit", request.limit)
                    parameter("origin", "*")
                    parameter("search", request.text)
                    parameter("type", "item")
                    parameter("uselang", "en")
                    header(HttpHeaders.UserAgent, userAgent)
                    timeout { requestTimeoutMillis = requestTimeout.inWholeMilliseconds }
                }
            val body = response.bodyAsText()
            if (response.status.value !in 200..299) {
                throw WikidataEntitySearchFailure(
                    endpoint,
                    response.status.value,
                    "HTTP ${response.status.value} ${response.status.description}: ${body.take(MAX_DIAGNOSTIC_LENGTH)}",
                    response.headers[HttpHeaders.RetryAfter],
                )
            }
            decode(body)
        } catch (failure: WikidataEntitySearchFailure) {
            throw failure
        } catch (timeout: HttpRequestTimeoutException) {
            throw WikidataEntitySearchFailure(
                endpoint,
                null,
                "Request timed out after $requestTimeout",
                cause = timeout,
            )
        } catch (exception: IOException) {
            throw transportFailure(exception)
        } catch (exception: SerializationException) {
            throw transportFailure(exception)
        } catch (exception: IllegalArgumentException) {
            throw transportFailure(exception)
        } catch (exception: IllegalStateException) {
            throw transportFailure(exception)
        }

    override fun close() = httpClient.close()

    private fun decode(body: String): List<WikidataEntitySearchRecord> =
        try {
            json.decodeFromString<MediaWikiSearchResponse>(body).search.map { result ->
                WikidataEntitySearchRecord(
                    result.id,
                    result.title,
                    result.conceptUri,
                    result.label,
                    result.description,
                )
            }
        } catch (exception: SerializationException) {
            throw WikidataEntitySearchFailure(
                endpoint,
                null,
                "Malformed MediaWiki JSON: ${exception.message}",
                cause = exception,
            )
        }

    private fun transportFailure(exception: Throwable) =
        WikidataEntitySearchFailure(
            endpoint,
            null,
            exception.message ?: exception.javaClass.simpleName,
            cause = exception,
        )

    private companion object {
        const val DEFAULT_USER_AGENT = "QueryEasy-Kotlin/0.1"
        val DEFAULT_REQUEST_TIMEOUT = 30.seconds
        const val MAX_DIAGNOSTIC_LENGTH = 1_024

        fun validateEndpoint(endpoint: String): String {
            val uri = URI(endpoint)
            require(uri.scheme == "http" || uri.scheme == "https") { "MediaWiki endpoint must use HTTP(S)" }
            require(!uri.host.isNullOrBlank()) { "MediaWiki endpoint must include a host" }
            return endpoint
        }
    }
}

fun createWikidataEntitySearchClient(
    endpoint: String = "https://www.wikidata.org/w/api.php",
    userAgent: String = "QueryEasy-Kotlin/0.1",
    connectTimeout: Duration = 10.seconds,
    requestTimeout: Duration = 30.seconds,
): KtorWikidataEntitySearchClient {
    val client =
        HttpClient(CIO) {
            install(HttpTimeout) {
                connectTimeoutMillis = connectTimeout.inWholeMilliseconds
                requestTimeoutMillis = requestTimeout.inWholeMilliseconds
            }
        }
    return KtorWikidataEntitySearchClient(endpoint, client, userAgent, requestTimeout)
}

@Serializable
private data class MediaWikiSearchResponse(val search: List<MediaWikiSearchResult> = emptyList())

@Serializable
private data class MediaWikiSearchResult(
    val id: String? = null,
    val title: String? = null,
    @SerialName("concepturi") val conceptUri: String? = null,
    val label: String? = null,
    val description: String? = null,
)

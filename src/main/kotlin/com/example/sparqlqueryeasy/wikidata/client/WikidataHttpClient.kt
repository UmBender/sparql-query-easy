package com.example.sparqlqueryeasy.wikidata.client

import com.example.sparqlqueryeasy.domain.model.BlankNode
import com.example.sparqlqueryeasy.domain.model.BoundSparqlBinding
import com.example.sparqlqueryeasy.domain.model.Iri
import com.example.sparqlqueryeasy.domain.model.Literal
import com.example.sparqlqueryeasy.domain.model.SparqlResultRow
import com.example.sparqlqueryeasy.domain.model.SparqlSelectResult
import com.example.sparqlqueryeasy.domain.model.SparqlVariable
import com.example.sparqlqueryeasy.domain.model.UnboundSparqlBinding
import com.example.sparqlqueryeasy.domain.model.WikidataHttpFailure
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.HttpRequestTimeoutException
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.timeout
import io.ktor.client.request.accept
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.request.url
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import java.io.IOException
import java.net.URI
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

interface WikidataHttpClient {
    suspend fun execute(query: String): SparqlSelectResult
}

/** Transport-only client; query construction is supplied by the separate generator. */
class KtorWikidataHttpClient(
    endpoint: String,
    private val httpClient: HttpClient,
    private val userAgent: String = DEFAULT_USER_AGENT,
    private val requestTimeout: Duration = DEFAULT_REQUEST_TIMEOUT,
) : WikidataHttpClient, AutoCloseable {
    private val endpoint: String = validateEndpoint(endpoint)
    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun execute(query: String): SparqlSelectResult {
        try {
            val response =
                httpClient.get {
                    url(endpoint)
                    parameter("query", query)
                    accept(ContentType.parse("application/sparql-results+json"))
                    header(HttpHeaders.UserAgent, userAgent)
                    timeout { requestTimeoutMillis = requestTimeout.inWholeMilliseconds }
                }
            val body = response.bodyAsText()
            if (response.status.value !in 200..299) {
                throw WikidataHttpFailure(
                    endpoint = endpoint,
                    statusCode = response.status.value,
                    diagnostic =
                        "HTTP ${response.status.value} ${response.status.description}: " +
                            body.take(MAX_DIAGNOSTIC_LENGTH),
                    query = query,
                    retryAfter = response.headers[HttpHeaders.RetryAfter],
                )
            }
            return decode(body, query)
        } catch (failure: WikidataHttpFailure) {
            throw failure
        } catch (timeout: HttpRequestTimeoutException) {
            throw WikidataHttpFailure(
                endpoint = endpoint,
                statusCode = null,
                diagnostic = "Request timed out after $requestTimeout",
                query = query,
                cause = timeout,
            )
        } catch (exception: IOException) {
            throw transportFailure(query, exception)
        } catch (exception: SerializationException) {
            throw transportFailure(query, exception)
        } catch (exception: IllegalArgumentException) {
            throw transportFailure(query, exception)
        } catch (exception: IllegalStateException) {
            throw transportFailure(query, exception)
        }
    }

    private fun transportFailure(
        query: String,
        exception: Throwable,
    ) = WikidataHttpFailure(
        endpoint = endpoint,
        statusCode = null,
        diagnostic = exception.message ?: exception.javaClass.simpleName,
        query = query,
        cause = exception,
    )

    override fun close() = httpClient.close()

    private fun decode(
        body: String,
        query: String,
    ): SparqlSelectResult =
        try {
            val response = json.decodeFromString<SparqlJsonResponse>(body)
            val variables = response.head.vars.map(::SparqlVariable)
            SparqlSelectResult(
                projectedVariables = variables,
                rows =
                    response.results.bindings.map { bindings ->
                        require(bindings.keys.all { it in response.head.vars }) {
                            "SPARQL binding is not present in head.vars"
                        }
                        SparqlResultRow(
                            variables.map { variable ->
                                val value = bindings[variable.name]
                                if (value == null) {
                                    UnboundSparqlBinding(variable)
                                } else {
                                    BoundSparqlBinding(variable, value.toDomainValue())
                                }
                            },
                        )
                    },
            )
        } catch (exception: SerializationException) {
            throw malformedResponse(query, exception)
        } catch (exception: IllegalArgumentException) {
            throw malformedResponse(query, exception)
        } catch (exception: IllegalStateException) {
            throw malformedResponse(query, exception)
        }

    private fun malformedResponse(
        query: String,
        exception: Throwable,
    ) = WikidataHttpFailure(
        endpoint = endpoint,
        statusCode = null,
        diagnostic = "Malformed SPARQL JSON response: ${exception.message ?: exception.javaClass.simpleName}",
        query = query,
        cause = exception,
    )

    private companion object {
        const val DEFAULT_USER_AGENT = ".NET QueryEasy"
        val DEFAULT_REQUEST_TIMEOUT = 30.seconds
        const val MAX_DIAGNOSTIC_LENGTH = 1_024

        fun validateEndpoint(endpoint: String): String {
            val uri = URI(endpoint)
            require(uri.scheme == "http" || uri.scheme == "https") { "Wikidata endpoint must use HTTP(S)" }
            require(!uri.host.isNullOrBlank()) { "Wikidata endpoint must include a host" }
            return endpoint
        }
    }
}

fun createWikidataHttpClient(
    endpoint: String,
    userAgent: String = ".NET QueryEasy",
    connectTimeout: Duration = 10.seconds,
    requestTimeout: Duration = 30.seconds,
): KtorWikidataHttpClient {
    val client =
        HttpClient(CIO) {
            install(HttpTimeout) {
                connectTimeoutMillis = connectTimeout.inWholeMilliseconds
                requestTimeoutMillis = requestTimeout.inWholeMilliseconds
            }
        }
    return KtorWikidataHttpClient(endpoint, client, userAgent, requestTimeout)
}

@Serializable
private data class SparqlJsonResponse(val head: SparqlJsonHead, val results: SparqlJsonResults)

@Serializable
private data class SparqlJsonHead(val vars: List<String>)

@Serializable
private data class SparqlJsonResults(val bindings: List<Map<String, SparqlJsonBinding>>)

@Serializable
private data class SparqlJsonBinding(
    val type: String,
    val value: String,
    val datatype: String? = null,
    @SerialName("xml:lang") val language: String? = null,
)

private fun SparqlJsonBinding.toDomainValue() =
    when (type) {
        "uri" -> Iri(value)
        "bnode" -> BlankNode(value)
        "literal", "typed-literal" -> Literal(lexicalForm = value, datatype = datatype?.let(::Iri), language = language)
        else -> error("Unsupported SPARQL JSON binding type: $type")
    }

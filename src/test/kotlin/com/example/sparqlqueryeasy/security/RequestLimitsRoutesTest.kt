@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.security

import com.example.sparqlqueryeasy.application.localdatabase.InMemoryLocalGraphCache
import com.example.sparqlqueryeasy.application.localdatabase.LocalDatabaseUploadService
import com.example.sparqlqueryeasy.application.query.PROFILE_MAX_LIMIT
import com.example.sparqlqueryeasy.application.query.STAGE_MAX_LIMIT
import com.example.sparqlqueryeasy.application.query.STAGE_MAX_OFFSET
import com.example.sparqlqueryeasy.application.relationships.EndpointExecution
import com.example.sparqlqueryeasy.domain.model.RdfGraph
import com.example.sparqlqueryeasy.domain.model.SparqlQueryExecutionFailure
import com.example.sparqlqueryeasy.http.HttpDependencies
import com.example.sparqlqueryeasy.http.MAX_REQUEST_BODY_BYTES
import com.example.sparqlqueryeasy.http.MAX_REQUEST_LIMIT
import com.example.sparqlqueryeasy.http.MAX_VARIABLE_FILTERS
import com.example.sparqlqueryeasy.http.MAX_WHERE_PATTERNS
import com.example.sparqlqueryeasy.http.configureErrorHandling
import com.example.sparqlqueryeasy.http.configureRouting
import com.example.sparqlqueryeasy.http.configureSerialization
import com.example.sparqlqueryeasy.rdf.jena.JenaGraphEndpointExecution
import com.example.sparqlqueryeasy.rdf.jena.JenaLocalSparqlExecutor
import com.example.sparqlqueryeasy.rdf.jena.JenaTurtleParser
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.OutgoingContent
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import io.ktor.utils.io.ByteWriteChannel
import io.ktor.utils.io.writeFully
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Test
import kotlin.test.assertFailsWith
import kotlin.time.Duration
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds
import kotlin.time.measureTime

/**
 * QUAL-023: caps on `limit`/`offset`, list sizes and the body size, and the local query timeout,
 * on the production query wiring over PokemonGen1 (no network).
 */
class RequestLimitsRoutesTest {
    private val recorder = QueryRecorder()

    private fun ApplicationTestBuilder.app(local: (RdfGraph) -> EndpointExecution = { JenaGraphEndpointExecution(it) }) {
        application {
            configureSerialization()
            configureErrorHandling()
            configureRouting(
                HttpDependencies(
                    LocalDatabaseUploadService(JenaTurtleParser(), InMemoryLocalGraphCache()),
                    recordingQueryDependencies(recorder, local),
                ),
            )
        }
    }

    private fun where(count: Int) =
        (0 until count).joinToString(",", "[", "]") { """{"subject":"?pokemon","predicate":"<${PK}speed>","object":"?v$it"}""" }

    private fun query(
        where: String = where(1),
        limit: Int = 20,
        filters: String = "[]",
        extra: String = "",
    ) = """{"endpointUrl":"PokemonGen1","variableName":"?pokemon","limit":$limit,"where":$where,"variableFilters":$filters$extra}"""

    private fun profile(where: String = where(1)) =
        """{"endpointUrl":"PokemonGen1","subject":"?pokemon","predicate":"<${PK}speed>","where":$where}"""

    private suspend fun ApplicationTestBuilder.post(
        path: String,
        body: String,
    ) = client.post(path) {
        contentType(ContentType.Application.Json)
        setBody(body)
    }

    private suspend fun ApplicationTestBuilder.rejected(
        path: String,
        body: String,
        error: String,
        status: HttpStatusCode = HttpStatusCode.BadRequest,
    ) {
        val response = post(path, body)
        response.status shouldBe status
        response.bodyAsText() shouldContain error
        recorder.take() shouldBe emptyList()
    }

    @Test
    fun `a limit above 10000 is 400 on query, sparql and search and nothing runs`() =
        testApplication {
            app()
            val tooMany = MAX_REQUEST_LIMIT + 1
            val error = "limit must not exceed $MAX_REQUEST_LIMIT"
            rejected("/api/query", query(limit = tooMany), error)
            rejected("/api/query/sparql", query(limit = tooMany), error)
            rejected("/api/query/search", """{"endpointUrl":"PokemonGen1","search":"Pika","limit":$tooMany}""", error)

            val atCap = post("/api/query/sparql", query(limit = MAX_REQUEST_LIMIT))
            atCap.status shouldBe HttpStatusCode.OK
            atCap.bodyAsText() shouldContain "LIMIT $MAX_REQUEST_LIMIT"
            post("/api/query", query(limit = MAX_REQUEST_LIMIT)).status shouldBe HttpStatusCode.OK
        }

    @Test
    fun `stage limit and offset and the profile limit keep their caps`() =
        testApplication {
            app()
            val stage = """{"endpointUrl":"PokemonGen1","variableName":"?pokemon","where":${where(1)}"""
            rejected("/api/query/stage", "$stage,\"limit\":${STAGE_MAX_LIMIT + 1}}", "limit must be between 1 and $STAGE_MAX_LIMIT")
            rejected("/api/query/stage", "$stage,\"offset\":${STAGE_MAX_OFFSET + 1}}", "offset must be between 0 and $STAGE_MAX_OFFSET")
            rejected(
                "/api/query/numeric-profile",
                profile().dropLast(1) + ",\"limit\":${PROFILE_MAX_LIMIT + 1}}",
                "$PROFILE_MAX_LIMIT",
            )
        }

    @Test
    fun `more than 100 where patterns or variable filters are 400 on every query route before generation`() =
        testApplication {
            app()
            val tooLong = where(MAX_WHERE_PATTERNS + 1)
            val error = "where must have at most $MAX_WHERE_PATTERNS patterns"
            listOf("/api/query", "/api/query/sparql", "/api/query/stage").forEach { path ->
                rejected(path, query(where = tooLong), error)
            }
            rejected("/api/query/count", """{"endpointUrl":"PokemonGen1","variableName":"?pokemon","where":$tooLong}""", error)
            rejected("/api/query/numeric-profile", profile(tooLong), error)

            val filters = (0..MAX_VARIABLE_FILTERS).joinToString(",", "[", "]") { """{"variableName":"?v0"}""" }
            rejected("/api/query", query(filters = filters), "variableFilters must have at most $MAX_VARIABLE_FILTERS filters")

            post("/api/query/sparql", query(where = where(MAX_WHERE_PATTERNS))).status shouldBe HttpStatusCode.OK
        }

    @Test
    fun `a body over 1 MiB is 413 whether its length is declared or streamed, and one at the limit is read`() =
        testApplication {
            app()
            val base = query()
            val over = base.dropLast(1) + ",\"pad\":\"" + "x".repeat(MAX_REQUEST_BODY_BYTES.toInt()) + "\"}"
            rejected("/api/query", over, "1048576", HttpStatusCode.PayloadTooLarge)

            val streamed =
                client.post("/api/query") {
                    setBody(
                        object : OutgoingContent.WriteChannelContent() {
                            override val contentType = ContentType.Application.Json

                            override suspend fun writeTo(channel: ByteWriteChannel) {
                                channel.writeFully(over.toByteArray())
                            }
                        },
                    )
                }
            streamed.status shouldBe HttpStatusCode.PayloadTooLarge
            recorder.take() shouldBe emptyList()

            // JSON allows whitespace before the closing brace: exactly the limit is still a valid request.
            val atLimit = base.dropLast(1) + " ".repeat(MAX_REQUEST_BODY_BYTES.toInt() - base.length) + "}"
            post("/api/query", atLimit).status shouldBe HttpStatusCode.OK
        }

    @Test
    fun `deeply nested JSON is 400, not a server error`() =
        testApplication {
            app()
            val depth = 200_000
            val nested = "[".repeat(depth) + "]".repeat(depth)
            post("/api/query", query(extra = ",\"pad\":$nested")).status shouldBe HttpStatusCode.BadRequest
            post("/api/query", query(where = nested)).status shouldBe HttpStatusCode.BadRequest
            recorder.take() shouldBe emptyList()
        }

    @Test
    fun `a local query that runs too long is stopped with 502 while other requests are served`() =
        testApplication {
            val timeout = 2.seconds
            app { JenaGraphEndpointExecution(it, JenaLocalSparqlExecutor(timeout = timeout)) }
            startApplication()
            // Three unrelated patterns: Jena must walk the triples' cube to find the distinct rows.
            val cube =
                """[{"subject":"?pokemon","predicate":"?p1","object":"?o1"},""" +
                    """{"subject":"?s2","predicate":"?p2","object":"?o2"},{"subject":"?s3","predicate":"?p3","object":"?o3"}]"""
            coroutineScope {
                val slow = async { post("/api/query", query(where = cube, limit = MAX_REQUEST_LIMIT)) }

                val fast = post("/api/query", query())
                fast.status shouldBe HttpStatusCode.OK
                slow.isCompleted shouldBe false

                val stopped = slow.await()
                stopped.status shouldBe HttpStatusCode.BadGateway
                stopped.bodyAsText() shouldContain "Query timed out after $timeout"
            }
        }

    @Test
    fun `the Jena executor stops a query at its timeout`() {
        val graph = pokemon.graph()
        val timeout: Duration = 300.milliseconds
        val elapsed =
            measureTime {
                val failure =
                    assertFailsWith<SparqlQueryExecutionFailure> {
                        runBlocking {
                            JenaLocalSparqlExecutor(
                                timeout = timeout,
                            ).execute(graph, "SELECT (COUNT(*) AS ?n) { ?a ?b ?c . ?d ?e ?f . ?g ?h ?i }")
                        }
                    }
                failure.diagnostic shouldBe "Query timed out after $timeout"
            }
        (elapsed < 10.seconds) shouldBe true
    }
}

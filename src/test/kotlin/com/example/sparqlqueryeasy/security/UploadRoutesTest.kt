package com.example.sparqlqueryeasy.security

import com.example.sparqlqueryeasy.application.endpoints.BuiltInGraphProvider
import com.example.sparqlqueryeasy.application.endpoints.EndpointContextResolution
import com.example.sparqlqueryeasy.application.endpoints.EndpointContextResolver
import com.example.sparqlqueryeasy.application.localdatabase.InMemoryLocalGraphCache
import com.example.sparqlqueryeasy.application.localdatabase.LocalDatabaseUploadService
import com.example.sparqlqueryeasy.domain.model.Iri
import com.example.sparqlqueryeasy.domain.model.RdfGraph
import com.example.sparqlqueryeasy.domain.model.RdfGraphHandle
import com.example.sparqlqueryeasy.http.HttpDependencies
import com.example.sparqlqueryeasy.http.MAX_UPLOAD_BODY_BYTES
import com.example.sparqlqueryeasy.http.configureErrorHandling
import com.example.sparqlqueryeasy.http.configureRouting
import com.example.sparqlqueryeasy.http.configureSerialization
import com.example.sparqlqueryeasy.rdf.TurtleParser
import com.example.sparqlqueryeasy.rdf.jena.JenaGraphEndpointExecution
import com.example.sparqlqueryeasy.rdf.jena.JenaTurtleParser
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.kotest.matchers.types.shouldBeInstanceOf
import io.ktor.client.request.forms.MultiPartFormDataContent
import io.ktor.client.request.forms.formData
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.OutgoingContent
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import io.ktor.utils.io.ByteWriteChannel
import org.junit.jupiter.api.Test

/**
 * QUAL-021 (decision 2026-10-28): a Turtle upload request is at most 5 MiB; above it the answer is 413
 * before the parser sees a byte, whether the length is declared or the body is streamed. Malformed Turtle
 * is 400 without a stack trace, and an uploaded graph is readable by anyone who has its id (a GUID).
 */
class UploadRoutesTest {
    private val parser = CountingParser()
    private val cache = InMemoryLocalGraphCache()

    @Test
    fun `an upload over 5 MiB is 413 before parsing, declared or streamed`() =
        testApplication {
            app()
            val over = upload(literalTurtle(MAX_UPLOAD_BODY_BYTES.toInt()))

            val declared = client.post("/api/local-database") { setBody(over) }
            declared.status shouldBe HttpStatusCode.PayloadTooLarge
            declared.bodyAsText() shouldBe """{"error":"Request is larger than the limit of 5242880 bytes"}"""

            val streamedBody = Streamed(upload(literalTurtle(MAX_UPLOAD_BODY_BYTES.toInt())))
            val streamed = client.post("/api/local-database") { setBody(streamedBody) }
            streamed.status shouldBe HttpStatusCode.PayloadTooLarge

            parser.calls shouldBe 0
            cache.get(RdfGraphHandle("00000000-0000-0000-0000-000000000001")) shouldBe null
        }

    @Test
    fun `a file with one huge literal just under the limit is parsed and its id reads the graph`() =
        testApplication {
            app()
            val response =
                client.post("/api/local-database") {
                    setBody(upload(literalTurtle(MAX_UPLOAD_BODY_BYTES.toInt() - 4096)))
                }

            response.status shouldBe HttpStatusCode.OK
            val id = Regex("\"data\":\"([^\"]+)\"").find(response.bodyAsText())!!.groupValues[1]
            parser.calls shouldBe 1
            // The id is a random GUID and the only key: whoever has it resolves the graph, with no owner check.
            val resolver =
                EndpointContextResolver(
                    cache,
                    object : BuiltInGraphProvider {
                        override fun graph() = RdfGraph()
                    },
                    { JenaGraphEndpointExecution(it) },
                    { _, _ -> error("no remote endpoint") },
                )
            resolver.resolve(id).shouldBeInstanceOf<EndpointContextResolution.Resolved>()
        }

    @Test
    fun `a 1 MiB upload passes, the general body limit does not apply to the upload route`() =
        testApplication {
            app()
            client.post("/api/local-database") { setBody(upload(literalTurtle(2 * 1024 * 1024))) }.status shouldBe
                HttpStatusCode.OK
        }

    @Test
    fun `malformed Turtle is 400 without a stack trace or class name`() =
        testApplication {
            app()
            val malformed =
                listOf("@prefix ex: <broken", "<a> <b> \"unterminated", "ex:s ex:p ex:o .", "\u0000\u0001<<>>")
            malformed.forEach { turtle ->
                val response = client.post("/api/local-database") { setBody(upload(turtle)) }
                response.status shouldBe HttpStatusCode.BadRequest
                val body = response.bodyAsText()
                body shouldContain "\"error\""
                body shouldNotContain "Exception"
                body shouldNotContain "at org."
                body shouldNotContain "at com."
                body shouldNotContain ".kt"
            }
        }

    private fun ApplicationTestBuilder.app() {
        application {
            configureSerialization()
            configureErrorHandling()
            configureRouting(HttpDependencies(LocalDatabaseUploadService(parser, cache)))
        }
    }

    private fun literalTurtle(size: Int) = "<https://e/s> <https://e/p> \"" + "x".repeat(size) + "\" ."

    private fun upload(text: String) =
        MultiPartFormDataContent(
            formData {
                append(
                    "ttlFile",
                    text,
                    Headers.build { append(HttpHeaders.ContentDisposition, "filename=\"upload.ttl\"") },
                )
            },
        )

    /** The same multipart body without a Content-Length, so the server counts it while reading. */
    private class Streamed(private val content: MultiPartFormDataContent) : OutgoingContent.WriteChannelContent() {
        override val contentType = content.contentType

        override suspend fun writeTo(channel: ByteWriteChannel) = content.writeTo(channel)
    }

    private class CountingParser : TurtleParser {
        private val delegate = JenaTurtleParser()
        var calls = 0

        override fun parse(
            turtle: String,
            baseIri: Iri?,
        ): RdfGraph {
            calls++
            return delegate.parse(turtle, baseIri)
        }
    }
}

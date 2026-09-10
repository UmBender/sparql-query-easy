package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.localdatabase.InMemoryLocalGraphCache
import com.example.sparqlqueryeasy.application.localdatabase.LocalDatabaseUploadService
import com.example.sparqlqueryeasy.application.localdatabase.LocalGraphHandleGenerator
import com.example.sparqlqueryeasy.domain.model.RdfGraphHandle
import com.example.sparqlqueryeasy.rdf.jena.JenaTurtleParser
import io.kotest.matchers.shouldBe
import io.ktor.client.request.forms.MultiPartFormDataContent
import io.ktor.client.request.forms.formData
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.Test

class LocalDatabaseRoutesTest {
    @Test
    fun `TTL-SIMPLE-001 upload returns exact data response`() =
        testApplication {
            application { testModule() }

            val response =
                client.post("/api/local-database") {
                    setBody(upload("@prefix ex: <https://example.test/> . ex:s ex:p ex:o ."))
                }

            response.status shouldBe HttpStatusCode.OK
            response.headers[HttpHeaders.ContentType]!!.startsWith(
                ContentType.Application.Json.toString(),
            ) shouldBe true
            response.bodyAsText() shouldBe "{\"data\":\"00000000-0000-0000-0000-000000000001\"}"
        }

    @Test
    fun `HTTP-MISSING-UPLOAD-001 returns validation status and JSON`() =
        testApplication {
            application { testModule() }

            val response = client.post("/api/local-database") { setBody(MultiPartFormDataContent(formData {})) }

            response.status shouldBe HttpStatusCode.BadRequest
            response.bodyAsText() shouldBe "{\"error\":\"Missing required upload: ttlFile\"}"
        }

    @Test
    fun `TTL-INVALID-001 returns validation error and does not cache`() =
        testApplication {
            val cache = InMemoryLocalGraphCache()
            application { testModule(cache) }

            val response = client.post("/api/local-database") { setBody(upload("@prefix ex: <broken")) }

            response.status shouldBe HttpStatusCode.BadRequest
            response.bodyAsText().startsWith("{\"error\":\"") shouldBe true
            cache.get(RdfGraphHandle("00000000-0000-0000-0000-000000000001")) shouldBe null
        }

    @Test
    fun `TTL-EMPTY-001 accepts an empty valid upload`() =
        testApplication {
            application { testModule() }

            val response = client.post("/api/local-database") { setBody(upload("# valid empty Turtle")) }

            response.status shouldBe HttpStatusCode.OK
            response.bodyAsText() shouldBe "{\"data\":\"00000000-0000-0000-0000-000000000001\"}"
        }

    private fun Application.testModule(cache: InMemoryLocalGraphCache = InMemoryLocalGraphCache()) {
        configureSerialization()
        configureRouting(
            HttpDependencies(
                LocalDatabaseUploadService(
                    JenaTurtleParser(),
                    cache,
                    LocalGraphHandleGenerator { RdfGraphHandle("00000000-0000-0000-0000-000000000001") },
                ),
            ),
        )
    }

    private fun upload(text: String) =
        MultiPartFormDataContent(
            formData {
                append(
                    "ttlFile",
                    text,
                    Headers.build {
                        append(HttpHeaders.ContentDisposition, "filename=\"upload.ttl\"")
                    },
                )
            },
        )
}

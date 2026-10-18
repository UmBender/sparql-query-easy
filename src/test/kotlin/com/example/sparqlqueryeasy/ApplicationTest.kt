package com.example.sparqlqueryeasy

import io.kotest.matchers.shouldBe
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Test

class ApplicationTest {
    @Test
    fun `application starts and health route responds`() =
        testApplication {
            application { module() }

            val response = client.get("/health")

            response.status shouldBe HttpStatusCode.OK
            ContentType.parse(response.headers[HttpHeaders.ContentType]!!).withoutParameters() shouldBe
                ContentType.Application.Json
            // BE-007: the database state depends on the local .env, so only its presence is checked here;
            // HealthRoutesTest asserts each state exactly.
            val body = Json.parseToJsonElement(response.bodyAsText()).jsonObject
            body.keys shouldBe setOf("status", "database")
            body.getValue("status").jsonPrimitive.content shouldBe "ok"
        }
}

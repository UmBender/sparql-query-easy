package com.example.sparqlqueryeasy

import io.kotest.matchers.shouldBe
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.Test

class ApplicationTest {
    @Test
    fun `application starts and health route responds`() =
        testApplication {
            application { module() }

            val response = client.get("/health")

            response.status shouldBe HttpStatusCode.OK
            response.bodyAsText() shouldBe "{\"status\":\"ok\"}"
        }
}

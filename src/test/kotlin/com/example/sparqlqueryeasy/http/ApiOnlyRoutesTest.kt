package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.module
import io.kotest.matchers.shouldBe
import io.ktor.client.request.get
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.Test

/** FE-049: Ktor serves the API only; the SvelteKit app comes from the web service or Vite. */
class ApiOnlyRoutesTest {
    @Test
    fun `the retired legacy page and its assets are no longer served`() =
        testApplication {
            application { module() }

            listOf("/", "/index2.html", "/login.html", "/app-core.js", "/index2.css").forEach { path ->
                client.get(path).status shouldBe HttpStatusCode.NotFound
            }
            client.get("/health").status shouldBe HttpStatusCode.OK
            client.get("/openapi.json").status shouldBe HttpStatusCode.OK
        }
}

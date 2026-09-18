package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.localdatabase.InMemoryLocalGraphCache
import com.example.sparqlqueryeasy.application.localdatabase.LocalDatabaseUploadService
import com.example.sparqlqueryeasy.rdf.jena.JenaTurtleParser
import io.kotest.matchers.shouldBe
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.Test

class StaticFrontendRoutesTest {
    @Test
    fun `root resolves to the authoritative same-origin frontend`() =
        testApplication {
            application { frontendModule() }

            val page = client.get("/")

            page.status shouldBe HttpStatusCode.OK
            page.bodyAsText().contains("apiUrl('/api/query')") shouldBe true
        }

    @Test
    fun `authoritative frontend and its local assets are served by Ktor`() =
        testApplication {
            application { frontendModule() }

            val page = client.get("/index2.html")
            val stylesheet = client.get("/grafos.css")

            page.status shouldBe HttpStatusCode.OK
            page.bodyAsText().contains("apiUrl('/api/query')") shouldBe true
            page.bodyAsText().contains("const API_BASE = ''") shouldBe true
            page.bodyAsText().contains("onAutocomplete: addSearchResultNode") shouldBe true
            page.bodyAsText().contains("id=\"node-action-menu\"") shouldBe true
            page.bodyAsText().contains("cy.on('tap', 'node', event => openNodeActionMenu(event.target))") shouldBe true
            page.bodyAsText().contains("<script src=\"cytoscape-cxtmenu.js\"></script>") shouldBe false
            stylesheet.status shouldBe HttpStatusCode.OK
        }

    @Test
    fun `authoritative frontend declares every Ktor request flow`() =
        testApplication {
            application { frontendModule() }

            val page = client.get("/index2.html").bodyAsText()

            listOf(
                "apiUrl('/health')",
                "apiUrl('/api/local-database')",
                "apiUrl('/api/query/search')",
                "apiUrl('/api/query/relationships')",
                "apiUrl('/api/query/relationship-value')",
                "apiUrl('/api/query')",
                "apiUrl('/api/query/sparql')",
            ).forEach { requestPath ->
                page.contains(requestPath) shouldBe true
            }
            page.contains("formData.append('ttlFile', this.files[0])") shouldBe true
            page.contains("const API_BASE = ''") shouldBe true
        }

    private fun Application.frontendModule() {
        configureSerialization()
        configureErrorHandling()
        configureRouting(HttpDependencies(LocalDatabaseUploadService(JenaTurtleParser(), InMemoryLocalGraphCache())))
    }
}

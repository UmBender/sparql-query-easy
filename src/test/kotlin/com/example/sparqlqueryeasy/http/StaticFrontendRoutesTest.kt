package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.localdatabase.InMemoryLocalGraphCache
import com.example.sparqlqueryeasy.application.localdatabase.LocalDatabaseUploadService
import com.example.sparqlqueryeasy.rdf.jena.JenaTurtleParser
import io.kotest.matchers.shouldBe
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.Test

class StaticFrontendRoutesTest {
    @Test
    fun `root resolves to the authoritative same-origin frontend`() =
        testApplication {
            application { frontendModule() }

            val page = client.get("/")
            val source = frontendSource()

            page.status shouldBe HttpStatusCode.OK
            page.bodyAsText().contains("<script src=\"app-core.js\"></script>") shouldBe true
            source.contains("apiUrl('/api/query')") shouldBe true
            source.contains("apiUrl('/api/query/stage')") shouldBe true
        }

    @Test
    fun `authoritative frontend and its local assets are served by Ktor`() =
        testApplication {
            application { frontendModule() }

            val page = client.get("/index2.html")
            val stylesheet = client.get("/grafos.css")
            val pageStylesheet = client.get("/index2.css")
            val queryModule = client.get("/query-calculations.js")
            val stageModule = client.get("/query-stages.js")
            val actionModule = client.get("/graph-actions.js")

            page.status shouldBe HttpStatusCode.OK
            val source = frontendSource()
            source.contains("apiUrl('/api/query')") shouldBe true
            source.contains("const API_BASE = ''") shouldBe true
            page.bodyAsText().contains("onAutocomplete: addSearchResultNode") shouldBe true
            page.bodyAsText().contains("id=\"node-action-menu\"") shouldBe true
            page.bodyAsText().contains("cy.on('tap', 'node', event => {") shouldBe true
            page.bodyAsText().contains("if (pendingConnection) completeConnection(event.target);") shouldBe true
            page.bodyAsText().contains("else openNodeActionMenu(event.target);") shouldBe true
            page.bodyAsText().contains("<script src=\"cytoscape-cxtmenu.js\"></script>") shouldBe false
            stylesheet.status shouldBe HttpStatusCode.OK
            page.bodyAsText().contains("<link rel=\"stylesheet\" href=\"index2.css\">") shouldBe true
            pageStylesheet.status shouldBe HttpStatusCode.OK
            pageStylesheet.headers["Content-Type"]?.startsWith("text/css") shouldBe true
            pageStylesheet.bodyAsText().contains("#node-action-menu,") shouldBe true
            queryModule.status shouldBe HttpStatusCode.OK
            queryModule.bodyAsText().contains("export function buildFilters") shouldBe true
            stageModule.status shouldBe HttpStatusCode.OK
            stageModule.bodyAsText().contains("export function buildVariableRegistry") shouldBe true
            actionModule.status shouldBe HttpStatusCode.OK
            actionModule.bodyAsText().contains("export function nodeActions") shouldBe true
            pageScripts.forEach { script ->
                val response = client.get("/$script")
                response.status shouldBe HttpStatusCode.OK
                response.headers["Content-Type"]?.startsWith("text/javascript") shouldBe true
                page.bodyAsText().contains("<script src=\"$script\"></script>") shouldBe true
            }
        }

    @Test
    fun `authoritative frontend declares every Ktor request flow`() =
        testApplication {
            application { frontendModule() }

            val page = frontendSource()

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

    // Classic scripts that index2.html loads in order before its inline bootstrap.
    private val pageScripts = listOf("app-core.js", "stage-order.js", "stage-exploration.js", "graph-nodes.js")

    private suspend fun ApplicationTestBuilder.frontendSource(): String =
        (listOf("index2.html") + pageScripts).map { client.get("/$it").bodyAsText() }.joinToString("\n")

    private fun Application.frontendModule() {
        configureSerialization()
        configureErrorHandling()
        configureRouting(HttpDependencies(LocalDatabaseUploadService(JenaTurtleParser(), InMemoryLocalGraphCache())))
    }
}

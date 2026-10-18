package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.module
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.assertEquals

/**
 * FE-043: the new frontend generates its API types from a snapshot of this
 * document (frontend/src/lib/api/openapi.json). A route or schema change fails
 * here until the snapshot is refreshed and `npm --prefix frontend run api:types` runs.
 * Set UPDATE_FRONTEND_OPENAPI=1 to rewrite the snapshot.
 */
class FrontendOpenApiSnapshotTest {
    private val snapshot = File("frontend/src/lib/api/openapi.json")
    private val json = Json { prettyPrint = true }

    @Test
    fun `the frontend OpenAPI snapshot equals the served document`() =
        testApplication {
            application { module() }
            val served = Json.parseToJsonElement(client.get("/openapi.json").bodyAsText())
            if (System.getenv("UPDATE_FRONTEND_OPENAPI") != null) {
                snapshot.writeText(json.encodeToString(served) + "\n")
            }
            assertEquals(
                served,
                Json.parseToJsonElement(snapshot.readText()),
                "Refresh frontend/src/lib/api/openapi.json (UPDATE_FRONTEND_OPENAPI=1), " +
                    "then run npm --prefix frontend run api:types",
            )
        }
}

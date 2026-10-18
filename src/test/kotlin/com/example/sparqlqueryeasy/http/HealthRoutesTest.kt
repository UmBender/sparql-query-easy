package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.HealthService
import com.example.sparqlqueryeasy.application.localdatabase.InMemoryLocalGraphCache
import com.example.sparqlqueryeasy.application.localdatabase.LocalDatabaseUploadService
import com.example.sparqlqueryeasy.config.DatabaseSettings
import com.example.sparqlqueryeasy.persistence.DatabaseConnector
import com.example.sparqlqueryeasy.persistence.TestPostgres
import com.example.sparqlqueryeasy.rdf.jena.JenaTurtleParser
import io.kotest.matchers.shouldBe
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.Test

/** BE-007: `GET /health` reports the database state and always answers 200. */
class HealthRoutesTest {
    private fun ApplicationTestBuilder.app(connector: DatabaseConnector) {
        application {
            configureSerialization()
            configureErrorHandling()
            configureRouting(
                HttpDependencies(
                    LocalDatabaseUploadService(JenaTurtleParser(), InMemoryLocalGraphCache()),
                    ownedResources = listOf(connector),
                    health = HealthService(connector::poll),
                ),
            )
        }
    }

    private suspend fun ApplicationTestBuilder.healthBody(): String {
        val response = client.get("/health")
        response.status shouldBe HttpStatusCode.OK
        return response.bodyAsText()
    }

    @Test
    fun `without a database the health route reports not-configured`() =
        testApplication {
            app(DatabaseConnector(null))
            healthBody() shouldBe """{"status":"ok","database":"not-configured"}"""
        }

    @Test
    fun `a migrated and reachable database is ready`() =
        testApplication {
            app(DatabaseConnector(TestPostgres.freshDatabase()).also { it.connect() })
            healthBody() shouldBe """{"status":"ok","database":"ready"}"""
        }

    @Test
    fun `an unreachable database is unavailable and the route still answers 200`() =
        testApplication {
            app(DatabaseConnector(TestPostgres.unreachable()).also { it.connect() })
            healthBody() shouldBe """{"status":"ok","database":"unavailable"}"""
        }

    @Test
    fun `polling health while the database is down reconnects at most once per retry interval`() =
        testApplication {
            var now = 0L
            var attempts = 0
            val connector =
                DatabaseConnector(
                    TestPostgres.unreachable(),
                    retryIntervalMillis = 5_000,
                    nowMillis = { now },
                    background = Runnable::run,
                ) { settings: DatabaseSettings ->
                    attempts += 1
                    error("unreachable: ${settings.url}")
                }
            connector.connect()
            app(connector)

            repeat(3) { healthBody() shouldBe """{"status":"ok","database":"unavailable"}""" }
            attempts shouldBe 1
            now = 4_999
            healthBody()
            attempts shouldBe 1
            now = 5_000
            repeat(3) { healthBody() }
            attempts shouldBe 2
        }
}

@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.security

import com.example.sparqlqueryeasy.application.auth.AttemptLimiter
import com.example.sparqlqueryeasy.application.auth.AuthService
import com.example.sparqlqueryeasy.application.auth.MutableClock
import com.example.sparqlqueryeasy.application.localdatabase.InMemoryLocalGraphCache
import com.example.sparqlqueryeasy.application.localdatabase.LocalDatabaseUploadService
import com.example.sparqlqueryeasy.application.study.StudyQueryRunner
import com.example.sparqlqueryeasy.config.Argon2Settings
import com.example.sparqlqueryeasy.http.ADMIN
import com.example.sparqlqueryeasy.http.AuthHttpDependencies
import com.example.sparqlqueryeasy.http.HttpDependencies
import com.example.sparqlqueryeasy.http.configureErrorHandling
import com.example.sparqlqueryeasy.http.configureRouting
import com.example.sparqlqueryeasy.http.configureSerialization
import com.example.sparqlqueryeasy.http.createGroup
import com.example.sparqlqueryeasy.http.json
import com.example.sparqlqueryeasy.http.studyHttpDependencies
import com.example.sparqlqueryeasy.http.taskBody
import com.example.sparqlqueryeasy.http.userClient
import com.example.sparqlqueryeasy.persistence.DatabaseConnector
import com.example.sparqlqueryeasy.persistence.PostgresAccountStore
import com.example.sparqlqueryeasy.persistence.TestPostgres
import com.example.sparqlqueryeasy.rdf.jena.JenaTurtleParser
import io.kotest.assertions.withClue
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.Test
import java.util.concurrent.atomic.AtomicInteger

/**
 * QUAL-020: the admin task reference query (create and preview) and the participant's submitted
 * query reach the generator through the same drawn-query fields; every payload goes into each of
 * them on PokemonGen1 (Testcontainers PostgreSQL for accounts, tasks and attempts).
 */
class StudySparqlInjectionRoutesTest {
    private val graph = """{"formatVersion":1,"nodes":[],"edges":[]}"""
    private val keys = AtomicInteger()

    private fun ApplicationTestBuilder.studyApp(): QueryRecorder {
        val recorder = QueryRecorder()
        val connector = DatabaseConnector(TestPostgres.freshDatabase()).also { it.connect() }
        val clock = MutableClock()
        val query = recordingQueryDependencies(recorder)
        val auth =
            AuthHttpDependencies(
                AuthService(
                    PostgresAccountStore(connector),
                    Argon2PasswordHasher(Argon2Settings(memoryKib = 1_024, iterations = 1, parallelism = 1)),
                    clock,
                    adminUsernames = setOf(ADMIN),
                ),
                AttemptLimiter(1_000_000, clock = clock),
                secureCookies = false,
            )
        // Hundreds of attempts in one test: the QUAL-023 per-user attempt limit is lifted here.
        val study =
            studyHttpDependencies(connector, StudyQueryRunner(query.generalQueryService, query.endpointContextResolver), clock)
                .copy(submissionLimiter = AttemptLimiter(1_000_000, clock = clock))
        application {
            configureSerialization()
            configureErrorHandling()
            configureRouting(
                HttpDependencies(
                    LocalDatabaseUploadService(JenaTurtleParser(), InMemoryLocalGraphCache()),
                    query,
                    auth,
                    study,
                    ownedResources = listOf(connector),
                ),
            )
        }
        return recorder
    }

    private fun Drawn.answer() = """{"variableName":$variableName,"where":$whereJson,"variableFilters":$filtersJson}"""

    private fun slots(
        path: String,
        body: (String) -> String,
    ) = drawnSlots().map { slot ->
        InjectionSlot("POST $path ${slot.field}", path, slot.benign, slot.expect, slot.admits) { body(slot.drawn(it).answer()) }
    }

    @Test
    fun `no payload in an admin reference query or a participant answer changes the query`() =
        testApplication {
            val recorder = studyApp()
            val admin = userClient(ADMIN)
            val ada = userClient("Ada")
            admin.json("/api/admin/tasks", taskBody()).status shouldBe HttpStatusCode.Created
            admin.createGroup("A", listOf("fire-fast"), listOf("Ada"))

            val preview =
                slots(
                    "/api/admin/tasks/preview",
                ) { """{"endpoint":"PokemonGen1","reference":{"graph":$graph,"query":$it},"maxResults":1000}""" }
            val create =
                slots("/api/admin/tasks") {
                    taskBody(key = "injection-${keys.incrementAndGet()}", reference = """{"graph":$graph,"query":$it}""")
                }
            val submit = slots("/api/study/tasks/fire-fast/submissions") { """{"graph":$graph,"query":$it}""" }

            // QUAL-023 closed the QUAL-020 findings: U+0000 and an answer variable over 63 characters are
            // 400 before anything is stored, so every payload goes into every field.
            val findings =
                preview.flatMap { admin.findInjections(it, recorder) } +
                    create.flatMap { admin.findInjections(it, recorder) } +
                    submit.flatMap { ada.findInjections(it, recorder) }
            withClue(findings.joinToString("\n")) { findings.shouldBeEmpty() }
        }
}

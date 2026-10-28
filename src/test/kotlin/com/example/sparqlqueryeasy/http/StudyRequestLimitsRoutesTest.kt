@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.http

import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.jsonArray
import org.junit.jupiter.api.Test

/**
 * QUAL-023 on the study routes (Testcontainers + PokemonGen1): text PostgreSQL cannot store and an
 * over-long answer variable are 400 before anything is saved (QUAL-020 found 503 and 500), attempts
 * are limited per user, and deeply nested JSON is not a server error.
 */
class StudyRequestLimitsRoutesTest {
    private val submissions = "/api/study/tasks/fire-fast/submissions"

    private suspend fun ApplicationTestBuilder.fireTaskFor(vararg members: String): Pair<HttpClient, List<HttpClient>> {
        val admin = userClient(ADMIN)
        val clients = members.map { userClient(it) }
        admin.json("/api/admin/tasks", taskBody()).status shouldBe HttpStatusCode.Created
        admin.createGroup("A", listOf("fire-fast"), members.toList())
        return admin to clients
    }

    private suspend fun HttpClient.attemptCount(): Int = get("/api/study/submissions?task=fire-fast").data().jsonArray.size

    private suspend fun HttpResponse.shouldBeRejected(error: String) {
        status shouldBe HttpStatusCode.BadRequest
        bodyAsText() shouldContain error
    }

    @Test
    fun `U+0000 in a task or an attempt is 400 and nothing is stored`() =
        testApplication {
            studyApp()
            val (admin, clients) = fireTaskFor("Ada")
            val ada = clients.single()

            admin.json("/api/admin/tasks", taskBody(key = "nul-title", title = "Fire\\u0000")).shouldBeRejected(NUL_REFUSED)
            admin.json("/api/admin/tasks", taskBody(key = "nul-statement", statement = "\\u0000")).shouldBeRejected(NUL_REFUSED)
            admin.get("/api/admin/tasks/nul-title").status shouldBe HttpStatusCode.NotFound
            admin.get("/api/admin/tasks/nul-statement").status shouldBe HttpStatusCode.NotFound

            val literal = fireSpeedQuery().replace("<${PK}FireType>", "Fire\\u0000")
            ada.json(submissions, drawn(literal)).shouldBeRejected(NUL_REFUSED)
            ada.json(submissions, drawn(graph = fireSpeedGraph.replaceFirst("{", "{\"note\":\"\\u0000\","))).shouldBeRejected(NUL_REFUSED)
            ada.attemptCount() shouldBe 0
        }

    @Test
    fun `an answer variable over 63 characters is 400 and one of 63 is stored`() =
        testApplication {
            studyApp()
            val (_, clients) = fireTaskFor("Ada")
            val ada = clients.single()

            val longest = "a".repeat(MAX_ANSWER_VARIABLE_LENGTH - 1)
            val tooLong = longest + "a"
            ada.json(submissions, drawn(fireSpeedQuery().replace("?pokemon", "?$tooLong"))).shouldBeRejected("at most 63 characters")
            ada.attemptCount() shouldBe 0
            ada.json(submissions, drawn(fireSpeedQuery().replace("?pokemon", "?$longest"))).status shouldBe HttpStatusCode.Created
            ada.attemptCount() shouldBe 1
        }

    @Test
    fun `attempts above 30 a minute are 429 for that user only`() =
        testApplication {
            studyApp()
            val (_, clients) = fireTaskFor("Ada", "Bea")
            val (ada, bea) = clients

            repeat(SUBMISSIONS_PER_MINUTE) { ada.json(submissions, drawn()).status shouldBe HttpStatusCode.Created }
            val limited = ada.json(submissions, drawn())
            limited.status shouldBe HttpStatusCode.TooManyRequests
            limited.bodyAsText() shouldContain TOO_MANY_SUBMISSIONS
            ada.attemptCount() shouldBe SUBMISSIONS_PER_MINUTE
            bea.json(submissions, drawn()).status shouldBe HttpStatusCode.Created
        }

    @Test
    fun `JSON nested deeper than 32 levels is 400 before parsing, even in an ignored field`() =
        testApplication {
            studyApp()
            val (_, clients) = fireTaskFor("Ada")
            val ada = clients.single()
            // Without the cap, kotlinx's recursive array parsing overflowed the stack: 500 (found by QUAL-023).
            val deep = "[".repeat(200_000) + "]".repeat(200_000)
            ada.json(submissions, drawn().dropLast(1) + ",\"pad\":$deep}").shouldBeRejected("deeper than $MAX_JSON_DEPTH levels")
            ada.attemptCount() shouldBe 0
            // Brackets inside strings do not count, and the deepest allowed nesting is still read.
            val allowed = "[".repeat(MAX_JSON_DEPTH - 1) + "\"[[[[\"" + "]".repeat(MAX_JSON_DEPTH - 1)
            ada.json(submissions, drawn().dropLast(1) + ",\"pad\":$allowed}").status shouldBe HttpStatusCode.Created
        }
}

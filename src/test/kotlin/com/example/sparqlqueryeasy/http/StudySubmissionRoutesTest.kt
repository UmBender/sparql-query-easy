@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.auth.MutableClock
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldStartWith
import io.ktor.client.HttpClient
import io.ktor.client.request.cookie
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import org.junit.jupiter.api.Test
import java.time.Duration

/** STUDY-004: submitting answers, the server-side check and the attempt history (Testcontainers + PokemonGen1). */
class StudySubmissionRoutesTest {
    private val submissions = "/api/study/tasks/fire-fast/submissions"

    /** The Fire speed task in one group with [members]; returns their clients. */
    private suspend fun ApplicationTestBuilder.fireTaskFor(vararg members: String): List<HttpClient> {
        val admin = userClient(ADMIN)
        val clients = members.map { userClient(it) }
        admin.json("/api/admin/tasks", taskBody()).status shouldBe HttpStatusCode.Created
        admin.createGroup("A", listOf("fire-fast"), members.toList())
        return clients
    }

    private suspend fun HttpClient.submit(answer: String = drawn()): HttpResponse = json(submissions, answer)

    private fun JsonElement.bool(name: String) = field(name).jsonPrimitive.boolean

    private fun JsonElement.int(name: String) = field(name).jsonPrimitive.int

    @Test
    fun `the Fire speed reference graph is correct and a graph without the speed filter is incorrect with feedback`() =
        testApplication {
            studyApp()
            val (ada) = fireTaskFor("Ada")

            val right = ada.submit()
            right.status shouldBe HttpStatusCode.Created
            val accepted = right.data()
            accepted.bool("correct") shouldBe true
            accepted.bool("invalid") shouldBe false
            accepted.int("attempt") shouldBe 1
            accepted.int("missing") shouldBe 0
            val expected = accepted.int("expectedCount")
            accepted.field("feedback").jsonPrimitive.content shouldBe "Correct: all $expected expected results."

            val wrong = ada.submit(drawn(fireSpeedQuery(minimumSpeed = null))).data()
            wrong.bool("correct") shouldBe false
            wrong.int("attempt") shouldBe 2
            wrong.int("matched") shouldBe expected
            val extra = wrong.int("extra")
            (extra > 0) shouldBe true
            wrong.field("feedback").jsonPrimitive.content shouldBe "Incorrect: $expected of $expected expected results; $extra extra."
            listOf("expected\"", "Charizard", "values").forEach { (it in ada.submit().bodyAsText()) shouldBe false }
        }

    @Test
    fun `a client correctness value or any extra field changes nothing`() =
        testApplication {
            studyApp()
            val (ada) = fireTaskFor("Ada")
            val forged = drawn(fireSpeedQuery(minimumSpeed = null)).dropLast(1) + ""","correct":true,"expected":[],"matched":99}"""

            val response = ada.submit(forged).data()

            response.bool("correct") shouldBe false
            ada.get("/api/study/submissions?task=fire-fast").data().jsonArray.single().field("correct").jsonPrimitive.boolean shouldBe false
        }

    @Test
    fun `a user sees only their own attempts`() =
        testApplication {
            studyApp()
            val (ada, bob) = fireTaskFor("Ada", "Bob")
            ada.submit()
            ada.submit(drawn(fireSpeedQuery(100)))
            bob.submit(drawn(fireSpeedQuery(null)))

            ada.get("/api/study/submissions?task=fire-fast").data().jsonArray.map { it.int("attempt") to it.bool("correct") } shouldBe
                listOf(1 to true, 2 to false)
            bob.get("/api/study/submissions?task=fire-fast").data().jsonArray.map { it.int("attempt") } shouldBe listOf(1)
            userClient("Cyd").get("/api/study/submissions?task=fire-fast").bodyAsText() shouldBe """{"data":[]}"""
            ada.get("/api/study/submissions").status shouldBe HttpStatusCode.BadRequest
            ada.get("/api/study/submissions?task=missing").status shouldBe HttpStatusCode.NotFound
        }

    @Test
    fun `each attempt carries the task revision it was checked against`() =
        testApplication {
            studyApp()
            val admin = userClient(ADMIN)
            val (ada) = fireTaskFor("Ada")
            ada.submit(drawn(fireSpeedQuery(100))).data().bool("correct") shouldBe false

            admin.putJson("/api/admin/tasks/fire-fast", taskBody(reference = drawn(fireSpeedQuery(100)))).data().int("revision") shouldBe 2
            val second = ada.submit(drawn(fireSpeedQuery(100))).data()

            second.bool("correct") shouldBe true
            ada.get("/api/study/submissions?task=fire-fast").data().jsonArray.map { it.int("taskRevision") } shouldBe listOf(1, 2)
        }

    @Test
    fun `a query that cannot run is stored as an invalid attempt with a clear message`() =
        testApplication {
            studyApp()
            val (ada) = fireTaskFor("Ada")
            val broken =
                """{"variableName":"?pokemon","where":[{"subject":"?pokemon","predicate":"<${PK}speed>","object":"?speed"}],""" +
                    """"variableFilters":[{"variableName":"?nowhere","filterType":2,"value":"90"}]}"""

            val response = ada.submit(drawn(broken))

            response.status shouldBe HttpStatusCode.Created
            val attempt = response.data()
            attempt.bool("invalid") shouldBe true
            attempt.bool("correct") shouldBe false
            attempt.field("matched").toString() shouldBe "null"
            attempt.field("feedback").jsonPrimitive.content shouldStartWith "The query could not run: "
            ada.get("/api/study/submissions?task=fire-fast").data().jsonArray.single().bool("invalid") shouldBe true
            ada.submit("""{"graph":$fireSpeedGraph}""").status shouldBe HttpStatusCode.BadRequest
        }

    @Test
    fun `time spent is measured on the server from the first open`() =
        testApplication {
            val clock = MutableClock()
            studyApp(clock = clock)
            val (ada, bob) = fireTaskFor("Ada", "Bob")
            ada.get("/api/study/tasks/fire-fast")
            clock.advance(Duration.ofSeconds(90))
            ada.get("/api/study/tasks/fire-fast")

            ada.submit().data().field("timeSpentMs").jsonPrimitive.long shouldBe 90_000
            bob.submit().data().field("timeSpentMs").jsonPrimitive.long shouldBe 0
            clock.advance(Duration.ofSeconds(30))
            ada.submit().data().field("timeSpentMs").jsonPrimitive.long shouldBe 120_000
        }

    @Test
    fun `a task outside the caller's group is 404 and nothing is stored`() =
        testApplication {
            studyApp()
            fireTaskFor("Ada")
            val bob = userClient("Bob")
            bob.submit().status shouldBe HttpStatusCode.NotFound
            bob.get("/api/study/submissions?task=fire-fast").bodyAsText() shouldBe """{"data":[]}"""
        }

    @Test
    fun `anonymous submit and list return 401 and a cross-site submit 403`() =
        testApplication {
            studyApp()
            val (ada) = fireTaskFor("Ada")
            client.submit().status shouldBe HttpStatusCode.Unauthorized
            client.get("/api/study/submissions?task=fire-fast").status shouldBe HttpStatusCode.Unauthorized
            ada.post(submissions) {
                contentType(ContentType.Application.Json)
                header(HttpHeaders.Origin, "https://evil.example")
                setBody(drawn())
            }.status shouldBe HttpStatusCode.Forbidden
        }

    @Test
    fun `without a database the routes answer 503 to a presented session`() =
        testApplication {
            studyApp(database = null)
            val response =
                client.post(submissions) {
                    contentType(ContentType.Application.Json)
                    cookie(SESSION_COOKIE, "abc")
                    setBody(drawn())
                }
            response.status shouldBe HttpStatusCode.ServiceUnavailable
            response.bodyAsText() shouldBe """{"error":"Accounts are temporarily unavailable"}"""
            client.get("/api/study/submissions?task=fire-fast") { cookie(SESSION_COOKIE, "abc") }.status shouldBe
                HttpStatusCode.ServiceUnavailable
        }
}

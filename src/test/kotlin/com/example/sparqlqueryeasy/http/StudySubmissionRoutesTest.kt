@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.auth.MutableClock
import com.example.sparqlqueryeasy.application.study.AnswerCheck
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldStartWith
import io.kotest.matchers.types.shouldBeInstanceOf
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
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import org.junit.jupiter.api.Test
import java.time.Duration

/**
 * STUDY-004, STUDY-016 (DEC-020): saving answers with or without variables, the admin-only automatic check and the
 * participant's saves, which never reveal correctness (Testcontainers + PokemonGen1).
 */
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

    private fun JsonElement.int(name: String) = field(name).jsonPrimitive.int

    /** The automatic check of [username]'s saves, oldest first: below the HTTP layer, as only the admin may see it. */
    private suspend fun StudyTestContext.checks(username: String): List<AnswerCheck> =
        checkNotNull(study.study.saves(userId(username), "fire-fast")).map { it.check }

    /** Charizard, an entity-only diagram: two concrete triples and no variable. */
    private val charizardQuery =
        """{"where":[{"subject":"<${PK}Charizard>","predicate":"<${PK}hasType>","object":"<${PK}FireType>","filterType":null},""" +
            """{"subject":"<${PK}Charizard>","predicate":"<${PK}speed>","object":"100","filterType":2}],"variableFilters":[]}"""

    /** A saved answer as its author sees it: nothing about correctness. */
    private fun JsonElement.shouldRevealNoCorrectness() {
        (this as JsonObject).keys shouldBe setOf("save", "taskRevision", "timeSpentMs", "savedAt")
    }

    @Test
    fun `a diagram with two variables is saved without any verdict and the admin check finds the matching variable`() =
        testApplication {
            val context = studyApp()
            val (ada) = fireTaskFor("Ada")

            val right = ada.submit()
            right.status shouldBe HttpStatusCode.Created
            right.data().shouldRevealNoCorrectness()
            right.data().int("save") shouldBe 1
            val wrong = ada.submit(drawn(fireSpeedQuery(minimumSpeed = null))).data()
            wrong.shouldRevealNoCorrectness()
            wrong.int("save") shouldBe 2
            listOf("correct", "feedback", "expected", "Charizard", "values", "matched").forEach {
                (it in ada.submit().bodyAsText()) shouldBe false
            }

            val (first, second) = context.checks("Ada").map { it.shouldBeInstanceOf<AnswerCheck.ByVariable>() }
            first.variables.map { it.variable to it.match } shouldBe listOf("?pokemon" to true, "?speed" to false)
            first.matched?.variable shouldBe "?pokemon"
            second.match shouldBe false
            val pokemon = second.variables.first()
            (pokemon.result!!.outcome.extra > 0) shouldBe true
            pokemon.result.outcome.missing shouldBe 0
        }

    @Test
    fun `an entity-only diagram is saved and checked structurally against the reference`() =
        testApplication {
            val context = studyApp()
            val (ada) = fireTaskFor("Ada")

            val saved = ada.submit(drawn(charizardQuery))
            saved.status shouldBe HttpStatusCode.Created
            saved.data().shouldRevealNoCorrectness()
            // One node and no relation: an empty where is a diagram too.
            ada.submit(drawn("""{"where":[],"variableFilters":[]}""")).status shouldBe HttpStatusCode.Created

            // The reference has two triples with ?pokemon and ?speed; neither is among the answer's.
            context.checks("Ada") shouldBe
                listOf(AnswerCheck.Structural(missing = 2, extra = 2), AnswerCheck.Structural(missing = 2, extra = 0))
        }

    @Test
    fun `a client correctness value or any extra field changes nothing`() =
        testApplication {
            val context = studyApp()
            val (ada) = fireTaskFor("Ada")
            val forged = drawn(fireSpeedQuery(minimumSpeed = null)).dropLast(1) + ""","correct":true,"expected":[],"matched":99}"""

            ada.submit(forged).data().shouldRevealNoCorrectness()

            context.checks("Ada").single().match shouldBe false
        }

    @Test
    fun `a user sees only their own saves`() =
        testApplication {
            studyApp()
            val (ada, bob) = fireTaskFor("Ada", "Bob")
            ada.submit()
            ada.submit(drawn(fireSpeedQuery(100)))
            bob.submit(drawn(fireSpeedQuery(null)))

            val adaSaves = ada.get("/api/study/submissions?task=fire-fast").data().jsonArray
            adaSaves.map { it.int("save") } shouldBe listOf(1, 2)
            adaSaves.forEach { it.shouldRevealNoCorrectness() }
            bob.get("/api/study/submissions?task=fire-fast").data().jsonArray.map { it.int("save") } shouldBe listOf(1)
            // QUAL-019: without the task in their group, Cyd cannot tell that it exists.
            userClient("Cyd").get("/api/study/submissions?task=fire-fast").bodyAsText() shouldBe """{"error":"Task not found"}"""
            ada.get("/api/study/submissions").status shouldBe HttpStatusCode.BadRequest
            ada.get("/api/study/submissions?task=missing").status shouldBe HttpStatusCode.NotFound
        }

    @Test
    fun `each save carries the task revision it was checked against`() =
        testApplication {
            val context = studyApp()
            val admin = userClient(ADMIN)
            val (ada) = fireTaskFor("Ada")
            ada.submit(drawn(fireSpeedQuery(100)))

            admin.putJson("/api/admin/tasks/fire-fast", taskBody(reference = drawn(fireSpeedQuery(100)))).data().int("revision") shouldBe 2
            ada.submit(drawn(fireSpeedQuery(100)))

            ada.get("/api/study/submissions?task=fire-fast").data().jsonArray.map { it.int("taskRevision") } shouldBe listOf(1, 2)
            context.checks("Ada").map { it.match } shouldBe listOf(false, true)
        }

    @Test
    fun `a query that cannot run is saved like any other and the admin check keeps the diagnostic`() =
        testApplication {
            val context = studyApp()
            val (ada) = fireTaskFor("Ada")
            val broken =
                """{"where":[{"subject":"?pokemon","predicate":"<${PK}speed>","object":"?speed"}],""" +
                    """"variableFilters":[{"variableName":"?nowhere","filterType":2,"value":"90"}]}"""

            val response = ada.submit(drawn(broken))

            response.status shouldBe HttpStatusCode.Created
            response.data().shouldRevealNoCorrectness()
            val check = context.checks("Ada").single().shouldBeInstanceOf<AnswerCheck.ByVariable>()
            check.invalid shouldBe true
            check.variables.map { it.variable } shouldBe listOf("?pokemon", "?speed", "?nowhere")
            check.variables.first().summary shouldStartWith "?pokemon: The query could not run: "
            ada.submit("""{"graph":$fireSpeedGraph}""").status shouldBe HttpStatusCode.BadRequest
        }

    private suspend fun HttpClient.statuses(): Map<String, String> =
        get("/api/study/tasks").data().jsonArray.associate {
            it.field("key").jsonPrimitive.content to it.field("status").jsonPrimitive.content
        }

    @Test
    fun `the task list shows each task as not started or answered, with the last save time, from the caller's own saves`() =
        testApplication {
            val clock = MutableClock()
            studyApp(clock = clock)
            val admin = userClient(ADMIN)
            val ada = userClient("Ada")
            val bob = userClient("Bob")
            admin.json("/api/admin/tasks", taskBody()).status shouldBe HttpStatusCode.Created
            admin.createTypeTask("water", "WaterType")
            admin.createGroup("A", listOf("fire-fast", "water"), listOf("Ada", "Bob"))

            ada.statuses() shouldBe mapOf("fire-fast" to "not_started", "water" to "not_started")
            ada.get("/api/study/tasks/fire-fast")
            ada.statuses().getValue("fire-fast") shouldBe "not_started"
            ada.get("/api/study/tasks").data().jsonArray.first().field("lastSavedAt").toString() shouldBe "null"

            ada.submit(drawn(fireSpeedQuery(minimumSpeed = null)))
            clock.advance(Duration.ofSeconds(60))
            val last = ada.submit(drawn(charizardQuery)).data().field("savedAt").jsonPrimitive.content
            ada.statuses() shouldBe mapOf("fire-fast" to "answered", "water" to "not_started")
            bob.statuses() shouldBe mapOf("fire-fast" to "not_started", "water" to "not_started")
            ada.get("/api/study/tasks").data().jsonArray.first().field("lastSavedAt").jsonPrimitive.content shouldBe last

            // A save at an earlier revision still counts as answered.
            admin.putJson("/api/admin/tasks/fire-fast", taskBody(reference = drawn(fireSpeedQuery(100)))).data().int("revision") shouldBe 2
            ada.statuses().getValue("fire-fast") shouldBe "answered"
            listOf("expected", "Charizard", "SELECT", "solved", "correct").forEach {
                (it in ada.get("/api/study/tasks").bodyAsText()) shouldBe false
            }
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
            bob.get("/api/study/submissions?task=fire-fast").bodyAsText() shouldBe """{"error":"Task not found"}"""
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

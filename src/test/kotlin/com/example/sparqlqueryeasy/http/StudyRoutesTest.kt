@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.auth.MutableClock
import io.kotest.matchers.shouldBe
import io.ktor.client.request.cookie
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Test
import java.time.Duration

/** STUDY-003 (participant routes) on Testcontainers PostgreSQL and PokemonGen1. */
class StudyRoutesTest {
    @Test
    fun `anonymous task routes return 401`() =
        testApplication {
            studyApp()
            listOf("/api/study/tasks", "/api/study/tasks/fire").forEach { path ->
                val response = client.get(path)
                response.status shouldBe HttpStatusCode.Unauthorized
                response.bodyAsText() shouldBe """{"error":"Login required"}"""
            }
        }

    @Test
    fun `the list shows exactly the caller's group's active tasks in group order`() =
        testApplication {
            studyApp()
            val admin = userClient(ADMIN)
            val ada = userClient("Ada")
            val bob = userClient("Bob")
            admin.json("/api/admin/tasks", taskBody(key = "fire-fast")).status shouldBe HttpStatusCode.Created
            admin.createTypeTask("water", "WaterType")
            admin.createTypeTask("grass", "GrassType")
            admin.createGroup("A", listOf("water", "fire-fast", "grass"), listOf("Ada"))
            admin.createGroup("B", listOf("grass"), listOf("Bob"))
            admin.json("/api/admin/tasks/grass/deactivate")

            val listed = ada.get("/api/study/tasks").data().jsonArray
            listed.map { it.field("key").jsonPrimitive.content } shouldBe listOf("water", "fire-fast")
            listed[1].field("summary").jsonPrimitive.content shouldBe "Find the Fire-type Pokémon with speed of at least 90."
            bob.get("/api/study/tasks").data().jsonArray.size shouldBe 0

            ada.get("/api/study/tasks/fire-fast").status shouldBe HttpStatusCode.OK
            bob.get("/api/study/tasks/fire-fast").status shouldBe HttpStatusCode.NotFound
            ada.get("/api/study/tasks/grass").status shouldBe HttpStatusCode.NotFound
            val unknown = ada.get("/api/study/tasks/missing")
            unknown.status shouldBe HttpStatusCode.NotFound
            unknown.bodyAsText() shouldBe """{"error":"Task not found"}"""
        }

    @Test
    fun `a user without a group gets an empty list`() =
        testApplication {
            studyApp()
            userClient(ADMIN).createTypeTask("water", "WaterType")
            val ada = userClient("Ada")
            ada.get("/api/study/tasks").bodyAsText() shouldBe """{"data":[]}"""
            ada.get("/api/study/tasks/water").status shouldBe HttpStatusCode.NotFound
        }

    @Test
    fun `task responses never contain the expected result, reference graph or SPARQL`() =
        testApplication {
            studyApp()
            val admin = userClient(ADMIN)
            val ada = userClient("Ada")
            val starting = ""","startingGraph":$fireSpeedGraph"""
            admin.json("/api/admin/tasks", taskBody(extra = starting)).status shouldBe HttpStatusCode.Created
            admin.createGroup("A", listOf("fire-fast"), listOf("Ada"))

            val summary = ada.get("/api/study/tasks").data().jsonArray.single().jsonObject
            summary.keys shouldBe setOf("key", "title", "summary")
            val task = ada.get("/api/study/tasks/fire-fast").data().jsonObject
            task.keys shouldBe setOf("key", "title", "statement", "endpoint", "startingGraph")
            task.getValue("endpoint").jsonPrimitive.content shouldBe "PokemonGen1"
            (task.getValue("startingGraph") as JsonObject).getValue("nodes").jsonArray.size shouldBe 3
            val text = ada.get("/api/study/tasks/fire-fast").bodyAsText()
            listOf("expected", "reference", "SELECT", "Charizard").forEach { (it in text) shouldBe false }
        }

    @Test
    fun `the first open is recorded and a later open keeps it`() =
        testApplication {
            val clock = MutableClock()
            val context = studyApp(clock = clock)
            val admin = userClient(ADMIN)
            val ada = userClient("Ada")
            admin.createTypeTask("water", "WaterType")
            admin.createGroup("A", listOf("water"), listOf("Ada"))
            val first = clock.now
            val task = context.study.tasks.find("water")!!

            context.progress.firstOpen(context.userId("Ada"), task.id) shouldBe null
            ada.get("/api/study/tasks").status shouldBe HttpStatusCode.OK
            context.progress.firstOpen(context.userId("Ada"), task.id) shouldBe null
            ada.get("/api/study/tasks/water").status shouldBe HttpStatusCode.OK
            clock.advance(Duration.ofMinutes(5))
            ada.get("/api/study/tasks/water").status shouldBe HttpStatusCode.OK

            context.progress.firstOpen(context.userId("Ada"), task.id) shouldBe first
        }

    @Test
    fun `other paths below api study still need a session and answer 404`() =
        testApplication {
            studyApp()
            client.get("/api/study/other").status shouldBe HttpStatusCode.Unauthorized
            userClient("Ada").get("/api/study/other").status shouldBe HttpStatusCode.NotFound
            client.get("/api/study/tasks") { cookie(SESSION_COOKIE, "abc") }.status shouldBe HttpStatusCode.Unauthorized
        }
}

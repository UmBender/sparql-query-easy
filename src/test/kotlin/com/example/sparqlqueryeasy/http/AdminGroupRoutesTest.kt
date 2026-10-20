@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.http

import io.kotest.matchers.shouldBe
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Test

/** STUDY-007: participant groups on Testcontainers PostgreSQL. */
class AdminGroupRoutesTest {
    private fun JsonElement.taskKeys() = field("tasks").jsonArray.map { it.field("key").jsonPrimitive.content }

    private fun JsonElement.members() = field("members").jsonArray.map { it.jsonPrimitive.content }

    @Test
    fun `anonymous callers get 401 and participants 403 on every group route`() =
        testApplication {
            studyApp()
            val participant = userClient("Ada")
            val routes: List<suspend (HttpClient) -> HttpResponse> =
                listOf(
                    { it.get("/api/admin/participants") },
                    { it.get("/api/admin/groups") },
                    { it.get("/api/admin/groups/1") },
                    { it.json("/api/admin/groups", """{"name":"A"}""") },
                    { it.putJson("/api/admin/groups/1", """{"name":"B"}""") },
                    { it.putJson("/api/admin/groups/1/tasks", """{"tasks":[]}""") },
                    { it.json("/api/admin/groups/1/members", """{"username":"Ada"}""") },
                    { it.json("/api/admin/groups/1/members/remove", """{"username":"Ada"}""") },
                    { it.json("/api/admin/groups/1/delete") },
                )
            routes.forEach { route ->
                route(client).status shouldBe HttpStatusCode.Unauthorized
                route(participant).status shouldBe HttpStatusCode.Forbidden
            }
        }

    @Test
    fun `each member's task query returns only their group's active tasks in the set order`() =
        testApplication {
            val context = studyApp()
            val admin = userClient(ADMIN)
            userClient("Ada")
            userClient("Bob")
            userClient("Cyd")
            val fire = admin.createTypeTask("fire", "FireType")
            val water = admin.createTypeTask("water", "WaterType")
            val grass = admin.createTypeTask("grass", "GrassType")
            val a = admin.createGroup("Condition A", listOf(water, fire), listOf("Ada"))
            admin.createGroup("Condition B", listOf(grass), listOf("bob"))

            val groupA = admin.get("/api/admin/groups/$a").data()
            groupA.taskKeys() shouldBe listOf("water", "fire")
            groupA.members() shouldBe listOf("Ada")
            admin.get("/api/admin/groups").data().jsonArray.map { it.field("name").jsonPrimitive.content } shouldBe
                listOf("Condition A", "Condition B")
            context.taskKeysFor("Ada") shouldBe listOf("water", "fire")
            context.taskKeysFor("Bob") shouldBe listOf("grass")
            context.taskKeysFor("Cyd") shouldBe emptyList()

            admin.json("/api/admin/tasks/water/deactivate")
            context.taskKeysFor("Ada") shouldBe listOf("fire")
            admin.get("/api/admin/groups/$a").data().taskKeys() shouldBe listOf("water", "fire")
        }

    @Test
    fun `assigning a user who is already in a group moves them`() =
        testApplication {
            studyApp()
            val admin = userClient(ADMIN)
            userClient("Ada")
            val a = admin.createGroup("A", members = listOf("Ada"))
            val b = admin.createGroup("B")

            admin.json("/api/admin/groups/$b/members", """{"username":"ADA"}""").data().members() shouldBe listOf("Ada")

            admin.get("/api/admin/groups/$a").data().members() shouldBe emptyList()
            val participants = admin.get("/api/admin/participants").data().jsonArray.single()
            participants.field("username").jsonPrimitive.content shouldBe "Ada"
            participants.field("groupName").jsonPrimitive.content shouldBe "B"
            admin.json("/api/admin/groups/$b/members/remove", """{"username":"Ada"}""").data().members() shouldBe emptyList()
            admin.get("/api/admin/participants").data().jsonArray.single().field("groupId").toString() shouldBe "null"
        }

    @Test
    fun `invalid names, tasks and members are rejected and a group with members is not deleted`() =
        testApplication {
            studyApp()
            val admin = userClient(ADMIN)
            userClient("Ada")
            admin.createTypeTask("fire", "FireType")
            val a = admin.createGroup("A")

            admin.json("/api/admin/groups", """{"name":"A"}""").status shouldBe HttpStatusCode.Conflict
            admin.json("/api/admin/groups", """{"name":"  "}""").status shouldBe HttpStatusCode.BadRequest
            admin.putJson("/api/admin/groups/$a/tasks", """{"tasks":["fire","missing"]}""").bodyAsText() shouldBe
                """{"error":"Unknown tasks: missing"}"""
            admin.putJson("/api/admin/groups/$a/tasks", """{"tasks":["fire","fire"]}""").status shouldBe HttpStatusCode.BadRequest
            admin.json("/api/admin/groups/$a/members", """{"username":"nobody"}""").status shouldBe HttpStatusCode.BadRequest
            admin.json("/api/admin/groups/$a/members", """{"username":"$ADMIN"}""").status shouldBe HttpStatusCode.BadRequest
            admin.get("/api/admin/groups/999").status shouldBe HttpStatusCode.NotFound
            admin.get("/api/admin/groups/x").status shouldBe HttpStatusCode.NotFound

            admin.json("/api/admin/groups/$a/members", """{"username":"Ada"}""")
            admin.json("/api/admin/groups/$a/delete").status shouldBe HttpStatusCode.Conflict
            admin.json("/api/admin/groups/$a/members/remove", """{"username":"Ada"}""")
            admin.json("/api/admin/groups/$a/delete").status shouldBe HttpStatusCode.NoContent
            admin.get("/api/admin/groups/$a").status shouldBe HttpStatusCode.NotFound
            admin.putJson("/api/admin/groups/$a", """{"name":"Z"}""").status shouldBe HttpStatusCode.NotFound
        }

    @Test
    fun `renaming keeps names unique`() =
        testApplication {
            studyApp()
            val admin = userClient(ADMIN)
            val a = admin.createGroup("A")
            admin.createGroup("B")
            admin.putJson("/api/admin/groups/$a", """{"name":"B"}""").status shouldBe HttpStatusCode.Conflict
            admin.putJson("/api/admin/groups/$a", """{"name":"Condition A"}""").data().field("name").jsonPrimitive.content shouldBe
                "Condition A"
        }
}

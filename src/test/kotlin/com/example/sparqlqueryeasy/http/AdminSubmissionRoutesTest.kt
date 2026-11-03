@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.auth.MutableClock
import com.example.sparqlqueryeasy.persistence.DatabaseConnector
import com.example.sparqlqueryeasy.persistence.TestPostgres
import com.example.sparqlqueryeasy.persistence.inTransaction
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import org.junit.jupiter.api.Test
import java.time.Duration

/** STUDY-017 (DEC-020): the admin reviews each participant's last save beside the reference of its revision. */
class AdminSubmissionRoutesTest {
    private val clock = MutableClock()
    private var groupId = 0L

    private suspend fun ApplicationTestBuilder.fireTask(vararg members: String): Pair<HttpClient, List<HttpClient>> {
        val admin = userClient(ADMIN)
        val clients = members.map { userClient(it) }
        admin.json("/api/admin/tasks", taskBody()).status shouldBe HttpStatusCode.Created
        groupId = admin.createGroup("A", listOf("fire-fast"), members.toList())
        return admin to clients
    }

    private suspend fun HttpClient.save(answer: String = drawn()) {
        clock.advance(Duration.ofSeconds(5))
        json("/api/study/tasks/fire-fast/submissions", answer).status shouldBe HttpStatusCode.Created
    }

    private suspend fun HttpClient.lastSaves(): List<JsonObject> =
        get("/api/admin/submissions").also { it.status shouldBe HttpStatusCode.OK }.data().jsonArray.map { it as JsonObject }

    private fun JsonElement.text(name: String) = field(name).jsonPrimitive.content

    @Test
    fun `the list has the last save per participant and task under a pseudonym with saves, finished and the hint`() =
        testApplication {
            studyApp(clock = clock)
            val (admin, clients) = fireTask("Ada", "Bob")
            val (ada, bob) = clients
            // Bob saves first, so he is P001 although Ada's account is older (DEC-020 C10, by first save).
            bob.save(drawn(fireSpeedQuery(minimumSpeed = null)))
            ada.save(drawn(fireSpeedQuery(minimumSpeed = null)))
            ada.save()
            ada.json("/api/study/finish").status shouldBe HttpStatusCode.OK

            val saves = admin.lastSaves()

            saves.map { listOf(it.text("participant"), it.text("username"), it.text("taskKey"), it.text("saves")) } shouldBe
                listOf(listOf("P001", "Bob", "fire-fast", "1"), listOf("P002", "Ada", "fire-fast", "2"))
            saves.map { it.text("autoCheck") } shouldBe listOf("no_match", "match")
            saves.map { it.field("finished").jsonPrimitive.boolean } shouldBe listOf(false, true)
            saves.map { it.field("taskRevision").jsonPrimitive.int } shouldBe listOf(1, 1)
            saves[1].field("timeSpentMs").jsonPrimitive.long shouldBe 5_000
            saves[1].text("taskTitle") shouldBe "Fast Fire Pokémon"

            // A newcomer only adds a higher number; the others keep theirs (C10).
            val cora = userClient("Cora")
            admin.json("/api/admin/groups/$groupId/members", """{"username":"Cora"}""")
            cora.save()
            admin.lastSaves().map { it.text("participant") to it.text("username") } shouldBe
                listOf("P001" to "Bob", "P002" to "Ada", "P003" to "Cora")
            admin.lastSaves() shouldBe admin.lastSaves()
        }

    @Test
    fun `a save keeps the reference of its revision after the task is edited`() =
        testApplication {
            studyApp(clock = clock)
            val (admin, clients) = fireTask("Ada", "Bob")
            val (ada, bob) = clients
            ada.save()
            admin.putJson(
                "/api/admin/tasks/fire-fast",
                taskBody(statement = "Find every Fire-type Pokémon.", reference = drawn(typeQuery("FireType"))),
            ).data().field("revision").jsonPrimitive.int shouldBe 2
            bob.save(drawn(typeQuery("FireType")))

            val (adaSave, bobSave) = admin.lastSaves().sortedBy { it.text("username") }
            val old = admin.get("/api/admin/submissions/${adaSave.text("id")}").data()
            val new = admin.get("/api/admin/submissions/${bobSave.text("id")}").data()

            old.field("summary").field("taskRevision").jsonPrimitive.int shouldBe 1
            old.field("reference").let { reference ->
                reference.field("revision").jsonPrimitive.int shouldBe 1
                reference.text("statement") shouldBe "Find the Fire-type Pokémon with speed of at least 90."
                reference.text("referenceSparql") shouldContain "speed"
                reference.field("referenceQuery").field("where").jsonArray.size shouldBe 2
                reference.field("referenceGraph").field("formatVersion").jsonPrimitive.int shouldBe 1
            }
            new.field("reference").text("statement") shouldBe "Find every Fire-type Pokémon."
            new.field("reference").field("referenceQuery").field("where").jsonArray.size shouldBe 1
            new.field("check").text("hint") shouldBe "match"

            old.field("graph").field("formatVersion").jsonPrimitive.int shouldBe 1
            old.field("query").field("where").jsonArray.size shouldBe 2
            old.field("check").let { check ->
                check.text("kind") shouldBe "variables"
                check.text("hint") shouldBe "match"
                val (pokemon, speed) = check.field("variables").jsonArray
                pokemon.text("variable") shouldBe "?pokemon"
                pokemon.field("match").jsonPrimitive.boolean shouldBe true
                pokemon.text("sparql") shouldContain "SELECT"
                pokemon.field("values").jsonArray.size shouldBe pokemon.field("expectedCount").jsonPrimitive.int
                speed.text("variable") shouldBe "?speed"
            }
        }

    @Test
    fun `a variable-free answer shows its structural check and a revision that was not kept has no reference`() =
        testApplication {
            val connector = DatabaseConnector(TestPostgres.freshDatabase()).also { it.connect() }
            studyApp(clock = clock, connector = connector)
            val (admin, clients) = fireTask("Ada")
            val charizard =
                """{"where":[{"subject":"<${PK}Charizard>","predicate":"<${PK}hasType>",""" +
                    """"object":"<${PK}FireType>","filterType":null}],"variableFilters":[]}"""
            clients.single().save(drawn(charizard))
            // As for a save made before V13: only the task's current revision was copied.
            connector.inTransaction { exec("DELETE FROM study_task_revision") }

            val id = admin.lastSaves().single().text("id")
            val review = admin.get("/api/admin/submissions/$id").data()

            review.field("reference") shouldBe JsonNull
            review.field("check").let { check ->
                check.text("kind") shouldBe "structural"
                check.text("hint") shouldBe "no_match"
                check.field("missing").jsonPrimitive.int shouldBe 2
                check.field("extra").jsonPrimitive.int shouldBe 1
                check.field("variables").jsonArray.size shouldBe 0
            }
        }

    @Test
    fun `an earlier save is not reviewed, participants get 403 and anonymous callers 401`() =
        testApplication {
            studyApp(clock = clock)
            val (admin, clients) = fireTask("Ada")
            val ada = clients.single()
            ada.save()
            ada.save()
            val last = admin.lastSaves().single().text("id").toLong()

            admin.get("/api/admin/submissions/${last - 1}").status shouldBe HttpStatusCode.NotFound
            admin.get("/api/admin/submissions/nope").status shouldBe HttpStatusCode.NotFound
            admin.get("/api/admin/submissions/$last").status shouldBe HttpStatusCode.OK
            ada.get("/api/admin/submissions").status shouldBe HttpStatusCode.Forbidden
            ada.get("/api/admin/submissions/$last").status shouldBe HttpStatusCode.Forbidden
            client.get("/api/admin/submissions").status shouldBe HttpStatusCode.Unauthorized
            client.get("/api/admin/submissions/$last").status shouldBe HttpStatusCode.Unauthorized
        }

    @Test
    fun `without saves the list is empty`() =
        testApplication {
            studyApp(clock = clock)
            fireTask("Ada").first.lastSaves() shouldBe emptyList()
        }
}

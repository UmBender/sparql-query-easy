package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.http.AccessFixture.Companion.A_TASK
import com.example.sparqlqueryeasy.http.AccessFixture.Companion.B_TASK
import com.example.sparqlqueryeasy.http.AccessFixture.Companion.FIRE_ANSWER
import com.example.sparqlqueryeasy.http.AccessFixture.Companion.WATER_ANSWER
import io.kotest.assertions.withClue
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldNotContain
import io.ktor.client.request.get
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.TextContent
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Test

/**
 * QUAL-019, threat 3 of the Security Test Plan (IDOR): participant Ada (group A) reads only her own data and her
 * group's tasks. Another participant's submissions, questionnaire answers and consent, and a task of another group,
 * are out of reach (a task outside the group is 404, not 403, so its existence is not revealed), and no participant
 * answer ever carries a task's expected result or reference query.
 */
class ParticipantIsolationTest {
    @Test
    fun `a task of another group is 404 on every participant route, as if it did not exist`() =
        testApplication {
            val fixture = accessFixture()
            val ada = fixture.ada
            val missing = """{"error":"Task not found"}"""
            val taskOps =
                client.openApiOperations().filter {
                    it.template.contains("{key}") && it.template.startsWith("/api/study/")
                }

            ada.get("/api/study/tasks").data().jsonKeys() shouldBe listOf(A_TASK)
            withClue("participant task operations found") { taskOps.isEmpty() shouldBe false }
            for (operation in taskOps + client.openApiOperations().filter { "task" in it.requiredQuery }) {
                for (key in listOf(B_TASK, "no-such-task")) {
                    val values = mapOf("key" to key, "task" to key)
                    val body =
                        if (operation.isWrite) drawn(typeQuery("WaterType")) else null
                    val response =
                        ada.send(operation, values) {
                            body?.let { setBody(TextContent(it, ContentType.Application.Json)) }
                        }
                    withClue("${operation.id} with $key") {
                        response.status shouldBe HttpStatusCode.NotFound
                        response.bodyAsText() shouldBe missing
                    }
                }
            }
            // Bob's attempt is still his only one: Ada's attempts stored nothing.
            fixture.bob.get("/api/study/submissions?task=$B_TASK").data().jsonArray.size shouldBe 1
        }

    @Test
    fun `a participant sees only their own attempts, consent and questionnaire state, whatever the parameters`() =
        testApplication {
            val fixture = accessFixture()
            val ada = fixture.ada
            // Cyd, in Ada's group, made a correct attempt at a-task; Ada made none.
            ada.get("/api/study/submissions?task=$A_TASK").bodyAsText() shouldBe """{"data":[]}"""
            val dee = Caller(client, "Dee").login()
            val eve = Caller(client, "Eve").login()
            // Dee accepted the consent but did not answer the profile, which Ada, Bob and Cyd did.
            dee.get("/api/study/forms/profile/response").data().field("answered").jsonPrimitive.content shouldBe "false"
            // Eve accepted nothing, which everyone else did.
            eve.get("/api/study/consent").data().field("acceptedAt").toString() shouldBe "null"

            val tampering =
                listOf(
                    "user=Bob",
                    "username=Bob",
                    "userId=${fixture.context.userId("Bob")}",
                    "participant=${fixture.context.userId("Bob")}",
                    "group=${fixture.groupB}",
                    "groupId=${fixture.groupB}",
                    "as=Bob",
                )
            val reads =
                client.openApiOperations().filter { !it.isWrite && ACCESS_RULES[it.id] == Access.PARTICIPANT_OWN }
            val changed = mutableListOf<String>()
            for (operation in reads) {
                val values = mapOf("key" to A_TASK, "task" to A_TASK, "slug" to "profile")
                val plain = operation.path(values)
                val expected = ada.get(plain).bodyAsText()
                for (parameter in tampering) {
                    val separator = if ('?' in plain) '&' else '?'
                    val actual = ada.get("$plain$separator$parameter").bodyAsText()
                    if (actual != expected) changed += "$plain$separator$parameter: $actual (without: $expected)"
                }
            }

            changed.shouldBeEmpty()
        }

    @Test
    fun `a submission body naming another user or carrying a verdict is stored as the caller's own attempt`() =
        testApplication {
            val fixture = accessFixture()
            val bobId = fixture.context.userId("Bob")
            val wrong = """{"variableName":"?pokemon","where":[],"variableFilters":[]}"""
            val forged =
                """{"graph":$fireSpeedGraph,"query":$wrong,"userId":$bobId,"username":"Bob","correct":true,""" +
                    """"expected":["$FIRE_ANSWER"],"task":"$B_TASK"}"""

            val response =
                fixture.ada.send(submitOperation(), mapOf("key" to A_TASK)) {
                    setBody(TextContent(forged, ContentType.Application.Json))
                }

            response.status shouldBe HttpStatusCode.Created
            response.data().field("correct").jsonPrimitive.content shouldBe "false"
            fixture.ada.get("/api/study/submissions?task=$A_TASK").data().jsonArray.size shouldBe 1
            fixture.bob.get("/api/study/submissions?task=$B_TASK").data().jsonArray.size shouldBe 1
        }

    @Test
    fun `no participant answer carries an expected result, a reference query or another participant's data`() =
        testApplication {
            val fixture = accessFixture()
            val ada = fixture.ada
            // Ada attempts her task once, right and wrong, so the attempt answers are in the sweep too.
            val submitted =
                listOf(drawn(typeQuery("FireType")), drawn(typeQuery("WaterType"))).map { answer ->
                    ada.send(submitOperation(), mapOf("key" to A_TASK)) {
                        setBody(TextContent(answer, ContentType.Application.Json))
                    }.bodyAsText()
                }
            val reads =
                client.openApiOperations().filter { !it.isWrite && ACCESS_RULES[it.id] != Access.ADMIN }
            val values = mapOf("key" to A_TASK, "task" to A_TASK, "slug" to "profile")
            val answers =
                reads.map { it.path(values) to ada.get(it.path(values)).bodyAsText() } +
                    submitted.map { "POST submissions" to it }
            val leaks = mutableListOf<String>()

            for ((path, body) in answers) {
                val keys = body.jsonOrNull()?.allKeys().orEmpty()
                val forbidden = keys.intersect(REFERENCE_FIELDS)
                if (forbidden.isNotEmpty()) leaks += "$path has $forbidden"
                for (marker in listOf(FIRE_ANSWER, WATER_ANSWER, B_TASK, "Bob", "Cyd", "Group B", "Group A")) {
                    if (marker in body) leaks += "$path contains $marker"
                }
            }

            withClue(leaks.joinToString("\n")) { leaks.size shouldBe 0 }
            // The admin's view of the same task does carry them, so the sweep would see a leak.
            fixture.admin.get("/api/admin/tasks/$A_TASK").bodyAsText().let { admin ->
                admin.jsonOrNull()!!.allKeys().intersect(REFERENCE_FIELDS).isEmpty() shouldBe false
                (FIRE_ANSWER in admin) shouldBe true
            }
            client.get("/api/study/tasks/$A_TASK").bodyAsText() shouldNotContain FIRE_ANSWER
        }

    private suspend fun ApplicationTestBuilder.submitOperation(): ApiOperation =
        client.openApiOperations().single { it.id == "POST /api/study/tasks/{key}/submissions" }

    private fun JsonElement.jsonKeys(): List<String> = (this as JsonArray).map { it.field("key").jsonPrimitive.content }

    private companion object {
        /** What only the admin may see of a task (API v1, STUDY-003/004). */
        val REFERENCE_FIELDS =
            setOf(
                "expected",
                "expectedResult",
                "expectedValues",
                "reference",
                "referenceQuery",
                "referenceSparql",
                "referenceGraph",
                "sparql",
            )
    }
}

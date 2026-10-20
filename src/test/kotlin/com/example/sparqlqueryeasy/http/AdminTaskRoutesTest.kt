@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.http

import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.ktor.client.request.cookie
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Test

/** STUDY-006: admin task management on Testcontainers PostgreSQL and the built-in PokemonGen1 graph. */
class AdminTaskRoutesTest {
    @Test
    fun `anonymous callers get 401 and participants 403 on every task route`() =
        testApplication {
            studyApp()
            val participant = userClient("Ada")
            val routes: List<suspend (io.ktor.client.HttpClient) -> io.ktor.client.statement.HttpResponse> =
                listOf(
                    { it.get("/api/admin/tasks") },
                    { it.get("/api/admin/tasks/fire-fast") },
                    { it.json("/api/admin/tasks", taskBody()) },
                    { it.json("/api/admin/tasks/preview", """{"endpoint":"PokemonGen1","reference":${drawn()}}""") },
                    { it.putJson("/api/admin/tasks/fire-fast", taskBody()) },
                    { it.json("/api/admin/tasks/fire-fast/deactivate") },
                    { it.json("/api/admin/tasks/fire-fast/reactivate") },
                )
            routes.forEach { route ->
                route(client).status shouldBe HttpStatusCode.Unauthorized
                route(participant).status shouldBe HttpStatusCode.Forbidden
            }
        }

    @Test
    fun `creating the Fire speed task stores what the same request returns on PokemonGen1`() =
        testApplication {
            studyApp()
            val admin = userClient(ADMIN)

            val created = admin.json("/api/admin/tasks", taskBody())

            created.status shouldBe HttpStatusCode.Created
            val task = created.data()
            task.field("revision").jsonPrimitive.int shouldBe 1
            task.field("active").jsonPrimitive.content shouldBe "true"
            task.field("referenceSparql").jsonPrimitive.content shouldContain "LIMIT 1001"
            val stored = task.field("expected").jsonArray.map { it.jsonObject }
            stored.forEach { it.getValue("type").jsonPrimitive.content shouldBe "iri" }
            val sameRequest =
                client.json(
                    "/api/query",
                    """{"endpointUrl":"PokemonGen1","limit":1000,"variableName":"?pokemon","where":[""" +
                        """{"subject":"?pokemon","predicate":"<${PK}hasType>","object":"<${PK}FireType>"},""" +
                        """{"subject":"?pokemon","predicate":"<${PK}speed>","object":"?speed"}],""" +
                        """"variableFilters":[{"variableName":"?speed","filterType":2,"value":"90"}]}""",
                ).data().jsonArray.map { it.field("propertyId").jsonPrimitive.content }
            stored.map { "<${it.getValue("value").jsonPrimitive.content}>" } shouldContainExactlyInAnyOrder sameRequest
            sameRequest shouldContain "<${PK}Charizard>"
            sameRequest shouldContain "<${PK}Rapidash>"

            val listed = admin.get("/api/admin/tasks").data().jsonArray.single()
            listed.field("key").jsonPrimitive.content shouldBe "fire-fast"
            listed.field("expectedCount").jsonPrimitive.int shouldBe sameRequest.size
            admin.get("/api/admin/tasks/fire-fast").data().field("referenceGraph").field("formatVersion").jsonPrimitive.int shouldBe 1
        }

    @Test
    fun `expected rows sent by the client are ignored`() =
        testApplication {
            studyApp()
            val admin = userClient(ADMIN)
            val forged = ""","expected":[{"type":"iri","value":"${PK}Pikachu"}],"expectedResult":[]"""

            val task = admin.json("/api/admin/tasks", taskBody(extra = forged)).data()

            val values = task.field("expected").jsonArray.map { it.field("value").jsonPrimitive.content }
            values shouldContain "${PK}Charizard"
            (("${PK}Pikachu") in values) shouldBe false
        }

    @Test
    fun `a reference result above the cap is rejected with 400 and nothing is stored`() =
        testApplication {
            studyApp()
            val admin = userClient(ADMIN)

            val response = admin.json("/api/admin/tasks", taskBody(maxResults = 3))

            response.status shouldBe HttpStatusCode.BadRequest
            response.bodyAsText() shouldContain "more than 3 results"
            admin.get("/api/admin/tasks").data() shouldBe JsonArray(emptyList())
        }

    @Test
    fun `invalid bodies are rejected with 400`() =
        testApplication {
            studyApp()
            val admin = userClient(ADMIN)
            val invalid =
                listOf(
                    taskBody(key = "Not A Key"),
                    taskBody(comparison = "bag"),
                    taskBody(reference = drawn(graph = """{"nodes":[]}""")),
                    taskBody().replace("PokemonGen1", "https://query.wikidata.org/sparql"),
                    "{not json",
                    taskBody(reference = drawn(query = """{"variableName":"?pokemon"}""")),
                )
            invalid.forEach { body -> admin.json("/api/admin/tasks", body).status shouldBe HttpStatusCode.BadRequest }
        }

    @Test
    fun `preview runs the reference without saving`() =
        testApplication {
            studyApp()
            val admin = userClient(ADMIN)

            val preview =
                admin.json(
                    "/api/admin/tasks/preview",
                    """{"endpoint":"PokemonGen1","reference":${drawn(typeQuery("FireType"))}}""",
                )

            preview.status shouldBe HttpStatusCode.OK
            val data = preview.data()
            data.field("distinctCount").jsonPrimitive.int shouldBe data.field("expected").jsonArray.distinct().size
            admin.get("/api/admin/tasks").data() shouldBe JsonArray(emptyList())
        }

    @Test
    fun `editing the reference increments the revision and editing only the title keeps the snapshot`() =
        testApplication {
            studyApp()
            val admin = userClient(ADMIN)
            val original = admin.json("/api/admin/tasks", taskBody()).data()

            val renamed = admin.putJson("/api/admin/tasks/fire-fast", taskBody(title = "Speedy Fire")).data()

            renamed.field("title").jsonPrimitive.content shouldBe "Speedy Fire"
            renamed.field("revision").jsonPrimitive.int shouldBe 1
            renamed.field("expected") shouldBe original.field("expected")
            renamed.field("referenceSparql") shouldBe original.field("referenceSparql")

            val slower = admin.putJson("/api/admin/tasks/fire-fast", taskBody(reference = drawn(fireSpeedQuery(100)))).data()

            slower.field("revision").jsonPrimitive.int shouldBe 2
            (slower.field("expected").jsonArray.size < original.field("expected").jsonArray.size) shouldBe true
            admin.putJson("/api/admin/tasks/fire-fast", taskBody(statement = "Another statement", reference = drawn(fireSpeedQuery(100))))
                .data().field("revision").jsonPrimitive.int shouldBe 3
            admin.putJson("/api/admin/tasks/missing", taskBody()).status shouldBe HttpStatusCode.NotFound
        }

    @Test
    fun `deactivating keeps the task and a duplicate key returns 409`() =
        testApplication {
            studyApp()
            val admin = userClient(ADMIN)
            admin.json("/api/admin/tasks", taskBody()).status shouldBe HttpStatusCode.Created

            val duplicate = admin.json("/api/admin/tasks", taskBody(title = "Other"))
            duplicate.status shouldBe HttpStatusCode.Conflict
            duplicate.bodyAsText() shouldBe """{"error":"A task with this key already exists"}"""

            admin.json("/api/admin/tasks/fire-fast/deactivate").data().field("active").jsonPrimitive.content shouldBe "false"
            admin.get("/api/admin/tasks").data().jsonArray.single().field("active").jsonPrimitive.content shouldBe "false"
            admin.json("/api/admin/tasks/fire-fast/reactivate").data().field("active").jsonPrimitive.content shouldBe "true"
            admin.json("/api/admin/tasks/missing/deactivate").status shouldBe HttpStatusCode.NotFound
            admin.get("/api/admin/tasks/missing").status shouldBe HttpStatusCode.NotFound
        }

    @Test
    fun `without a database the task routes answer 503 to a presented session`() =
        testApplication {
            studyApp(database = null)
            client.get("/api/admin/tasks").status shouldBe HttpStatusCode.Unauthorized
            val response = client.get("/api/admin/tasks") { cookie(SESSION_COOKIE, "abc") }
            response.status shouldBe HttpStatusCode.ServiceUnavailable
            response.bodyAsText() shouldBe """{"error":"Accounts are temporarily unavailable"}"""
        }
}

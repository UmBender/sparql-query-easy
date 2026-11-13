package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.auth.MutableClock
import com.example.sparqlqueryeasy.application.study.QuestionnaireService
import com.example.sparqlqueryeasy.application.study.StudyResources
import com.example.sparqlqueryeasy.persistence.DatabaseConnector
import com.example.sparqlqueryeasy.persistence.PostgresFormResponseStore
import com.example.sparqlqueryeasy.persistence.PostgresFormStore
import com.example.sparqlqueryeasy.persistence.TestPostgres
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.ktor.client.HttpClient
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
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Test
import java.sql.DriverManager

/** STUDY-010 (DEC-015 Q3/Q6): each questionnaire is answered once, checked on the server, in its place. */
class StudyFormResponseRoutesTest {
    /** Valid answers to the shipped usability questionnaire (v2): questions 2 to 15. */
    private val usability =
        (listOf(""""q02_queries_done":4""") + USABILITY_LIKERT.mapIndexed { index, id -> """"$id":${index % 5 + 1}""" })
            .joinToString(",", "{", "}")

    private suspend fun HttpClient.answer(
        slug: String,
        answers: String,
        version: Int = PROFILE_VERSION,
    ): HttpResponse = json("/api/study/forms/$slug/responses", """{"version":$version,"answers":$answers}""")

    @Test
    fun `a valid profile is stored once with the form and consent versions and only the answers`() =
        testApplication {
            val clock = MutableClock()
            val database = TestPostgres.freshDatabase()
            studyApp(database = database, clock = clock)
            val ada = userClient("Ada", profile = false)

            // A client time is never read; the server's clock is.
            val first =
                ada.json(
                    "/api/study/forms/profile/responses",
                    """{"version":2,"submittedAt":"2000-01-01T00:00:00Z","answers":$PROFILE_ANSWERS}""",
                )
            first.status shouldBe HttpStatusCode.Created
            first.data().field("submittedAt").jsonPrimitive.content shouldBe clock.now.toString()
            val again = ada.answer("profile", PROFILE_ANSWERS)
            again.status shouldBe HttpStatusCode.Conflict
            again.bodyAsText() shouldBe """{"error":"You have already answered this questionnaire"}"""

            val rows = storedRows(checkNotNull(database))
            rows.size shouldBe 1
            rows.single().first shouldBe "profile 2 2"
            Json.parseToJsonElement(rows.single().second).jsonObject shouldBe
                Json.parseToJsonElement(PROFILE_ANSWERS).jsonObject
            ada.get("/api/study/forms/profile/response").data().field("answered").jsonPrimitive.content shouldBe "true"
        }

    @Test
    fun `invalid answers are rejected per question even without the client check and nothing is stored`() =
        testApplication {
            val database = TestPostgres.freshDatabase()
            studyApp(database = database)
            val ada = userClient("Ada", profile = false)

            val response =
                ada.answer(
                    "profile",
                    """{"q01_sparql_knowledge":6,"email":"ada@example.org"}""",
                )

            response.status shouldBe HttpStatusCode.BadRequest
            val body = Json.parseToJsonElement(response.bodyAsText()).jsonObject
            body.getValue("errors").jsonObject.mapValues { it.value.jsonPrimitive.content } shouldBe
                mapOf("email" to "Unknown question.", "q01_sparql_knowledge" to "Choose a value from 1 to 5.")
            storedRows(checkNotNull(database)) shouldBe emptyList()
        }

    @Test
    fun `missing answers, an old version and an unknown questionnaire are refused`() =
        testApplication {
            studyApp()
            val ada = userClient("Ada", profile = false)
            val noAnswers = ada.json("/api/study/forms/profile/responses", """{"version":2}""")
            noAnswers.status shouldBe HttpStatusCode.BadRequest
            // The placeholder v1 is no longer the current version (STUDY-015).
            ada.answer("profile", PROFILE_ANSWERS, version = 1).status shouldBe HttpStatusCode.Conflict
            ada.answer("profile", PROFILE_ANSWERS, version = 3).status shouldBe HttpStatusCode.Conflict
            ada.answer("nope", "{}").status shouldBe HttpStatusCode.NotFound
            ada.get("/api/study/forms/nope/response").status shouldBe HttpStatusCode.NotFound
            ada.get("/api/study/forms/profile/response").data().field("submittedAt") shouldBe JsonNull
        }

    @Test
    fun `without consent nothing is stored, anonymous callers get 401 and cross-site posts 403`() =
        testApplication {
            studyApp()
            val bob = userClient("Bob", consent = false)
            val refused = bob.answer("profile", PROFILE_ANSWERS)
            refused.status shouldBe HttpStatusCode.Forbidden
            refused.bodyAsText() shouldBe """{"error":"consent_required"}"""
            bob.get("/api/study/forms").status shouldBe HttpStatusCode.Forbidden
            client.answer("profile", PROFILE_ANSWERS).status shouldBe HttpStatusCode.Unauthorized
            client.get("/api/study/forms/profile/response").status shouldBe HttpStatusCode.Unauthorized
            val ada = userClient("Ada", profile = false)
            ada.post("/api/study/forms/profile/responses") {
                contentType(ContentType.Application.Json)
                header(HttpHeaders.Origin, "https://evil.example")
                setBody("""{"version":2,"answers":$PROFILE_ANSWERS}""")
            }.status shouldBe HttpStatusCode.Forbidden
            ada.get("/api/study/forms/profile/response").data().field("answered").jsonPrimitive.content shouldBe "false"
        }

    @Test
    fun `the tasks open after the profile and the usability questionnaire only after the final submission`() =
        testApplication {
            studyApp()
            val ada = userClient("Ada", profile = false)

            val tasks = ada.get("/api/study/tasks")
            tasks.status shouldBe HttpStatusCode.Forbidden
            tasks.bodyAsText() shouldBe """{"error":"profile_required"}"""
            ada.json("/api/study/finish").bodyAsText() shouldBe """{"error":"profile_required"}"""
            val early = ada.answer("usability", usability)
            early.status shouldBe HttpStatusCode.Forbidden
            early.bodyAsText() shouldBe """{"error":"finish_required"}"""

            ada.answerProfile().status shouldBe HttpStatusCode.Created
            ada.get("/api/study/tasks").status shouldBe HttpStatusCode.OK
            ada.json("/api/study/finish").status shouldBe HttpStatusCode.OK
            ada.answer("usability", """{"q02_queries_done":21}""").let { refused ->
                refused.status shouldBe HttpStatusCode.BadRequest
                val errors = Json.parseToJsonElement(refused.bodyAsText()).jsonObject.getValue("errors").jsonObject
                errors.getValue("q02_queries_done").jsonPrimitive.content shouldBe "Enter a number from 0 to 20."
                errors.keys shouldBe (listOf("q02_queries_done") + USABILITY_LIKERT).toSet()
            }
            ada.answer("usability", usability).status shouldBe HttpStatusCode.Created

            val forms = ada.get("/api/study/forms").data().jsonArray.map { it.jsonObject }
            val phases = forms.map { it.text("slug") to it.text("phase") }
            phases shouldBe listOf("profile" to "before_tasks", "usability" to "after_finish")
            forms.forEach { (it.getValue("submittedAt") == JsonNull) shouldBe false }
            userClient(ADMIN, consent = false).get("/api/study/tasks").status shouldBe HttpStatusCode.OK
        }

    @Test
    fun `a stored version with responses can no longer change`() =
        testApplication {
            val connector = DatabaseConnector(TestPostgres.freshDatabase()).also { it.connect() }
            studyApp(connector = connector)
            userClient("Ada").get("/api/study/tasks").status shouldBe HttpStatusCode.OK
            val shipped = StudyResources.fromClasspath()
            val profile = shipped.currentForms.getValue("profile")
            val edited = profile.copy(title = "PLACEHOLDER edited")
            val service =
                QuestionnaireService(
                    shipped.withProfile(edited),
                    PostgresFormStore(connector),
                    PostgresFormResponseStore(connector),
                )

            shouldThrow<IllegalStateException> { service.storedId(edited) }.message shouldContain
                "changed after responses were stored"
        }

    private fun kotlinx.serialization.json.JsonObject.text(name: String): String = getValue(name).jsonPrimitive.content

    /** "slug version consentVersion" and the answers JSON of every stored response. */
    private fun storedRows(database: com.example.sparqlqueryeasy.config.DatabaseSettings): List<Pair<String, String>> =
        DriverManager.getConnection(database.url, database.user, database.password).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery(
                    "SELECT form_slug, form_version, consent_version, answers FROM study_form_response",
                ).use { rows ->
                    buildList {
                        while (rows.next()) {
                            add("${rows.getString(1)} ${rows.getInt(2)} ${rows.getInt(3)}" to rows.getString(4))
                        }
                    }
                }
            }
        }
}

/** The Likert questions 3 to 15 of the shipped usability questionnaire (v2, STUDY-015). */
internal val USABILITY_LIKERT =
    listOf(
        "q03_ease_of_use",
        "q04_video_usefulness",
        "q05_needs_support",
        "q06_well_integrated",
        "q07_inconsistencies",
        "q08_learn_quickly",
        "q09_confident",
        "q10_learn_before",
        "q11_symbols_clear",
        "q12_symbols_intuitive",
        "q13_symbol_count",
        "q14_notation_consistent",
        "q15_layout_helps",
    )

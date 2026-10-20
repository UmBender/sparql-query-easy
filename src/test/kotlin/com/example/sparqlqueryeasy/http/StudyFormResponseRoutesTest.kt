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
    private val usability = """{"easy_to_use":5,"faster_than_sparql":4,"confident":3,"most_useful":"filter_funnel"}"""

    private suspend fun HttpClient.answer(
        slug: String,
        answers: String,
        version: Int = 1,
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
                    """{"version":1,"submittedAt":"2000-01-01T00:00:00Z","answers":$PROFILE_ANSWERS}""",
                )
            first.status shouldBe HttpStatusCode.Created
            first.data().field("submittedAt").jsonPrimitive.content shouldBe clock.now.toString()
            val again = ada.answer("profile", PROFILE_ANSWERS)
            again.status shouldBe HttpStatusCode.Conflict
            again.bodyAsText() shouldBe """{"error":"You have already answered this questionnaire"}"""

            val rows = storedRows(checkNotNull(database))
            rows.size shouldBe 1
            rows.single().first shouldBe "profile 1 1"
            // The optional role was left empty, so it is not stored.
            Json.parseToJsonElement(rows.single().second).jsonObject shouldBe
                Json.parseToJsonElement(
                    """{"sparql_familiarity":"heard_of","query_languages":["sql","sparql"],"programming_years":4,""" +
                        """"data_comfort":4}""",
                ).jsonObject
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
                    PROFILE_ANSWERS.replace("\"programming_years\":4", "\"programming_years\":99")
                        .replace("\"role\":\"\"", "\"role\":\"\",\"email\":\"ada@example.org\""),
                )

            response.status shouldBe HttpStatusCode.BadRequest
            val body = Json.parseToJsonElement(response.bodyAsText()).jsonObject
            body.getValue("errors").jsonObject.mapValues { it.value.jsonPrimitive.content } shouldBe
                mapOf("email" to "Unknown question.", "programming_years" to "Enter a number from 0 to 60.")
            storedRows(checkNotNull(database)) shouldBe emptyList()
        }

    @Test
    fun `missing answers, an old version and an unknown questionnaire are refused`() =
        testApplication {
            studyApp()
            val ada = userClient("Ada", profile = false)
            val noAnswers = ada.json("/api/study/forms/profile/responses", """{"version":1}""")
            noAnswers.status shouldBe HttpStatusCode.BadRequest
            ada.answer("profile", PROFILE_ANSWERS, version = 2).status shouldBe HttpStatusCode.Conflict
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
                setBody("""{"version":1,"answers":$PROFILE_ANSWERS}""")
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

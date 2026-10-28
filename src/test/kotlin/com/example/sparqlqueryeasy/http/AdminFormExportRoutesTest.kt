package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.auth.MutableClock
import com.example.sparqlqueryeasy.application.study.FormSubmitResult
import com.example.sparqlqueryeasy.application.study.QuestionnaireService
import com.example.sparqlqueryeasy.application.study.StudyResources
import com.example.sparqlqueryeasy.persistence.DatabaseConnector
import com.example.sparqlqueryeasy.persistence.PostgresFormResponseStore
import com.example.sparqlqueryeasy.persistence.PostgresFormStore
import com.example.sparqlqueryeasy.persistence.TestPostgres
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldNotContain
import io.kotest.matchers.types.shouldBeInstanceOf
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.http.withCharset
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.jupiter.api.Test

/** STUDY-011 (DEC-015 Q5 A): admins download each questionnaire's responses as CSV; nobody else can. */
class AdminFormExportRoutesTest {
    @Test
    fun `an admin downloads the responses with the user id and group, never the username`() =
        testApplication {
            val context = studyApp()
            val admin = userClient(ADMIN, consent = false)
            userClient("Ada")
            admin.createGroup("Group A", members = listOf("Ada"))
            val ada = context.userId("Ada")

            val response = admin.get("/api/admin/forms/profile/responses.csv")

            response.status shouldBe HttpStatusCode.OK
            response.contentType() shouldBe ContentType.Text.CSV.withCharset(Charsets.UTF_8)
            response.headers[HttpHeaders.ContentDisposition] shouldBe "attachment; filename=profile-responses.csv"
            val lines = response.bodyAsText().split("\r\n")
            lines[0] shouldBe
                "response_id,participant,group,form_version,consent_version,submitted_at," +
                "q01_sparql_knowledge,$PROFILE_V1_COLUMNS"
            lines[1].split(",").let { cells ->
                cells[1] shouldBe ada.toString()
                cells.drop(2).take(3) shouldBe listOf("Group A", "2", "1")
                cells.drop(6) shouldBe listOf("2", "", "", "", "", "")
            }
            lines.drop(2) shouldBe listOf("")
            val body = response.bodyAsText()
            body shouldNotContain "Ada"
            body shouldNotContain "argon2"

            admin.get("/api/admin/forms/usability/responses.csv").bodyAsText().split("\r\n").size shouldBe 2
        }

    @Test
    fun `responses to the placeholder v1 stay in the export after the dissertation questions (STUDY-015)`() =
        testApplication {
            val connector = DatabaseConnector(TestPostgres.freshDatabase()).also { it.connect() }
            val clock = MutableClock()
            val context = studyApp(connector = connector, clock = clock)
            val admin = userClient(ADMIN, consent = false)
            userClient("Old", profile = false)
            val shipped = StudyResources.fromClasspath()
            val v1 = shipped.copy(forms = shipped.forms.filter { it.version == 1 })
            val old =
                QuestionnaireService(v1, PostgresFormStore(connector), PostgresFormResponseStore(connector), clock)
            val oldAnswers =
                """{"sparql_familiarity":"heard_of","query_languages":["sql","sparql"],"programming_years":4,""" +
                    """"data_comfort":4}"""
            old.submit(
                context.userId("Old"),
                "profile",
                1,
                Json.parseToJsonElement(oldAnswers).jsonObject,
                consentVersion = 1,
                finished = false,
            ).shouldBeInstanceOf<FormSubmitResult.Stored>()
            // A v1 answer still counts as the profile: the tasks are open and v2 is not asked again.
            userClient("Old", profile = false).get("/api/study/tasks").status shouldBe HttpStatusCode.OK
            userClient("Ada")

            val lines = admin.get("/api/admin/forms/profile/responses.csv").bodyAsText().split("\r\n")

            lines[0].substringAfter("submitted_at,") shouldBe "q01_sparql_knowledge,$PROFILE_V1_COLUMNS"
            lines[1].split(",").let { cells ->
                cells[3] shouldBe "1"
                cells.drop(6) shouldBe listOf("", "heard_of", "sql;sparql", "4", "4", "")
            }
            lines[2].split(",").let { cells ->
                cells[3] shouldBe "2"
                cells.drop(6) shouldBe listOf("2", "", "", "", "", "")
            }
        }

    @Test
    fun `participants get 403, anonymous callers 401 and an unknown questionnaire 404`() =
        testApplication {
            studyApp()
            userClient("Ada").get("/api/admin/forms/profile/responses.csv").status shouldBe HttpStatusCode.Forbidden
            client.get("/api/admin/forms/profile/responses.csv").status shouldBe HttpStatusCode.Unauthorized
            userClient(ADMIN, consent = false).get("/api/admin/forms/nope/responses.csv").status shouldBe
                HttpStatusCode.NotFound
        }
}

/** The question columns only the placeholder profile v1 had, after the current version's. */
private const val PROFILE_V1_COLUMNS = "sparql_familiarity,query_languages,programming_years,data_comfort,role"

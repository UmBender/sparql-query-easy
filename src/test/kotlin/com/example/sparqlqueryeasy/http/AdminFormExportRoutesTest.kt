package com.example.sparqlqueryeasy.http

import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldNotContain
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.http.withCharset
import io.ktor.server.testing.testApplication
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
                "sparql_familiarity,query_languages,programming_years,data_comfort,role"
            lines[1].split(",").let { cells ->
                cells[1] shouldBe ada.toString()
                cells.drop(2).take(3) shouldBe listOf("Group A", "1", "1")
                cells.drop(6) shouldBe listOf("heard_of", "sql;sparql", "4", "4", "")
            }
            lines.drop(2) shouldBe listOf("")
            val body = response.bodyAsText()
            body shouldNotContain "Ada"
            body shouldNotContain "argon2"

            admin.get("/api/admin/forms/usability/responses.csv").bodyAsText().split("\r\n").size shouldBe 2
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

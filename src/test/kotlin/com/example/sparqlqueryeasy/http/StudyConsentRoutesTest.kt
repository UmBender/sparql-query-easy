package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.auth.MutableClock
import com.example.sparqlqueryeasy.application.study.ConsentResult
import com.example.sparqlqueryeasy.application.study.ConsentService
import com.example.sparqlqueryeasy.application.study.ConsentText
import com.example.sparqlqueryeasy.application.study.StudyResources
import com.example.sparqlqueryeasy.persistence.DatabaseConnector
import com.example.sparqlqueryeasy.persistence.PostgresConsentStore
import com.example.sparqlqueryeasy.persistence.TestPostgres
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldStartWith
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
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Test
import java.time.Duration

/** STUDY-008 (DEC-015 Q1): consent to the current text before any task attempt or questionnaire response. */
class StudyConsentRoutesTest {
    private val required = """{"error":"consent_required"}"""

    private suspend fun HttpClient.gatedRoutes(): List<HttpResponse> =
        listOf(
            get("/api/study/tasks"),
            get("/api/study/tasks/fire-fast"),
            json("/api/study/tasks/fire-fast/submissions", drawn()),
            get("/api/study/submissions?task=fire-fast"),
            json("/api/study/finish"),
        )

    @Test
    fun `the shipped consent text is a marked placeholder at version 1`() {
        val consent = StudyResources.fromClasspath().consent
        consent.version shouldBe 1
        consent.text shouldStartWith "PLACEHOLDER"
    }

    @Test
    fun `without consent every task route answers 403 consent_required and stores nothing`() =
        testApplication {
            val context = studyApp()
            val admin = userClient(ADMIN)
            val ada = userClient("Ada", consent = false)
            admin.json("/api/admin/tasks", taskBody()).status shouldBe HttpStatusCode.Created
            admin.createGroup("A", listOf("fire-fast"), listOf("Ada"))

            ada.gatedRoutes().forEach { response ->
                response.status shouldBe HttpStatusCode.Forbidden
                response.bodyAsText() shouldBe required
            }
            context.progress.finishedAt(context.userId("Ada")) shouldBe null

            ada.acceptConsent().status shouldBe HttpStatusCode.OK
            ada.answerProfile().status shouldBe HttpStatusCode.Created
            ada.gatedRoutes().map { it.status } shouldBe
                listOf(
                    HttpStatusCode.OK,
                    HttpStatusCode.OK,
                    HttpStatusCode.Created,
                    HttpStatusCode.OK,
                    HttpStatusCode.OK,
                )
        }

    @Test
    fun `accepting stores the current version once with the server time`() =
        testApplication {
            val clock = MutableClock()
            studyApp(clock = clock)
            val ada = userClient("Ada", consent = false)

            val before = ada.get("/api/study/consent").data()
            before.field("version").jsonPrimitive.content shouldBe "1"
            before.field("text").jsonPrimitive.content shouldStartWith "PLACEHOLDER"
            before.field("acceptedAt") shouldBe JsonNull

            val first = ada.acceptConsent().data()
            first.field("acceptedAt").jsonPrimitive.content shouldBe clock.now.toString()
            clock.advance(Duration.ofHours(1))
            val again = ada.acceptConsent()

            again.status shouldBe HttpStatusCode.OK
            again.data().field("acceptedAt") shouldBe first.field("acceptedAt")
            ada.get("/api/study/consent").data().field("acceptedAt") shouldBe first.field("acceptedAt")
        }

    @Test
    fun `an old or unknown version answers 409 and stores nothing, a missing one 400`() =
        testApplication {
            studyApp()
            val ada = userClient("Ada", consent = false)

            ada.json("/api/study/consent", """{"version":0}""").status shouldBe HttpStatusCode.Conflict
            ada.json("/api/study/consent", """{"version":2}""").status shouldBe HttpStatusCode.Conflict
            ada.json("/api/study/consent", "{}").status shouldBe HttpStatusCode.BadRequest
            ada.get("/api/study/consent").data().field("acceptedAt") shouldBe JsonNull
            ada.get("/api/study/tasks").status shouldBe HttpStatusCode.Forbidden
        }

    @Test
    fun `a new consent version asks a user who accepted only the old one again`() =
        testApplication {
            val connector = DatabaseConnector(TestPostgres.freshDatabase()).also { it.connect() }
            val context = studyApp(connector = connector)
            userClient("Ada").get("/api/study/tasks").status shouldBe HttpStatusCode.OK
            val ada = context.userId("Ada")

            val second = ConsentService(ConsentText(2, "PLACEHOLDER second text"), PostgresConsentStore(connector))

            second.hasConsented(ada) shouldBe false
            (second.accept(ada, 1) is ConsentResult.NotCurrent) shouldBe true
            (second.accept(ada, 2) is ConsentResult.Accepted) shouldBe true
            second.hasConsented(ada) shouldBe true
        }

    @Test
    fun `admins are not gated and anonymous callers get 401`() =
        testApplication {
            studyApp()
            val admin = userClient(ADMIN, consent = false)
            admin.get("/api/study/tasks").status shouldBe HttpStatusCode.OK
            client.get("/api/study/consent").status shouldBe HttpStatusCode.Unauthorized
            client.json("/api/study/consent", """{"version":1}""").status shouldBe HttpStatusCode.Unauthorized
        }

    @Test
    fun `accepting needs a same-origin JSON request`() =
        testApplication {
            studyApp()
            val ada = userClient("Ada", consent = false)
            ada.post("/api/study/consent") {
                contentType(ContentType.Application.Json)
                header(HttpHeaders.Origin, "https://evil.example")
                setBody("""{"version":1}""")
            }.status shouldBe HttpStatusCode.Forbidden
            ada.post("/api/study/consent") { setBody("""{"version":1}""") }.status shouldBe
                HttpStatusCode.UnsupportedMediaType
            ada.get("/api/study/consent").data().field("acceptedAt") shouldBe JsonNull
        }
}

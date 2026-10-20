@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.auth.MutableClock
import io.kotest.matchers.shouldBe
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
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Test
import java.time.Duration

/** STUDY-005: the final submission closes the proposed queries for that user only (D6). */
class StudyFinishRoutesTest {
    private val closed = """{"error":"You have finished the study; the proposed queries are closed"}"""

    private suspend fun HttpClient.studyRoutes(): List<HttpResponse> =
        listOf(
            get("/api/study/tasks"),
            get("/api/study/tasks/fire-fast"),
            json("/api/study/tasks/fire-fast/submissions", drawn()),
            get("/api/study/submissions?task=fire-fast"),
        )

    @Test
    fun `after finishing, list, open, submit and history return 403 for that user only`() =
        testApplication {
            studyApp()
            val admin = userClient(ADMIN)
            val ada = userClient("Ada")
            val bob = userClient("Bob")
            admin.json("/api/admin/tasks", taskBody()).status shouldBe HttpStatusCode.Created
            admin.createGroup("A", listOf("fire-fast"), listOf("Ada", "Bob"))
            ada.studyRoutes().map { it.status } shouldBe
                listOf(HttpStatusCode.OK, HttpStatusCode.OK, HttpStatusCode.Created, HttpStatusCode.OK)

            ada.json("/api/study/finish").status shouldBe HttpStatusCode.OK

            ada.studyRoutes().forEach { response ->
                response.status shouldBe HttpStatusCode.Forbidden
                response.bodyAsText() shouldBe closed
            }
            bob.studyRoutes().map { it.status } shouldBe
                listOf(HttpStatusCode.OK, HttpStatusCode.OK, HttpStatusCode.Created, HttpStatusCode.OK)
            ada.get("/api/auth/session").status shouldBe HttpStatusCode.OK
        }

    @Test
    fun `finishing twice answers 200 with the first time`() =
        testApplication {
            val clock = MutableClock()
            studyApp(clock = clock)
            val ada = userClient("Ada")

            val first = ada.json("/api/study/finish").data().field("finishedAt").jsonPrimitive.content
            clock.advance(Duration.ofHours(1))
            val second = ada.json("/api/study/finish")

            first shouldBe clock.now.minus(Duration.ofHours(1)).toString()
            second.status shouldBe HttpStatusCode.OK
            second.data().field("finishedAt").jsonPrimitive.content shouldBe first
        }

    @Test
    fun `finishing needs a session and a same-origin JSON request`() =
        testApplication {
            studyApp()
            val ada = userClient("Ada")
            client.json("/api/study/finish").status shouldBe HttpStatusCode.Unauthorized
            ada.post("/api/study/finish") {
                contentType(ContentType.Application.Json)
                header(HttpHeaders.Origin, "https://evil.example")
                setBody("{}")
            }.status shouldBe HttpStatusCode.Forbidden
            ada.post("/api/study/finish") { setBody("finish") }.status shouldBe HttpStatusCode.UnsupportedMediaType
            ada.get("/api/study/tasks").status shouldBe HttpStatusCode.OK
        }
}

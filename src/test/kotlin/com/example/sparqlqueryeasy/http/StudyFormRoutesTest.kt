package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.study.FormDefinition
import com.example.sparqlqueryeasy.application.study.QuestionnaireService
import com.example.sparqlqueryeasy.application.study.StudyResources
import com.example.sparqlqueryeasy.persistence.DatabaseConnector
import com.example.sparqlqueryeasy.persistence.PostgresFormStore
import com.example.sparqlqueryeasy.persistence.TestPostgres
import io.kotest.matchers.shouldBe
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.decodeFromJsonElement
import org.junit.jupiter.api.Test

/** STUDY-009: the questionnaire definitions over GET /api/study/forms/{slug}. */
class StudyFormRoutesTest {
    private val lenient = Json { ignoreUnknownKeys = true }

    @Test
    fun `a consenting participant reads the current definition, which is then stored`() =
        testApplication {
            val connector = DatabaseConnector(TestPostgres.freshDatabase()).also { it.connect() }
            studyApp(connector = connector)
            val ada = userClient("Ada")

            val response = ada.get("/api/study/forms/profile")

            response.status shouldBe HttpStatusCode.OK
            val served = lenient.decodeFromJsonElement<FormDefinition>(response.data())
            served shouldBe StudyResources.fromClasspath().currentForms.getValue("profile")
            val stored = PostgresFormStore(connector).store("profile", 1, "{}", java.time.Instant.EPOCH)
            Json.decodeFromString<FormDefinition>(stored.definitionJson) shouldBe served
        }

    @Test
    fun `unknown slugs answer 404, no consent 403 and anonymous 401`() =
        testApplication {
            studyApp()
            userClient("Ada").get("/api/study/forms/nope").status shouldBe HttpStatusCode.NotFound
            val bob = userClient("Bob", consent = false)
            val forbidden = bob.get("/api/study/forms/profile")
            forbidden.status shouldBe HttpStatusCode.Forbidden
            forbidden.bodyAsText() shouldBe """{"error":"consent_required"}"""
            client.get("/api/study/forms/profile").status shouldBe HttpStatusCode.Unauthorized
        }

    @Test
    fun `a stored version whose file changed is brought up to date`() =
        testApplication {
            val connector = DatabaseConnector(TestPostgres.freshDatabase()).also { it.connect() }
            val store = PostgresFormStore(connector)
            val shipped = StudyResources.fromClasspath()
            val first = QuestionnaireService(shipped, store)
            val profile = checkNotNull(first.current("profile"))
            val id = first.storedId(profile)

            val edited = profile.copy(title = "PLACEHOLDER edited")
            val second = QuestionnaireService(shipped.copy(forms = listOf(edited)), store)

            second.storedId(edited) shouldBe id
            val stored = store.store("profile", 1, "{}", java.time.Instant.EPOCH).definitionJson
            Json.decodeFromString<FormDefinition>(stored) shouldBe edited
        }
}

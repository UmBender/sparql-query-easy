package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.auth.MutableClock
import com.example.sparqlqueryeasy.application.study.DiagramText
import com.example.sparqlqueryeasy.persistence.DatabaseConnector
import com.example.sparqlqueryeasy.persistence.TestPostgres
import com.example.sparqlqueryeasy.persistence.inTransaction
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.kotest.matchers.string.shouldStartWith
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsBytes
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import org.junit.jupiter.api.Test
import java.io.ByteArrayInputStream
import java.time.Duration
import java.time.Instant
import java.util.zip.ZipInputStream

/** STUDY-018 (DEC-020): the ZIP of the last saved answers, read back entry by entry. */
class AdminSubmissionExportRoutesTest {
    private val clock = MutableClock(Instant.parse("2026-11-02T12:00:00Z"))

    private suspend fun ApplicationTestBuilder.fireTask(vararg members: String): Pair<HttpClient, List<HttpClient>> {
        val admin = userClient(ADMIN)
        val clients = members.map { userClient(it) }
        admin.json("/api/admin/tasks", taskBody()).status shouldBe HttpStatusCode.Created
        admin.createGroup("A", listOf("fire-fast"), members.toList())
        return admin to clients
    }

    private suspend fun HttpClient.save(answer: String = drawn()) {
        clock.advance(Duration.ofSeconds(1))
        json("/api/study/tasks/fire-fast/submissions", answer).status shouldBe HttpStatusCode.Created
    }

    /** The ZIP's entries in order, as UTF-8 text. */
    private fun unzip(bytes: ByteArray): Map<String, String> =
        ZipInputStream(ByteArrayInputStream(bytes)).use { zip ->
            generateSequence { zip.nextEntry }.associate { it.name to zip.readBytes().toString(Charsets.UTF_8) }
        }

    private val charizard =
        """{"where":[{"subject":"<${PK}Charizard>","predicate":"<${PK}hasType>",""" +
            """"object":"<${PK}FireType>","filterType":null}],"variableFilters":[]}"""

    @Test
    fun `the ZIP holds the index and one folder per pseudonym and task with only the last save`() =
        testApplication {
            studyApp(clock = clock)
            val (admin, clients) = fireTask("Ada", "Bob")
            val (ada, bob) = clients
            ada.save(drawn(fireSpeedQuery(minimumSpeed = null)))
            ada.save()
            bob.save(drawn(charizard))
            ada.json("/api/study/finish")

            val response = admin.get("/api/admin/submissions.zip")

            response.status shouldBe HttpStatusCode.OK
            response.contentType() shouldBe ContentType.Application.Zip
            response.headers[HttpHeaders.ContentDisposition] shouldBe "attachment; filename=submissions-2026-11-02.zip"
            val files = unzip(response.bodyAsBytes())
            files.keys.toList() shouldBe
                listOf(
                    "index.csv",
                    "P001/fire-fast/diagram.txt",
                    "P001/fire-fast/diagram.json",
                    "P001/fire-fast/reference.txt",
                    "P001/fire-fast/query.sparql",
                    "P001/fire-fast/values.csv",
                    "P002/fire-fast/diagram.txt",
                    "P002/fire-fast/diagram.json",
                    "P002/fire-fast/reference.txt",
                )
            files.getValue("index.csv") shouldBe
                "participant,task_key,task_revision,saved_at,time_spent_s,saves,finished,auto_check\r\n" +
                "P001,fire-fast,1,2026-11-02T12:00:02Z,1,2,true,match\r\n" +
                "P002,fire-fast,1,2026-11-02T12:00:03Z,0,1,false,no_match\r\n"

            // Only the last save: its diagram.json is the saved graph, which the editor loads (frontend fixture).
            Json.parseToJsonElement(files.getValue("P001/fire-fast/diagram.json")) shouldBe
                Json.parseToJsonElement(fireSpeedGraph)
            files.getValue("P001/fire-fast/diagram.txt") shouldBe
                DiagramText.render(
                    "Diagram of P001, task fire-fast, revision 1 (derived from diagram.json)",
                    fireSpeedGraph,
                )
            files.getValue("P001/fire-fast/diagram.txt") shouldContain
                "[3] ?speed — value variable, filter: at least 90"
            files.getValue("P001/fire-fast/query.sparql").let {
                it shouldStartWith "# ?pokemon\n"
                it shouldContain "# ?speed\n"
                it shouldContain "SELECT"
            }
            files.getValue("P001/fire-fast/values.csv") shouldStartWith "variable,row,type,value,datatype,language\r\n"
            files.getValue("P001/fire-fast/values.csv") shouldContain "?pokemon,1,iri,$PK"
            files.getValue("P001/fire-fast/reference.txt").let {
                it shouldStartWith "Reference of task fire-fast, revision 1"
                it shouldContain "Statement\n  Find the Fire-type Pokémon with speed of at least 90."
                it shouldContain "Reference SPARQL\n"
                it shouldContain "Expected values (set): "
            }

            val everything = files.values.joinToString("\n")
            listOf("Ada", "Bob", ADMIN, "@").forEach { everything shouldNotContain it }
        }

    @Test
    fun `a revision that was not kept is named in reference txt`() =
        testApplication {
            val connector = DatabaseConnector(TestPostgres.freshDatabase()).also { it.connect() }
            studyApp(clock = clock, connector = connector)
            val (admin, clients) = fireTask("Ada")
            clients.single().save(drawn(charizard))
            connector.inTransaction { exec("DELETE FROM study_task_revision") }

            val files = unzip(admin.get("/api/admin/submissions.zip").bodyAsBytes())

            files.getValue("P001/fire-fast/reference.txt") shouldContain
                "The reference for revision 1 was not kept"
        }

    @Test
    fun `without saves the ZIP holds only the header, and only admins may download it`() =
        testApplication {
            studyApp(clock = clock)
            val (admin, clients) = fireTask("Ada")

            unzip(admin.get("/api/admin/submissions.zip").bodyAsBytes()) shouldBe
                mapOf(
                    "index.csv" to
                        "participant,task_key,task_revision,saved_at,time_spent_s,saves,finished,auto_check\r\n",
                )
            clients.single().get("/api/admin/submissions.zip").status shouldBe HttpStatusCode.Forbidden
            client.get("/api/admin/submissions.zip").status shouldBe HttpStatusCode.Unauthorized
        }
}

@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.security

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import com.example.sparqlqueryeasy.application.localdatabase.InMemoryLocalGraphCache
import com.example.sparqlqueryeasy.application.localdatabase.LocalDatabaseUploadService
import com.example.sparqlqueryeasy.application.relationships.EndpointExecution
import com.example.sparqlqueryeasy.domain.model.SparqlSelectResult
import com.example.sparqlqueryeasy.http.ADMIN
import com.example.sparqlqueryeasy.http.HttpDependencies
import com.example.sparqlqueryeasy.http.INTERNAL_ERROR
import com.example.sparqlqueryeasy.http.MALFORMED_BODY
import com.example.sparqlqueryeasy.http.PROFILE_ANSWERS
import com.example.sparqlqueryeasy.http.SESSION_COOKIE
import com.example.sparqlqueryeasy.http.configureErrorHandling
import com.example.sparqlqueryeasy.http.configureRequestLogging
import com.example.sparqlqueryeasy.http.configureRouting
import com.example.sparqlqueryeasy.http.configureSerialization
import com.example.sparqlqueryeasy.http.createGroup
import com.example.sparqlqueryeasy.http.drawn
import com.example.sparqlqueryeasy.http.json
import com.example.sparqlqueryeasy.http.studyApp
import com.example.sparqlqueryeasy.http.taskBody
import com.example.sparqlqueryeasy.http.userClient
import com.example.sparqlqueryeasy.rdf.jena.JenaTurtleParser
import io.kotest.assertions.withClue
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldNotContain
import io.ktor.client.HttpClient
import io.ktor.client.plugins.cookies.HttpCookies
import io.ktor.client.plugins.cookies.cookies
import io.ktor.client.request.cookie
import io.ktor.client.request.forms.formData
import io.ktor.client.request.forms.submitFormWithBinaryData
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.slf4j.LoggerFactory
import java.security.MessageDigest

/**
 * QUAL-022: forced failures answer the contract error body and nothing internal; the log at the
 * production levels (logback.xml) holds no password, session token or its digest, and no answers.
 */
class ErrorLeakTest {
    private val root = LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME) as Logger
    private val application = LoggerFactory.getLogger("com.example.sparqlqueryeasy") as Logger
    private val ktor = LoggerFactory.getLogger("io.ktor.server.Application") as Logger
    private val appender = ListAppender<ILoggingEvent>()
    private val previous = mutableMapOf<Logger, Level?>()

    @BeforeEach
    fun capture() {
        listOf(application, ktor).forEach {
            previous[it] = it.level
            it.level = Level.INFO
        }
        appender.start()
        root.addAppender(appender)
    }

    @AfterEach
    fun release() {
        root.detachAppender(appender)
        previous.forEach { (logger, level) -> logger.level = level }
    }

    /** Stack frames, Kotlin/Java class names, SQL, file paths and internal hosts. */
    private val internals =
        Regex(
            listOf(
                """com\.example""",
                """org\.apache""",
                """kotlinx\.""",
                """java\.""",
                """io\.ktor""",
                """Exception""",
                """\bat [\w.$]+\(""",
                """\.kt\b""",
                """/home/""",
                """/app/""",
                """jdbc:""",
                """postgres""",
                """SELECT .+ FROM""",
                """\bdb:5432""",
            ).joinToString("|"),
        )

    private suspend fun HttpResponse.shouldBeClean(status: HttpStatusCode) {
        val body = bodyAsText()
        withClue(body) {
            this.status shouldBe status
            body.startsWith("""{"error":"""") shouldBe true
            internals.find(body)?.value shouldBe null
        }
    }

    private suspend fun HttpClient.postJson(
        path: String,
        body: String,
    ) = post(path) {
        contentType(ContentType.Application.Json)
        setBody(body)
    }

    /** An executor failure that is not a SPARQL failure, with internal details in its message. */
    private object Exploding : EndpointExecution {
        override val isLocal = true
        override val isWikidata = false

        override suspend fun execute(query: String): SparqlSelectResult =
            error("jdbc:postgresql://db:5432/easyquery failed in /app/lib/Executor.kt")
    }

    private fun ApplicationTestBuilder.queryApp() {
        application {
            configureSerialization()
            configureErrorHandling()
            configureRouting(
                HttpDependencies(
                    LocalDatabaseUploadService(JenaTurtleParser(), InMemoryLocalGraphCache()),
                    recordingQueryDependencies(QueryRecorder()) { Exploding },
                ),
            )
        }
    }

    @Test
    fun `malformed bodies on strict routes answer one fixed message without the Kotlin class`() =
        testApplication {
            queryApp()
            listOf(
                "/api/query" to "{not-json",
                "/api/query" to """{"limit":"many"}""",
                "/api/query/count" to """{"unknown":1}""",
                "/api/query/stage" to """{"where":{"subject":1}}""",
            ).forEach { (path, body) ->
                val response = client.postJson(path, body)
                response.shouldBeClean(HttpStatusCode.BadRequest)
                response.bodyAsText() shouldBe """{"error":"$MALFORMED_BODY"}"""
            }
        }

    @Test
    fun `an unexpected executor failure is a fixed 500 and its message stays in the log`() =
        testApplication {
            queryApp()
            val response =
                client.postJson(
                    "/api/query",
                    """{"endpointUrl":"PokemonGen1","variableName":"?p",""" +
                        """"where":[{"subject":"?p","predicate":"<${PK}speed>","object":"?s"}]}""",
                )
            response.shouldBeClean(HttpStatusCode.InternalServerError)
            response.bodyAsText() shouldBe """{"error":"$INTERNAL_ERROR"}"""
            appender.list.any { "jdbc:postgresql://db:5432" in (it.throwableProxy?.message ?: "") } shouldBe true
        }

    @Test
    fun `invalid Turtle and an invalid generated query answer their diagnostic without internals`() =
        testApplication {
            queryApp()
            client
                .submitFormWithBinaryData(
                    "/api/local-database",
                    formData {
                        append(
                            "ttlFile",
                            "@prefix : <http://x/> . :a :b ".toByteArray(),
                            Headers.build {
                                append(HttpHeaders.ContentDisposition, "filename=\"bad.ttl\"")
                            },
                        )
                    },
                ).shouldBeClean(HttpStatusCode.BadRequest)
            client
                .postJson(
                    "/api/query",
                    """{"endpointUrl":"PokemonGen1","variableName":"?p","where":[{"subject":"?p","predicate":"<a b>","object":"?s"}]}""",
                )
                .shouldBeClean(HttpStatusCode.BadRequest)
        }

    @Test
    fun `lenient study bodies and a missing database answer without internals`() =
        testApplication {
            studyApp()
            val admin = userClient(ADMIN)
            listOf(
                """{"key":["x"]}""",
                """{"key":"k","reference":{"graph":{"formatVersion":"one"}}}""",
                taskBody().replace("\"maxResults\":1000", "\"maxResults\":\"many\""),
            ).forEach { admin.postJson("/api/admin/tasks", it).shouldBeClean(HttpStatusCode.BadRequest) }
            client.postJson("/api/auth/login", """{"username":["x"]}""").shouldBeClean(HttpStatusCode.BadRequest)
        }

    @Test
    fun `without a database the account and study routes answer 503 without internals`() =
        testApplication {
            studyApp(database = null)
            client.postJson(
                "/api/auth/register",
                """{"username":"ana","password":"correct horse"}""",
            ).shouldBeClean(HttpStatusCode.ServiceUnavailable)
            client.post("/api/study/finish") {
                contentType(ContentType.Application.Json)
                cookie(SESSION_COOKIE, "abc")
                setBody("{}")
            }.shouldBeClean(HttpStatusCode.ServiceUnavailable)
        }

    @Test
    fun `registering, logging in, answering a form and submitting log no secret and no answer`() =
        testApplication {
            studyApp()
            application { configureRequestLogging() }
            val password = "correct horse"
            val ada = createClient { install(HttpCookies) }
            ada.postJson("/api/auth/register", """{"username":"Ada","password":"$password"}""").status shouldBe HttpStatusCode.Created
            val wrong = ada.postJson("/api/auth/login", """{"username":"Ada","password":"wrong $password"}""")
            wrong.status shouldBe HttpStatusCode.Unauthorized
            ada.postJson("/api/auth/login", """{"username":"Ada","password":"$password"}""").status shouldBe HttpStatusCode.OK
            val token = ada.cookies("http://localhost").single { it.name == SESSION_COOKIE }.value
            // Consent and the profile questionnaire, through a second session of the same account.
            userClient("Ada")
            val admin = userClient(ADMIN)
            admin.json("/api/admin/tasks", taskBody()).status shouldBe HttpStatusCode.Created
            admin.createGroup("A", listOf("fire-fast"), listOf("Ada"))
            ada.postJson("/api/study/tasks/fire-fast/submissions", drawn()).status shouldBe HttpStatusCode.Created

            val log = appender.list.joinToString("\n") { it.formattedMessage + (it.throwableProxy?.message ?: "") }
            (log.isNotEmpty()) shouldBe true
            val digest = MessageDigest.getInstance("SHA-256").digest(token.toByteArray()).joinToString("") { "%02x".format(it) }
            listOf(password, token, digest, PROFILE_ANSWERS.substringAfter('{').substringBefore(':'), "FireType", "speed").forEach {
                log shouldNotContain it
            }
        }
}

package com.example.sparqlqueryeasy.http

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.string.shouldMatch
import io.kotest.matchers.string.shouldNotContain
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.application.Application
import io.ktor.server.request.receiveText
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.slf4j.LoggerFactory

class RequestLoggingTest {
    private val logger = LoggerFactory.getLogger(REQUEST_LOGGER) as Logger
    private val appender = ListAppender<ILoggingEvent>()
    private var previousLevel: Level? = null

    @BeforeEach
    fun capture() {
        previousLevel = logger.level
        logger.level = Level.INFO
        appender.start()
        logger.addAppender(appender)
    }

    @AfterEach
    fun release() {
        logger.detachAppender(appender)
        logger.level = previousLevel
    }

    private fun Application.loggedRoutes() {
        configureRequestLogging()
        routing {
            get("/health") { call.respond(HttpStatusCode.OK) }
            post("/api/auth/login") {
                call.receiveText()
                call.respond(HttpStatusCode.Unauthorized)
            }
            get("/api/query/upstream") { call.respond(HttpStatusCode.BadGateway) }
        }
    }

    @Test
    fun `a request is one line with status, method, path and duration and nothing secret`() =
        testApplication {
            application { loggedRoutes() }

            client.post("/api/auth/login?next=private-query-value") {
                contentType(ContentType.Application.Json)
                header(HttpHeaders.Cookie, "easyquery_session=secret-session-token")
                header(HttpHeaders.Authorization, "Bearer secret-bearer")
                setBody("""{"username":"ana","password":"secret-password"}""")
            }
            client.get("/api/query/upstream")

            val lines = appender.list.map { it.formattedMessage }
            lines shouldHaveSize 2
            lines[0] shouldMatch Regex("""401 POST /api/auth/login \d+ ms""")
            lines[1] shouldMatch Regex("""502 GET /api/query/upstream \d+ ms""")
            for (secret in listOf("secret-password", "secret-session-token", "secret-bearer", "private-query-value")) {
                lines.joinToString("\n") shouldNotContain secret
            }
        }

    @Test
    fun `the health check is not logged`() =
        testApplication {
            application { loggedRoutes() }

            client.get("/health")

            appender.list shouldHaveSize 0
        }
}

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.auth.AuthService
import com.example.sparqlqueryeasy.application.auth.MutableClock
import com.example.sparqlqueryeasy.application.auth.SessionToken
import com.example.sparqlqueryeasy.persistence.TestPostgres
import io.kotest.assertions.withClue
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.ktor.client.HttpClient
import io.ktor.client.request.cookie
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
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.Test
import java.time.Duration
import java.util.Base64

/**
 * QUAL-019, threat 2 of the Security Test Plan: nobody becomes admin except the account whose username is listed in
 * `EASYQUERY_ADMIN_USERNAMES` (here [ADMIN], "Grace"), and only with a live session of that account.
 *
 * The username rule these attacks rely on: the name is trimmed, must be 3–32 ASCII letters, digits, `.`, `_` or
 * `-`, and is compared lower-cased (`Locale.ROOT`). So another case or surrounding whitespace is the same account
 * (409), and a Unicode lookalike or an invisible character is not a valid username (400).
 */
class AdminEscalationTest {
    private val clock = MutableClock()

    private suspend fun ApplicationTestBuilder.adminToken(): String = login(ADMIN).sessionToken()

    private suspend fun ApplicationTestBuilder.login(name: String): HttpResponse =
        client.json("/api/auth/login", """{"username":"$name","password":"correct horse"}""")

    private suspend fun ApplicationTestBuilder.adminTasksWith(token: String): HttpResponse =
        client.get("/api/admin/tasks") { cookie(SESSION_COOKIE, token) }

    @Test
    fun `registering the admin's name in another case, with whitespace or with a lookalike never yields an admin`() =
        testApplication {
            studyApp(clock = clock)
            userClient(ADMIN, consent = false)
            val attempts =
                mapOf(
                    "grace" to HttpStatusCode.Conflict,
                    "GRACE" to HttpStatusCode.Conflict,
                    "gRaCe" to HttpStatusCode.Conflict,
                    " Grace" to HttpStatusCode.Conflict,
                    "Grace " to HttpStatusCode.Conflict,
                    "\\tGrace\\n" to HttpStatusCode.Conflict,
                    " Grace " to HttpStatusCode.Conflict,
                    // Cyrillic а, Greek ο-free lookalikes, fullwidth letters, zero-width and combining characters.
                    "Grаce" to HttpStatusCode.BadRequest,
                    "ɢrace" to HttpStatusCode.BadRequest,
                    "Ｇrace" to HttpStatusCode.BadRequest,
                    "Grace​" to HttpStatusCode.BadRequest,
                    "G‍race" to HttpStatusCode.BadRequest,
                    "Gracé" to HttpStatusCode.BadRequest,
                    "Gr ace" to HttpStatusCode.BadRequest,
                    "Grace\\u0000" to HttpStatusCode.BadRequest,
                )

            for ((name, status) in attempts) {
                val response = client.json("/api/auth/register", """{"username":"$name","password":"another horse"}""")
                withClue("register \"$name\": ${response.bodyAsText()}") {
                    response.status shouldBe status
                    response.headers[HttpHeaders.SetCookie] shouldBe null
                }
            }
            // The look-alike-free variants that are valid names are other accounts, and participants.
            for (name in listOf("Grace.", "Grace_", "-Grace", "Grace1", "Gracie")) {
                val response = client.json("/api/auth/register", """{"username":"$name","password":"another horse"}""")
                withClue(name) {
                    response.bodyAsText() shouldBe """{"data":{"username":"$name","role":"participant"}}"""
                }
                adminTasksWith(response.sessionToken()).bodyAsText() shouldBe ADMIN_REQUIRED
            }
            // The real admin still logs in with the original password: no attempt took the account over.
            login(ADMIN).bodyAsText() shouldBe """{"data":{"username":"Grace","role":"admin"}}"""
            client.json("/api/auth/login", """{"username":"GRACE","password":"another horse"}""").status shouldBe
                HttpStatusCode.Unauthorized
        }

    @Test
    fun `a role or admin field in the register or login body is never read`() =
        testApplication {
            studyApp(clock = clock)
            val smuggled = """"role":"admin","isAdmin":true,"admin":true,"roles":["admin"],"user":{"role":"admin"}"""

            val registered =
                client.json("/api/auth/register", """{"username":"Mallory","password":"correct horse",$smuggled}""")
            val loggedIn =
                client.json("/api/auth/login", """{"username":"Mallory","password":"correct horse",$smuggled}""")

            // Unknown fields fail the strict account body (400); with the plain body Mallory is a participant.
            registered.status shouldBe HttpStatusCode.BadRequest
            loggedIn.status shouldBe HttpStatusCode.BadRequest
            registered.headers[HttpHeaders.SetCookie] shouldBe null
            val plain = client.json("/api/auth/register", """{"username":"Mallory","password":"correct horse"}""")
            plain.bodyAsText() shouldBe """{"data":{"username":"Mallory","role":"participant"}}"""
            adminTasksWith(plain.sessionToken()).bodyAsText() shouldBe ADMIN_REQUIRED
            // A participant's own study write with an admin claim does not change the role either.
            val mallory = userClient("Mallory")
            mallory.json("/api/study/consent", """{"version":1,"role":"admin"}""")
            mallory.get("/api/auth/session").bodyAsText() shouldContain """"role":"participant""""
            mallory.get("/api/admin/tasks").bodyAsText() shouldBe ADMIN_REQUIRED
        }

    @Test
    fun `forged, truncated, padded, expired and other users' session cookies never reach the admin routes`() =
        testApplication {
            studyApp(clock = clock)
            userClient(ADMIN, consent = false)
            val participant = client.json("/api/auth/register", """{"username":"Ada","password":"correct horse"}""")
            val token = adminToken()
            val random = Base64.getUrlEncoder().withoutPadding().encodeToString(ByteArray(32) { it.toByte() })
            val forged =
                listOf(
                    random,
                    token.dropLast(1),
                    token.take(16),
                    token + "A",
                    token.reversed(),
                    token.uppercase(),
                    // The stored SHA-256 digest of the admin's token, as if the database leaked.
                    AuthService.digest(SessionToken(token)),
                    "A".repeat(64),
                    "A".repeat(65),
                    "../$token",
                    "",
                    participant.sessionToken(),
                )

            for (value in forged) {
                val response = client.get("/api/admin/tasks") { header(HttpHeaders.Cookie, "$SESSION_COOKIE=$value") }
                withClue("cookie \"$value\"") {
                    val denial = if (value == participant.sessionToken()) ADMIN_REQUIRED else LOGIN_REQUIRED
                    response.bodyAsText() shouldBe denial
                }
            }
            // A second cookie of the same name or another cookie name does not add a role either.
            client.get("/api/admin/tasks") {
                header(HttpHeaders.Cookie, "$SESSION_COOKIE=${participant.sessionToken()}; admin=true; role=admin")
            }.bodyAsText() shouldBe ADMIN_REQUIRED
            client.get("/api/admin/tasks") { header("X-Session", token) }.bodyAsText() shouldBe LOGIN_REQUIRED
            client.get("/api/admin/tasks") { header(HttpHeaders.Authorization, "Bearer $token") }.bodyAsText() shouldBe
                LOGIN_REQUIRED
            // The real token works until its seven days are over, then never again.
            adminTasksWith(token).status shouldBe HttpStatusCode.OK
            clock.advance(Duration.ofDays(7))
            adminTasksWith(token).bodyAsText() shouldBe LOGIN_REQUIRED
        }

    @Test
    fun `an admin cookie kept after logout or replaced by a new login no longer works`() =
        testApplication {
            studyApp(clock = clock)
            userClient(ADMIN, consent = false)
            val old = adminToken()
            val loggedOut = adminToken()

            client.json("/api/auth/logout").status shouldBe HttpStatusCode.Unauthorized
            val logout = client.postAs("/api/auth/logout", loggedOut)

            logout.status shouldBe HttpStatusCode.NoContent
            adminTasksWith(loggedOut).bodyAsText() shouldBe LOGIN_REQUIRED
            client.postAs("/api/admin/groups", loggedOut, """{"name":"after logout"}""").bodyAsText() shouldBe
                LOGIN_REQUIRED
            // Logging in with an old cookie rotates it: the old id stops working (no fixation).
            val rotated = client.postAs("/api/auth/login", old, """{"username":"Grace","password":"correct horse"}""")
            rotated.status shouldBe HttpStatusCode.OK
            adminTasksWith(old).bodyAsText() shouldBe LOGIN_REQUIRED
            adminTasksWith(rotated.sessionToken()).status shouldBe HttpStatusCode.OK
        }

    @Test
    fun `a demoted admin's old session loses the admin routes after a restart with a changed list`() {
        val database = TestPostgres.freshDatabase()
        lateinit var token: String
        testApplication {
            studyApp(database = database, clock = clock)
            userClient(ADMIN, consent = false)
            token = adminToken()
            adminTasksWith(token).status shouldBe HttpStatusCode.OK
        }
        testApplication {
            studyApp(database = database, clock = clock, admins = emptySet())
            val session = client.get("/api/auth/session") { cookie(SESSION_COOKIE, token) }
            session.bodyAsText() shouldBe """{"data":{"username":"Grace","role":"participant"}}"""
            adminTasksWith(token).bodyAsText() shouldBe ADMIN_REQUIRED
            client.postAs("/api/admin/groups", token, """{"name":"demoted"}""").bodyAsText() shouldBe ADMIN_REQUIRED
            // Nor does registering or logging in again bring the role back.
            login(ADMIN).bodyAsText() shouldNotContain """"role":"admin""""
        }
    }

    private suspend fun HttpClient.postAs(
        path: String,
        token: String,
        body: String = "{}",
    ): HttpResponse =
        post(path) {
            cookie(SESSION_COOKIE, token)
            contentType(ContentType.Application.Json)
            setBody(body)
        }
}

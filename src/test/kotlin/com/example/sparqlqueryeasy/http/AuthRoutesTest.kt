@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.auth.AttemptLimiter
import com.example.sparqlqueryeasy.application.auth.AuthService
import com.example.sparqlqueryeasy.application.auth.MutableClock
import com.example.sparqlqueryeasy.config.AppSettings
import com.example.sparqlqueryeasy.config.Argon2Settings
import com.example.sparqlqueryeasy.config.DatabaseSettings
import com.example.sparqlqueryeasy.persistence.DatabaseConnector
import com.example.sparqlqueryeasy.persistence.PostgresAccountStore
import com.example.sparqlqueryeasy.persistence.TestPostgres
import com.example.sparqlqueryeasy.security.Argon2PasswordHasher
import io.kotest.matchers.collections.shouldContainAll
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.ktor.client.HttpClient
import io.ktor.client.plugins.cookies.HttpCookies
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

/** AUTH-001: the Authentication Contract over HTTP, on embedded PostgreSQL. */
class AuthRoutesTest {
    private val clock = MutableClock()
    private val cheapArgon2 = Argon2Settings(memoryKib = 1_024, iterations = 1, parallelism = 1)

    private fun ApplicationTestBuilder.app(
        database: DatabaseSettings? = TestPostgres.freshDatabase(),
        attempts: Int = 100,
        secureCookies: Boolean = false,
        trustProxy: Boolean = false,
    ) {
        val connector = DatabaseConnector(database).also { it.connect() }
        val base = defaultHttpDependencies(AppSettings())
        val auth =
            AuthHttpDependencies(
                AuthService(PostgresAccountStore(connector), Argon2PasswordHasher(cheapArgon2), clock),
                AttemptLimiter(attempts, clock = clock),
                secureCookies,
                trustProxy,
            )
        application {
            configureSerialization()
            configureErrorHandling()
            configureRouting(base.copy(auth = auth, ownedResources = listOf(base, connector)))
        }
    }

    private fun ApplicationTestBuilder.browser(): HttpClient = createClient { install(HttpCookies) }

    private suspend fun HttpClient.json(
        path: String,
        body: String = "{}",
        origin: String? = null,
    ): HttpResponse =
        post(path) {
            contentType(ContentType.Application.Json)
            origin?.let { header(HttpHeaders.Origin, it) }
            setBody(body)
        }

    private suspend fun HttpClient.register(
        name: String = "Ada",
        password: String = "correct horse",
    ) = json("/api/auth/register", """{"username":"$name","password":"$password"}""")

    private suspend fun HttpClient.login(
        name: String = "Ada",
        password: String = "correct horse",
    ) = json("/api/auth/login", """{"username":"$name","password":"$password"}""")

    private fun HttpResponse.sessionCookie(): String = headers.getAll(HttpHeaders.SetCookie)!!.single { it.startsWith("$SESSION_COOKIE=") }

    private fun HttpResponse.tokenValue(): String = sessionCookie().substringAfter('=').substringBefore(';')

    @Test
    fun `registration creates the account and sets an HttpOnly SameSite=Lax session cookie for seven days`() =
        testApplication {
            app()
            val client = browser()

            val response = client.register()

            response.status shouldBe HttpStatusCode.Created
            response.bodyAsText() shouldBe """{"data":{"username":"Ada"}}"""
            val cookie = response.sessionCookie()
            cookie.split("; ").map { it.substringBefore('=') } shouldContainAll listOf("Max-Age", "Path", "HttpOnly", "SameSite")
            cookie shouldContain "Max-Age=604800"
            cookie shouldContain "SameSite=Lax"
            cookie shouldNotContain "Secure"
            client.get("/api/auth/session").bodyAsText() shouldBe """{"data":{"username":"Ada"}}"""
        }

    @Test
    fun `production cookies are Secure`() =
        testApplication {
            app(secureCookies = true)
            client.register().sessionCookie() shouldContain "Secure"
        }

    @Test
    fun `registration rejects a taken username regardless of case and invalid input`() =
        testApplication {
            app()
            client.register("Ada").status shouldBe HttpStatusCode.Created

            val taken = client.register("ADA", "another password")
            taken.status shouldBe HttpStatusCode.Conflict
            taken.bodyAsText() shouldBe """{"error":"This username is already taken"}"""
            val short = client.register("Bob", "short")
            short.status shouldBe HttpStatusCode.BadRequest
            short.bodyAsText() shouldBe """{"error":"Password must have 8 to 128 characters"}"""
            client.json("/api/auth/register", "{not json").status shouldBe HttpStatusCode.BadRequest
        }

    @Test
    fun `login succeeds with the password and fails identically for a wrong password or an unknown user`() =
        testApplication {
            app()
            client.register()

            val ok = client.login("ada")
            ok.status shouldBe HttpStatusCode.OK
            ok.bodyAsText() shouldBe """{"data":{"username":"Ada"}}"""
            val wrong = client.login("Ada", "wrong password")
            val unknown = client.login("Nobody", "wrong password")
            wrong.status shouldBe HttpStatusCode.Unauthorized
            unknown.status shouldBe HttpStatusCode.Unauthorized
            wrong.bodyAsText() shouldBe """{"error":"Invalid username or password"}"""
            unknown.bodyAsText() shouldBe wrong.bodyAsText()
            wrong.headers.getAll(HttpHeaders.SetCookie) shouldBe null
        }

    @Test
    fun `login rotates the session id and the presented session stops working (no fixation)`() =
        testApplication {
            app()
            val before = client.register().tokenValue()

            val response =
                client.post("/api/auth/login") {
                    contentType(ContentType.Application.Json)
                    cookie(SESSION_COOKIE, before)
                    setBody("""{"username":"Ada","password":"correct horse"}""")
                }
            val after = response.tokenValue()

            after shouldNotBe before
            client.get("/api/auth/session") { cookie(SESSION_COOKIE, before) }.status shouldBe HttpStatusCode.Unauthorized
            client.get("/api/auth/session") { cookie(SESSION_COOKIE, after) }.status shouldBe HttpStatusCode.OK
        }

    @Test
    fun `missing, tampered and expired sessions are rejected`() =
        testApplication {
            app()
            val token = client.register().tokenValue()
            val tampered = token.dropLast(1) + if (token.last() == 'A') "B" else "A"

            client.get("/api/auth/session").status shouldBe HttpStatusCode.Unauthorized
            client.get("/api/auth/session").bodyAsText() shouldBe """{"error":"Login required"}"""
            client.get("/api/auth/session") { cookie(SESSION_COOKIE, tampered) }.status shouldBe HttpStatusCode.Unauthorized
            client.get("/api/auth/session") { cookie(SESSION_COOKIE, "not a token!") }.status shouldBe
                HttpStatusCode.Unauthorized
            clock.advance(Duration.ofDays(7))
            client.get("/api/auth/session") { cookie(SESSION_COOKIE, token) }.status shouldBe HttpStatusCode.Unauthorized
        }

    @Test
    fun `logout requires a session, deletes it and clears the cookie`() =
        testApplication {
            app()
            val browser = browser()
            browser.json("/api/auth/logout").status shouldBe HttpStatusCode.Unauthorized
            val token = browser.register().tokenValue()

            val response = browser.json("/api/auth/logout")

            response.status shouldBe HttpStatusCode.NoContent
            response.sessionCookie() shouldContain "Max-Age=0"
            browser.get("/api/auth/session").status shouldBe HttpStatusCode.Unauthorized
            client.get("/api/auth/session") { cookie(SESSION_COOKIE, token) }.status shouldBe HttpStatusCode.Unauthorized
        }

    @Test
    fun `state-changing auth routes accept only same-origin JSON`() =
        testApplication {
            app()
            val crossSite = client.json("/api/auth/register", """{"username":"Ada","password":"correct horse"}""", "https://evil.example")
            crossSite.status shouldBe HttpStatusCode.Forbidden
            crossSite.bodyAsText() shouldBe """{"error":"Cross-origin request rejected"}"""
            client.json("/api/auth/login", "{}", "null").status shouldBe HttpStatusCode.Forbidden
            val form =
                client.post("/api/auth/login") {
                    contentType(ContentType.Application.FormUrlEncoded)
                    setBody("username=Ada&password=correct+horse")
                }
            form.status shouldBe HttpStatusCode.UnsupportedMediaType
            form.bodyAsText() shouldBe """{"error":"Content-Type must be application/json"}"""

            client.json("/api/auth/register", """{"username":"Ada","password":"correct horse"}""", "http://localhost").status shouldBe
                HttpStatusCode.Created
            val browser = browser()
            browser.login()
            browser.json("/api/auth/logout", origin = "https://evil.example").status shouldBe HttpStatusCode.Forbidden
            browser.get("/api/auth/session").status shouldBe HttpStatusCode.OK
        }

    @Test
    fun `login and registration attempts are limited per client address`() =
        testApplication {
            app(attempts = 3)
            List(3) { client.login("Nobody", "wrong password").status } shouldBe List(3) { HttpStatusCode.Unauthorized }

            val limited = client.register()
            limited.status shouldBe HttpStatusCode.TooManyRequests
            limited.bodyAsText() shouldBe """{"error":"Too many attempts; try again in a minute"}"""
            clock.advance(Duration.ofMinutes(1))
            client.register().status shouldBe HttpStatusCode.Created
        }

    @Test
    fun `behind the trusted proxy the limit follows X-Forwarded-For`() =
        testApplication {
            app(attempts = 1, trustProxy = true)

            suspend fun from(address: String) =
                client.post("/api/auth/login") {
                    contentType(ContentType.Application.Json)
                    header("X-Forwarded-For", "$address, 10.0.0.1")
                    setBody("""{"username":"Nobody","password":"wrong password"}""")
                }.status

            from("203.0.113.1") shouldBe HttpStatusCode.Unauthorized
            from("203.0.113.1") shouldBe HttpStatusCode.TooManyRequests
            from("203.0.113.2") shouldBe HttpStatusCode.Unauthorized
        }

    @Test
    fun `every path under api study requires a session`() =
        testApplication {
            app()
            val unauthenticated = client.get("/api/study/proposed-queries")
            unauthenticated.status shouldBe HttpStatusCode.Unauthorized
            unauthenticated.bodyAsText() shouldBe """{"error":"Login required"}"""
            client.post("/api/study/submissions").status shouldBe HttpStatusCode.Unauthorized

            val browser = browser()
            browser.register()
            browser.get("/api/study/proposed-queries").status shouldBe HttpStatusCode.NotFound
        }

    @Test
    fun `query and application routes stay public`() =
        testApplication {
            app()
            client.get("/health").status shouldBe HttpStatusCode.OK
            client.get("/api/endpoints").status shouldBe HttpStatusCode.OK
            client.get("/openapi.json").status shouldBe HttpStatusCode.OK
            client.json(
                "/api/query/count",
                """{"endpointUrl":"PokemonGen1","variableName":"?s","where":[{"subject":"?s","predicate":"?p","object":"?o"}]}""",
            ).status shouldBe HttpStatusCode.OK
        }

    @Test
    fun `without a database account routes answer 503 and the session check still answers 401 without a cookie`() =
        testApplication {
            app(database = null)
            val response = client.register()
            response.status shouldBe HttpStatusCode.ServiceUnavailable
            response.bodyAsText() shouldBe """{"error":"Accounts are temporarily unavailable"}"""
            client.get("/api/auth/session").status shouldBe HttpStatusCode.Unauthorized
            client.get("/api/auth/session") { cookie(SESSION_COOKIE, "abc") }.status shouldBe HttpStatusCode.ServiceUnavailable
            client.get("/health").status shouldBe HttpStatusCode.OK
        }
}

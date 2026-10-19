package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.auth.AttemptLimiter
import com.example.sparqlqueryeasy.application.auth.AuthService
import com.example.sparqlqueryeasy.application.auth.LoginResult
import com.example.sparqlqueryeasy.application.auth.RegistrationResult
import com.example.sparqlqueryeasy.application.auth.SessionToken
import com.example.sparqlqueryeasy.application.auth.User
import com.example.sparqlqueryeasy.application.persistence.PersistenceUnavailableException
import io.ktor.http.ContentType
import io.ktor.http.Cookie
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.Url
import io.ktor.server.request.contentType
import io.ktor.server.request.header
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.RoutingContext
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.util.date.GMTDate
import kotlinx.serialization.Serializable

@Serializable
data class AuthCredentialsHttpRequest(val username: String? = null, val password: String? = null)

@Serializable
data class SessionUserHttpResponse(val username: String, val role: String) {
    constructor(user: User) : this(user.username, user.role.wire)
}

/** Accounts and sessions over HTTP (AUTH-001, Authentication Contract). */
data class AuthHttpDependencies(
    val service: AuthService,
    val limiter: AttemptLimiter,
    val secureCookies: Boolean,
    val trustProxy: Boolean = false,
)

const val SESSION_COOKIE = "easyquery_session"
private const val MAX_TOKEN_LENGTH = 64
private val TOKEN = Regex("[A-Za-z0-9_-]+")

internal fun Route.authRoutes(auth: AuthHttpDependencies) {
    route("/api/auth") {
        post("register") {
            authRoute(auth, limited = true) {
                val request = call.receive<AuthCredentialsHttpRequest>()
                when (val result = auth.service.register(request.username, request.password, sessionToken())) {
                    is RegistrationResult.Registered -> {
                        setSessionCookie(auth, result.token)
                        call.respond(
                            HttpStatusCode.Created,
                            DataResponse(SessionUserHttpResponse(result.user)),
                        )
                    }
                    RegistrationResult.UsernameTaken ->
                        call.respond(HttpStatusCode.Conflict, ErrorResponse("This username is already taken"))
                    is RegistrationResult.Invalid ->
                        call.respond(HttpStatusCode.BadRequest, ErrorResponse(result.message))
                }
            }
        }.documentRegister()
        post("login") {
            authRoute(auth, limited = true) {
                val request = call.receive<AuthCredentialsHttpRequest>()
                when (val result = auth.service.login(request.username, request.password, sessionToken())) {
                    is LoginResult.LoggedIn -> {
                        setSessionCookie(auth, result.token)
                        call.respond(DataResponse(SessionUserHttpResponse(result.user)))
                    }
                    LoginResult.InvalidCredentials ->
                        call.respond(HttpStatusCode.Unauthorized, ErrorResponse("Invalid username or password"))
                    is LoginResult.Invalid -> call.respond(HttpStatusCode.BadRequest, ErrorResponse(result.message))
                }
            }
        }.documentLogin()
        post("logout") {
            authRoute(auth, limited = false) {
                withSession(auth) { _, token ->
                    auth.service.logout(token)
                    clearSessionCookie(auth)
                    call.respond(HttpStatusCode.NoContent)
                }
            }
        }.documentLogout()
        get("session") {
            accountsAvailable {
                withSession(auth) { user, _ -> call.respond(DataResponse(SessionUserHttpResponse(user))) }
            }
        }.documentSession()
    }
    // STUDY-001/002 add their routes here; every path below /api/study requires a session.
    route("/api/study/{...}") {
        handle {
            accountsAvailable {
                withSession(auth) { _, _ -> call.respond(HttpStatusCode.NotFound, ErrorResponse("Not found")) }
            }
        }
    }.also(::hideFromOpenApi)
}

/**
 * Runs [block] with the session's user, or answers 401. Protected routes (logout, everything under `/api/study`)
 * go through here.
 */
internal suspend fun RoutingContext.withSession(
    auth: AuthHttpDependencies,
    block: suspend RoutingContext.(User, SessionToken) -> Unit,
) {
    val token = sessionToken()
    val user = token?.let { auth.service.currentUser(it) }
    if (token == null || user == null) {
        call.respond(HttpStatusCode.Unauthorized, ErrorResponse("Login required"))
        return
    }
    block(user, token)
}

/** CSRF (same origin only, JSON only), the attempt limit, then [block]. */
private suspend fun RoutingContext.authRoute(
    auth: AuthHttpDependencies,
    limited: Boolean,
    block: suspend RoutingContext.() -> Unit,
) {
    when {
        !sameOrigin() -> call.respond(HttpStatusCode.Forbidden, ErrorResponse("Cross-origin request rejected"))
        !call.request.contentType().match(ContentType.Application.Json) ->
            call.respond(HttpStatusCode.UnsupportedMediaType, ErrorResponse("Content-Type must be application/json"))
        limited && !auth.limiter.tryAcquire(clientAddress(auth)) ->
            call.respond(HttpStatusCode.TooManyRequests, ErrorResponse("Too many attempts; try again in a minute"))
        else -> accountsAvailable(block)
    }
}

internal suspend fun RoutingContext.accountsAvailable(block: suspend RoutingContext.() -> Unit) {
    try {
        block()
    } catch (_: PersistenceUnavailableException) {
        call.respond(HttpStatusCode.ServiceUnavailable, ErrorResponse("Accounts are temporarily unavailable"))
    }
}

/** A browser always sends Origin on these POSTs; it must name this host. Clients without Origin are not browsers. */
private fun RoutingContext.sameOrigin(): Boolean {
    val origin = call.request.header(HttpHeaders.Origin) ?: return true
    val url = runCatching { Url(origin) }.getOrNull()?.takeIf { origin != "null" && it.host.isNotEmpty() }
    val host = call.request.header(HttpHeaders.Host) ?: call.request.local.serverHost
    val authority = url?.let { if (it.port == it.protocol.defaultPort) it.host else "${it.host}:${it.port}" }
    // TLS ends at the proxy, so Host may carry the other scheme's default port.
    return authority.equals(host.removeSuffix(":80").removeSuffix(":443"), ignoreCase = true)
}

private fun RoutingContext.clientAddress(auth: AuthHttpDependencies): String {
    val forwarded = call.request.header("X-Forwarded-For")?.substringBefore(',')?.trim()
    return if (auth.trustProxy && !forwarded.isNullOrEmpty()) forwarded else call.request.local.remoteAddress
}

private fun RoutingContext.sessionToken(): SessionToken? =
    call.request.cookies[SESSION_COOKIE]
        ?.takeIf { it.length <= MAX_TOKEN_LENGTH && TOKEN.matches(it) }
        ?.let(::SessionToken)

private fun RoutingContext.setSessionCookie(
    auth: AuthHttpDependencies,
    token: SessionToken,
) {
    call.response.cookies.append(
        Cookie(
            SESSION_COOKIE,
            token.value,
            maxAge = AuthService.SESSION_LIFETIME.seconds.toInt(),
            path = "/",
            secure = auth.secureCookies,
            httpOnly = true,
            extensions = mapOf("SameSite" to "Lax"),
        ),
    )
}

private fun RoutingContext.clearSessionCookie(auth: AuthHttpDependencies) {
    call.response.cookies.append(
        Cookie(
            SESSION_COOKIE,
            "",
            maxAge = 0,
            expires = GMTDate.START,
            path = "/",
            secure = auth.secureCookies,
            httpOnly = true,
            extensions = mapOf("SameSite" to "Lax"),
        ),
    )
}

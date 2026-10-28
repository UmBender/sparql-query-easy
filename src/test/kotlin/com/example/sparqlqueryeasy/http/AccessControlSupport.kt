package com.example.sparqlqueryeasy.http

import io.ktor.client.HttpClient
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.cookie
import io.ktor.client.request.forms.MultiPartFormDataContent
import io.ktor.client.request.forms.formData
import io.ktor.client.request.get
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.TextContent
import io.ktor.http.encodeURLQueryComponent
import io.ktor.server.testing.ApplicationTestBuilder
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** One operation of the live OpenAPI document (QUAL-019). */
internal data class ApiOperation(
    val method: HttpMethod,
    val template: String,
    val requiredQuery: List<String>,
    val bodyTypes: Set<String>,
) {
    val id: String get() = "${method.value} $template"

    val isWrite: Boolean get() = method != HttpMethod.Get

    /** The path with every `{name}` (and each required query parameter) taken from [values], else a probe value. */
    fun path(values: Map<String, String>): String {
        val path = PARAMETER.replace(template) { values[it.groupValues[1]] ?: PROBE }
        val query = requiredQuery.joinToString("&") { "$it=${(values[it] ?: PROBE).encodeURLQueryComponent()}" }
        return if (query.isEmpty()) path else "$path?$query"
    }

    private companion object {
        val PARAMETER = Regex("\\{([^}]+)}")
        const val PROBE = "matrix-probe"
    }
}

private val OPERATION_METHODS = listOf("get", "put", "post", "delete", "patch", "head", "options")

/** Every operation of `/openapi.json` as this application serves it, so new routes are included automatically. */
internal suspend fun HttpClient.openApiOperations(): List<ApiOperation> {
    val response = get("/openapi.json")
    check(response.status == HttpStatusCode.OK) { "GET /openapi.json answered ${response.status}" }
    val paths = Json.parseToJsonElement(response.bodyAsText()).jsonObject.getValue("paths").jsonObject
    return paths.flatMap { (template, item) ->
        item.jsonObject.filterKeys { it in OPERATION_METHODS }.map { (method, element) ->
            val operation = element.jsonObject
            val required =
                (operation["parameters"] as? JsonArray).orEmpty()
                    .map { it.jsonObject }
                    .filter { it.string("in") == "query" && it["required"]?.jsonPrimitive?.content == "true" }
                    .map { it.string("name") }
            val bodyTypes =
                (operation["requestBody"] as? JsonObject)?.get("content")?.jsonObject?.keys.orEmpty()
            ApiOperation(HttpMethod.parse(method.uppercase()), template, required, bodyTypes)
        }
    }
}

private fun JsonObject.string(name: String): String = getValue(name).jsonPrimitive.content

/**
 * A body for any write operation: every field a study, admin or account route reads, with values that would be
 * accepted, so a guard that lets a request through is visible. Query routes read only `endpointUrl` here, a
 * built-in graph, so nothing leaves the process.
 */
internal const val PROBE_BODY =
    """{"endpointUrl":"PokemonGen1","username":"Mallory","password":"correct horse","name":"probe-group",""" +
        """"tasks":[],"version":1,"answers":{},"search":"","variableName":"?s","where":[]}"""

/**
 * Sends [operation] the way a client of its documented content type would, or with [PROBE_BODY] declared as
 * [bodyType]; [configure] adds headers or a cookie.
 */
internal suspend fun HttpClient.send(
    operation: ApiOperation,
    values: Map<String, String>,
    bodyType: ContentType? = null,
    configure: HttpRequestBuilder.() -> Unit = {},
): HttpResponse =
    request(operation.path(values)) {
        method = operation.method
        if (operation.isWrite) {
            val multipart = ContentType.MultiPart.FormData.toString() in operation.bodyTypes
            if (multipart && bodyType == null) {
                setBody(MultiPartFormDataContent(formData { append("note", "no file") }))
            } else {
                setBody(TextContent(PROBE_BODY, bodyType ?: ContentType.Application.Json))
            }
        }
        configure()
    }

/**
 * A caller of the matrix: anonymous ([username] null) or a user whose session cookie is sent explicitly, so the
 * test can also present stolen, forged or old cookies. A lost session (an operation like logout ended it) is
 * restored by logging in again before the next request.
 */
internal class Caller(
    private val http: HttpClient,
    val username: String?,
) {
    var token: String? = null
        private set

    val label: String get() = username ?: "anonymous"

    suspend fun login(): Caller {
        val name = checkNotNull(username)
        val response = http.json("/api/auth/login", """{"username":"$name","password":"correct horse"}""")
        check(response.status == HttpStatusCode.OK) { "login $name: ${response.status} ${response.bodyAsText()}" }
        token = response.sessionToken()
        return this
    }

    suspend fun send(
        operation: ApiOperation,
        values: Map<String, String>,
        bodyType: ContentType? = null,
        configure: HttpRequestBuilder.() -> Unit = {},
    ): HttpResponse {
        restoreSession()
        return http.send(operation, values, bodyType) {
            token?.let { cookie(SESSION_COOKIE, it) }
            configure()
        }
    }

    suspend fun get(path: String): HttpResponse {
        restoreSession()
        return http.get(path) { token?.let { cookie(SESSION_COOKIE, it) } }
    }

    private suspend fun restoreSession() {
        val current = token ?: return
        if (http.get("/api/auth/session") { cookie(SESSION_COOKIE, current) }.status == HttpStatusCode.Unauthorized) {
            login()
        }
    }
}

/** The value of the `easyquery_session` cookie a login or registration set. */
internal fun HttpResponse.sessionToken(): String =
    headers.getAll(HttpHeaders.SetCookie).orEmpty()
        .single { it.startsWith("$SESSION_COOKIE=") }
        .substringAfter('=')
        .substringBefore(';')

/** The study answers 401 like this without a session, and 403 like this for a participant on an admin route. */
internal const val LOGIN_REQUIRED = """{"error":"Login required"}"""
internal const val ADMIN_REQUIRED = """{"error":"Admin role required"}"""

/** Whether [response] is the session or role guard refusing the caller (not a business answer such as 404). */
internal suspend fun HttpResponse.isAccessDenial(): Boolean =
    (status == HttpStatusCode.Unauthorized && bodyAsText() == LOGIN_REQUIRED) ||
        (status == HttpStatusCode.Forbidden && bodyAsText() == ADMIN_REQUIRED)

/**
 * QUAL-019 study: admin Grace; tasks `a-task` (all Fire) in group A with Ada and Cyd, `b-task` (all Water) in group
 * B with Bob; Bob and Cyd have each made a correct attempt. Ada, Bob and Cyd accepted the consent and answered the
 * profile. Dee accepted the consent only; Eve did neither.
 */
internal class AccessFixture(
    val context: StudyTestContext,
    val anonymous: Caller,
    val admin: Caller,
    val ada: Caller,
    val bob: Caller,
    val groupA: Long,
    val groupB: Long,
) {
    /** Path parameter values: B's resources, so an allowed call by A is an attempt on another participant's data. */
    val values: Map<String, String>
        get() = mapOf("key" to B_TASK, "task" to B_TASK, "id" to groupB.toString(), "slug" to "profile")

    val callers: List<Caller> get() = listOf(anonymous, ada, bob, admin)

    companion object {
        const val A_TASK = "a-task"
        const val B_TASK = "b-task"

        /** Answers of [A_TASK] and [B_TASK]: they must never reach a participant. */
        val FIRE_ANSWER = "${PK}Charmander"
        val WATER_ANSWER = "${PK}Squirtle"
    }
}

internal suspend fun ApplicationTestBuilder.accessFixture(): AccessFixture {
    val context = studyApp()
    val grace = userClient(ADMIN, consent = false)
    grace.createTypeTask(AccessFixture.A_TASK, "FireType")
    grace.createTypeTask(AccessFixture.B_TASK, "WaterType")
    val ada = userClient("Ada")
    val bob = userClient("Bob")
    val cyd = userClient("Cyd")
    userClient("Dee", consent = true, profile = false)
    userClient("Eve", consent = false)
    val groupA = grace.createGroup("Group A", listOf(AccessFixture.A_TASK), listOf("Ada", "Cyd"))
    val groupB = grace.createGroup("Group B", listOf(AccessFixture.B_TASK), listOf("Bob"))
    check(bob.json("/api/study/tasks/b-task/submissions", drawn(typeQuery("WaterType"))).status.value == 201)
    check(cyd.json("/api/study/tasks/a-task/submissions", drawn(typeQuery("FireType"))).status.value == 201)
    check(ada.get("/api/study/tasks").status == HttpStatusCode.OK)
    val plain = client
    return AccessFixture(
        context = context,
        anonymous = Caller(plain, null),
        admin = Caller(plain, ADMIN).login(),
        ada = Caller(plain, "Ada").login(),
        bob = Caller(plain, "Bob").login(),
        groupA = groupA,
        groupB = groupB,
    )
}

/** Every object key in [element], at any depth. */
internal fun JsonElement.allKeys(): Set<String> =
    when (this) {
        is JsonObject -> keys + values.flatMap { it.allKeys() }
        is JsonArray -> flatMap { it.allKeys() }.toSet()
        else -> emptySet()
    }

internal fun String.jsonOrNull(): JsonElement? = runCatching { Json.parseToJsonElement(this) }.getOrNull()

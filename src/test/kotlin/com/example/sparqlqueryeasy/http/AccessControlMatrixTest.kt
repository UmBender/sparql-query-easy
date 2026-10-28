package com.example.sparqlqueryeasy.http

import io.kotest.assertions.withClue
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import io.ktor.client.request.header
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.contentType
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.Test

/**
 * QUAL-019, threats 1 and 4 of the Security Test Plan: every operation of the live OpenAPI document, called by
 * anonymous, participant Ada (group A), participant Bob (group B) and the admin, answers as [ACCESS_RULES] says,
 * and every state-changing account, study and admin route refuses cross-site and non-JSON requests.
 */
class AccessControlMatrixTest {
    @Test
    fun `every OpenAPI operation is classified and the table names no operation the document lacks`() =
        testApplication {
            studyApp()
            val documented = client.openApiOperations().map { it.id }.toSet()

            withClue("Operations without an access rule: add them to ACCESS_RULES (AccessControlRules.kt)") {
                (documented - ACCESS_RULES.keys).shouldBeEmpty()
            }
            withClue("Rules for operations the document no longer has") {
                (ACCESS_RULES.keys - documented).shouldBeEmpty()
            }
            val misplaced =
                ACCESS_RULES.filter { (id, access) ->
                    val path = id.substringAfter(' ')
                    (path.startsWith("/api/admin/") && access != Access.ADMIN) ||
                        (path.startsWith("/api/study/") && access == Access.PUBLIC)
                }
            withClue("An /api/admin operation must be ADMIN and an /api/study one needs a session") {
                misplaced.keys.shouldBeEmpty()
            }
        }

    @Test
    fun `anonymous, both participants and the admin get exactly the access the table declares`() =
        testApplication {
            val fixture = accessFixture()
            val operations = client.openApiOperations()
            val wrong = mutableListOf<String>()

            for (operation in operations) {
                val access = ACCESS_RULES[operation.id]
                if (access == null) {
                    wrong += "${operation.id}: no access rule (fail closed)"
                    continue
                }
                for (caller in fixture.callers) {
                    val response = caller.send(operation, fixture.values)
                    val body = response.bodyAsText()
                    val expected = expectedDenial(access, caller, fixture)
                    val actual =
                        when {
                            response.isAccessDenial() -> body
                            response.status.value >= SERVER_ERROR -> "server error ${response.status}: $body"
                            else -> ALLOWED
                        }
                    if (actual != expected) {
                        wrong += "${operation.id} as ${caller.label}: expected $expected, got $actual"
                    }
                }
            }

            withClue(wrong.joinToString("\n")) { wrong.size shouldBe 0 }
        }

    @Test
    fun `routing tricks around the admin prefix never reach admin data`() =
        testApplication {
            val fixture = accessFixture()
            val variants =
                listOf(
                    "/api/admin/tasks/",
                    "/api/admin//tasks",
                    "/api//admin/tasks",
                    "/api/study/../admin/tasks",
                    "/api/study/%2e%2e/admin/tasks",
                    "/api/%61dmin/tasks",
                    "/API/ADMIN/TASKS",
                    "/api/Admin/tasks",
                    "/api/admin/tasks;role=admin",
                    "/api/admin/tasks?role=admin",
                    "/api/admin/tasks%00",
                    "/api/admin/participants.json",
                )
            val leaks = mutableListOf<String>()

            for (caller in listOf(fixture.anonymous, fixture.ada)) {
                for (path in variants) {
                    for (method in listOf(HttpMethod.Get, HttpMethod.Head, HttpMethod.Options, HttpMethod.Post)) {
                        val response =
                            client.request(path) {
                                this.method = method
                                caller.token?.let { header(HttpHeaders.Cookie, "$SESSION_COOKIE=$it") }
                                if (method == HttpMethod.Post) {
                                    contentType(ContentType.Application.Json)
                                    setBody(taskBody(key = "smuggled"))
                                }
                            }
                        val body = response.bodyAsText()
                        if (response.status.value in OK_RANGE || "a-task" in body || "Ada" in body) {
                            leaks += "${method.value} $path as ${caller.label}: ${response.status} $body"
                        }
                    }
                }
            }

            leaks.shouldBeEmpty()
            fixture.admin.get("/api/admin/tasks/smuggled").status.value shouldBe NOT_FOUND
        }

    @Test
    fun `every state-changing auth, study and admin operation refuses a foreign Origin and a non-JSON body`() =
        testApplication {
            val fixture = accessFixture()
            val before = snapshot(fixture)
            val writes =
                client.openApiOperations().filter { operation ->
                    operation.isWrite && CSRF_PREFIXES.any { operation.template.startsWith(it) }
                }
            val accepted = mutableListOf<String>()

            for (operation in writes) {
                // The caller the route would otherwise serve: the admin, a participant, or anyone. An unclassified
                // operation is checked with the admin, the most powerful session (and fails the first test).
                val caller =
                    when (ACCESS_RULES[operation.id]) {
                        Access.ADMIN, null -> fixture.admin
                        Access.LOGIN, Access.PARTICIPANT_OWN -> fixture.ada
                        Access.PUBLIC -> fixture.anonymous
                    }
                for (origin in FOREIGN_ORIGINS) {
                    val response = caller.send(operation, fixture.values) { header(HttpHeaders.Origin, origin) }
                    if (response.status.value != FORBIDDEN || response.bodyAsText() != CROSS_ORIGIN) {
                        accepted += "${operation.id} from $origin: ${response.status} ${response.bodyAsText()}"
                    }
                }
                for (type in NON_JSON_TYPES) {
                    val response =
                        caller.send(operation, fixture.values, type) { header(HttpHeaders.Origin, "http://localhost") }
                    if (response.status.value != UNSUPPORTED || response.bodyAsText() != JSON_ONLY) {
                        accepted += "${operation.id} as $type: ${response.status} ${response.bodyAsText()}"
                    }
                }
            }

            withClue("Write operations under ${CSRF_PREFIXES.joinToString()} found") { writes.isEmpty() shouldBe false }
            withClue(accepted.joinToString("\n")) { accepted.size shouldBe 0 }
            snapshot(fixture) shouldBe before
        }

    /** What the guard must answer [caller] for an operation with [access]: a denial body, or [ALLOWED]. */
    private fun expectedDenial(
        access: Access,
        caller: Caller,
        fixture: AccessFixture,
    ): String =
        when {
            access == Access.PUBLIC -> ALLOWED
            caller === fixture.anonymous -> LOGIN_REQUIRED
            access == Access.ADMIN && caller !== fixture.admin -> ADMIN_REQUIRED
            else -> ALLOWED
        }

    /** What a cross-site or non-JSON write could change: tasks, groups, accounts, Ada's study state and answers. */
    private suspend fun snapshot(fixture: AccessFixture): List<String> =
        listOf(
            "/api/admin/tasks",
            "/api/admin/groups",
            "/api/admin/participants",
            "/api/admin/forms/profile/responses.csv",
        ).map { fixture.admin.get(it).bodyAsText() } +
            listOf(
                "/api/auth/session",
                "/api/study/consent",
                "/api/study/forms",
                "/api/study/tasks",
                "/api/study/submissions?task=a-task",
            ).map { fixture.ada.get(it).bodyAsText() } +
            fixture.anonymous.get("/api/auth/session").bodyAsText()

    private companion object {
        const val ALLOWED = "allowed"
        const val SERVER_ERROR = 500
        const val FORBIDDEN = 403
        const val UNSUPPORTED = 415
        const val NOT_FOUND = 404
        val OK_RANGE = 200..299
        const val CROSS_ORIGIN = """{"error":"Cross-origin request rejected"}"""
        const val JSON_ONLY = """{"error":"Content-Type must be application/json"}"""
        val CSRF_PREFIXES = listOf("/api/auth/", "/api/study/", "/api/admin/")
        val FOREIGN_ORIGINS =
            listOf(
                "https://evil.example",
                "null",
                "http://localhost.evil.example",
                "http://evil.example/localhost",
                "http://localhost:8081",
                "file://",
            )

        /** The three types a cross-site form or `fetch` may send without a preflight, and a JSON lookalike. */
        val NON_JSON_TYPES =
            listOf(
                ContentType.Text.Plain,
                ContentType.Application.FormUrlEncoded,
                ContentType.MultiPart.FormData,
                ContentType.parse("application/jsonp"),
            )
    }
}

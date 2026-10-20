@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.auth.AttemptLimiter
import com.example.sparqlqueryeasy.application.auth.AuthService
import com.example.sparqlqueryeasy.application.auth.MutableClock
import com.example.sparqlqueryeasy.application.study.StudyQueryRunner
import com.example.sparqlqueryeasy.config.AppSettings
import com.example.sparqlqueryeasy.config.Argon2Settings
import com.example.sparqlqueryeasy.config.DatabaseSettings
import com.example.sparqlqueryeasy.persistence.DatabaseConnector
import com.example.sparqlqueryeasy.persistence.PostgresAccountStore
import com.example.sparqlqueryeasy.persistence.PostgresStudyProgressStore
import com.example.sparqlqueryeasy.persistence.TestPostgres
import com.example.sparqlqueryeasy.security.Argon2PasswordHasher
import io.ktor.client.HttpClient
import io.ktor.client.plugins.cookies.HttpCookies
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import java.io.File

internal const val PK = "http://easyquery.example.org/pokemon#"
internal const val ADMIN = "Grace"

/** The study API (STUDY-003…007) on a fresh Testcontainers database and the built-in graphs; no external services. */
internal fun ApplicationTestBuilder.studyApp(
    database: DatabaseSettings? = TestPostgres.freshDatabase(),
    clock: MutableClock = MutableClock(),
    connector: DatabaseConnector = DatabaseConnector(database).also { it.connect() },
): StudyTestContext {
    val base = defaultHttpDependencies(AppSettings())
    val query = checkNotNull(base.query)
    val auth =
        AuthHttpDependencies(
            AuthService(
                PostgresAccountStore(connector),
                Argon2PasswordHasher(Argon2Settings(memoryKib = 1_024, iterations = 1, parallelism = 1)),
                clock,
                adminUsernames = setOf(ADMIN),
            ),
            AttemptLimiter(1_000, clock = clock),
            secureCookies = false,
        )
    val runner = StudyQueryRunner(query.generalQueryService, query.endpointContextResolver)
    val study = studyHttpDependencies(connector, runner, clock)
    application {
        configureSerialization()
        configureErrorHandling()
        configureRouting(base.copy(auth = auth, study = study, ownedResources = listOf(base, connector)))
    }
    return StudyTestContext(study, PostgresAccountStore(connector), PostgresStudyProgressStore(connector))
}

/** The services behind [studyApp], for checks below the HTTP layer. */
internal class StudyTestContext(
    val study: StudyHttpDependencies,
    private val accounts: PostgresAccountStore,
    val progress: PostgresStudyProgressStore,
) {
    suspend fun userId(username: String): Long = checkNotNull(accounts.findCredentials(username.lowercase())).user.id

    /** The application query STUDY-003 serves: the keys of [username]'s group's active tasks, in order. */
    suspend fun taskKeysFor(username: String): List<String> = study.groups.activeTasksFor(userId(username)).map { it.key }
}

/**
 * A client with [name]'s session: registered, or logged in when the account exists. With [consent] it also
 * accepts the current consent text (STUDY-008) and with [profile] answers the profile questionnaire
 * (STUDY-010), as every participant must before the task routes open.
 */
internal suspend fun ApplicationTestBuilder.userClient(
    name: String,
    consent: Boolean = true,
    profile: Boolean = consent,
): HttpClient =
    createClient { install(HttpCookies) }.also {
        val credentials = """{"username":"$name","password":"correct horse"}"""
        if (it.json("/api/auth/register", credentials).status.value == 409) it.json("/api/auth/login", credentials)
        if (consent) it.acceptConsent()
        if (profile) it.answerProfile()
    }

/** Valid answers to the shipped placeholder profile questionnaire (v1). */
internal const val PROFILE_ANSWERS =
    """{"sparql_familiarity":"heard_of","query_languages":["sql","sparql"],"programming_years":4,""" +
        """"data_comfort":4,"role":""}"""

/** Answers the profile questionnaire; an already answered one answers 409, which is fine here. */
internal suspend fun HttpClient.answerProfile(answers: String = PROFILE_ANSWERS): HttpResponse =
    json("/api/study/forms/profile/responses", """{"version":1,"answers":$answers}""")

/** Accepts the current consent text: the version GET /api/study/consent names. */
internal suspend fun HttpClient.acceptConsent(): HttpResponse {
    val current = get("/api/study/consent")
    if (current.status.value != 200) return current
    val version = current.data().field("version")
    return json("/api/study/consent", """{"version":$version}""")
}

internal suspend fun HttpClient.json(
    path: String,
    body: String = "{}",
): HttpResponse =
    post(path) {
        contentType(ContentType.Application.Json)
        setBody(body)
    }

internal suspend fun HttpClient.putJson(
    path: String,
    body: String,
): HttpResponse =
    put(path) {
        contentType(ContentType.Application.Json)
        setBody(body)
    }

internal suspend fun HttpResponse.data(): JsonElement {
    return Json.parseToJsonElement(bodyAsText()).jsonObject.getValue("data")
}

/** The saved Fire-type speed ≥ 90 query the frontend tests also use (FE-042 format). */
internal val fireSpeedGraph: String =
    File("frontend/src/lib/domain/fixtures/fire-speed-at-least-90.query.json").readText()

/** What the frontend's Run Query mapping derives from [fireSpeedGraph] (fixtures/legacy/fire-speed-at-least-90). */
internal fun fireSpeedQuery(minimumSpeed: Int? = 90): String {
    val filters =
        minimumSpeed?.let { """[{"variableName":"?speed","filterType":2,"value":"$it"}]""" } ?: "[]"
    return """{"variableName":"?pokemon","where":[""" +
        """{"subject":"?pokemon","predicate":"<${PK}hasType>","object":"<${PK}FireType>","filterType":null},""" +
        """{"subject":"?pokemon","predicate":"<${PK}speed>","object":"?speed","filterType":null}],""" +
        """"variableFilters":$filters}"""
}

/** A drawn query: [graph] and the request derived from it. */
internal fun drawn(
    query: String = fireSpeedQuery(),
    graph: String = fireSpeedGraph,
): String = """{"graph":$graph,"query":$query}"""

/** All Pokémon of one type, as the frontend derives it from a two-node graph. */
internal fun typeQuery(type: String): String =
    """{"variableName":"?pokemon","where":[{"subject":"?pokemon","predicate":"<${PK}hasType>",""" +
        """"object":"<$PK$type>","filterType":null}],"variableFilters":[]}"""

internal fun taskBody(
    key: String = "fire-fast",
    title: String = "Fast Fire Pokémon",
    statement: String = "Find the Fire-type Pokémon with speed of at least 90.",
    reference: String = drawn(),
    comparison: String = "set",
    maxResults: Int = 1000,
    extra: String = "",
): String =
    """{"key":"$key","title":"$title","statement":"$statement","endpoint":"PokemonGen1",""" +
        """"reference":$reference,"comparison":"$comparison","maxResults":$maxResults$extra}"""

internal fun JsonElement.field(name: String): JsonElement = (this as JsonObject).getValue(name)

/** Creates an all-Pokémon-of-[type] task through the admin route and returns its key. */
internal suspend fun HttpClient.createTypeTask(
    key: String,
    type: String,
): String {
    val response = json("/api/admin/tasks", taskBody(key = key, title = "All $type", reference = drawn(typeQuery(type))))
    check(response.status.value == 201) { "creating $key: ${response.bodyAsText()}" }
    return key
}

/** Creates a group with [tasks] in order and [members]; returns its id. */
internal suspend fun HttpClient.createGroup(
    name: String,
    tasks: List<String> = emptyList(),
    members: List<String> = emptyList(),
): Long {
    val id = json("/api/admin/groups", """{"name":"$name"}""").data().field("id").toString().toLong()
    putJson("/api/admin/groups/$id/tasks", """{"tasks":[${tasks.joinToString { "\"$it\"" }}]}""")
    members.forEach { json("/api/admin/groups/$id/members", """{"username":"$it"}""") }
    return id
}

/** The shipped questionnaires with [profile] in place of the profile questionnaire. */
internal fun com.example.sparqlqueryeasy.application.study.StudyResources.withProfile(
    profile: com.example.sparqlqueryeasy.application.study.FormDefinition,
) = copy(forms = forms.map { if (it.slug == profile.slug) profile else it })

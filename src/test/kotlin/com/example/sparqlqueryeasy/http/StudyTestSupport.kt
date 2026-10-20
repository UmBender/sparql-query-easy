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
import com.example.sparqlqueryeasy.persistence.TestPostgres
import com.example.sparqlqueryeasy.security.Argon2PasswordHasher
import io.ktor.client.HttpClient
import io.ktor.client.plugins.cookies.HttpCookies
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
) {
    val connector = DatabaseConnector(database).also { it.connect() }
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
    val study = studyHttpDependencies(connector, runner)
    application {
        configureSerialization()
        configureErrorHandling()
        configureRouting(base.copy(auth = auth, study = study, ownedResources = listOf(base, connector)))
    }
}

internal suspend fun ApplicationTestBuilder.userClient(name: String): HttpClient =
    createClient { install(HttpCookies) }.also {
        it.json("/api/auth/register", """{"username":"$name","password":"correct horse"}""")
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

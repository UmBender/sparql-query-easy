@file:Suppress("MaxLineLength", "ReturnCount")

package com.example.sparqlqueryeasy.security

import com.example.sparqlqueryeasy.application.endpoints.BuiltInGraphProvider
import com.example.sparqlqueryeasy.application.endpoints.ClasspathTurtleTextSource
import com.example.sparqlqueryeasy.application.endpoints.EndpointContextResolver
import com.example.sparqlqueryeasy.application.endpoints.EndpointExecutionResolverAdapter
import com.example.sparqlqueryeasy.application.endpoints.POKEMON_ENDPOINT_ID
import com.example.sparqlqueryeasy.application.endpoints.POKEMON_RESOURCE_NAME
import com.example.sparqlqueryeasy.application.endpoints.ParsedBuiltInGraphProvider
import com.example.sparqlqueryeasy.application.localdatabase.InMemoryLocalGraphCache
import com.example.sparqlqueryeasy.application.localdatabase.LocalDatabaseUploadService
import com.example.sparqlqueryeasy.application.query.GeneralQueryService
import com.example.sparqlqueryeasy.application.query.NumericProfileService
import com.example.sparqlqueryeasy.application.query.ResultCountService
import com.example.sparqlqueryeasy.application.query.ResultFilteringService
import com.example.sparqlqueryeasy.application.query.StageQueryService
import com.example.sparqlqueryeasy.application.querygeneration.SparqlQueryGenerationService
import com.example.sparqlqueryeasy.application.relationships.ElementRelationshipsService
import com.example.sparqlqueryeasy.application.relationships.EndpointExecution
import com.example.sparqlqueryeasy.application.relationships.RelationshipValueService
import com.example.sparqlqueryeasy.application.search.SearchService
import com.example.sparqlqueryeasy.application.search.WikidataEntitySearchClient
import com.example.sparqlqueryeasy.application.search.WikidataEntitySearchRecord
import com.example.sparqlqueryeasy.application.search.WikidataEntitySearchRequest
import com.example.sparqlqueryeasy.domain.model.RdfGraph
import com.example.sparqlqueryeasy.domain.model.SparqlSelectResult
import com.example.sparqlqueryeasy.domain.model.SparqlVariable
import com.example.sparqlqueryeasy.http.HttpDependencies
import com.example.sparqlqueryeasy.http.QueryHttpDependencies
import com.example.sparqlqueryeasy.rdf.jena.JenaGraphEndpointExecution
import com.example.sparqlqueryeasy.rdf.jena.JenaSparqlSyntaxValidator
import com.example.sparqlqueryeasy.rdf.jena.JenaTurtleParser
import com.example.sparqlqueryeasy.wikidata.query.CSharpCompatibleWikidataQueryGenerator
import io.ktor.client.HttpClient
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.apache.jena.query.QueryFactory
import java.util.concurrent.CopyOnWriteArrayList

internal const val PK = "http://easyquery.example.org/pokemon#"
internal const val WIKIDATA = "https://query.wikidata.org/sparql"

/** Every query text an endpoint was asked to execute, in order. */
internal class QueryRecorder {
    private val queries = CopyOnWriteArrayList<String>()

    fun record(query: String) {
        queries += query
    }

    /** The queries recorded since the last call. */
    fun take(): List<String> = queries.toList().also { queries.clear() }
}

/** Records the query, then runs it on the real Jena graph execution. */
private class RecordingLocalExecution(
    private val delegate: EndpointExecution,
    private val recorder: QueryRecorder,
) : EndpointExecution by delegate {
    override suspend fun execute(query: String): SparqlSelectResult {
        recorder.record(query)
        return delegate.execute(query)
    }
}

/** A remote endpoint that never leaves the process: it records the query and answers no rows. */
internal class RecordingRemoteExecution(
    override val isWikidata: Boolean,
    private val recorder: QueryRecorder,
) : EndpointExecution {
    override val isLocal: Boolean = false

    override suspend fun execute(query: String): SparqlSelectResult {
        recorder.record(query)
        return SparqlSelectResult(QueryFactory.create(query).projectVars.map { SparqlVariable(it.varName) }, emptyList())
    }
}

/** Wikidata entity search is not SPARQL; it answers nothing here. */
internal object NoEntitySearch : WikidataEntitySearchClient {
    override suspend fun search(request: WikidataEntitySearchRequest): List<WikidataEntitySearchRecord> = emptyList()
}

private val parser = JenaTurtleParser()
private val brasileirao: BuiltInGraphProvider by lazy { ParsedBuiltInGraphProvider(ClasspathTurtleTextSource(), parser) }
internal val pokemon: BuiltInGraphProvider by lazy {
    ParsedBuiltInGraphProvider(ClasspathTurtleTextSource(POKEMON_RESOURCE_NAME), parser)
}

/**
 * The production query wiring (defaultHttpDependencies) with recording executions and no network;
 * [local] runs a built-in graph's queries (QUAL-023 passes a short timeout).
 */
internal fun recordingQueryDependencies(
    recorder: QueryRecorder,
    local: (RdfGraph) -> EndpointExecution = { JenaGraphEndpointExecution(it) },
): QueryHttpDependencies {
    val generator = CSharpCompatibleWikidataQueryGenerator()
    val filtering = ResultFilteringService()
    val resolver =
        EndpointContextResolver(
            InMemoryLocalGraphCache(),
            brasileirao,
            { graph -> RecordingLocalExecution(local(graph), recorder) },
            { _, isWikidata -> RecordingRemoteExecution(isWikidata, recorder) },
            mapOf(POKEMON_ENDPOINT_ID to pokemon),
        )
    val adapter = EndpointExecutionResolverAdapter(resolver)
    return QueryHttpDependencies(
        resolver,
        ElementRelationshipsService(adapter, generator, filtering),
        RelationshipValueService(adapter, generator, filtering),
        SearchService(generator, filtering, NoEntitySearch),
        GeneralQueryService(generator, JenaSparqlSyntaxValidator(), filtering),
        SparqlQueryGenerationService(generator, JenaSparqlSyntaxValidator()),
        StageQueryService(generator, JenaSparqlSyntaxValidator()),
        NumericProfileService(generator, JenaSparqlSyntaxValidator()),
        ResultCountService(generator, JenaSparqlSyntaxValidator()),
    )
}

internal fun recordingHttpDependencies(recorder: QueryRecorder): HttpDependencies =
    HttpDependencies(LocalDatabaseUploadService(parser, InMemoryLocalGraphCache()), recordingQueryDependencies(recorder))

/** A JSON string literal. */
internal fun js(value: String): String = JsonPrimitive(value).toString()

/** How an accepted payload must appear in the parsed query: as exactly this one term. */
internal sealed interface Expect {
    fun holds(
        queries: List<ParsedSparql>,
        value: String,
    ): Boolean

    /** A string literal whose lexical form is the whole payload. */
    data object Literal : Expect {
        override fun holds(
            queries: List<ParsedSparql>,
            value: String,
        ) = queries.any { it.hasLiteral(value) }
    }

    /** An IRI [prefix] + payload. */
    data class Iri(val prefix: String = "") : Expect {
        override fun holds(
            queries: List<ParsedSparql>,
            value: String,
        ) = queries.any { it.hasIri(prefix + value) }
    }

    /** A literal whose datatype IRI is [prefix] + payload. */
    data class Datatype(val prefix: String = "") : Expect {
        override fun holds(
            queries: List<ParsedSparql>,
            value: String,
        ) = queries.any { it.hasDatatype(prefix + value) }
    }

    /** A variable named by the payload. */
    data object Variable : Expect {
        override fun holds(
            queries: List<ParsedSparql>,
            value: String,
        ) = queries.any { it.hasVariable(value) }
    }

    /** Numbers, language tags and ignored values: the shape comparison is the whole check. */
    data object Shape : Expect {
        override fun holds(
            queries: List<ParsedSparql>,
            value: String,
        ) = true
    }
}

/**
 * One client field of one route: [body] puts a value in that field of an otherwise valid request.
 * [benign] is a value of the same kind the route accepts; [admits] leaves out values whose kind the
 * documented wire format changes on purpose (a `?x` object is a variable, not a literal).
 */
internal data class InjectionSlot(
    val name: String,
    val path: String,
    val benign: String,
    val expect: Expect,
    val admits: (String) -> Boolean = { true },
    val body: (String) -> String,
) {
    override fun toString(): String = name
}

/** The route, a payload and what went wrong. */
internal data class InjectionFinding(val slot: String, val payload: String, val problem: String)

internal suspend fun HttpClient.postJson(
    path: String,
    body: String,
): HttpResponse =
    post(path) {
        contentType(ContentType.Application.Json)
        setBody(body)
    }

private suspend fun queriesOf(
    slot: InjectionSlot,
    response: HttpResponse,
    recorder: QueryRecorder,
): List<String> {
    val executed = recorder.take()
    // View SPARQL executes nothing; the generated query is the response.
    if (slot.path.endsWith("/sparql") && response.status == HttpStatusCode.OK) {
        return executed + Json.parseToJsonElement(response.bodyAsText()).jsonObject.getValue("data").jsonPrimitive.content
    }
    return executed
}

/** What the benign value of a slot produced: the status and the in-scope queries. */
internal class Baseline(val status: HttpStatusCode, val queries: List<ParsedSparql>)

/** Sends the benign value; it must be accepted and produce in-scope queries. */
internal suspend fun HttpClient.baseline(
    slot: InjectionSlot,
    recorder: QueryRecorder,
): Baseline {
    recorder.take()
    val response = postJson(slot.path, slot.body(slot.benign))
    val queries = queriesOf(slot, response, recorder)
    check(response.status.value in 200..299) {
        "$slot: the benign value was not accepted (${response.status}): ${response.bodyAsText().take(300)}"
    }
    check(queries.isNotEmpty()) { "$slot: the benign value generated no query" }
    val parsed = queries.map(ParsedSparql::parse)
    parsed.forEach { check(it.scopeViolation() == null) { "$slot: benign query out of scope: ${it.scopeViolation()}" } }
    return Baseline(response.status, parsed)
}

/**
 * The QUAL-020 oracle for one value in one field: either 400 with nothing executed, or the benign
 * status with queries that Jena parses as one SELECT each, stay in scope, have exactly the benign
 * queries' algebra shape and hold the value as the one term the field asks for. Null when it holds.
 */
internal suspend fun HttpClient.probe(
    slot: InjectionSlot,
    recorder: QueryRecorder,
    baseline: Baseline,
    value: String,
): String? {
    val response = postJson(slot.path, slot.body(value))
    val queries = queriesOf(slot, response, recorder)
    return when {
        response.status == HttpStatusCode.BadRequest ->
            if (queries.isEmpty()) null else "rejected with 400 after executing ${queries.size} query(ies)"
        response.status != baseline.status ->
            "status ${response.status} instead of 400 or ${baseline.status}: ${response.bodyAsText().take(300)}"
        else -> oracle(slot.expect, value, baseline.queries, queries)
    }
}

/** Every fixed payload [slot] admits, through [probe]. */
internal suspend fun HttpClient.findInjections(
    slot: InjectionSlot,
    recorder: QueryRecorder,
    payloads: List<SparqlPayload> = sparqlPayloads,
): List<InjectionFinding> {
    val baseline = baseline(slot, recorder)
    return payloads.filter { slot.admits(it.value) }.mapNotNull { payload ->
        probe(slot, recorder, baseline, payload.value)?.let { InjectionFinding(slot.name, payload.id, it) }
    }
}

/** The structural check of accepted [queries] against the [baseline]; null when it holds. */
internal fun oracle(
    expect: Expect,
    value: String,
    baseline: List<ParsedSparql>,
    queries: List<String>,
): String? {
    if (queries.size != baseline.size) return "${queries.size} queries instead of ${baseline.size}"
    val parsed =
        queries.map {
            try {
                ParsedSparql.parse(it)
            } catch (failure: org.apache.jena.query.QueryParseException) {
                return "generated SPARQL that does not parse as one query: ${failure.message}"
            }
        }
    parsed.forEach { query -> query.scopeViolation()?.let { return it } }
    parsed.zip(baseline).forEachIndexed { index, (query, benign) ->
        if (query.shape != benign.shape) return "query $index has another algebra:\n${query.shape}\nbenign:\n${benign.shape}"
    }
    if (!expect.holds(parsed, value)) return "the payload is not the $expect term of the query"
    return null
}

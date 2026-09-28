@file:Suppress("MaxLineLength", "ReturnCount")

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.endpoints.ClasspathTurtleTextSource
import com.example.sparqlqueryeasy.application.endpoints.EndpointContextResolver
import com.example.sparqlqueryeasy.application.endpoints.EndpointExecutionResolverAdapter
import com.example.sparqlqueryeasy.application.endpoints.ParsedBuiltInGraphProvider
import com.example.sparqlqueryeasy.application.localdatabase.InMemoryLocalGraphCache
import com.example.sparqlqueryeasy.application.localdatabase.LocalDatabaseUploadService
import com.example.sparqlqueryeasy.application.query.GeneralQueryService
import com.example.sparqlqueryeasy.application.query.ResultFilteringService
import com.example.sparqlqueryeasy.application.querygeneration.SparqlQueryGenerationService
import com.example.sparqlqueryeasy.application.relationships.ElementRelationshipsService
import com.example.sparqlqueryeasy.application.relationships.EndpointExecution
import com.example.sparqlqueryeasy.application.relationships.RelationshipValueService
import com.example.sparqlqueryeasy.application.search.SearchService
import com.example.sparqlqueryeasy.application.search.WikidataEntitySearchClient
import com.example.sparqlqueryeasy.application.search.WikidataEntitySearchRecord
import com.example.sparqlqueryeasy.application.search.WikidataEntitySearchRequest
import com.example.sparqlqueryeasy.domain.model.BlankNode
import com.example.sparqlqueryeasy.domain.model.BoundSparqlBinding
import com.example.sparqlqueryeasy.domain.model.Iri
import com.example.sparqlqueryeasy.domain.model.Literal
import com.example.sparqlqueryeasy.domain.model.RdfGraph
import com.example.sparqlqueryeasy.domain.model.RdfResource
import com.example.sparqlqueryeasy.domain.model.RdfStatement
import com.example.sparqlqueryeasy.domain.model.RdfValue
import com.example.sparqlqueryeasy.domain.model.SparqlBinding
import com.example.sparqlqueryeasy.domain.model.SparqlSelectResult
import com.example.sparqlqueryeasy.domain.model.SparqlVariable
import com.example.sparqlqueryeasy.rdf.jena.JenaGraphEndpointExecution
import com.example.sparqlqueryeasy.rdf.jena.JenaRdfGraphComparator
import com.example.sparqlqueryeasy.rdf.jena.JenaSparqlSyntaxValidator
import com.example.sparqlqueryeasy.rdf.jena.JenaTurtleParser
import com.example.sparqlqueryeasy.wikidata.query.CSharpCompatibleWikidataQueryGenerator
import io.kotest.matchers.shouldBe
import io.ktor.client.request.forms.MultiPartFormDataContent
import io.ktor.client.request.forms.formData
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Test

/** Executes immutable C# captures through the Kotlin HTTP boundary; failures name the fixture ID. */
class CaptureDrivenCompatibilityTest {
    @Test
    fun `captured C sharp HTTP and generated SPARQL contracts match Kotlin`() {
        captures().filterNot { it.id in EXCLUDED_CAPTURE_CASES }.forEach(::assertCapture)
    }

    @Test
    fun `C sharp exception captures remain explicit intentional HTTP differences`() {
        INTENTIONAL_EXCEPTION_DIFFERENCES shouldBe
            setOf(
                "HTTP-BAD-JSON-001",
                "HTTP-MISSING-UPLOAD-001",
                "LOCAL-CACHE-MISS-001",
                "SELECT-INVALID-001",
                "TTL-INVALID-001",
                "TTL-INVALID-002",
            )
    }

    private fun assertCapture(capture: Capture) {
        val executions = mutableListOf<RecordedExecution>()
        testApplication {
            application { compatibilityModule(executions) }
            val endpoint = uploadIfNeeded(capture)
            capture.graph?.let { expected ->
                val turtle = requireNotNull(capture.turtle) { "${capture.id}: graph capture has no Turtle fixture" }
                val actual = JenaTurtleParser().parse(resourceText("/turtle/$turtle"))
                withMessage(capture.id) { JenaRdfGraphComparator().areIsomorphic(actual, expected) shouldBe true }
            }
            val request = capture.request?.replace("__DATABASE_ID__", endpoint)
            if (request != null && capture.http != null) {
                val response = client.post(routeFor(capture.id)) { jsonBody(request) }
                val responseBody = response.bodyAsText()
                withMessage(capture.id) {
                    if (response.status != HttpStatusCode.fromValue(capture.http.status)) {
                        error("expected ${capture.http.status}, got ${response.status}: $responseBody")
                    }
                }
                withMessage(capture.id) {
                    comparableBody(capture.id, Json.parseToJsonElement(responseBody)) shouldBe
                        comparableBody(capture.id, capture.http.body)
                }
            }
            if (request != null && capture.generatedSparql != null && capture.id in SPARQL_ROUTE_CASES) {
                val response = client.post("/api/query/sparql") { jsonBody(request) }
                withMessage(capture.id) { response.status shouldBe HttpStatusCode.OK }
                val actual = Json.parseToJsonElement(response.bodyAsText()).jsonObject.getValue("data").jsonPrimitive.content
                withMessage(capture.id) { normalizeQuery(actual) shouldBe normalizeQuery(capture.generatedSparql) }
            }
            assertExecutedQueries(capture.id, capture.rawQueries, executions)
        }
    }

    private suspend fun io.ktor.server.testing.ApplicationTestBuilder.uploadIfNeeded(capture: Capture): String {
        val fixture = capture.turtle ?: return "CampeonatoBrasileiro2023"
        if (capture.id.startsWith("TTL-") && capture.request == null) return ""
        val text = requireNotNull(javaClass.getResourceAsStream("/turtle/$fixture")).readBytes().toString(Charsets.UTF_8)
        val response =
            client.post("/api/local-database") {
                setBody(
                    MultiPartFormDataContent(
                        formData {
                            append("ttlFile", text, Headers.build { append(HttpHeaders.ContentDisposition, "filename=\"$fixture\"") })
                        },
                    ),
                )
            }
        response.status shouldBe HttpStatusCode.OK
        return Json.parseToJsonElement(response.bodyAsText()).jsonObject.getValue("data").jsonPrimitive.content
    }

    private fun Application.compatibilityModule(executions: MutableList<RecordedExecution>) {
        val cache = InMemoryLocalGraphCache()
        val parser = JenaTurtleParser()
        val generator = CSharpCompatibleWikidataQueryGenerator()
        val filtering = ResultFilteringService()
        val resolver =
            EndpointContextResolver(cache, ParsedBuiltInGraphProvider(ClasspathTurtleTextSource(), parser), {
                RecordedExecution(JenaGraphEndpointExecution(it)).also(executions::add)
            }, { _, wikidata -> GenerationOnlyRemoteExecution(wikidata) })
        val executionResolver = EndpointExecutionResolverAdapter(resolver)
        configureSerialization()
        configureErrorHandling()
        configureRouting(
            HttpDependencies(
                LocalDatabaseUploadService(parser, cache),
                QueryHttpDependencies(
                    resolver,
                    ElementRelationshipsService(executionResolver, generator, filtering),
                    RelationshipValueService(executionResolver, generator, filtering),
                    SearchService(generator, filtering, EmptySearch),
                    GeneralQueryService(generator, JenaSparqlSyntaxValidator(), filtering),
                    SparqlQueryGenerationService(generator, JenaSparqlSyntaxValidator()),
                ),
            ),
        )
    }

    private fun routeFor(id: String) =
        when {
            id in SPARQL_ROUTE_CASES -> "/api/query/sparql"
            id.startsWith("RELATIONSHIPS") -> "/api/query/relationships"
            id.startsWith("RELATIONSHIP-") -> "/api/query/relationship-value"
            id.startsWith("SEARCH") || id == "BUILTIN-GRAPH-001" -> "/api/query/search"
            else -> "/api/query"
        }

    private fun assertExecutedQueries(
        id: String,
        expected: List<RawQuery>,
        executions: List<RecordedExecution>,
    ) {
        val actual = executions.flatMap { it.executions }
        withMessage(id) { actual.size shouldBe expected.size }
        expected.zip(actual).forEach { (raw, execution) ->
            withMessage(id) { normalizeQuery(execution.query) shouldBe normalizeQuery(raw.query) }
            assertRawResult(id, raw, execution.result)
        }
    }

    private fun captures(): List<Capture> =
        requireNotNull(javaClass.getResourceAsStream("/expected/index.json")).bufferedReader().use { reader ->
            Json.parseToJsonElement(reader.readText()).jsonObject.getValue("cases").jsonArray.map { capture(it.jsonPrimitive.content) }
        }

    private fun capture(id: String): Capture {
        val root =
            requireNotNull(javaClass.getResourceAsStream("/expected/$id/case.json")).bufferedReader().use {
                Json.parseToJsonElement(it.readText()).jsonObject
            }
        val http = root["http"].jsonObjectOrNull()?.let { Http(it.getValue("status").jsonPrimitive.content.toInt(), it.getValue("body")) }
        val turtle = root["turtleFixture"].jsonObjectOrNull()?.get("name")?.jsonPrimitive?.content
        val graph = root["graph"].jsonObjectOrNull()?.let(::graph)
        val raw = root["rawQueries"]?.jsonArray.orEmpty().map(::rawQuery)
        return Capture(
            id,
            turtle,
            root["request"]?.jsonPrimitive?.contentOrNull,
            root["generatedSparql"]?.jsonPrimitive?.contentOrNull,
            http,
            graph,
            raw,
        )
    }

    private fun graph(value: JsonObject) =
        RdfGraph(
            value.getValue("statements").jsonArray.map { statement ->
                statement.jsonObject.let {
                    RdfStatement(
                        node(it.getValue("subject")) as RdfResource,
                        node(it.getValue("predicate")) as Iri,
                        node(it.getValue("object")),
                    )
                }
            }.toSet(),
        )

    private fun node(value: JsonElement): RdfValue {
        val item = value.jsonObject
        return when (item.getValue("kind").jsonPrimitive.content) {
            "uri" -> Iri(item.getValue("uri").jsonPrimitive.content)
            "blank" -> BlankNode(item.getValue("blankId").jsonPrimitive.content)
            else ->
                Literal(
                    item.getValue("lexicalForm").jsonPrimitive.content,
                    item["datatype"].captureText()?.let(::Iri),
                    item["language"].captureText(),
                )
        }
    }

    private fun JsonElement?.captureText() = this?.jsonPrimitive?.contentOrNull?.ifBlank { null }

    private fun rawQuery(value: JsonElement): RawQuery {
        val item = value.jsonObject
        val result = item.getValue("result").jsonObject
        val variables = result.getValue("projectedVariables").jsonArray.map { it.jsonPrimitive.content }
        val rows =
            result.getValue("rows").jsonArray.map { row ->
                row.jsonObject.getValue("bindings").jsonArray.map { binding ->
                    binding.jsonObject.let {
                        RawBinding(
                            it.getValue("variable").jsonPrimitive.content,
                            present = it.getValue("present").jsonPrimitive.content == "true",
                            bound = it.getValue("bound").jsonPrimitive.content == "true",
                            value = it["value"]?.takeUnless { value -> value is JsonNull }?.let(::node),
                        )
                    }
                }
            }
        return RawQuery(item.getValue("query").jsonPrimitive.content, variables, rows)
    }

    private fun assertRawResult(
        id: String,
        expected: RawQuery,
        actual: SparqlSelectResult,
    ) {
        withMessage(id) { actual.projectedVariables.map(SparqlVariable::name) shouldBe expected.variables }
        val mapping = BlankNodeMapping()
        if (id in ORDERED_CASES) {
            withMessage(id) { actual.rows.size shouldBe expected.rows.size }
            expected.rows.zip(actual.rows).forEach { (expectedRow, actualRow) -> assertRow(id, expectedRow, actualRow.bindings, mapping) }
        } else {
            val unmatched = actual.rows.toMutableList()
            expected.rows.forEach { expectedRow ->
                val match =
                    unmatched.indices.firstOrNull { index ->
                        val candidate = mapping.copy()
                        rowMatches(expectedRow, unmatched[index].bindings, candidate).also { if (it) mapping.replaceWith(candidate) }
                    }
                val matched =
                    withMessage(id) {
                        requireNotNull(match) {
                            "No matching Kotlin row for captured C# row: $expectedRow; " +
                                "remaining Kotlin rows (${unmatched.size}): ${unmatched.take(5)}"
                        }
                    }
                unmatched.removeAt(matched)
            }
            withMessage(id) { unmatched shouldBe emptyList() }
        }
    }

    private fun assertRow(
        id: String,
        expected: List<RawBinding>,
        actual: List<SparqlBinding>,
        mapping: BlankNodeMapping,
    ) {
        withMessage(id) { rowMatches(expected, actual, mapping) shouldBe true }
    }

    private fun rowMatches(
        expected: List<RawBinding>,
        actual: List<SparqlBinding>,
        mapping: BlankNodeMapping,
    ): Boolean {
        if (expected.map(RawBinding::name) != actual.map { it.variable.name }) return false
        return expected.zip(actual).all { (expectedBinding, actualBinding) ->
            if (expectedBinding.present != expectedBinding.bound) return false
            when (actualBinding) {
                is BoundSparqlBinding ->
                    expectedBinding.present && expectedBinding.bound &&
                        expectedBinding.value?.let { valuesMatch(it, actualBinding.value, mapping) } == true
                else -> !expectedBinding.present && !expectedBinding.bound && actualBinding !is BoundSparqlBinding
            }
        }
    }

    private fun valuesMatch(
        expected: RdfValue,
        actual: RdfValue,
        mapping: BlankNodeMapping,
    ): Boolean =
        when (expected) {
            is Iri -> actual is Iri && actual.value == expected.value
            is Literal ->
                actual is Literal &&
                    actual.lexicalForm == expected.lexicalForm &&
                    actual.datatype == expected.datatype &&
                    actual.language == expected.language
            is BlankNode -> actual is BlankNode && mapping.matches(expected.identifier, actual.identifier)
        }

    private fun resourceText(path: String) = requireNotNull(javaClass.getResourceAsStream(path)).readBytes().toString(Charsets.UTF_8)

    /** C# uses five random hexadecimal suffixes; Kotlin uses deterministic pattern indexes. */
    private fun normalizeQuery(value: String) = value.replace(Regex("\\?literalValue(?:[0-9a-f]{5}|[0-9]+)"), "?literalValue__ID__")

    private fun comparableBody(
        id: String,
        body: JsonElement,
    ): JsonElement {
        if (id in ORDERED_CASES || body !is JsonObject) return body
        val data = body["data"] as? JsonArray ?: return body
        return JsonObject(
            body.toMutableMap().apply { put("data", kotlinx.serialization.json.JsonArray(data.sortedBy(JsonElement::toString))) },
        )
    }

    private fun <T> withMessage(
        id: String,
        block: () -> T,
    ): T =
        try {
            block()
        } catch (failure: Throwable) {
            throw AssertionError("Compatibility fixture $id failed", failure)
        }

    private data class Capture(
        val id: String,
        val turtle: String?,
        val request: String?,
        val generatedSparql: String?,
        val http: Http?,
        val graph: RdfGraph?,
        val rawQueries: List<RawQuery>,
    )

    private data class RawQuery(val query: String, val variables: List<String>, val rows: List<List<RawBinding>>)

    private data class RawBinding(
        val name: String,
        val present: Boolean,
        val bound: Boolean,
        val value: RdfValue?,
    )

    private data class Http(val status: Int, val body: JsonElement)

    private data class ExecutedQuery(val query: String, val result: SparqlSelectResult)

    private class RecordedExecution(private val delegate: EndpointExecution) : EndpointExecution {
        val executions = mutableListOf<ExecutedQuery>()
        override val isLocal: Boolean = delegate.isLocal
        override val isWikidata: Boolean = delegate.isWikidata

        override suspend fun execute(query: String): SparqlSelectResult =
            delegate.execute(query).also { result -> executions += ExecutedQuery(query, result) }
    }

    private class BlankNodeMapping(
        private val expectedToActual: MutableMap<String, String> = mutableMapOf(),
        private val actualToExpected: MutableMap<String, String> = mutableMapOf(),
    ) {
        fun matches(
            expected: String,
            actual: String,
        ): Boolean {
            val knownActual = expectedToActual[expected]
            val knownExpected = actualToExpected[actual]
            if (knownActual != null || knownExpected != null) return knownActual == actual && knownExpected == expected
            expectedToActual[expected] = actual
            actualToExpected[actual] = expected
            return true
        }

        fun copy() = BlankNodeMapping(expectedToActual.toMutableMap(), actualToExpected.toMutableMap())

        fun replaceWith(other: BlankNodeMapping) {
            expectedToActual.clear()
            expectedToActual.putAll(other.expectedToActual)
            actualToExpected.clear()
            actualToExpected.putAll(other.actualToExpected)
        }
    }

    private class GenerationOnlyRemoteExecution(override val isWikidata: Boolean) : EndpointExecution {
        override val isLocal = false

        override suspend fun execute(query: String): SparqlSelectResult = error("Remote execution is forbidden in capture tests")
    }

    private object EmptySearch : WikidataEntitySearchClient {
        override suspend fun search(request: WikidataEntitySearchRequest): List<WikidataEntitySearchRecord> = emptyList()
    }

    private companion object {
        val INTENTIONAL_EXCEPTION_DIFFERENCES =
            setOf(
                "HTTP-BAD-JSON-001",
                "HTTP-MISSING-UPLOAD-001",
                "LOCAL-CACHE-MISS-001",
                "SELECT-INVALID-001",
                "TTL-INVALID-001",
                "TTL-INVALID-002",
            )
        val SPARQL_ROUTE_CASES =
            setOf("SELECT-LIMIT-ZERO-001", "SELECT-LIMIT-TWO-001", "SPARQL-INJECTION-PATH-001", "WIKIDATA-GENERATION-001")
        val ORDERED_CASES = setOf("SELECT-ORDER-MAX-001", "SELECT-ORDER-MIN-001")
        val EXCLUDED_CAPTURE_CASES = INTENTIONAL_EXCEPTION_DIFFERENCES
    }
}

private fun io.ktor.client.request.HttpRequestBuilder.jsonBody(value: String) {
    headers.append(HttpHeaders.ContentType, "application/json")
    setBody(value)
}

private fun JsonElement?.jsonObjectOrNull() = this?.takeUnless { it is JsonNull }?.jsonObject

@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.security

import com.example.sparqlqueryeasy.application.endpoints.POKEMON_ENDPOINT_ID
import com.example.sparqlqueryeasy.application.endpoints.RemoteSparqlEndpoint
import com.example.sparqlqueryeasy.application.endpoints.RemoteSparqlEndpointContext
import com.example.sparqlqueryeasy.application.query.ResultFilteringService
import com.example.sparqlqueryeasy.application.search.SearchRequest
import com.example.sparqlqueryeasy.application.search.SearchResult
import com.example.sparqlqueryeasy.application.search.SearchService
import com.example.sparqlqueryeasy.domain.model.Literal
import com.example.sparqlqueryeasy.http.configureErrorHandling
import com.example.sparqlqueryeasy.http.configureRouting
import com.example.sparqlqueryeasy.http.configureSerialization
import com.example.sparqlqueryeasy.wikidata.query.CSharpCompatibleWikidataQueryGenerator
import io.kotest.assertions.withClue
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldNotBeEmpty
import io.kotest.matchers.shouldBe
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import org.junit.jupiter.api.Test

/**
 * QUAL-020 (Security Test Plan threats 5–6): every payload of security/sparql-payloads.json in every
 * client field of every query route, on the built-in PokemonGen1 graph (real Jena execution) and on
 * Wikidata (a recording fake, so its label and prefix variants are checked offline).
 */
class SparqlInjectionRoutesTest {
    private fun ApplicationTestBuilder.recordingApp(): QueryRecorder {
        val recorder = QueryRecorder()
        application {
            configureSerialization()
            configureErrorHandling()
            configureRouting(recordingHttpDependencies(recorder))
        }
        return recorder
    }

    private fun noInjection(slots: (String) -> List<InjectionSlot>) =
        listOf(POKEMON_ENDPOINT_ID, WIKIDATA).forEach { endpoint ->
            testApplication {
                val recorder = recordingApp()
                val findings = slots(endpoint).flatMap { client.findInjections(it, recorder) }
                withClue(findings.joinToString("\n")) { findings.shouldBeEmpty() }
            }
        }

    @Test
    fun `no payload in a drawn-query field of Run Query, View SPARQL, count or stage changes the query`() =
        noInjection(::drawnQueryRouteSlots)

    @Test
    fun `no payload in a numeric profile field changes the query`() = noInjection(::numericProfileSlots)

    @Test
    fun `no payload in a staged binding changes the query`() = noInjection(::stageBindingSlots)

    @Test
    fun `no payload in a relationship field changes the query`() = noInjection(::relationshipSlots)

    @Test
    fun `no payload in local search text changes the query`() =
        testApplication {
            val recorder = recordingApp()
            val findings = client.findInjections(searchSlot(POKEMON_ENDPOINT_ID), recorder)
            withClue(findings.joinToString("\n")) { findings.shouldBeEmpty() }
        }

    /** A generic remote endpoint is the only place search text enters SPARQL (STRSTARTS). */
    @Test
    fun `no payload in remote SPARQL search text changes the query`() =
        runBlocking {
            val recorder = QueryRecorder()
            val search = SearchService(CSharpCompatibleWikidataQueryGenerator(), ResultFilteringService(), NoEntitySearch)
            val remote =
                RemoteSparqlEndpointContext(
                    RemoteSparqlEndpoint.parse("https://sparql.example.org/sparql"),
                    RecordingRemoteExecution(isWikidata = false, recorder),
                )
            search.search(SearchRequest("Char"), remote)
            val baseline = recorder.take().map(ParsedSparql::parse)
            baseline.size shouldBe 1

            val findings =
                sparqlPayloads.mapNotNull { payload ->
                    val result = search.search(SearchRequest(payload.value), remote)
                    val queries = recorder.take()
                    when (result) {
                        is SearchResult.InvalidInput -> if (queries.isEmpty()) null else "rejected after executing"
                        else -> oracle(Expect.Literal, payload.value, baseline, queries)
                    }?.let { "${payload.id}: $it" }
                }
            withClue(findings.joinToString("\n")) { findings.shouldBeEmpty() }
        }

    @Test
    fun `on the built-in graph a payload never returns rows the same query without its value would not`() =
        testApplication {
            val recorder = recordingApp()
            val literals = pokemon.graph().statements.mapNotNull { (it.`object` as? Literal)?.lexicalForm }
            // Every literal slot keeps the Fire-type pattern, so its rows are at most the Fire-type Pokémon.
            val firePattern = """{"subject":"?pokemon","predicate":"<${PK}hasType>","object":"<${PK}FireType>"}"""
            val fire =
                client.postJson(
                    "/api/query",
                    """{"endpointUrl":"$POKEMON_ENDPOINT_ID","variableName":"?pokemon","where":[$firePattern],"limit":1000}""",
                ).data().jsonArray.map { it.jsonObject.getValue("propertyId").jsonPrimitive.content }.toSet()
            fire.shouldNotBeEmpty()
            val slots =
                drawnQueryRouteSlots(POKEMON_ENDPOINT_ID).filter {
                    it.expect == Expect.Literal && it.path in setOf("/api/query", "/api/query/count")
                }
            slots.size shouldBe 12

            val findings =
                slots.flatMap { slot ->
                    sparqlPayloads.filter { slot.admits(it.value) }.mapNotNull { payload ->
                        val response = client.postJson(slot.path, slot.body(payload.value))
                        recorder.take()
                        if (response.status == HttpStatusCode.BadRequest) return@mapNotNull null
                        val data = response.data()
                        val rows =
                            if (slot.path == "/api/query") {
                                data.jsonArray.map { it.jsonObject.getValue("propertyId").jsonPrimitive.content }
                            } else {
                                List(data.jsonObject.getValue("count").jsonPrimitive.long.toInt()) { "row $it" }
                            }
                        val inGraph = literals.any { payload.value in it }
                        when {
                            !inGraph && rows.isNotEmpty() -> "$slot ${payload.id}: ${rows.size} rows for a value no literal holds"
                            slot.path == "/api/query" && !fire.containsAll(rows) -> "$slot ${payload.id}: rows outside the Fire type"
                            rows.size > fire.size -> "$slot ${payload.id}: ${rows.size} rows, more than the ${fire.size} Fire Pokémon"
                            else -> null
                        }
                    }
                }
            withClue(findings.joinToString("\n")) { findings.shouldBeEmpty() }
        }

    private suspend fun HttpResponse.data(): JsonElement {
        status shouldBe HttpStatusCode.OK
        return Json.parseToJsonElement(bodyAsText()).jsonObject.getValue("data")
    }
}

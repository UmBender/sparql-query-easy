package com.example.sparqlqueryeasy.application.relationships

import com.example.sparqlqueryeasy.application.query.PropertyResult
import com.example.sparqlqueryeasy.application.query.ResultFilteringService
import com.example.sparqlqueryeasy.domain.model.BoundSparqlBinding
import com.example.sparqlqueryeasy.domain.model.Iri
import com.example.sparqlqueryeasy.domain.model.Literal
import com.example.sparqlqueryeasy.domain.model.RdfValue
import com.example.sparqlqueryeasy.domain.model.SparqlResultRow
import com.example.sparqlqueryeasy.domain.model.SparqlSelectResult
import com.example.sparqlqueryeasy.domain.model.SparqlVariable
import com.example.sparqlqueryeasy.domain.model.UnboundSparqlBinding
import com.example.sparqlqueryeasy.wikidata.query.CSharpCompatibleWikidataQueryGenerator
import com.example.sparqlqueryeasy.wikidata.query.IriTerm
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import org.junit.jupiter.api.Test
import kotlin.coroutines.Continuation
import kotlin.coroutines.EmptyCoroutineContext
import kotlin.coroutines.startCoroutine

class ElementRelationshipsServiceTest {
    private val generator = CSharpCompatibleWikidataQueryGenerator()

    @Test
    fun `RELATIONSHIPS-LOCAL-001 resolves endpoint generates query executes then keeps local rows`() {
        val fixtureResult =
            select(
                listOf("property", "propertyLabel", "propertyType"),
                row(
                    "property" to Iri("https://example.test/p1"),
                    "propertyLabel" to null,
                    "propertyType" to Literal("outro"),
                ),
                row(
                    "property" to Iri("https://example.test/p2"),
                    "propertyLabel" to Literal("Label"),
                    "propertyType" to Literal("objeto"),
                ),
            )
        val fake = RecordingEndpoint(isLocal = true, isWikidata = false, fixtureResult)
        val service = ElementRelationshipsService(FakeResolver(fake), generator, ResultFilteringService())

        runSuspend {
            service.getElementRelationships(
                ElementRelationshipsRequest(
                    endpointUrl = "local-id",
                    element = IriTerm("https://example.test/subject"),
                ),
            )
        } shouldBe
            listOf(
                PropertyResult("<https://example.test/p1>", "", "outro"),
                PropertyResult("<https://example.test/p2>", "Label", "objeto"),
            )
        fake.query shouldContain "<https://example.test/subject> ?property [] ."
        fake.query shouldContain "?property rdfs:label ?propertyLabel ."
        fake.query.contains("LIMIT") shouldBe false
    }

    @Test
    fun `RELATIONSHIPS-LOCAL-001 remote path filters empty labels and outro after execution`() {
        val result =
            select(
                listOf("property", "propertyLabel", "propertyType"),
                row(
                    "property" to Iri("https://example.test/empty"),
                    "propertyLabel" to null,
                    "propertyType" to Literal("objeto"),
                ),
                row(
                    "property" to Iri("https://example.test/outro"),
                    "propertyLabel" to Literal("Visible"),
                    "propertyType" to Literal("outro"),
                ),
                row(
                    "property" to Iri("https://example.test/kept"),
                    "propertyLabel" to Literal("Visible"),
                    "propertyType" to Literal("objeto"),
                ),
            )
        val fake = RecordingEndpoint(isLocal = false, isWikidata = true, result)
        val service = ElementRelationshipsService(FakeResolver(fake), generator, ResultFilteringService())

        runSuspend {
            service.getElementRelationships(
                ElementRelationshipsRequest(
                    "https://query.wikidata.org/sparql",
                    IriTerm("https://example.test/subject"),
                ),
            )
        } shouldBe listOf(PropertyResult("<https://example.test/kept>", "Visible", "objeto"))
        fake.query shouldContain "PREFIX wikibase: <http://wikiba.se/ontology#>"
        fake.query shouldContain "?propertyClaim wikibase:directClaim ?property ."
    }

    @Test
    fun `service propagates endpoint and execution failures without changing them`() {
        val expected = IllegalStateException("endpoint unavailable")
        val resolver =
            object : EndpointExecutionResolver {
                override fun resolve(endpointUrl: String): EndpointExecution = throw expected
            }
        val service = ElementRelationshipsService(resolver, generator, ResultFilteringService())
        val actual =
            runCatching {
                runSuspend {
                    service.getElementRelationships(
                        ElementRelationshipsRequest("bad", IriTerm("https://example.test/subject")),
                    )
                }
            }.exceptionOrNull()
        actual shouldBe expected
    }

    private class FakeResolver(private val endpoint: EndpointExecution) : EndpointExecutionResolver {
        override fun resolve(endpointUrl: String): EndpointExecution = endpoint
    }

    private class RecordingEndpoint(
        override val isLocal: Boolean,
        override val isWikidata: Boolean,
        private val response: SparqlSelectResult,
    ) : EndpointExecution {
        lateinit var query: String

        override suspend fun execute(query: String): SparqlSelectResult {
            this.query = query
            return response
        }
    }

    private fun select(
        variables: List<String>,
        vararg rows: Map<String, RdfValue?>,
    ): SparqlSelectResult {
        val projected = variables.map(::SparqlVariable)
        return SparqlSelectResult(
            projected,
            rows.map { values ->
                SparqlResultRow(
                    projected.map { variable ->
                        values[variable.name]?.let { BoundSparqlBinding(variable, it) }
                            ?: UnboundSparqlBinding(variable)
                    },
                )
            },
        )
    }

    private fun row(vararg values: Pair<String, RdfValue?>): Map<String, RdfValue?> = mapOf(*values)
}

private fun <T> runSuspend(block: suspend () -> T): T {
    var result: Result<T>? = null
    block.startCoroutine(
        object : Continuation<T> {
            override val context = EmptyCoroutineContext

            override fun resumeWith(value: Result<T>) {
                result = value
            }
        },
    )
    return requireNotNull(result).getOrThrow()
}

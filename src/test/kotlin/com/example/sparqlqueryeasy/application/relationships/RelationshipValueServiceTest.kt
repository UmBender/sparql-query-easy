package com.example.sparqlqueryeasy.application.relationships

import com.example.sparqlqueryeasy.application.query.PropertyResult
import com.example.sparqlqueryeasy.application.query.ResultFilteringService
import com.example.sparqlqueryeasy.domain.model.BlankNode
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
import com.example.sparqlqueryeasy.wikidata.query.WikidataPropertyId
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import org.junit.jupiter.api.Test
import kotlin.coroutines.Continuation
import kotlin.coroutines.EmptyCoroutineContext
import kotlin.coroutines.startCoroutine

class RelationshipValueServiceTest {
    private val generator = CSharpCompatibleWikidataQueryGenerator()

    @Test
    fun `RELATIONSHIP-LITERAL-001 maps lexical literal values to text IDs and labels`() {
        val endpoint =
            RecordingEndpoint(
                isLocal = true,
                isWikidata = false,
                select(
                    listOf("property", "propertyLabel"),
                    row("property" to Literal("olá", Literal.RDF_LANG_STRING, "pt-BR"), "propertyLabel" to null),
                    row(
                        "property" to Literal("0042", Iri("http://www.w3.org/2001/XMLSchema#integer")),
                        "propertyLabel" to null,
                    ),
                    row("property" to BlankNode("b0"), "propertyLabel" to null),
                ),
            )
        val service = RelationshipValueService(FakeResolver(endpoint), generator, ResultFilteringService())

        runSuspend {
            service.getRelationshipValue(
                RelationshipValueRequest(
                    endpointUrl = "local-id",
                    subject = IriTerm("https://example.test/subject"),
                    predicate = IriTerm("https://example.test/value"),
                    isLiteral = true,
                ),
            )
        } shouldBe
            listOf(
                PropertyResult("olá", "olá", "text"),
                PropertyResult("0042", "0042", "text"),
                PropertyResult("blank", "blank", "text"),
            )
        endpoint.query shouldContain "?property ."
        endpoint.query.contains("OPTIONAL") shouldBe false
    }

    @Test
    fun `RELATIONSHIP-RESOURCE-001 filters empty labels after resource mapping`() {
        val endpoint =
            RecordingEndpoint(
                isLocal = false,
                isWikidata = true,
                select(
                    listOf("property", "propertyLabel"),
                    row("property" to Iri("https://example.test/kept"), "propertyLabel" to Literal("Kept")),
                    row("property" to Iri("https://example.test/missing"), "propertyLabel" to null),
                ),
            )
        val service = RelationshipValueService(FakeResolver(endpoint), generator, ResultFilteringService())

        runSuspend {
            service.getRelationshipValue(
                RelationshipValueRequest(
                    "https://query.wikidata.org/sparql",
                    IriTerm("https://example.test/subject"),
                    WikidataPropertyId("P31").directClaim(),
                    isLiteral = false,
                ),
            )
        } shouldBe listOf(PropertyResult("<https://example.test/kept>", "Kept"))
        endpoint.query shouldContain "PREFIX wikibase: <http://wikiba.se/ontology#>"
        endpoint.query shouldContain "?property rdfs:label ?propertyLabel ."
    }

    @Test
    fun `service propagates execution exceptions without changing them`() {
        val expected = IllegalStateException("query failed")
        val endpoint =
            object : EndpointExecution {
                override val isLocal = false
                override val isWikidata = false

                override suspend fun execute(query: String): SparqlSelectResult = throw expected
            }
        val service = RelationshipValueService(FakeResolver(endpoint), generator, ResultFilteringService())

        runCatching {
            runSuspend {
                service.getRelationshipValue(
                    RelationshipValueRequest(
                        "remote",
                        IriTerm("https://example.test/subject"),
                        IriTerm("https://example.test/predicate"),
                        false,
                    ),
                )
            }
        }.exceptionOrNull() shouldBe expected
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

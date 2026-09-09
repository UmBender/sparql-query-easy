package com.example.sparqlqueryeasy.application.query

import com.example.sparqlqueryeasy.domain.model.BlankNode
import com.example.sparqlqueryeasy.domain.model.BoundSparqlBinding
import com.example.sparqlqueryeasy.domain.model.Iri
import com.example.sparqlqueryeasy.domain.model.Literal
import com.example.sparqlqueryeasy.domain.model.RdfValue
import com.example.sparqlqueryeasy.domain.model.SparqlResultRow
import com.example.sparqlqueryeasy.domain.model.SparqlSelectResult
import com.example.sparqlqueryeasy.domain.model.SparqlVariable
import com.example.sparqlqueryeasy.domain.model.UnboundSparqlBinding
import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test

class ResultFilteringServiceTest {
    private val service = ResultFilteringService()

    @Test
    fun `RELATIONSHIPS-LOCAL-001 keeps local empty labels outro types and duplicate rows`() {
        val results =
            result(
                listOf("property", "propertyLabel", "propertyType"),
                row(
                    "property" to Iri("https://example.test/one"),
                    "propertyLabel" to null,
                    "propertyType" to Literal("outro"),
                ),
                row(
                    "property" to Iri("https://example.test/two"),
                    "propertyLabel" to Literal("  "),
                    "propertyType" to Literal("objeto"),
                ),
                row(
                    "property" to Iri("https://example.test/two"),
                    "propertyLabel" to Literal("  "),
                    "propertyType" to Literal("objeto"),
                ),
            )

        service.elementRelationships(results, isLocal = true) shouldBe
            listOf(
                PropertyResult("<https://example.test/one>", "", "outro"),
                PropertyResult("<https://example.test/two>", "  ", "objeto"),
                PropertyResult("<https://example.test/two>", "  ", "objeto"),
            )
        service.elementRelationships(results, isLocal = false) shouldBe
            listOf(
                PropertyResult("<https://example.test/two>", "  ", "objeto"),
                PropertyResult("<https://example.test/two>", "  ", "objeto"),
            )
    }

    @Test
    fun `RELATIONSHIP-LITERAL-001 preserves literal lexical form and RDF metadata does not change display`() {
        val results =
            result(
                listOf("property", "propertyLabel"),
                row(
                    "property" to Literal(" olá ", Literal.RDF_LANG_STRING, "pt-BR"),
                    "propertyLabel" to null,
                ),
                row(
                    "property" to Literal("0042", Iri("http://www.w3.org/2001/XMLSchema#integer")),
                    "propertyLabel" to null,
                ),
                row("property" to BlankNode("private"), "propertyLabel" to null),
            )

        service.relationshipValues(results, isLiteral = true) shouldBe
            listOf(
                PropertyResult(" olá ", " olá ", "text"),
                PropertyResult("0042", "0042", "text"),
                PropertyResult("blank", "blank", "text"),
            )
    }

    @Test
    fun `RELATIONSHIP-RESOURCE-001 removes entries with unbound labels but does not trim labels`() {
        val results =
            result(
                listOf("property", "propertyLabel"),
                row("property" to Iri("https://example.test/kept"), "propertyLabel" to Literal(" ")),
                row("property" to Iri("https://example.test/dropped"), "propertyLabel" to null),
            )

        service.relationshipValues(results, isLiteral = false) shouldBe
            listOf(PropertyResult("<https://example.test/kept>", " "))
    }

    @Test
    fun `SEARCH-LOCAL-001 applies current-culture lowercase then exact type filter then takes twenty`() {
        val accepted =
            (1..21).map { index ->
                row(
                    "property" to Iri("https://example.test/$index"),
                    "propertyLabel" to Literal("  FoOtball $index  ", Literal.RDF_LANG_STRING, "en"),
                    "propertyParentType" to Literal("objetoClasse"),
                )
            }
        val results =
            result(
                listOf("property", "propertyLabel", "propertyParentType"),
                *(
                    accepted +
                        row(
                            "property" to Iri("https://example.test/other"),
                            "propertyLabel" to Literal("football"),
                            "propertyParentType" to Literal("ObjetoClasse"),
                        )
                ).toTypedArray(),
            )

        service.search(results, "fooT", isLocal = true) shouldBe
            (1..20).map { index ->
                PropertyResult(
                    "<https://example.test/$index>",
                    "  FoOtball $index  ",
                    "objetoClasse",
                )
            }
        service.search(results, "", isLocal = true) shouldBe emptyList()
        service.search(results, "fooT", isLocal = false).size shouldBe 22
    }

    @Test
    fun `QUERY-EMPTY-WHERE-001 falls back only on empty labels then filters exact parent type`() {
        val results =
            result(
                listOf("item", "itemLabel", "itemParentType", "itemRdfType"),
                row(
                    "item" to Iri("https://example.test/fallback"),
                    "itemLabel" to null,
                    "itemParentType" to Literal("objetoClasse"),
                    "itemRdfType" to Iri("https://example.test/Class"),
                ),
                row(
                    "item" to Literal("0042", Iri("http://www.w3.org/2001/XMLSchema#integer")),
                    "itemLabel" to Literal(" "),
                    "itemParentType" to Literal("objetoClasse"),
                    "itemRdfType" to null,
                ),
                row(
                    "item" to Iri("https://example.test/not-class"),
                    "itemLabel" to Literal("Kept before empty-where filter"),
                    "itemParentType" to Literal("outro"),
                    "itemRdfType" to null,
                ),
                row(
                    "item" to null,
                    "itemLabel" to null,
                    "itemParentType" to Literal("objetoClasse"),
                    "itemRdfType" to null,
                ),
            )

        service.query(results, "?item", whereIsEmpty = true) shouldBe
            listOf(
                PropertyResult(
                    "<https://example.test/fallback>",
                    "<https://example.test/fallback>",
                    "objetoClasse",
                    "<https://example.test/Class>",
                ),
                PropertyResult("0042", " ", "objetoClasse"),
            )
        service.query(results, "?item", whereIsEmpty = false).size shouldBe 3
    }

    private fun result(
        variables: List<String>,
        vararg rows: Map<String, RdfValue?>,
    ): SparqlSelectResult {
        val projectedVariables = variables.map(::SparqlVariable)
        return SparqlSelectResult(
            projectedVariables,
            rows.map { row ->
                SparqlResultRow(
                    projectedVariables.map { variable ->
                        row[variable.name]?.let { BoundSparqlBinding(variable, it) } ?: UnboundSparqlBinding(variable)
                    },
                )
            },
        )
    }

    private fun row(vararg bindings: Pair<String, RdfValue?>): Map<String, RdfValue?> = mapOf(*bindings)
}

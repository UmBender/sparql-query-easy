package com.example.sparqlqueryeasy.domain.model

import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import org.junit.jupiter.api.Test
import kotlin.test.assertFailsWith

class DomainModelsTest {
    @Test
    fun `IRIs have value equality and reject invalid values`() {
        Iri("https://example.test/resource") shouldBe Iri("https://example.test/resource")

        assertFailsWith<IllegalArgumentException> {
            Iri("not an absolute iri")
        }
    }

    @Test
    fun `blank nodes compare by their identity representation`() {
        BlankNode("generated-1") shouldBe BlankNode("generated-1")
        BlankNode("generated-1") shouldNotBe BlankNode("generated-2")
    }

    @Test
    fun `literals preserve plain language tagged and typed forms`() {
        Literal("plain") shouldBe Literal(lexicalForm = "plain")
        Literal(lexicalForm = "olá", language = "pt-BR").language shouldBe "pt-BR"

        val integer = Iri("http://www.w3.org/2001/XMLSchema#integer")
        Literal(lexicalForm = "0042", datatype = integer).datatype shouldBe integer
    }

    @Test
    fun `literals reject incompatible language and datatype combinations`() {
        assertFailsWith<IllegalArgumentException> {
            Literal(
                lexicalForm = "hello",
                datatype = Iri("http://www.w3.org/2001/XMLSchema#string"),
                language = "en",
            )
        }

        assertFailsWith<IllegalArgumentException> {
            Literal(lexicalForm = "hello", datatype = Literal.RDF_LANG_STRING)
        }
    }

    @Test
    fun `RDF statements have structural equality`() {
        val statement =
            RdfStatement(
                subject = Iri("https://example.test/subject"),
                predicate = Iri("https://example.test/predicate"),
                `object` = Literal("value"),
            )

        statement shouldBe statement.copy()
    }

    @Test
    fun `SELECT results preserve projected variable ordering and duplicate rows`() {
        val item = SparqlVariable("item")
        val label = SparqlVariable("label")
        val row =
            SparqlResultRow(
                listOf(
                    BoundSparqlBinding(item, Iri("https://example.test/item/1")),
                    BoundSparqlBinding(label, Literal("First item")),
                ),
            )

        val result =
            SparqlSelectResult(
                projectedVariables = listOf(label, item),
                rows = listOf(row, row),
            )

        result.projectedVariables shouldBe listOf(label, item)
        result.rows shouldBe listOf(row, row)
    }

    @Test
    fun `rows distinguish bound unbound and missing variables`() {
        val item = SparqlVariable("item")
        val label = SparqlVariable("label")
        val missing = SparqlVariable("missing")
        val row =
            SparqlResultRow(
                listOf(
                    BoundSparqlBinding(item, Iri("https://example.test/item/1")),
                    UnboundSparqlBinding(label),
                ),
            )

        (row.binding(item) as BoundSparqlBinding).value shouldBe Iri("https://example.test/item/1")
        row.binding(label) shouldBe UnboundSparqlBinding(label)
        row.binding(missing) shouldBe null
    }

    @Test
    fun `ASK and CONSTRUCT result types retain their domain values`() {
        SparqlAskResult(true).value shouldBe true

        val graph = RdfGraph()
        SparqlConstructResult(graph).graph shouldBe graph
    }

    @Test
    fun `domain failures retain diagnostic information`() {
        val parseFailure =
            TurtleParsingFailure(
                diagnostic = "Unexpected token on line 3",
                baseIri = Iri("https://example.test/base/"),
            )
        val queryFailure =
            SparqlQueryExecutionFailure(
                query = "SELECT * WHERE { ?s ?p ?o }",
                diagnostic = "Query timeout",
            )

        parseFailure.diagnostic shouldBe "Unexpected token on line 3"
        parseFailure.baseIri shouldBe Iri("https://example.test/base/")
        queryFailure.query shouldBe "SELECT * WHERE { ?s ?p ?o }"
        queryFailure.diagnostic shouldBe "Query timeout"
    }

    @Test
    fun `SELECT results require an explicit binding state for every projection`() {
        val item = SparqlVariable("item")
        val label = SparqlVariable("label")
        val incompleteRow =
            SparqlResultRow(
                listOf(BoundSparqlBinding(item, Iri("https://example.test/item/1"))),
            )

        assertFailsWith<IllegalArgumentException> {
            SparqlSelectResult(
                projectedVariables = listOf(item, label),
                rows = listOf(incompleteRow),
            )
        }
    }
}

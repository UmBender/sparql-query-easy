package com.example.sparqlqueryeasy.rdf.jena

import com.example.sparqlqueryeasy.domain.model.BlankNode
import com.example.sparqlqueryeasy.domain.model.BoundSparqlBinding
import com.example.sparqlqueryeasy.domain.model.Iri
import com.example.sparqlqueryeasy.domain.model.Literal
import com.example.sparqlqueryeasy.domain.model.RdfGraph
import com.example.sparqlqueryeasy.domain.model.RdfStatement
import com.example.sparqlqueryeasy.domain.model.SparqlSelectResult
import com.example.sparqlqueryeasy.domain.model.SparqlVariable
import com.example.sparqlqueryeasy.domain.model.TurtleParsingFailure
import com.example.sparqlqueryeasy.domain.model.UnboundSparqlBinding
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test
import kotlin.coroutines.Continuation
import kotlin.coroutines.EmptyCoroutineContext
import kotlin.coroutines.startCoroutine
import kotlin.test.assertFailsWith

class JenaRdfInfrastructureTest {
    private val parser = JenaTurtleParser()
    private val executor = JenaLocalSparqlExecutor()

    @Test
    fun `Turtle parser explicitly parses Turtle and preserves declared base and prefixes`() {
        val graph = parser.parse(resource("turtle/base-iri.ttl"))

        graph.statements shouldContainExactlyInAnyOrder
            setOf(
                RdfStatement(
                    Iri("https://example.test/base/relative-item"),
                    Iri("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
                    Iri("http://www.w3.org/2002/07/owl#Class"),
                ),
                RdfStatement(
                    Iri("https://example.test/base/relative-item"),
                    Iri("http://www.w3.org/2000/01/rdf-schema#label"),
                    Literal("Base resolved item", Literal.RDF_LANG_STRING, "en"),
                ),
                RdfStatement(
                    Iri("https://example.test/base/relative-item"),
                    Iri("https://example.test/base/related"),
                    Iri("https://example.test/base/relative-target"),
                ),
                RdfStatement(
                    Iri("https://example.test/base/relative-target"),
                    Iri("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
                    Iri("http://www.w3.org/2002/07/owl#Class"),
                ),
                RdfStatement(
                    Iri("https://example.test/base/relative-target"),
                    Iri("http://www.w3.org/2000/01/rdf-schema#label"),
                    Literal("Base resolved target", Literal.RDF_LANG_STRING, "en"),
                ),
            )
    }

    @Test
    fun `Turtle parser uses caller base when the document has no base directive`() {
        val graph = parser.parse("<subject> <predicate> <object> .", Iri("https://example.test/caller/"))

        graph.statements shouldBe
            setOf(
                RdfStatement(
                    Iri("https://example.test/caller/subject"),
                    Iri("https://example.test/caller/predicate"),
                    Iri("https://example.test/caller/object"),
                ),
            )
    }

    @Test
    fun `Jena mapping preserves literal lexical form datatype language IRIs and blank node identity`() {
        val graph = parser.parse(resource("turtle/literals.ttl"))
        val values = graph.statements.map(RdfStatement::`object`)

        values.filterIsInstance<Literal>() shouldContainExactlyInAnyOrder
            listOf(
                Literal("Literal holder", Literal.RDF_LANG_STRING, "en"),
                Literal("plain text", Iri("http://www.w3.org/2001/XMLSchema#string")),
                Literal("hello", Literal.RDF_LANG_STRING, "en"),
                Literal("olá", Literal.RDF_LANG_STRING, "pt-BR"),
                Literal("typed text", Iri("http://www.w3.org/2001/XMLSchema#string")),
                Literal("quote: \"; slash: \\; newline: \n; tab: \t", Iri("http://www.w3.org/2001/XMLSchema#string")),
            )

        val blankGraph = parser.parse(resource("turtle/blank-nodes.ttl"))
        blankGraph.statements.map(RdfStatement::`object`).filterIsInstance<BlankNode>().distinct().size shouldBe 2
    }

    @Test
    fun `local SELECT preserves projection order unbound values and duplicate rows`() {
        val graph = parser.parse(resource("turtle/optional-unbound.ttl"))
        val result =
            execute(
                graph,
                """
                PREFIX ex: <https://example.test/optional/>
                SELECT ?label ?item WHERE {
                  ?item a <http://www.w3.org/2002/07/owl#Class> .
                  OPTIONAL { ?item <http://www.w3.org/2000/01/rdf-schema#label> ?label }
                }
                """.trimIndent(),
            ) as SparqlSelectResult

        result.projectedVariables shouldBe listOf(SparqlVariable("label"), SparqlVariable("item"))
        result.rows.any {
            it.binding(SparqlVariable("label")) == UnboundSparqlBinding(SparqlVariable("label"))
        } shouldBe true
        result.rows.forEach { row ->
            (row.binding(SparqlVariable("item")) is BoundSparqlBinding) shouldBe true
        }

        val duplicates =
            execute(
                graph,
                "PREFIX ex: <https://example.test/optional/> SELECT ?item WHERE { VALUES ?item { ex:one ex:one } }",
            ) as SparqlSelectResult
        duplicates.rows.size shouldBe 2
    }

    @Test
    fun `local SELECT only applies an ordering when the query asks for one`() {
        val graph = parser.parse(resource("turtle/ordering.ttl"))
        val result =
            execute(
                graph,
                """
                PREFIX ex: <https://example.test/order/>
                SELECT ?rank WHERE { ?item ex:score ?rank } ORDER BY DESC(?rank)
                """.trimIndent(),
            ) as SparqlSelectResult

        result.rows.map { (it.binding(SparqlVariable("rank")) as BoundSparqlBinding).value } shouldBe
            listOf(
                Literal("3", Iri("http://www.w3.org/2001/XMLSchema#integer")),
                Literal("2", Iri("http://www.w3.org/2001/XMLSchema#integer")),
                Literal("1", Iri("http://www.w3.org/2001/XMLSchema#integer")),
            )
    }

    @Test
    fun `graph comparison is semantic and formatter follows the captured C sharp policy`() {
        val left =
            RdfGraph(
                setOf(
                    RdfStatement(BlankNode("left"), Iri("https://example.test/p"), Literal("value")),
                ),
            )
        val right =
            RdfGraph(
                setOf(
                    RdfStatement(BlankNode("right"), Iri("https://example.test/p"), Literal("value")),
                ),
            )
        JenaRdfGraphComparator().areIsomorphic(left, right) shouldBe true

        val formatter = DotNetRdfValueFormatter()
        formatter.format(Iri("https://example.test/item")) shouldBe "<https://example.test/item>"
        formatter.format(
            Iri("https://example.test/item"),
            removeIriDelimiters = true,
        ) shouldBe "https://example.test/item"
        formatter.format(BlankNode("private-id")) shouldBe "blank"
        formatter.format(Literal("olá", Literal.RDF_LANG_STRING, "pt-BR")) shouldBe "olá"
    }

    @Test
    fun `parser and query failures retain diagnostics instead of exposing Jena exceptions directly`() {
        val parseFailure =
            assertFailsWith<TurtleParsingFailure> {
                parser.parse(resource("turtle/invalid-unclosed-string.ttl"))
            }
        parseFailure.diagnostic.isNotBlank() shouldBe true

        val queryFailure =
            assertFailsWith<com.example.sparqlqueryeasy.domain.model.SparqlQueryExecutionFailure> {
                execute(parser.parse(resource("turtle/simple.ttl")), "SELECT WHERE { ?s ?p ?o }")
            }
        queryFailure.diagnostic.isNotBlank() shouldBe true
    }

    private fun resource(path: String): String =
        requireNotNull(javaClass.classLoader.getResourceAsStream(path)).bufferedReader().use { it.readText() }

    private fun execute(
        graph: RdfGraph,
        query: String,
    ): com.example.sparqlqueryeasy.domain.model.SparqlResult = runSuspend { executor.execute(graph, query) }
}

private fun <T> runSuspend(block: suspend () -> T): T {
    var result: Result<T>? = null
    block.startCoroutine(
        object : Continuation<T> {
            override val context = EmptyCoroutineContext

            override fun resumeWith(resumeResult: Result<T>) {
                result = resumeResult
            }
        },
    )
    return requireNotNull(result).getOrThrow()
}

@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.application.query

import com.example.sparqlqueryeasy.application.endpoints.RemoteSparqlEndpoint
import com.example.sparqlqueryeasy.application.endpoints.RemoteSparqlEndpointContext
import com.example.sparqlqueryeasy.application.endpoints.UploadedGraphEndpointContext
import com.example.sparqlqueryeasy.application.endpoints.WikidataEndpointContext
import com.example.sparqlqueryeasy.application.relationships.EndpointExecution
import com.example.sparqlqueryeasy.domain.model.BlankNode
import com.example.sparqlqueryeasy.domain.model.BoundSparqlBinding
import com.example.sparqlqueryeasy.domain.model.Iri
import com.example.sparqlqueryeasy.domain.model.Literal
import com.example.sparqlqueryeasy.domain.model.RdfGraphHandle
import com.example.sparqlqueryeasy.domain.model.RdfValue
import com.example.sparqlqueryeasy.domain.model.SparqlQueryExecutionFailure
import com.example.sparqlqueryeasy.domain.model.SparqlResultRow
import com.example.sparqlqueryeasy.domain.model.SparqlSelectResult
import com.example.sparqlqueryeasy.domain.model.SparqlVariable
import com.example.sparqlqueryeasy.domain.model.UnboundSparqlBinding
import com.example.sparqlqueryeasy.rdf.jena.JenaGraphEndpointExecution
import com.example.sparqlqueryeasy.rdf.jena.JenaSparqlSyntaxValidator
import com.example.sparqlqueryeasy.rdf.jena.JenaTurtleParser
import com.example.sparqlqueryeasy.wikidata.query.CSharpCompatibleWikidataQueryGenerator
import com.example.sparqlqueryeasy.wikidata.query.IriBindingValue
import com.example.sparqlqueryeasy.wikidata.query.IriTerm
import com.example.sparqlqueryeasy.wikidata.query.LiteralBindingValue
import com.example.sparqlqueryeasy.wikidata.query.LiteralObject
import com.example.sparqlqueryeasy.wikidata.query.Maximum
import com.example.sparqlqueryeasy.wikidata.query.QueryVariable
import com.example.sparqlqueryeasy.wikidata.query.StageBinding
import com.example.sparqlqueryeasy.wikidata.query.StageBindingValue
import com.example.sparqlqueryeasy.wikidata.query.TermObject
import com.example.sparqlqueryeasy.wikidata.query.TriplePattern
import com.example.sparqlqueryeasy.wikidata.query.VariableTerm
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Test

class StageQueryServiceTest {
    private val service = StageQueryService(CSharpCompatibleWikidataQueryGenerator(), JenaSparqlSyntaxValidator())

    private val graph =
        JenaTurtleParser().parse(
            """
            @prefix ex: <https://example.test/> .
            @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
            @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
            ex:gremio ex:city ex:portoAlegre ; ex:founded 1903 ; ex:name "Grêmio"@pt ; ex:nick "Tricolor" ; ex:playsIn ex:serieA ; rdfs:label "Gremio"@en .
            ex:inter ex:city ex:portoAlegre ; ex:founded 1909 ; ex:name "Internacional"@pt ; ex:nick "Colorado" ; ex:playsIn ex:serieA .
            ex:santos ex:city ex:santosCity ; ex:founded 1912 ; ex:playsIn ex:serieB ; ex:ground [ ex:size 10 ] .
            ex:portoAlegre rdfs:label "Porto Alegre"@en .
            """.trimIndent(),
        )
    private val local =
        UploadedGraphEndpointContext(
            "00000000-0000-0000-0000-000000000010",
            RdfGraphHandle("00000000-0000-0000-0000-000000000010"),
            graph,
            JenaGraphEndpointExecution(graph),
        )

    @Test
    fun `first stage lists distinct typed candidates ordered by term with labels`() =
        runBlocking<Unit> {
            val result = service.execute(request("city", listOf(pattern("?team", "city", "?city"))), local) as StageQueryResult.Success

            result.page.candidates shouldBe
                listOf(
                    StageCandidate(Iri("https://example.test/portoAlegre"), "Porto Alegre"),
                    StageCandidate(Iri("https://example.test/santosCity"), null),
                )
            result.page.hasMore shouldBe false
            result.query.contains("GROUP BY ?city") shouldBe true
        }

    @Test
    fun `IRI binding in object position constrains the next variable`() =
        runBlocking<Unit> {
            val result =
                service.execute(
                    request(
                        "team",
                        listOf(pattern("?team", "city", "?city")),
                        listOf(StageBinding(QueryVariable("city"), IriBindingValue(IriTerm("https://example.test/portoAlegre")))),
                    ),
                    local,
                ) as StageQueryResult.Success

            result.page.candidates.map(StageCandidate::value) shouldBe
                listOf(Iri("https://example.test/gremio"), Iri("https://example.test/inter"))
            result.page.candidates.first().label shouldBe "Gremio"
        }

    @Test
    fun `predicate binding constrains the subject through the variable predicate`() =
        runBlocking<Unit> {
            val serieA =
                TriplePattern(
                    VariableTerm(QueryVariable("team")),
                    VariableTerm(QueryVariable("p")),
                    TermObject(IriTerm("https://example.test/serieA")),
                )

            teams(serieA, "p", IriBindingValue(IriTerm("https://example.test/playsIn"))) shouldBe
                listOf(gremio, Iri("https://example.test/inter"))
        }

    @Test
    fun `typed and language literal bindings match exact RDF terms`() =
        runBlocking<Unit> {
            val xsd = "http://www.w3.org/2001/XMLSchema#"

            teams(pattern("?team", "founded", "?year"), "year", LiteralBindingValue("1903", IriTerm("${xsd}integer"))) shouldBe
                listOf(gremio)
            teams(pattern("?team", "name", "?name"), "name", LiteralBindingValue("Grêmio", language = "pt")) shouldBe listOf(gremio)
            teams(pattern("?team", "name", "?name"), "name", LiteralBindingValue("Grêmio", language = "en")) shouldBe emptyList()
            teams(pattern("?team", "nick", "?nick"), "nick", LiteralBindingValue("Tricolor", IriTerm("${xsd}string"))) shouldBe
                listOf(gremio)
        }

    private val gremio = Iri("https://example.test/gremio")

    private suspend fun teams(
        pattern: TriplePattern,
        boundVariable: String,
        value: StageBindingValue,
    ): List<RdfValue> {
        val result =
            service.execute(
                request("team", listOf(pattern), listOf(StageBinding(QueryVariable(boundVariable), value))),
                local,
            ) as StageQueryResult.Success
        return result.page.candidates.map(StageCandidate::value)
    }

    @Test
    fun `literal candidates keep datatype and language and blank nodes are returned as terms`() =
        runBlocking<Unit> {
            val years = service.execute(request("year", listOf(pattern("?team", "founded", "?year"))), local) as StageQueryResult.Success
            val names = service.execute(request("name", listOf(pattern("?team", "name", "?name"))), local) as StageQueryResult.Success
            val grounds =
                service.execute(
                    request("ground", listOf(pattern("?team", "ground", "?ground"))),
                    local,
                ) as StageQueryResult.Success

            years.page.candidates.map(StageCandidate::value) shouldBe
                listOf("1903", "1909", "1912").map { Literal(it, Iri("http://www.w3.org/2001/XMLSchema#integer")) }
            names.page.candidates.map(StageCandidate::value).toSet() shouldBe
                setOf(Literal("Grêmio", Literal.RDF_LANG_STRING, "pt"), Literal("Internacional", Literal.RDF_LANG_STRING, "pt"))
            (grounds.page.candidates.single().value is BlankNode) shouldBe true
        }

    @Test
    fun `offset paging reports hasMore from one extra row`() =
        runBlocking<Unit> {
            val first =
                service.execute(
                    request("year", listOf(pattern("?team", "founded", "?year")), limit = 2),
                    local,
                ) as StageQueryResult.Success
            val second =
                service.execute(
                    request("year", listOf(pattern("?team", "founded", "?year")), limit = 2, offset = 2),
                    local,
                ) as StageQueryResult.Success

            first.page.candidates.map { (it.value as Literal).lexicalForm } shouldBe listOf("1903", "1909")
            first.page.hasMore shouldBe true
            first.query.contains("LIMIT 3\nOFFSET 0") shouldBe true
            second.page.candidates.map { (it.value as Literal).lexicalForm } shouldBe listOf("1912")
            second.page.hasMore shouldBe false
        }

    @Test
    fun `literal binding text cannot inject SPARQL`() =
        runBlocking<Unit> {
            val execution = RecordingExecution(select())
            val result =
                service.execute(
                    request(
                        "team",
                        listOf(pattern("?team", "nick", "?nick")),
                        listOf(StageBinding(QueryVariable("nick"), LiteralBindingValue("x\") } UNION { ?team ?p ?o } #"))),
                    ),
                    remote(execution),
                ) as StageQueryResult.Success

            result.page.candidates shouldBe emptyList()
            execution.queries.single().contains("VALUES (?nick) { (\"x\\\") } UNION { ?team ?p ?o } #\") }") shouldBe true
        }

    @Test
    fun `unbound rows are dropped and duplicate terms collapse`() =
        runBlocking<Unit> {
            val item = Iri("https://example.test/item")
            val execution = RecordingExecution(select(item to "Item", null to null, item to "Other"))

            val result =
                service.execute(
                    request("team", listOf(pattern("?team", "city", "?city"))),
                    remote(execution),
                ) as StageQueryResult.Success

            result.page.candidates shouldBe listOf(StageCandidate(item, "Item"))
        }

    @Test
    fun `Wikidata endpoints also request direct-claim predicate labels`() =
        runBlocking<Unit> {
            val execution = RecordingExecution(select())
            service.execute(
                request(
                    "p",
                    listOf(
                        TriplePattern(
                            VariableTerm(QueryVariable("s")),
                            VariableTerm(QueryVariable("p")),
                            TermObject(VariableTerm(QueryVariable("o"))),
                        ),
                    ),
                ),
                WikidataEndpointContext(RemoteSparqlEndpoint.parse("https://query.wikidata.org/sparql"), execution),
            )

            execution.queries.single().contains("?__stageClaim wikibase:directClaim ?p") shouldBe true
        }

    @Test
    fun `invalid requests are rejected before execution`() =
        runBlocking<Unit> {
            val execution = RecordingExecution(select())
            val endpoint = remote(execution)
            val base = listOf(pattern("?team", "city", "?city"))
            val cityIri = IriBindingValue(IriTerm("https://example.test/portoAlegre"))

            listOf(
                request("team", emptyList()),
                request("team", base, limit = 0),
                request("team", base, limit = 51),
                request("team", base, offset = -1),
                request("team", base, offset = 10_001),
                request("missing", base),
                request("team", base, listOf(StageBinding(QueryVariable("team"), cityIri))),
                request("team", base, listOf(StageBinding(QueryVariable("other"), cityIri))),
                request("team", base, List(2) { StageBinding(QueryVariable("city"), cityIri) }),
                request("__stageLabel", listOf(pattern("?__stageLabel", "city", "?city"))),
                request(
                    "team",
                    listOf(
                        TriplePattern(
                            VariableTerm(QueryVariable("team")),
                            IriTerm("https://example.test/founded"),
                            LiteralObject("1"),
                            Maximum,
                        ),
                    ),
                ),
            ).forEach { invalid ->
                (service.execute(invalid, endpoint) is StageQueryResult.InvalidInput) shouldBe true
            }
            execution.queries shouldBe emptyList()
        }

    @Test
    fun `execution failures are reported without losing the generated query`() =
        runBlocking<Unit> {
            val execution = RecordingExecution { throw SparqlQueryExecutionFailure("query", "fake upstream failure") }

            val result = service.execute(request("city", listOf(pattern("?team", "city", "?city"))), remote(execution))

            (result as StageQueryResult.ExecutionFailure).diagnostic.contains("fake upstream failure") shouldBe true
        }

    private fun request(
        variable: String,
        patterns: List<TriplePattern>,
        bindings: List<StageBinding> = emptyList(),
        limit: Int = 20,
        offset: Int = 0,
    ) = StageQueryRequest(QueryVariable(variable), patterns, bindings, limit, offset)

    private fun pattern(
        subject: String,
        predicate: String,
        objectVariable: String,
    ) = TriplePattern(
        VariableTerm(QueryVariable(subject.removePrefix("?"))),
        IriTerm("https://example.test/$predicate"),
        TermObject(VariableTerm(QueryVariable(objectVariable.removePrefix("?")))),
    )

    private fun remote(execution: EndpointExecution) =
        RemoteSparqlEndpointContext(RemoteSparqlEndpoint.parse("https://example.test/sparql"), execution)

    private fun select(vararg rows: Pair<RdfValue?, String?>): SparqlSelectResult {
        val team = SparqlVariable("team")
        val label = SparqlVariable("__stageLabelOut")
        return SparqlSelectResult(
            listOf(team, label),
            rows.map { (value, text) ->
                SparqlResultRow(
                    listOf(
                        value?.let { BoundSparqlBinding(team, it) } ?: UnboundSparqlBinding(team),
                        text?.let { BoundSparqlBinding(label, Literal(it)) } ?: UnboundSparqlBinding(label),
                    ),
                )
            },
        )
    }

    private class RecordingExecution(
        private val response: suspend (String) -> SparqlSelectResult,
    ) : EndpointExecution {
        constructor(response: SparqlSelectResult) : this({ response })

        val queries = mutableListOf<String>()
        override val isLocal: Boolean = false
        override val isWikidata: Boolean = false

        override suspend fun execute(query: String): SparqlSelectResult {
            queries += query
            return response(query)
        }
    }
}

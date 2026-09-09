package com.example.sparqlqueryeasy.wikidata.query

import io.kotest.matchers.shouldBe
import org.apache.jena.query.QueryFactory
import org.junit.jupiter.api.Test
import kotlin.test.assertFailsWith

class WikidataQueryGeneratorTest {
    private val generator = CSharpCompatibleWikidataQueryGenerator()

    @Test
    fun `WIKIDATA-GENERATION-001 has a stable C sharp compatible snapshot and parses`() {
        val query =
            generator.generate(
                GeneralSelectQuery(
                    variable = QueryVariable("property"),
                    patterns =
                        listOf(
                            TriplePattern(
                                WikidataEntityId("Q42").asIri(),
                                VariableTerm(QueryVariable("property")),
                                AnyBlankNode,
                            ),
                        ),
                    limit = 20,
                ),
            )

        query shouldBe
            """
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX owl: <http://www.w3.org/2002/07/owl#>
            PREFIX wikibase: <http://wikiba.se/ontology#>
            SELECT DISTINCT ?property ?propertyLabel ?propertyRdfType ?propertyType
            WHERE {
            <https://www.wikidata.org/entity/Q42> ?property [] .
            ?property rdf:type ?propertyRdfType .
            OPTIONAL {
            ?propertyClaim wikibase:directClaim ?property .
            ?propertyClaim rdfs:label ?propertyLabel .
            FILTER (lang(?propertyLabel) = "en")
            }
            }
            LIMIT 20

            """.trimIndent()
        parses(query)
    }

    @Test
    fun `multiple properties preserve input order and optional label blocks`() {
        val query =
            generator.generate(
                GeneralSelectQuery(
                    QueryVariable("item"),
                    listOf(
                        TriplePattern(
                            VariableTerm(QueryVariable("item")),
                            WikidataPropertyId("P31").directClaim(),
                            TermObject(WikidataEntityId("Q5").asIri()),
                        ),
                        TriplePattern(
                            VariableTerm(QueryVariable("item")),
                            WikidataPropertyId("P279").directClaim(),
                            TermObject(WikidataEntityId("Q35120").asIri()),
                        ),
                    ),
                    limit = 2,
                ),
            )

        (query.indexOf("P31") < query.indexOf("P279")) shouldBe true
        Regex("""OPTIONAL \{""").findAll(query).count() shouldBe 2
        parses(query)
    }

    @Test
    fun `filters ordering and escaped values are deterministic and syntactically safe`() {
        val starts = literalQuery(StartsWith("a\"b\n"))
        starts.contains("STRSTARTS(STR(?literalValue0), \"a\\\"b\\n\")") shouldBe true
        parses(starts)
        parses(literalQuery(Contains("text")))
        parses(literalQuery(GreaterOrEqual("7")))
        parses(literalQuery(LessOrEqual("7.5")))

        val maximum = literalQuery(Maximum)
        maximum.contains("ORDER BY DESC(?literalValue0)\nLIMIT 1") shouldBe true
        parses(maximum)
        val minimum = literalQuery(Minimum)
        minimum.contains("ORDER BY ASC(?literalValue0)\nLIMIT 1") shouldBe true
        parses(minimum)
    }

    @Test
    fun `language selection and every EndpointService query form parse`() {
        val display =
            generator.generate(
                DisplaySelectQuery(
                    QueryVariable("item"),
                    listOf(
                        TriplePattern(
                            VariableTerm(QueryVariable("item")),
                            WikidataPropertyId("P31").directClaim(),
                            TermObject(WikidataEntityId("Q5").asIri()),
                        ),
                    ),
                    20,
                ),
            )
        display.contains("FILTER (lang(?itemLabel) = \"en\")") shouldBe true
        parses(display)
        parses(generator.generate(RelationshipQuery(WikidataEntityId("Q42"))))
        parses(
            generator.generate(
                RelationshipValueQuery(
                    WikidataEntityId("Q42").asIri(),
                    PropertyPath(listOf(WikidataPropertyId("P31"), WikidataPropertyId("P279"))),
                    false,
                ),
            ),
        )
        parses(
            generator.generate(
                RelationshipValueQuery(
                    WikidataEntityId("Q42").asIri(),
                    WikidataPropertyId("P31").directClaim(),
                    true,
                ),
            ),
        )
        parses(generator.generate(SearchSelectQuery("football", 20, isLocal = false)))
        parses(generator.generate(SearchSelectQuery("football", 20, isLocal = true)))
    }

    @Test
    fun `empty collections preserve C sharp empty where behavior`() {
        val general = generator.generate(GeneralSelectQuery(QueryVariable("item"), emptyList(), 0))
        general.contains("?item ?p ?o .") shouldBe true
        general.contains("?itemParentType") shouldBe true
        general.endsWith("LIMIT 0\n") shouldBe true
        parses(general)

        val display = generator.generate(DisplaySelectQuery(QueryVariable("item"), emptyList(), 0))
        display.contains("WHERE {\n}\nLIMIT 0") shouldBe true
        parses(display)
    }

    @Test
    fun `invalid identifiers values and unsafe filter placement are rejected before query construction`() {
        assertFailsWith<IllegalArgumentException> { WikidataEntityId("Q42; DROP ALL") }
        assertFailsWith<IllegalArgumentException> { WikidataPropertyId("P0") }
        assertFailsWith<IllegalArgumentException> { QueryVariable("item } ?s ?p ?o") }
        assertFailsWith<IllegalArgumentException> { GreaterOrEqual("7; DROP ALL") }
        assertFailsWith<IllegalArgumentException> {
            TriplePattern(
                WikidataEntityId("Q42").asIri(),
                WikidataPropertyId("P31").directClaim(),
                TermObject(WikidataEntityId("Q5").asIri()),
                StartsWith("x"),
            )
        }
    }

    private fun literalQuery(filter: QueryFilter): String =
        generator.generate(
            GeneralSelectQuery(
                QueryVariable("item"),
                listOf(
                    TriplePattern(
                        VariableTerm(QueryVariable("item")),
                        WikidataPropertyId("P31").directClaim(),
                        LiteralObject("value"),
                        filter,
                    ),
                ),
                20,
            ),
        )

    private fun parses(query: String) {
        QueryFactory.create(query)
    }
}

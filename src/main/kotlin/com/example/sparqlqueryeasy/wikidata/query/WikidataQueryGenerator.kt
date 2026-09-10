package com.example.sparqlqueryeasy.wikidata.query

import java.math.BigDecimal
import java.net.URI

sealed interface WikidataQuery

data class WikidataEntityId(val value: String) {
    init {
        require(Regex("Q[1-9][0-9]*").matches(value)) { "Invalid Wikidata entity identifier: $value" }
    }

    fun asIri(): IriTerm = IriTerm("https://www.wikidata.org/entity/$value")
}

data class WikidataPropertyId(val value: String) {
    init {
        require(Regex("P[1-9][0-9]*").matches(value)) { "Invalid Wikidata property identifier: $value" }
    }

    fun directClaim(): IriTerm = IriTerm("https://www.wikidata.org/prop/direct/$value")
}

data class QueryVariable(val name: String) {
    init {
        require(Regex("[A-Za-z_][A-Za-z0-9_]*").matches(name)) { "Invalid SPARQL variable name: $name" }
    }

    fun render(): String = "?$name"
}

sealed interface QueryTerm {
    fun render(): String
}

data class IriTerm(val value: String) : QueryTerm {
    init {
        val parsed =
            try {
                URI(value)
            } catch (exception: java.net.URISyntaxException) {
                throw IllegalArgumentException("Invalid query IRI: $value", exception)
            }
        require(parsed.isAbsolute && parsed.fragment == null && !value.any(Char::isWhitespace)) {
            "Invalid query IRI: $value"
        }
    }

    override fun render(): String = "<$value>"
}

data class VariableTerm(val variable: QueryVariable) : QueryTerm {
    override fun render(): String = variable.render()
}

data class PropertyPath(val properties: List<WikidataPropertyId>) : QueryTerm {
    init {
        require(properties.isNotEmpty()) { "A property path must contain at least one property" }
    }

    override fun render(): String = properties.joinToString("/") { it.directClaim().render() }
}

/** A validated sequence of full IRIs for the legacy request form `<iri>/<iri>`. */
data class IriSequencePath(val segments: List<IriTerm>) : QueryTerm {
    init {
        require(segments.size >= 2) { "An IRI sequence path must contain at least two segments" }
    }

    override fun render(): String = segments.joinToString("/") { it.render() }
}

sealed interface QueryObject {
    fun render(): String
}

data class TermObject(val term: QueryTerm) : QueryObject {
    override fun render(): String = term.render()
}

data object AnyBlankNode : QueryObject {
    override fun render(): String = "[]"
}

data class LiteralObject(val value: String) : QueryObject {
    override fun render(): String = "\"${value.escapeSparqlString()}\""
}

sealed interface QueryFilter

data class StartsWith(val value: String) : QueryFilter

data class Contains(val value: String) : QueryFilter

data class GreaterOrEqual(val value: String) : QueryFilter {
    init {
        numeric(value)
    }
}

data class LessOrEqual(val value: String) : QueryFilter {
    init {
        numeric(value)
    }
}

data object Maximum : QueryFilter

data object Minimum : QueryFilter

private fun numeric(value: String) {
    require(Regex("[+-]?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?").matches(value)) {
        "Invalid numeric filter value: $value"
    }
    BigDecimal(value)
}

data class TriplePattern(
    val subject: QueryTerm,
    val predicate: QueryTerm,
    val `object`: QueryObject,
    val filter: QueryFilter? = null,
) {
    init {
        require(filter == null || `object` is LiteralObject) { "Filters require a literal object" }
    }
}

data class GeneralSelectQuery(
    val variable: QueryVariable,
    val patterns: List<TriplePattern>,
    val limit: Int,
    val useWikidataLabels: Boolean = true,
    val useWikidataPrefixes: Boolean = useWikidataLabels,
) : WikidataQuery {
    init {
        require(limit >= 0) { "LIMIT must not be negative" }
    }
}

data class DisplaySelectQuery(
    val variable: QueryVariable,
    val patterns: List<TriplePattern>,
    val limit: Int,
    val useWikidataPrefixes: Boolean = true,
) : WikidataQuery {
    init {
        require(limit >= 0) { "LIMIT must not be negative" }
    }
}

data class RelationshipQuery(
    val subject: QueryTerm,
    val useWikidataLabels: Boolean = true,
) : WikidataQuery {
    constructor(entity: WikidataEntityId) : this(entity.asIri(), true)
}

data class RelationshipValueQuery(
    val subject: QueryTerm,
    val predicate: QueryTerm,
    val isLiteral: Boolean,
    val useWikidataPrefixes: Boolean = true,
) : WikidataQuery

data class SearchSelectQuery(val search: String, val limit: Int, val isLocal: Boolean) : WikidataQuery {
    init {
        require(limit >= 0) { "LIMIT must not be negative" }
    }
}

interface WikidataQueryGenerator {
    fun generate(input: WikidataQuery): String
}

/** Deterministic C# SparqlQueryBuilder equivalent; literals are escaped and identifiers are typed. */
class CSharpCompatibleWikidataQueryGenerator : WikidataQueryGenerator {
    override fun generate(input: WikidataQuery): String =
        when (input) {
            is GeneralSelectQuery -> generalSelect(input)
            is DisplaySelectQuery -> displaySelect(input)
            is RelationshipQuery -> relationships(input)
            is RelationshipValueQuery -> relationshipValues(input)
            is SearchSelectQuery -> search(input)
        }

    private fun generalSelect(input: GeneralSelectQuery): String {
        val variable = input.variable.render()
        return QueryText(input.useWikidataPrefixes).apply {
            line("SELECT DISTINCT $variable ${variable}Label ${variable}RdfType ${variable}Type")
            line("WHERE {")
            if (input.patterns.isEmpty()) {
                line("$variable ?p ?o .")
                rdfType(variable)
                label(variable, input.useWikidataLabels)
                parentType(variable)
            } else {
                input.patterns.forEachIndexed { index, pattern ->
                    pattern(pattern, index)
                    rdfType(variable)
                    label(variable, input.useWikidataLabels)
                }
            }
            finishWhere()
            limit(input.limit)
        }.build()
    }

    private fun displaySelect(input: DisplaySelectQuery): String {
        val variable = input.variable.render()
        return QueryText(input.useWikidataPrefixes).apply {
            line("SELECT DISTINCT $variable ${variable}Label")
            line("WHERE {")
            input.patterns.forEachIndexed { index, pattern ->
                pattern(pattern, index)
                label(variable, false)
            }
            finishWhere()
            limit(input.limit)
        }.build()
    }

    private fun relationships(input: RelationshipQuery): String =
        QueryText(input.useWikidataLabels).apply {
            line("SELECT DISTINCT ?property ?propertyLabel ?propertyType")
            line("WHERE {")
            line("${input.subject.render()} ?property [] .")
            label("?property", input.useWikidataLabels)
            propertyType("?property")
            finishWhere()
        }.build()

    private fun relationshipValues(input: RelationshipValueQuery): String =
        QueryText(input.useWikidataPrefixes).apply {
            line("SELECT DISTINCT ?property ?propertyLabel")
            line("WHERE {")
            line("${input.subject.render()} ${input.predicate.render()} ?property .")
            if (!input.isLiteral) label("?property", false)
            finishWhere()
        }.build()

    private fun search(input: SearchSelectQuery): String =
        QueryText(false).apply {
            line("SELECT DISTINCT ?property ?propertyLabel ?propertyParentType")
            line("WHERE {")
            label("?property", false)
            parentType("?property")
            if (!input.isLocal) {
                line("FILTER (STRSTARTS(STR(?propertyLabel), \"${input.search.escapeSparqlString()}\"))")
            }
            finishWhere()
            if (!input.isLocal) limit(input.limit)
        }.build()

    private class QueryText(wikidata: Boolean) {
        private val lines =
            mutableListOf(
                "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>",
                "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>",
                "PREFIX owl: <http://www.w3.org/2002/07/owl#>",
            )
        private var orderBy: String? = null

        init {
            if (wikidata) lines += "PREFIX wikibase: <http://wikiba.se/ontology#>"
        }

        fun line(value: String) {
            lines += value
        }

        fun pattern(
            pattern: TriplePattern,
            index: Int,
        ) {
            if (pattern.`object` !is LiteralObject) {
                line("${pattern.subject.render()} ${pattern.predicate.render()} ${pattern.`object`.render()} .")
                return
            }
            val literal = "?literalValue$index"
            line("${pattern.subject.render()} ${pattern.predicate.render()} $literal .")
            when (val filter = pattern.filter) {
                null -> line("FILTER (str($literal) = ${pattern.`object`.render()}) .")
                is StartsWith -> line("FILTER (STRSTARTS(STR($literal), \"${filter.value.escapeSparqlString()}\"))")
                is Contains -> line("FILTER (CONTAINS(STR($literal), \"${filter.value.escapeSparqlString()}\"))")
                is GreaterOrEqual -> line("FILTER ($literal >= ${filter.value})")
                is LessOrEqual -> line("FILTER ($literal <= ${filter.value})")
                Maximum -> orderBy = "ORDER BY DESC($literal)"
                Minimum -> orderBy = "ORDER BY ASC($literal)"
            }
        }

        fun rdfType(variable: String) = line("$variable rdf:type ${variable}RdfType .")

        fun label(
            variable: String,
            wikidataLabels: Boolean,
        ) {
            line("OPTIONAL {")
            if (wikidataLabels) {
                line("${variable}Claim wikibase:directClaim $variable .")
                line("${variable}Claim rdfs:label ${variable}Label .")
            } else {
                line("$variable rdfs:label ${variable}Label .")
            }
            line("FILTER (lang(${variable}Label) = \"en\")")
            line("}")
        }

        fun parentType(variable: String) =
            line(
                listOf(
                    "BIND(IF(EXISTS { $variable rdf:type ?parentClass . ?parentClass rdf:type owl:Class },",
                    "\"objetoClasse\", \"outro\") AS ${variable}ParentType)",
                ).joinToString(" "),
            )

        fun propertyType(variable: String) =
            line(
                listOf(
                    "BIND(IF(EXISTS { $variable rdf:type owl:ObjectProperty }, \"objeto\",",
                    "IF(EXISTS { $variable rdf:type owl:DatatypeProperty }, \"label\", \"outro\"))",
                    "AS ${variable}Type)",
                ).joinToString(" "),
            )

        fun finishWhere() {
            line("}")
            orderBy?.let(::line)
        }

        fun limit(limit: Int) = line("LIMIT ${if (orderBy == null) limit else 1}")

        fun build(): String = lines.joinToString("\n", postfix = "\n")
    }
}

private fun String.escapeSparqlString(): String =
    buildString {
        this@escapeSparqlString.forEach { character ->
            append(
                when (character) {
                    '\\' -> "\\\\"
                    '\"' -> "\\\""
                    '\n' -> "\\n"
                    '\r' -> "\\r"
                    '\t' -> "\\t"
                    else ->
                        if (character.code < 0x20) {
                            "\\u${character.code.toString(16).padStart(4, '0')}"
                        } else {
                            character
                        }
                },
            )
        }
    }

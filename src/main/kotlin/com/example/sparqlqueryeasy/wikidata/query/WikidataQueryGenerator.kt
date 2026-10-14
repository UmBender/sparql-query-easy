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
        require(parsed.isAbsolute && !value.any(Char::isWhitespace)) {
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

/** Both bounds inclusive (filterType 6, BE-003); one FILTER keeps them on the same value. */
data class Between(val minimum: String, val maximum: String) : QueryFilter {
    init {
        numeric(minimum)
        numeric(maximum)
        require(BigDecimal(minimum) <= BigDecimal(maximum)) { "Between minimum must not exceed maximum" }
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

/**
 * FE-034: a variable object restricted to literal values, rendered as `FILTER (isLiteral(?v) && …)`
 * after the patterns. Without [filter] and [exactValue] it keeps any literal; [exactValue] matches
 * the lexical form. Maximum/Minimum are not supported on a variable.
 */
data class VariableFilter(
    val variable: QueryVariable,
    val filter: QueryFilter? = null,
    val exactValue: String? = null,
) {
    init {
        require(filter == null || exactValue == null) { "A variable filter takes a filter or an exact value, not both" }
        require(filter != Maximum && filter != Minimum) {
            "Maximum and Minimum filters are not supported on a variable filter"
        }
    }
}

/** Each filtered variable is the object of a pattern and has one filter. */
private fun requireFilteredObjects(
    patterns: List<TriplePattern>,
    variableFilters: List<VariableFilter>,
) {
    val objects = patterns.mapNotNull { ((it.`object` as? TermObject)?.term as? VariableTerm)?.variable }.toSet()
    variableFilters.forEach { filter ->
        require(filter.variable in objects) {
            "Variable filter ${filter.variable.render()} must be the object of a where pattern"
        }
    }
    require(variableFilters.map(VariableFilter::variable).distinct().size == variableFilters.size) {
        "A variable may have only one variable filter"
    }
}

data class GeneralSelectQuery(
    val variable: QueryVariable,
    val patterns: List<TriplePattern>,
    val limit: Int,
    val useWikidataLabels: Boolean = true,
    val useWikidataPrefixes: Boolean = useWikidataLabels,
    val variableFilters: List<VariableFilter> = emptyList(),
) : WikidataQuery {
    init {
        require(limit >= 0) { "LIMIT must not be negative" }
        requireFilteredObjects(patterns, variableFilters)
    }
}

data class DisplaySelectQuery(
    val variable: QueryVariable,
    val patterns: List<TriplePattern>,
    val limit: Int,
    val useWikidataPrefixes: Boolean = true,
    val variableFilters: List<VariableFilter> = emptyList(),
) : WikidataQuery {
    init {
        require(limit >= 0) { "LIMIT must not be negative" }
        requireFilteredObjects(patterns, variableFilters)
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

/** A typed RDF term applied to a staged query through VALUES; never parsed from query text. */
sealed interface StageBindingValue {
    fun render(): String
}

data class IriBindingValue(val iri: IriTerm) : StageBindingValue {
    override fun render(): String = iri.render()
}

data class LiteralBindingValue(
    val lexicalForm: String,
    val datatype: IriTerm? = null,
    val language: String? = null,
) : StageBindingValue {
    init {
        language?.let { require(languageTag.matches(it)) { "Invalid language tag: $it" } }
        require(language == null || datatype == null) { "A language-tagged literal cannot declare a datatype" }
    }

    // RDF 1.1 treats a simple literal and xsd:string as the same term; plain form also matches RDF 1.0 stores.
    override fun render(): String {
        val quoted = "\"${lexicalForm.escapeSparqlString()}\""
        return when {
            language != null -> "$quoted@$language"
            datatype != null && datatype.value != XSD_STRING -> "$quoted^^${datatype.render()}"
            else -> quoted
        }
    }

    private companion object {
        const val XSD_STRING = "http://www.w3.org/2001/XMLSchema#string"
        val languageTag = Regex("[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*")
    }
}

data class StageBinding(
    val variable: QueryVariable,
    val value: StageBindingValue,
)

/** One bounded page of distinct values for [variable] under typed [bindings] (API-002). */
data class StageCandidateQuery(
    val variable: QueryVariable,
    val patterns: List<TriplePattern>,
    val bindings: List<StageBinding>,
    val limit: Int,
    val offset: Int,
    val useWikidataLabels: Boolean,
    val variableFilters: List<VariableFilter> = emptyList(),
) : WikidataQuery {
    init {
        require(patterns.isNotEmpty()) { "A staged query requires at least one pattern" }
        requireFilteredObjects(patterns, variableFilters)
        require(limit > 0) { "LIMIT must be positive" }
        require(offset >= 0) { "OFFSET must not be negative" }
        require(patterns.none { it.filter == Maximum || it.filter == Minimum }) {
            "Maximum and Minimum filters are not supported in staged exploration"
        }
    }
}

/**
 * Numeric values of [predicate] on [subject] under [patterns] (BE-003). [values] pages the
 * distinct entity/value pairs ordered by value; otherwise the query returns count, min and max.
 */
data class NumericProfileQuery(
    val subject: QueryTerm,
    val predicate: IriTerm,
    val patterns: List<TriplePattern>,
    val limit: Int,
    val useWikidataLabels: Boolean,
    val values: Boolean,
    val variableFilters: List<VariableFilter> = emptyList(),
) : WikidataQuery {
    init {
        requireFilteredObjects(patterns, variableFilters)
        require(limit > 0) { "LIMIT must be positive" }
        require(subject is VariableTerm || subject is IriTerm) { "subject must be a variable or an IRI" }
        require(patterns.none { it.filter == Maximum || it.filter == Minimum }) {
            "Maximum and Minimum filters are not supported in numeric profiles"
        }
    }
}

/** Number of distinct values of [variable] under [patterns] (FE-028 filter funnel). */
data class CountQuery(
    val variable: QueryVariable,
    val patterns: List<TriplePattern>,
    val variableFilters: List<VariableFilter> = emptyList(),
) : WikidataQuery {
    init {
        require(patterns.isNotEmpty()) { "A count requires at least one pattern" }
        requireFilteredObjects(patterns, variableFilters)
    }
}

interface WikidataQueryGenerator {
    fun generate(input: WikidataQuery): String
}

/** Default and allowed range of the row cap for queries with Maximum/Minimum filters (BE-004). */
const val DEFAULT_EXTREME_RESULT_LIMIT = 100
val EXTREME_RESULT_LIMIT_RANGE = 1..10_000

/**
 * Deterministic C# SparqlQueryBuilder equivalent; literals are escaped and identifiers are typed.
 * BE-004 departs from C# for Maximum/Minimum: they keep every row whose value equals the extreme
 * (ties included) instead of ordering with `LIMIT 1`, and [extremeResultLimit] caps those queries.
 */
class CSharpCompatibleWikidataQueryGenerator(
    private val extremeResultLimit: Int = DEFAULT_EXTREME_RESULT_LIMIT,
) : WikidataQueryGenerator {
    init {
        require(extremeResultLimit in EXTREME_RESULT_LIMIT_RANGE) {
            "The extreme result limit must be between ${EXTREME_RESULT_LIMIT_RANGE.first} and " +
                "${EXTREME_RESULT_LIMIT_RANGE.last}"
        }
    }

    override fun generate(input: WikidataQuery): String =
        when (input) {
            is GeneralSelectQuery -> generalSelect(input)
            is DisplaySelectQuery -> displaySelect(input)
            is RelationshipQuery -> relationships(input)
            is RelationshipValueQuery -> relationshipValues(input)
            is SearchSelectQuery -> search(input)
            is StageCandidateQuery -> stageCandidates(input)
            is NumericProfileQuery -> numericProfile(input)
            is CountQuery -> count(input)
        }

    private fun generalSelect(input: GeneralSelectQuery): String {
        val variable = input.variable.render()
        return QueryText(input.useWikidataPrefixes, extremeResultLimit).apply {
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
                variableFilterLines(input.variableFilters).forEach(::line)
                extremes(input.patterns, input.variableFilters) { rdfType(variable) }
            }
            finishWhere()
            limit(input.limit)
        }.build()
    }

    private fun displaySelect(input: DisplaySelectQuery): String {
        val variable = input.variable.render()
        return QueryText(input.useWikidataPrefixes, extremeResultLimit).apply {
            line("SELECT DISTINCT $variable ${variable}Label")
            line("WHERE {")
            input.patterns.forEachIndexed { index, pattern ->
                pattern(pattern, index)
                label(variable, false)
            }
            variableFilterLines(input.variableFilters).forEach(::line)
            extremes(input.patterns, input.variableFilters) {}
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

    private fun numericProfile(input: NumericProfileQuery): String =
        QueryText(input.useWikidataLabels).apply {
            if (input.values) {
                val label =
                    if (input.useWikidataLabels) {
                        "COALESCE(?__profileLabel, ?__profileClaimLabel)"
                    } else {
                        "?__profileLabel"
                    }
                line("SELECT ?__profileEntity ?__profileValue (SAMPLE($label) AS ?__profileLabelOut)")
            } else {
                line(
                    "SELECT (COUNT(*) AS ?__profileCount) (MIN(?__profileValue) AS ?__profileMin) " +
                        "(MAX(?__profileValue) AS ?__profileMax)",
                )
                line("WHERE {")
                line("SELECT DISTINCT ?__profileEntity ?__profileValue")
            }
            line("WHERE {")
            input.patterns.forEachIndexed { index, pattern -> pattern(pattern, index) }
            variableFilterLines(input.variableFilters).forEach(::line)
            line("${input.subject.render()} ${input.predicate.render()} ?__profileValue .")
            line("BIND(${input.subject.render()} AS ?__profileEntity)")
            line("FILTER (isNumeric(?__profileValue))")
            if (!input.values) {
                line("}")
                line("}")
                return@apply
            }
            line("OPTIONAL { ?__profileEntity rdfs:label ?__profileLabel . FILTER (lang(?__profileLabel) = \"en\") }")
            if (input.useWikidataLabels) {
                line(
                    "OPTIONAL { ?__profileClaim wikibase:directClaim ?__profileEntity . " +
                        "?__profileClaim rdfs:label ?__profileClaimLabel . " +
                        "FILTER (lang(?__profileClaimLabel) = \"en\") }",
                )
            }
            line("}")
            line("GROUP BY ?__profileEntity ?__profileValue")
            line("ORDER BY ?__profileValue ?__profileEntity")
            line("LIMIT ${input.limit}")
        }.build()

    private fun count(input: CountQuery): String =
        QueryText(false).apply {
            line("SELECT (COUNT(DISTINCT ${input.variable.render()}) AS ?__countValue)")
            line("WHERE {")
            input.patterns.forEachIndexed { index, pattern -> pattern(pattern, index) }
            variableFilterLines(input.variableFilters).forEach(::line)
            // Maximum/Minimum count every tied value (BE-004); a count has no LIMIT to cap.
            extremes(input.patterns, input.variableFilters) {}
            line("}")
        }.build()

    private fun stageCandidates(input: StageCandidateQuery): String {
        val variable = input.variable.render()
        return QueryText(input.useWikidataLabels).apply {
            val label =
                if (input.useWikidataLabels) "COALESCE(?__stageLabel, ?__stageClaimLabel)" else "?__stageLabel"
            line("SELECT $variable (SAMPLE($label) AS ?__stageLabelOut)")
            line("WHERE {")
            if (input.bindings.isNotEmpty()) {
                val names = input.bindings.joinToString(" ") { it.variable.render() }
                val values = input.bindings.joinToString(" ") { it.value.render() }
                line("VALUES ($names) { ($values) }")
            }
            input.patterns.forEachIndexed { index, pattern -> pattern(pattern, index) }
            variableFilterLines(input.variableFilters).forEach(::line)
            line("OPTIONAL { $variable rdfs:label ?__stageLabel . FILTER (lang(?__stageLabel) = \"en\") }")
            if (input.useWikidataLabels) {
                line(
                    "OPTIONAL { ?__stageClaim wikibase:directClaim $variable . " +
                        "?__stageClaim rdfs:label ?__stageClaimLabel . FILTER (lang(?__stageClaimLabel) = \"en\") }",
                )
            }
            line("}")
            line("GROUP BY $variable")
            line("ORDER BY $variable")
            // One extra row tells the caller whether another page exists.
            line("LIMIT ${input.limit + 1}")
            line("OFFSET ${input.offset}")
        }.build()
    }

    private class QueryText(
        wikidata: Boolean,
        private val extremeLimit: Int = DEFAULT_EXTREME_RESULT_LIMIT,
    ) {
        private val lines =
            mutableListOf(
                "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>",
                "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>",
                "PREFIX owl: <http://www.w3.org/2002/07/owl#>",
            )
        private var hasExtreme = false

        init {
            if (wikidata) lines += "PREFIX wikibase: <http://wikiba.se/ontology#>"
        }

        fun line(value: String) {
            lines += value
        }

        /** [constrained] false binds the literal without any value condition (inside an extreme subquery). */
        fun pattern(
            pattern: TriplePattern,
            index: Int,
            literal: String = "?literalValue$index",
            constrained: Boolean = true,
        ) {
            if (pattern.`object` !is LiteralObject) {
                line("${pattern.subject.render()} ${pattern.predicate.render()} ${pattern.`object`.render()} .")
                return
            }
            line("${pattern.subject.render()} ${pattern.predicate.render()} $literal .")
            if (!constrained) return
            when (val filter = pattern.filter) {
                null -> line("FILTER (str($literal) = ${pattern.`object`.render()}) .")
                Maximum, Minimum -> hasExtreme = true
                else -> line("FILTER (${filter.condition(literal)})")
            }
        }

        /**
         * BE-004: for each Maximum/Minimum literal, a subquery computes that relation's extreme over
         * the rest of the query, and only rows equal to it remain, so ties are all kept. Other
         * filters apply inside the subquery; other Maximum/Minimum relations only bind their value.
         */
        fun extremes(
            patterns: List<TriplePattern>,
            variableFilters: List<VariableFilter>,
            subjectConstraints: QueryText.() -> Unit,
        ) {
            patterns.forEachIndexed { index, target ->
                val function =
                    when (target.filter) {
                        Maximum -> "MAX"
                        Minimum -> "MIN"
                        else -> return@forEachIndexed
                    }
                val extreme = "?__extreme$index"
                line("{")
                line("SELECT ($function(?__extremeValue${index}_$index) AS $extreme)")
                line("WHERE {")
                patterns.forEachIndexed { other, pattern ->
                    val ownExtreme = pattern.filter == Maximum || pattern.filter == Minimum
                    pattern(pattern, other, "?__extremeValue${index}_$other", constrained = !ownExtreme)
                }
                variableFilterLines(variableFilters).forEach(::line)
                subjectConstraints()
                line("}")
                line("}")
                line("FILTER (?literalValue$index = $extreme)")
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

        /** Matches the multiline interpolated string emitted by C# AddVariableParentType. */
        fun parentType(variable: String) =
            line(
                "\n                BIND(IF(\n" +
                    "                    EXISTS {\n" +
                    "                        $variable rdf:type ?parentClass .\n" +
                    "                        ?parentClass rdf:type owl:Class\n" +
                    "                    },\n" +
                    "                    \"objetoClasse\",\n" +
                    "                    \"outro\"\n" +
                    "                ) AS ${variable}ParentType)\n" +
                    "            ",
            )

        fun propertyType(variable: String) =
            line(
                "BIND(IF(EXISTS { $variable rdf:type owl:ObjectProperty}, \"objeto\", " +
                    "IF(EXISTS {$variable rdf:type owl:DatatypeProperty}, \"label\", \"outro\")) as ${variable}Type)",
            )

        fun finishWhere() {
            line("}")
        }

        fun limit(limit: Int) = line("LIMIT ${if (hasExtreme) minOf(limit, extremeLimit) else limit}")

        fun build(): String = lines.joinToString("\n", postfix = "\n")
    }
}

/** FE-034: one FILTER per variable restricted to literals, written after the patterns it constrains. */
private fun variableFilterLines(filters: List<VariableFilter>): List<String> =
    filters.map { item ->
        val variable = item.variable.render()
        val condition =
            item.filter?.condition(variable)
                ?: item.exactValue?.let { "str($variable) = \"${it.escapeSparqlString()}\"" }
        val literal = "isLiteral($variable)"
        if (condition == null) "FILTER ($literal)" else "FILTER ($literal && $condition)"
    }

/** The row condition of a non-extreme filter on [term]. */
private fun QueryFilter.condition(term: String): String =
    when (this) {
        is StartsWith -> "STRSTARTS(STR($term), \"${value.escapeSparqlString()}\")"
        is Contains -> "CONTAINS(STR($term), \"${value.escapeSparqlString()}\")"
        is GreaterOrEqual -> "$term >= $value"
        is LessOrEqual -> "$term <= $value"
        is Between -> "$term >= $minimum && $term <= $maximum"
        Maximum, Minimum -> error("Maximum and Minimum have no row condition")
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

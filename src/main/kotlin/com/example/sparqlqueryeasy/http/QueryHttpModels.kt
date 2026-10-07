@file:Suppress("InstanceOfCheckForException", "MaxLineLength", "ThrowsCount", "TooManyFunctions")

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.query.NumericProfile
import com.example.sparqlqueryeasy.application.query.NumericProfileRequest
import com.example.sparqlqueryeasy.application.query.PROFILE_DEFAULT_LIMIT
import com.example.sparqlqueryeasy.application.query.PROFILE_MAX_LIMIT
import com.example.sparqlqueryeasy.application.query.PropertyResult
import com.example.sparqlqueryeasy.application.query.StageCandidatePage
import com.example.sparqlqueryeasy.application.query.StageQueryRequest
import com.example.sparqlqueryeasy.domain.model.BlankNode
import com.example.sparqlqueryeasy.domain.model.Iri
import com.example.sparqlqueryeasy.domain.model.Literal
import com.example.sparqlqueryeasy.domain.model.RdfValue
import com.example.sparqlqueryeasy.wikidata.query.AnyBlankNode
import com.example.sparqlqueryeasy.wikidata.query.Between
import com.example.sparqlqueryeasy.wikidata.query.Contains
import com.example.sparqlqueryeasy.wikidata.query.GreaterOrEqual
import com.example.sparqlqueryeasy.wikidata.query.IriBindingValue
import com.example.sparqlqueryeasy.wikidata.query.IriSequencePath
import com.example.sparqlqueryeasy.wikidata.query.IriTerm
import com.example.sparqlqueryeasy.wikidata.query.LessOrEqual
import com.example.sparqlqueryeasy.wikidata.query.LiteralBindingValue
import com.example.sparqlqueryeasy.wikidata.query.LiteralObject
import com.example.sparqlqueryeasy.wikidata.query.Maximum
import com.example.sparqlqueryeasy.wikidata.query.Minimum
import com.example.sparqlqueryeasy.wikidata.query.QueryFilter
import com.example.sparqlqueryeasy.wikidata.query.QueryObject
import com.example.sparqlqueryeasy.wikidata.query.QueryTerm
import com.example.sparqlqueryeasy.wikidata.query.QueryVariable
import com.example.sparqlqueryeasy.wikidata.query.StageBinding
import com.example.sparqlqueryeasy.wikidata.query.StageBindingValue
import com.example.sparqlqueryeasy.wikidata.query.StartsWith
import com.example.sparqlqueryeasy.wikidata.query.TermObject
import com.example.sparqlqueryeasy.wikidata.query.TriplePattern
import com.example.sparqlqueryeasy.wikidata.query.VariableTerm
import io.ktor.openapi.JsonSchema
import kotlinx.serialization.Serializable

internal const val DEFAULT_ENDPOINT_URL = "https://query.wikidata.org/sparql"
internal const val DEFAULT_LIMIT = 20

@Serializable
data class RelationshipsHttpRequest(
    @JsonSchema.Default("\"$DEFAULT_ENDPOINT_URL\"")
    val endpointUrl: String = DEFAULT_ENDPOINT_URL,
    @JsonSchema.Default("20")
    val limit: Int = DEFAULT_LIMIT,
    @JsonSchema.Default("\"<http://www.wikidata.org/entity/Q529207>\"")
    val id: String = "<http://www.wikidata.org/entity/Q529207>",
)

@Serializable
data class RelationshipValueHttpRequest(
    @JsonSchema.Default("\"$DEFAULT_ENDPOINT_URL\"")
    val endpointUrl: String = DEFAULT_ENDPOINT_URL,
    @JsonSchema.Default("20")
    val limit: Int = DEFAULT_LIMIT,
    val subjectId: String? = null,
    val predicateId: String? = null,
    @JsonSchema.Default("false")
    val isLiteral: Boolean = false,
)

@Serializable
data class SearchHttpRequest(
    @JsonSchema.Default("\"$DEFAULT_ENDPOINT_URL\"")
    val endpointUrl: String = DEFAULT_ENDPOINT_URL,
    @JsonSchema.Default("20")
    val limit: Int = DEFAULT_LIMIT,
    val search: String? = null,
)

@Serializable
data class GeneralQueryHttpRequest(
    @JsonSchema.Default("\"$DEFAULT_ENDPOINT_URL\"")
    val endpointUrl: String = DEFAULT_ENDPOINT_URL,
    @JsonSchema.Default("20")
    val limit: Int = DEFAULT_LIMIT,
    val where: List<WhereHttpRequest>? = null,
    val variableName: String? = null,
    @JsonSchema.Default("true")
    val ignoreWikidata: Boolean = true,
)

@Serializable
data class WhereHttpRequest(
    val subject: String? = null,
    val predicate: String? = null,
    val `object`: String? = null,
    @JsonSchema.Description(
        "Literal filter: 0 Starts, 1 Contains, 2 Greater/equal, 3 Lesser/equal, 4 Max, 5 Min, " +
            "6 Between (object min..max, both inclusive).",
    )
    @JsonSchema.Enum("0", "1", "2", "3", "4", "5", "6")
    val filterType: Int? = null,
)

@Serializable
data class PropertyDtoResponse(
    val propertyId: String,
    val propertyLabel: String,
    val propertyType: String? = null,
    val propertyClass: String? = null,
)

@Serializable
data class RdfTermHttp(
    @JsonSchema.Enum("iri", "literal", "bnode")
    val type: String,
    @JsonSchema.Description("IRI without angle brackets, literal lexical form, or blank-node label.")
    val value: String,
    val datatype: String? = null,
    val language: String? = null,
)

@Serializable
data class StageBindingHttpRequest(
    val variableName: String? = null,
    val term: RdfTermHttp? = null,
)

@Serializable
data class StageQueryHttpRequest(
    @JsonSchema.Default("\"$DEFAULT_ENDPOINT_URL\"")
    val endpointUrl: String = DEFAULT_ENDPOINT_URL,
    val variableName: String? = null,
    val where: List<WhereHttpRequest>? = null,
    @JsonSchema.Description("Committed typed bindings; blank nodes are rejected.")
    val bindings: List<StageBindingHttpRequest> = emptyList(),
    @JsonSchema.Default("20")
    @JsonSchema.Description("Page size, 1 to 50.")
    val limit: Int = DEFAULT_LIMIT,
    @JsonSchema.Default("0")
    @JsonSchema.Description("Page offset, 0 to 10000.")
    val offset: Int = 0,
)

@Serializable
data class NumericProfileHttpRequest(
    @JsonSchema.Default("\"$DEFAULT_ENDPOINT_URL\"")
    val endpointUrl: String = DEFAULT_ENDPOINT_URL,
    @JsonSchema.Description("The query without the profiled relation; may be empty.")
    val where: List<WhereHttpRequest> = emptyList(),
    @JsonSchema.Description("Subject of the profiled relation: a SPARQL variable or an IRI in angle brackets.")
    val subject: String? = null,
    @JsonSchema.Description("Profiled predicate IRI in angle brackets.")
    val predicate: String? = null,
    @JsonSchema.Default("$PROFILE_DEFAULT_LIMIT")
    @JsonSchema.Description("Maximum number of values returned, 1 to $PROFILE_MAX_LIMIT.")
    val limit: Int = PROFILE_DEFAULT_LIMIT,
)

@Serializable
data class NumericProfileValueHttpResponse(
    val entity: RdfTermHttp,
    val label: String?,
    @JsonSchema.Description("Literal lexical form.")
    val value: String,
    val datatype: String?,
    val number: Double,
)

@Serializable
data class NumericProfileHttpResponse(
    val subject: String,
    val predicate: String,
    @JsonSchema.Description("Distinct entity/value pairs with a numeric value.")
    val count: Int,
    val min: Double?,
    val max: Double?,
    @JsonSchema.Description("True when values holds fewer pairs than count.")
    val truncated: Boolean,
    @JsonSchema.Description("Pairs ordered by number.")
    val values: List<NumericProfileValueHttpResponse>,
)

@Serializable
data class StageCandidateHttpResponse(
    val term: RdfTermHttp,
    val label: String?,
    val selectable: Boolean,
)

@Serializable
data class StageCandidatesHttpResponse(
    val variableName: String,
    val offset: Int,
    val limit: Int,
    val hasMore: Boolean,
    val candidates: List<StageCandidateHttpResponse>,
)

internal class HttpRequestValidationFailure(
    message: String,
    cause: Throwable? = null,
) : IllegalArgumentException(message, cause)

internal fun GeneralQueryHttpRequest.toVariable(): QueryVariable =
    QueryVariable(requireValue(variableName, "variableName").removePrefix("?"))

internal fun GeneralQueryHttpRequest.toPatterns(): List<TriplePattern> =
    requireNotNull(where) { "Missing required field: where" }.map(WhereHttpRequest::toPattern)

internal fun RelationshipsHttpRequest.toElement(): QueryTerm = id.toQueryTerm("id")

internal fun RelationshipValueHttpRequest.toSubject(): QueryTerm = requireValue(subjectId, "subjectId").toQueryTerm("subjectId")

internal fun RelationshipValueHttpRequest.toPredicate(): QueryTerm = requireValue(predicateId, "predicateId").toQueryTerm("predicateId")

internal fun WhereHttpRequest.toPattern(): TriplePattern {
    val objectText = requireValue(`object`, "where.object")
    val filter = filterType?.toFilter(objectText)
    return TriplePattern(
        subject = requireValue(subject, "where.subject").toQueryTerm("where.subject"),
        predicate = requireValue(predicate, "where.predicate").toQueryTerm("where.predicate"),
        `object` = objectText.toQueryObject(),
        filter = filter,
    )
}

private fun Int.toFilter(value: String): QueryFilter =
    when (this) {
        0 -> StartsWith(value)
        1 -> Contains(value)
        2 -> GreaterOrEqual(value)
        3 -> LessOrEqual(value)
        4 -> Maximum
        5 -> Minimum
        6 -> value.toBetween()
        else -> throw HttpRequestValidationFailure("Unsupported filterType: $this")
    }

private fun String.toBetween(): Between {
    val bounds = split("..")
    if (bounds.size != 2) throw HttpRequestValidationFailure("Between filter value must be min..max: $this")
    return Between(bounds[0].trim(), bounds[1].trim())
}

private fun String.toQueryObject(): QueryObject =
    when {
        this == "[]" -> AnyBlankNode
        startsWith("?") -> TermObject(toQueryTerm("where.object"))
        startsWith("<") -> TermObject(toQueryTerm("where.object"))
        else -> LiteralObject(this)
    }

private fun String?.toQueryTerm(field: String): QueryTerm {
    val value = requireValue(this, field)
    return try {
        when {
            value.startsWith("?") -> VariableTerm(QueryVariable(value.removePrefix("?")))
            value.startsWith("<") -> value.toIriOrPath()
            else -> throw HttpRequestValidationFailure("$field must be an IRI, property path, or SPARQL variable")
        }
    } catch (exception: IllegalArgumentException) {
        if (exception is HttpRequestValidationFailure) throw exception
        throw HttpRequestValidationFailure(exception.message ?: "Invalid $field", exception)
    }
}

private fun String.toIriOrPath(): QueryTerm {
    require(endsWith(">")) { "IRI must end with >" }
    val segments = removeSurrounding("<", ">").split(">/<")
    return if (segments.size == 1) {
        IriTerm(segments.single())
    } else {
        // C# accepts slash-separated raw IRI paths. Retain the supported, safe subset.
        IriSequencePath(segments.map(::IriTerm))
    }
}

private fun requireValue(
    value: String?,
    field: String,
): String = value ?: throw HttpRequestValidationFailure("Missing required field: $field")

internal fun PropertyResult.toQueryResponse() = PropertyDtoResponse(propertyId, propertyLabel, propertyType, propertyClass)

internal fun PropertyResult.toRelationshipResponse() = PropertyDtoResponse(propertyId, propertyLabel, propertyType = propertyType)

internal fun PropertyResult.toRelationshipValueResponse(isLiteral: Boolean) =
    PropertyDtoResponse(propertyId, propertyLabel, propertyType = if (isLiteral) propertyType else null)

internal fun PropertyResult.toSearchResponse() = PropertyDtoResponse(propertyId, propertyLabel, propertyType = propertyType)

internal fun NumericProfileHttpRequest.toProfileRequest(): NumericProfileRequest =
    NumericProfileRequest(
        subject = subject.toQueryTerm("subject"),
        predicate =
            predicate.toQueryTerm("predicate") as? IriTerm
                ?: throw HttpRequestValidationFailure("predicate must be a single IRI"),
        patterns = where.map(WhereHttpRequest::toPattern),
        limit = limit,
    )

internal fun NumericProfile.toResponse() =
    NumericProfileHttpResponse(
        subject = subject.render(),
        predicate = predicate.render(),
        count = count,
        min = minimum?.toDouble(),
        max = maximum?.toDouble(),
        truncated = truncated,
        values =
            values.map {
                NumericProfileValueHttpResponse(
                    it.entity.toTermResponse(),
                    it.label,
                    it.value.lexicalForm,
                    it.value.datatype?.value,
                    it.number.toDouble(),
                )
            },
    )

internal fun StageQueryHttpRequest.toStageRequest(): StageQueryRequest =
    StageQueryRequest(
        variable = QueryVariable(requireValue(variableName, "variableName").removePrefix("?")),
        patterns = requireNotNull(where) { "Missing required field: where" }.map(WhereHttpRequest::toPattern),
        bindings = bindings.map(StageBindingHttpRequest::toBinding),
        limit = limit,
        offset = offset,
    )

private fun StageBindingHttpRequest.toBinding(): StageBinding =
    StageBinding(
        QueryVariable(requireValue(variableName, "bindings.variableName").removePrefix("?")),
        (term ?: throw HttpRequestValidationFailure("Missing required field: bindings.term")).toBindingValue(),
    )

private fun RdfTermHttp.toBindingValue(): StageBindingValue =
    when (type) {
        "iri" -> IriBindingValue(IriTerm(value))
        "literal" ->
            LiteralBindingValue(
                lexicalForm = value,
                // rdf:langString is implied by a language tag; the tag alone identifies the term.
                datatype = datatype?.takeUnless { language != null && it == Literal.RDF_LANG_STRING.value }?.let(::IriTerm),
                language = language,
            )
        "bnode" -> throw HttpRequestValidationFailure("Blank node terms cannot be bound")
        else -> throw HttpRequestValidationFailure("Unsupported term type: $type")
    }

internal fun StageCandidatePage.toResponse() =
    StageCandidatesHttpResponse(
        variableName = variable.render(),
        offset = offset,
        limit = limit,
        hasMore = hasMore,
        candidates =
            candidates.map { candidate ->
                StageCandidateHttpResponse(candidate.value.toTermResponse(), candidate.label, candidate.value !is BlankNode)
            },
    )

private fun RdfValue.toTermResponse(): RdfTermHttp =
    when (this) {
        is Iri -> RdfTermHttp("iri", value)
        is Literal -> RdfTermHttp("literal", lexicalForm, datatype?.value, language)
        is BlankNode -> RdfTermHttp("bnode", identifier)
    }

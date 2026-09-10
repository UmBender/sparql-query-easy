@file:Suppress("InstanceOfCheckForException", "MaxLineLength", "ThrowsCount", "TooManyFunctions")

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.query.PropertyResult
import com.example.sparqlqueryeasy.wikidata.query.AnyBlankNode
import com.example.sparqlqueryeasy.wikidata.query.Contains
import com.example.sparqlqueryeasy.wikidata.query.GreaterOrEqual
import com.example.sparqlqueryeasy.wikidata.query.IriSequencePath
import com.example.sparqlqueryeasy.wikidata.query.IriTerm
import com.example.sparqlqueryeasy.wikidata.query.LessOrEqual
import com.example.sparqlqueryeasy.wikidata.query.LiteralObject
import com.example.sparqlqueryeasy.wikidata.query.Maximum
import com.example.sparqlqueryeasy.wikidata.query.Minimum
import com.example.sparqlqueryeasy.wikidata.query.QueryFilter
import com.example.sparqlqueryeasy.wikidata.query.QueryObject
import com.example.sparqlqueryeasy.wikidata.query.QueryTerm
import com.example.sparqlqueryeasy.wikidata.query.QueryVariable
import com.example.sparqlqueryeasy.wikidata.query.StartsWith
import com.example.sparqlqueryeasy.wikidata.query.TermObject
import com.example.sparqlqueryeasy.wikidata.query.TriplePattern
import com.example.sparqlqueryeasy.wikidata.query.VariableTerm
import kotlinx.serialization.Serializable

internal const val DEFAULT_ENDPOINT_URL = "https://query.wikidata.org/sparql"
internal const val DEFAULT_LIMIT = 20

@Serializable
data class RelationshipsHttpRequest(
    val endpointUrl: String = DEFAULT_ENDPOINT_URL,
    val limit: Int = DEFAULT_LIMIT,
    val id: String = "<http://www.wikidata.org/entity/Q529207>",
)

@Serializable
data class RelationshipValueHttpRequest(
    val endpointUrl: String = DEFAULT_ENDPOINT_URL,
    val limit: Int = DEFAULT_LIMIT,
    val subjectId: String? = null,
    val predicateId: String? = null,
    val isLiteral: Boolean = false,
)

@Serializable
data class SearchHttpRequest(
    val endpointUrl: String = DEFAULT_ENDPOINT_URL,
    val limit: Int = DEFAULT_LIMIT,
    val search: String? = null,
)

@Serializable
data class GeneralQueryHttpRequest(
    val endpointUrl: String = DEFAULT_ENDPOINT_URL,
    val limit: Int = DEFAULT_LIMIT,
    val where: List<WhereHttpRequest>? = null,
    val variableName: String? = null,
    val ignoreWikidata: Boolean = true,
)

@Serializable
data class WhereHttpRequest(
    val subject: String? = null,
    val predicate: String? = null,
    val `object`: String? = null,
    val filterType: Int? = null,
)

@Serializable
data class PropertyDtoResponse(
    val propertyId: String,
    val propertyLabel: String,
    val propertyType: String? = null,
    val propertyClass: String? = null,
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
        else -> throw HttpRequestValidationFailure("Unsupported filterType: $this")
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

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.query.GeneralQueryRequest
import com.example.sparqlqueryeasy.application.study.Comparison
import com.example.sparqlqueryeasy.application.study.DEFAULT_MAX_RESULTS
import com.example.sparqlqueryeasy.application.study.DrawnQuery
import com.example.sparqlqueryeasy.application.study.StudyTask
import com.example.sparqlqueryeasy.application.study.TaskDraft
import io.ktor.openapi.JsonSchema
import io.ktor.server.request.receiveText
import io.ktor.server.routing.RoutingContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.intOrNull

/** The request a drawn query derives with the Run Query mapping (DEC-014 Q5); the server sets endpoint and limit. */
@Serializable
data class AnswerQueryHttpRequest(
    @JsonSchema.Description("The answer variable, with or without the leading ?.")
    val variableName: String? = null,
    val where: List<WhereHttpRequest>? = null,
    val variableFilters: List<VariableFilterHttpRequest> = emptyList(),
)

/** A drawn query: the saved graph (FE-042, formatVersion 1) and the request derived from it. */
@Serializable
data class DrawnQueryHttpRequest(
    @JsonSchema.Description("The drawn graph in the saved-query format (formatVersion 1), stored as sent.")
    val graph: JsonObject? = null,
    val query: AnswerQueryHttpRequest? = null,
)

@Serializable
data class AdminTaskHttpRequest(
    @JsonSchema.Description("Stable key, 1 to 64 lowercase letters, digits or '-'. Ignored on update (the path wins).")
    val key: String? = null,
    val title: String? = null,
    val statement: String? = null,
    @JsonSchema.Description("A built-in local graph id, such as PokemonGen1.")
    val endpoint: String? = null,
    @JsonSchema.Description("Optional saved query (formatVersion 1) the participant's editor starts from.")
    val startingGraph: JsonObject? = null,
    val reference: DrawnQueryHttpRequest? = null,
    @JsonSchema.Enum("set", "multiset")
    @JsonSchema.Default("\"set\"")
    val comparison: String = "set",
    @JsonSchema.Default("$DEFAULT_MAX_RESULTS")
    @JsonSchema.Description("Result cap for the reference and the answers, 1 to 10000.")
    val maxResults: Int = DEFAULT_MAX_RESULTS,
)

@Serializable
data class TaskPreviewHttpRequest(
    val endpoint: String? = null,
    val reference: DrawnQueryHttpRequest? = null,
    @JsonSchema.Default("$DEFAULT_MAX_RESULTS")
    val maxResults: Int = DEFAULT_MAX_RESULTS,
)

@Serializable
data class TaskPreviewHttpResponse(
    val sparql: String,
    @JsonSchema.Description("Typed terms of the answer variable, one per result row.")
    val expected: List<RdfTermHttp>,
    val distinctCount: Int,
)

@Serializable
data class AdminTaskSummaryHttpResponse(
    val key: String,
    val title: String,
    val endpoint: String,
    val comparison: String,
    val revision: Int,
    val active: Boolean,
    val expectedCount: Int,
    val updatedAt: String,
)

@Serializable
data class AdminTaskHttpResponse(
    val key: String,
    val title: String,
    val statement: String,
    val endpoint: String,
    val startingGraph: JsonObject?,
    val referenceGraph: JsonObject,
    val referenceQuery: AnswerQueryHttpRequest,
    val referenceSparql: String,
    val expected: List<RdfTermHttp>,
    val comparison: String,
    val maxResults: Int,
    val revision: Int,
    val active: Boolean,
    val createdAt: String,
    val updatedAt: String,
)

/** Study and admin bodies ignore unknown fields: a client-sent `expected` or `correct` is never read. */
internal val lenientJson =
    Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = true
    }

/** Decodes the body leniently; malformed JSON becomes [HttpRequestValidationFailure]. */
internal suspend inline fun <reified T> RoutingContext.receiveLenient(): T {
    val text = call.receiveText()
    return try {
        lenientJson.decodeFromString<T>(text.ifBlank { "{}" })
    } catch (failure: SerializationException) {
        throw HttpRequestValidationFailure("Malformed request body: ${failure.message}", failure)
    } catch (failure: IllegalArgumentException) {
        throw HttpRequestValidationFailure("Malformed request body: ${failure.message}", failure)
    }
}

internal fun AnswerQueryHttpRequest.toGeneralRequest(): GeneralQueryRequest {
    val wire = GeneralQueryHttpRequest(where = where, variableName = variableName, variableFilters = variableFilters)
    return try {
        GeneralQueryRequest(wire.toVariable(), wire.toPatterns(), variableFilters = wire.toVariableFilters())
    } catch (failure: HttpRequestValidationFailure) {
        throw failure
    } catch (failure: IllegalArgumentException) {
        throw HttpRequestValidationFailure(failure.message ?: "Invalid query", failure)
    }
}

internal fun requireSavedGraph(
    graph: JsonObject?,
    field: String,
): JsonObject {
    val version = graph?.get("formatVersion") as? JsonPrimitive
    if (graph == null || version?.intOrNull != 1) {
        throw HttpRequestValidationFailure("$field must be a saved query with formatVersion 1")
    }
    return graph
}

internal fun DrawnQueryHttpRequest?.toDrawnQuery(field: String): DrawnQuery {
    val drawn = this ?: throw HttpRequestValidationFailure("Missing required field: $field")
    val graph = requireSavedGraph(drawn.graph, "$field.graph")
    val query = drawn.query ?: throw HttpRequestValidationFailure("Missing required field: $field.query")
    return DrawnQuery(graph.toString(), lenientJson.encodeToString(query), query.toGeneralRequest())
}

internal fun AdminTaskHttpRequest.toDraft(): TaskDraft =
    TaskDraft(
        key = key.orEmpty(),
        title = title.orEmpty(),
        statement = statement.orEmpty(),
        endpoint = endpoint.orEmpty(),
        startingGraphJson = startingGraph?.let { requireSavedGraph(it, "startingGraph").toString() },
        reference = reference.toDrawnQuery("reference"),
        comparison =
            Comparison.fromWire(comparison) ?: throw HttpRequestValidationFailure("comparison must be set or multiset"),
        maxResults = maxResults,
    )

private fun parseObject(json: String): JsonObject = lenientJson.parseToJsonElement(json) as JsonObject

internal fun StudyTask.toSummaryResponse() =
    AdminTaskSummaryHttpResponse(
        key = key,
        title = title,
        endpoint = endpoint,
        comparison = comparison.wire,
        revision = revision,
        active = active,
        expectedCount = expected.values.size,
        updatedAt = updatedAt.toString(),
    )

internal fun StudyTask.toAdminResponse() =
    AdminTaskHttpResponse(
        key = key,
        title = title,
        statement = statement,
        endpoint = endpoint,
        startingGraph = startingGraphJson?.let(::parseObject),
        referenceGraph = parseObject(referenceGraphJson),
        referenceQuery = lenientJson.decodeFromString(referenceRequestJson),
        referenceSparql = expected.sparql,
        expected = expected.values.map { it.toTermResponse() },
        comparison = comparison.wire,
        maxResults = maxResults,
        revision = revision,
        active = active,
        createdAt = createdAt.toString(),
        updatedAt = updatedAt.toString(),
    )

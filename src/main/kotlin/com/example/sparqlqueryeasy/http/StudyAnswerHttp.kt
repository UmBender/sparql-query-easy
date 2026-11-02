package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.study.DrawnAnswer
import com.example.sparqlqueryeasy.application.study.StudyTask
import com.example.sparqlqueryeasy.wikidata.query.TriplePattern

/**
 * A participant's answer (STUDY-016, DEC-020): the saved graph and the derived `where` and `variableFilters`, with
 * or without variables. `variableName` is not read; `where` may be empty (a diagram of one node).
 */
internal fun DrawnQueryHttpRequest?.toDrawnAnswer(field: String): DrawnAnswer {
    val drawn = requireField(this, field)
    val graph = requireSavedGraph(drawn.graph, "$field.graph")
    val query = requireField(drawn.query, "$field.query")
    val answer =
        DrawnAnswer(
            graph.toString(),
            lenientJson.encodeToString(query),
            query.toAnswerPatterns(),
            invalidAsValidation { query.toWire().toVariableFilters() },
        )
    if (answer.variables.any { it.render().length > MAX_ANSWER_VARIABLE_LENGTH }) {
        throw HttpRequestValidationFailure(
            "Each variable of $field.query must have at most ${MAX_ANSWER_VARIABLE_LENGTH - 1} characters " +
                "after the ?",
        )
    }
    return answer
}

/** The triples of a drawn request, as the structural check compares them (DEC-020 C1). */
internal fun AnswerQueryHttpRequest.toAnswerPatterns(): List<TriplePattern> {
    val wire = toWire()
    return invalidAsValidation { wire.toPatterns() }
}

/** The triples of a task's stored reference request (validated when the task was saved). */
internal fun referencePatterns(task: StudyTask): List<TriplePattern> =
    lenientJson.decodeFromString<AnswerQueryHttpRequest>(task.referenceRequestJson).toAnswerPatterns()

private fun <T : Any> requireField(
    value: T?,
    field: String,
): T = value ?: throw HttpRequestValidationFailure("Missing required field: $field")

private fun AnswerQueryHttpRequest.toWire() =
    GeneralQueryHttpRequest(where = where, variableName = variableName, variableFilters = variableFilters)

private inline fun <T> invalidAsValidation(block: () -> T): T =
    try {
        block()
    } catch (failure: HttpRequestValidationFailure) {
        throw failure
    } catch (failure: IllegalArgumentException) {
        throw HttpRequestValidationFailure(failure.message ?: "Invalid query", failure)
    }

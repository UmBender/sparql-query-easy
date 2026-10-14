package com.example.sparqlqueryeasy.application.query

import com.example.sparqlqueryeasy.application.endpoints.EndpointContext
import com.example.sparqlqueryeasy.application.endpoints.EndpointContextResolution
import com.example.sparqlqueryeasy.domain.model.BoundSparqlBinding
import com.example.sparqlqueryeasy.domain.model.Literal
import com.example.sparqlqueryeasy.domain.model.RdfFailure
import com.example.sparqlqueryeasy.domain.model.SparqlVariable
import com.example.sparqlqueryeasy.rdf.SparqlSyntaxValidation
import com.example.sparqlqueryeasy.rdf.SparqlSyntaxValidator
import com.example.sparqlqueryeasy.wikidata.query.CountQuery
import com.example.sparqlqueryeasy.wikidata.query.QueryVariable
import com.example.sparqlqueryeasy.wikidata.query.TermObject
import com.example.sparqlqueryeasy.wikidata.query.TriplePattern
import com.example.sparqlqueryeasy.wikidata.query.VariableFilter
import com.example.sparqlqueryeasy.wikidata.query.VariableTerm
import com.example.sparqlqueryeasy.wikidata.query.WikidataQueryGenerator

private const val RESERVED_COUNT_PREFIX = "__count"

data class ResultCountRequest(
    val variable: QueryVariable,
    val patterns: List<TriplePattern>,
    val variableFilters: List<VariableFilter> = emptyList(),
)

sealed interface ResultCountResult {
    data class Success(
        val variable: QueryVariable,
        val count: Long,
    ) : ResultCountResult

    data class InvalidInput(val diagnostic: String) : ResultCountResult

    data class InvalidQuery(
        val query: String,
        val diagnostic: String,
    ) : ResultCountResult

    data class LocalGraphUnavailable(val endpointUrl: String) : ResultCountResult

    data class InvalidEndpoint(
        val endpointUrl: String,
        val diagnostic: String,
    ) : ResultCountResult

    data class ExecutionFailure(
        val diagnostic: String,
        val cause: RdfFailure,
    ) : ResultCountResult
}

/**
 * Number of distinct values of one variable under a query (FE-028). Unlike `/api/query`
 * it has no LIMIT and does not require the variable to have an rdf:type.
 */
class ResultCountService(
    private val queryGenerator: WikidataQueryGenerator,
    private val syntaxValidator: SparqlSyntaxValidator,
) {
    suspend fun execute(
        request: ResultCountRequest,
        endpoint: EndpointContextResolution,
    ): ResultCountResult =
        when (endpoint) {
            is EndpointContextResolution.Resolved -> execute(request, endpoint.context)
            is EndpointContextResolution.LocalGraphUnavailable ->
                ResultCountResult.LocalGraphUnavailable(endpoint.endpointUrl)
            is EndpointContextResolution.InvalidRemoteEndpoint ->
                ResultCountResult.InvalidEndpoint(endpoint.endpointUrl, endpoint.diagnostic)
        }

    suspend fun execute(
        request: ResultCountRequest,
        endpoint: EndpointContext,
    ): ResultCountResult {
        val query =
            try {
                validate(request)?.let { throw IllegalArgumentException(it) }
                val query = CountQuery(request.variable, request.patterns, request.variableFilters)
                Result.success(queryGenerator.generate(query))
            } catch (exception: IllegalArgumentException) {
                Result.failure(exception)
            }
        val invalid =
            query.exceptionOrNull()?.let { ResultCountResult.InvalidInput(it.message ?: it.javaClass.simpleName) }
                ?: (syntaxValidator.validate(query.getOrThrow()) as? SparqlSyntaxValidation.Invalid)
                    ?.let { ResultCountResult.InvalidQuery(query.getOrThrow(), it.diagnostic) }
        return invalid ?: executeValidated(request, endpoint, query.getOrThrow())
    }

    private suspend fun executeValidated(
        request: ResultCountRequest,
        endpoint: EndpointContext,
        query: String,
    ): ResultCountResult =
        try {
            val row = endpoint.executor.execute(query).rows.singleOrNull()
            val literal = (row?.binding(COUNT) as? BoundSparqlBinding)?.value as? Literal
            ResultCountResult.Success(request.variable, literal?.lexicalForm?.toLongOrNull() ?: 0L)
        } catch (exception: RdfFailure) {
            ResultCountResult.ExecutionFailure(exception.message ?: exception.javaClass.simpleName, exception)
        }

    private fun validate(request: ResultCountRequest): String? {
        val variables = request.patterns.flatMap(TriplePattern::countVariables) + request.variable
        return if (variables.any { it.name.startsWith(RESERVED_COUNT_PREFIX) }) {
            "Variable names starting with $RESERVED_COUNT_PREFIX are reserved"
        } else {
            null
        }
    }

    private companion object {
        val COUNT = SparqlVariable("__countValue")
    }
}

private fun TriplePattern.countVariables() =
    listOfNotNull(
        (subject as? VariableTerm)?.variable,
        (predicate as? VariableTerm)?.variable,
        ((`object` as? TermObject)?.term as? VariableTerm)?.variable,
    )

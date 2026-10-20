package com.example.sparqlqueryeasy.application.query

import com.example.sparqlqueryeasy.application.endpoints.EndpointContext
import com.example.sparqlqueryeasy.application.endpoints.EndpointContextResolution
import com.example.sparqlqueryeasy.domain.model.BoundSparqlBinding
import com.example.sparqlqueryeasy.domain.model.RdfFailure
import com.example.sparqlqueryeasy.domain.model.RdfValue
import com.example.sparqlqueryeasy.domain.model.SparqlSelectResult
import com.example.sparqlqueryeasy.domain.model.SparqlVariable
import com.example.sparqlqueryeasy.rdf.SparqlSyntaxValidation
import com.example.sparqlqueryeasy.rdf.SparqlSyntaxValidator
import com.example.sparqlqueryeasy.wikidata.query.GeneralSelectQuery
import com.example.sparqlqueryeasy.wikidata.query.QueryVariable
import com.example.sparqlqueryeasy.wikidata.query.TriplePattern
import com.example.sparqlqueryeasy.wikidata.query.VariableFilter
import com.example.sparqlqueryeasy.wikidata.query.WikidataQueryGenerator

data class GeneralQueryRequest(
    val variable: QueryVariable,
    val patterns: List<TriplePattern> = emptyList(),
    val limit: Int = 20,
    val ignoreWikidata: Boolean = true,
    val variableFilters: List<VariableFilter> = emptyList(),
)

sealed interface GeneralQueryResult {
    data class Success(
        val values: List<PropertyResult>,
        val query: String,
    ) : GeneralQueryResult

    data class InvalidInput(val diagnostic: String) : GeneralQueryResult

    data class InvalidQuery(
        val query: String,
        val diagnostic: String,
    ) : GeneralQueryResult

    data class LocalGraphUnavailable(val endpointUrl: String) : GeneralQueryResult

    data class InvalidEndpoint(
        val endpointUrl: String,
        val diagnostic: String,
    ) : GeneralQueryResult

    data class ExecutionFailure(
        val query: String,
        val diagnostic: String,
        val cause: RdfFailure,
    ) : GeneralQueryResult
}

/** The typed values of the queried variable, one per result row (STUDY-006); failures carry a diagnostic. */
sealed interface GeneralQueryTerms {
    data class Success(
        val values: List<RdfValue>,
        val query: String,
    ) : GeneralQueryTerms

    /** The request could not become a query ([query] null), the query was invalid, or execution failed. */
    data class Failure(
        val query: String?,
        val diagnostic: String,
    ) : GeneralQueryTerms
}

/** C# EndpointService.GetQuery orchestration over an immutable endpoint context. */
class GeneralQueryService(
    private val queryGenerator: WikidataQueryGenerator,
    private val syntaxValidator: SparqlSyntaxValidator,
    private val resultFiltering: ResultFilteringService,
) {
    suspend fun execute(
        request: GeneralQueryRequest,
        endpoint: EndpointContextResolution,
    ): GeneralQueryResult =
        when (endpoint) {
            is EndpointContextResolution.Resolved -> execute(request, endpoint.context)
            is EndpointContextResolution.LocalGraphUnavailable ->
                GeneralQueryResult.LocalGraphUnavailable(endpoint.endpointUrl)
            is EndpointContextResolution.InvalidRemoteEndpoint ->
                GeneralQueryResult.InvalidEndpoint(endpoint.endpointUrl, endpoint.diagnostic)
        }

    suspend fun execute(
        request: GeneralQueryRequest,
        endpoint: EndpointContext,
    ): GeneralQueryResult =
        when (val run = run(request, endpoint)) {
            is QueryRun.InvalidInput -> GeneralQueryResult.InvalidInput(run.diagnostic)
            is QueryRun.InvalidQuery -> GeneralQueryResult.InvalidQuery(run.query, run.diagnostic)
            is QueryRun.Failed -> GeneralQueryResult.ExecutionFailure(run.query, run.cause.diagnostic(), run.cause)
            is QueryRun.Executed ->
                GeneralQueryResult.Success(
                    values = resultFiltering.query(run.result, request.variable.render(), request.patterns.isEmpty()),
                    query = run.query,
                )
        }

    /**
     * The same query as [execute], answering the RDF terms bound to the variable in each row, in result order
     * (duplicates kept, unbound rows skipped). The proposed tasks compare these (STUDY-006, DEC-014 Q5).
     */
    suspend fun executeTerms(
        request: GeneralQueryRequest,
        endpoint: EndpointContext,
    ): GeneralQueryTerms =
        when (val run = run(request, endpoint)) {
            is QueryRun.InvalidInput -> GeneralQueryTerms.Failure(null, run.diagnostic)
            is QueryRun.InvalidQuery -> GeneralQueryTerms.Failure(run.query, run.diagnostic)
            is QueryRun.Failed -> GeneralQueryTerms.Failure(run.query, run.cause.diagnostic())
            is QueryRun.Executed -> {
                val variable = SparqlVariable(request.variable.name)
                GeneralQueryTerms.Success(
                    run.result.rows.mapNotNull { row -> (row.binding(variable) as? BoundSparqlBinding)?.value },
                    run.query,
                )
            }
        }

    private suspend fun run(
        request: GeneralQueryRequest,
        endpoint: EndpointContext,
    ): QueryRun =
        when (val generated = generate(request, endpoint)) {
            is GeneratedQuery.InvalidInput -> QueryRun.InvalidInput(generated.diagnostic)
            is GeneratedQuery.Success -> executeValidated(endpoint, generated.query)
        }

    private fun generate(
        request: GeneralQueryRequest,
        endpoint: EndpointContext,
    ): GeneratedQuery =
        try {
            GeneratedQuery.Success(
                queryGenerator.generate(
                    GeneralSelectQuery(
                        variable = request.variable,
                        patterns = request.patterns,
                        limit = request.limit,
                        useWikidataLabels = endpoint.isWikidata && !request.ignoreWikidata,
                        useWikidataPrefixes = endpoint.isWikidata,
                        variableFilters = request.variableFilters,
                    ),
                ),
            )
        } catch (exception: IllegalArgumentException) {
            GeneratedQuery.InvalidInput(exception.message ?: exception.javaClass.simpleName)
        }

    private suspend fun executeValidated(
        endpoint: EndpointContext,
        query: String,
    ): QueryRun =
        when (val validation = syntaxValidator.validate(query)) {
            is SparqlSyntaxValidation.Invalid -> QueryRun.InvalidQuery(query, validation.diagnostic)
            SparqlSyntaxValidation.Valid ->
                try {
                    QueryRun.Executed(endpoint.executor.execute(query), query)
                } catch (exception: RdfFailure) {
                    QueryRun.Failed(query, exception)
                }
        }
}

private sealed interface QueryRun {
    data class InvalidInput(val diagnostic: String) : QueryRun

    data class InvalidQuery(
        val query: String,
        val diagnostic: String,
    ) : QueryRun

    data class Failed(
        val query: String,
        val cause: RdfFailure,
    ) : QueryRun

    data class Executed(
        val result: SparqlSelectResult,
        val query: String,
    ) : QueryRun
}

private sealed interface GeneratedQuery {
    data class Success(val query: String) : GeneratedQuery

    data class InvalidInput(val diagnostic: String) : GeneratedQuery
}

private fun RdfFailure.diagnostic(): String = message ?: javaClass.simpleName

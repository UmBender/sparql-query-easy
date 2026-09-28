package com.example.sparqlqueryeasy.application.query

import com.example.sparqlqueryeasy.application.endpoints.EndpointContext
import com.example.sparqlqueryeasy.application.endpoints.EndpointContextResolution
import com.example.sparqlqueryeasy.domain.model.RdfFailure
import com.example.sparqlqueryeasy.rdf.SparqlSyntaxValidation
import com.example.sparqlqueryeasy.rdf.SparqlSyntaxValidator
import com.example.sparqlqueryeasy.wikidata.query.GeneralSelectQuery
import com.example.sparqlqueryeasy.wikidata.query.QueryVariable
import com.example.sparqlqueryeasy.wikidata.query.TriplePattern
import com.example.sparqlqueryeasy.wikidata.query.WikidataQueryGenerator

data class GeneralQueryRequest(
    val variable: QueryVariable,
    val patterns: List<TriplePattern> = emptyList(),
    val limit: Int = 20,
    val ignoreWikidata: Boolean = true,
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
        when (val generated = generate(request, endpoint)) {
            is GeneratedQuery.InvalidInput -> GeneralQueryResult.InvalidInput(generated.diagnostic)
            is GeneratedQuery.Success -> executeValidated(request, endpoint, generated.query)
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
                    ),
                ),
            )
        } catch (exception: IllegalArgumentException) {
            GeneratedQuery.InvalidInput(exception.message ?: exception.javaClass.simpleName)
        }

    private suspend fun executeValidated(
        request: GeneralQueryRequest,
        endpoint: EndpointContext,
        query: String,
    ): GeneralQueryResult =
        when (val validation = syntaxValidator.validate(query)) {
            is SparqlSyntaxValidation.Invalid -> GeneralQueryResult.InvalidQuery(query, validation.diagnostic)
            SparqlSyntaxValidation.Valid ->
                try {
                    GeneralQueryResult.Success(
                        values =
                            resultFiltering.query(
                                endpoint.executor.execute(query),
                                request.variable.render(),
                                request.patterns.isEmpty(),
                            ),
                        query = query,
                    )
                } catch (exception: RdfFailure) {
                    GeneralQueryResult.ExecutionFailure(query, exception.diagnostic(), exception)
                }
        }
}

private sealed interface GeneratedQuery {
    data class Success(val query: String) : GeneratedQuery

    data class InvalidInput(val diagnostic: String) : GeneratedQuery
}

private fun RdfFailure.diagnostic(): String = message ?: javaClass.simpleName

package com.example.sparqlqueryeasy.application.search

import com.example.sparqlqueryeasy.application.endpoints.EndpointContext
import com.example.sparqlqueryeasy.application.endpoints.EndpointContextResolution
import com.example.sparqlqueryeasy.application.query.PropertyResult
import com.example.sparqlqueryeasy.application.query.ResultFilteringService
import com.example.sparqlqueryeasy.domain.model.RdfFailure
import com.example.sparqlqueryeasy.wikidata.entitysearch.WikidataEntitySearchFailure
import com.example.sparqlqueryeasy.wikidata.query.SearchSelectQuery
import com.example.sparqlqueryeasy.wikidata.query.WikidataQueryGenerator

data class SearchRequest(
    val text: String,
    val limit: Int = 20,
)

sealed interface SearchResult {
    data class Success(
        val values: List<PropertyResult>,
        val sparqlQuery: String? = null,
    ) : SearchResult

    data class InvalidInput(val diagnostic: String) : SearchResult

    data class LocalGraphUnavailable(val endpointUrl: String) : SearchResult

    data class InvalidEndpoint(
        val endpointUrl: String,
        val diagnostic: String,
    ) : SearchResult

    data class ExecutionFailure(
        val diagnostic: String,
        val cause: Throwable,
    ) : SearchResult
}

/** C# EndpointService.GetSearch over immutable endpoint contexts. */
class SearchService(
    private val queryGenerator: WikidataQueryGenerator,
    private val resultFiltering: ResultFilteringService,
    private val entitySearchClient: WikidataEntitySearchClient,
) {
    suspend fun search(
        request: SearchRequest,
        endpoint: EndpointContextResolution,
    ): SearchResult =
        when (endpoint) {
            is EndpointContextResolution.Resolved -> search(request, endpoint.context)
            is EndpointContextResolution.LocalGraphUnavailable ->
                SearchResult.LocalGraphUnavailable(endpoint.endpointUrl)
            is EndpointContextResolution.InvalidRemoteEndpoint ->
                SearchResult.InvalidEndpoint(endpoint.endpointUrl, endpoint.diagnostic)
        }

    suspend fun search(
        request: SearchRequest,
        endpoint: EndpointContext,
    ): SearchResult =
        when {
            request.text.isEmpty() -> SearchResult.Success(emptyList())
            request.limit < 0 -> SearchResult.InvalidInput("Search limit must not be negative")
            endpoint.isWikidata -> mediaWikiSearch(request)
            else -> sparqlSearch(request, endpoint)
        }

    private suspend fun mediaWikiSearch(request: SearchRequest): SearchResult =
        try {
            SearchResult.Success(
                entitySearchClient.search(WikidataEntitySearchRequest(request.text, request.limit)).map { record ->
                    PropertyResult(
                        propertyId = "<${record.conceptUri.orEmpty()}>",
                        propertyLabel = "(${record.id.orEmpty()}) ${record.label.orEmpty()}",
                        propertyType = "object",
                    )
                },
            )
        } catch (exception: WikidataEntitySearchFailure) {
            SearchResult.ExecutionFailure(exception.diagnostic, exception)
        }

    private suspend fun sparqlSearch(
        request: SearchRequest,
        endpoint: EndpointContext,
    ): SearchResult {
        val query =
            try {
                queryGenerator.generate(SearchSelectQuery(request.text, request.limit, endpoint.isLocal))
            } catch (exception: IllegalArgumentException) {
                return SearchResult.InvalidInput(exception.message ?: exception.javaClass.simpleName)
            }
        return try {
            SearchResult.Success(
                resultFiltering.search(endpoint.executor.execute(query), request.text, endpoint.isLocal),
                query,
            )
        } catch (exception: RdfFailure) {
            SearchResult.ExecutionFailure(exception.message ?: exception.javaClass.simpleName, exception)
        }
    }
}

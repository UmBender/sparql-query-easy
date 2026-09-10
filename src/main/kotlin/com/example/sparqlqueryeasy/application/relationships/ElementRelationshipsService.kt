package com.example.sparqlqueryeasy.application.relationships

import com.example.sparqlqueryeasy.application.query.PropertyResult
import com.example.sparqlqueryeasy.application.query.ResultFilteringService
import com.example.sparqlqueryeasy.domain.model.SparqlSelectResult
import com.example.sparqlqueryeasy.wikidata.query.QueryTerm
import com.example.sparqlqueryeasy.wikidata.query.RelationshipQuery
import com.example.sparqlqueryeasy.wikidata.query.WikidataQueryGenerator

data class ElementRelationshipsRequest(
    val endpointUrl: String,
    val element: QueryTerm,
)

/** Request-scoped endpoint execution capability; implementations may be local or network-backed. */
interface EndpointExecution {
    val isLocal: Boolean
    val isWikidata: Boolean

    suspend fun execute(query: String): SparqlSelectResult
}

interface EndpointExecutionResolver {
    fun resolve(endpointUrl: String): EndpointExecution
}

/** Pure application orchestration for C# EndpointService.GetElementRelationships. */
class ElementRelationshipsService(
    private val endpointResolver: EndpointExecutionResolver,
    private val queryGenerator: WikidataQueryGenerator,
    private val resultFiltering: ResultFilteringService,
) {
    suspend fun getElementRelationships(request: ElementRelationshipsRequest): List<PropertyResult> {
        val endpoint = endpointResolver.resolve(request.endpointUrl)
        val query =
            queryGenerator.generate(
                RelationshipQuery(
                    subject = request.element,
                    useWikidataLabels = endpoint.isWikidata,
                ),
            )
        val results = endpoint.execute(query)
        return resultFiltering.elementRelationships(results, endpoint.isLocal)
    }
}

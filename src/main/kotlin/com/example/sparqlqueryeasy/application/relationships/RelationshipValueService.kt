package com.example.sparqlqueryeasy.application.relationships

import com.example.sparqlqueryeasy.application.query.PropertyResult
import com.example.sparqlqueryeasy.application.query.ResultFilteringService
import com.example.sparqlqueryeasy.wikidata.query.QueryTerm
import com.example.sparqlqueryeasy.wikidata.query.RelationshipValueQuery
import com.example.sparqlqueryeasy.wikidata.query.WikidataQueryGenerator

data class RelationshipValueRequest(
    val endpointUrl: String,
    val subject: QueryTerm,
    val predicate: QueryTerm,
    val isLiteral: Boolean,
)

/** Pure application orchestration for C# EndpointService.GetRelationshipValue. */
class RelationshipValueService(
    private val endpointResolver: EndpointExecutionResolver,
    private val queryGenerator: WikidataQueryGenerator,
    private val resultFiltering: ResultFilteringService,
) {
    suspend fun getRelationshipValue(request: RelationshipValueRequest): List<PropertyResult> {
        val endpoint = endpointResolver.resolve(request.endpointUrl)
        val query =
            queryGenerator.generate(
                RelationshipValueQuery(
                    subject = request.subject,
                    predicate = request.predicate,
                    isLiteral = request.isLiteral,
                    useWikidataPrefixes = endpoint.isWikidata,
                ),
            )
        return resultFiltering.relationshipValues(endpoint.execute(query), request.isLiteral)
    }
}

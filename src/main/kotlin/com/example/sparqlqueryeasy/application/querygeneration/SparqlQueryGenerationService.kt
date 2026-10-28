package com.example.sparqlqueryeasy.application.querygeneration

import com.example.sparqlqueryeasy.application.endpoints.EndpointContext
import com.example.sparqlqueryeasy.rdf.SparqlSyntaxValidation
import com.example.sparqlqueryeasy.rdf.SparqlSyntaxValidator
import com.example.sparqlqueryeasy.wikidata.query.DisplaySelectQuery
import com.example.sparqlqueryeasy.wikidata.query.QueryVariable
import com.example.sparqlqueryeasy.wikidata.query.TriplePattern
import com.example.sparqlqueryeasy.wikidata.query.VariableFilter
import com.example.sparqlqueryeasy.wikidata.query.WikidataQueryGenerator

data class SparqlQueryGenerationRequest(
    val variable: QueryVariable,
    val patterns: List<TriplePattern> = emptyList(),
    val limit: Int = 20,
    val variableFilters: List<VariableFilter> = emptyList(),
)

sealed interface SparqlQueryGenerationResult {
    data class Success(val query: String) : SparqlQueryGenerationResult

    data class InvalidInput(val diagnostic: String) : SparqlQueryGenerationResult

    data class InvalidGeneratedQuery(val diagnostic: String) : SparqlQueryGenerationResult
}

/** Generates the C# GetSparqlQuery form, with its filters (BUG-012), without executing it. */
class SparqlQueryGenerationService(
    private val generator: WikidataQueryGenerator,
    private val syntaxValidator: SparqlSyntaxValidator,
) {
    fun generate(
        request: SparqlQueryGenerationRequest,
        endpoint: EndpointContext,
    ): SparqlQueryGenerationResult {
        val query =
            try {
                generator.generate(
                    DisplaySelectQuery(
                        variable = request.variable,
                        // BUG-012: unlike C# GetSparqlQuery, the preview keeps each filterType
                        // (MAX/MIN included), so it shows the filter Run Query applies.
                        patterns = request.patterns,
                        limit = request.limit,
                        useWikidataPrefixes = endpoint.isWikidata,
                        // FE-034: variable filters are new, so the preview shows them.
                        variableFilters = request.variableFilters,
                    ),
                )
            } catch (exception: IllegalArgumentException) {
                return SparqlQueryGenerationResult.InvalidInput(
                    exception.message ?: exception.javaClass.simpleName,
                )
            }

        return when (val validation = syntaxValidator.validate(query)) {
            SparqlSyntaxValidation.Valid -> SparqlQueryGenerationResult.Success(query)
            is SparqlSyntaxValidation.Invalid ->
                SparqlQueryGenerationResult.InvalidGeneratedQuery(validation.diagnostic)
        }
    }
}

package com.example.sparqlqueryeasy.application.querygeneration

import com.example.sparqlqueryeasy.application.endpoints.EndpointContext
import com.example.sparqlqueryeasy.rdf.SparqlSyntaxValidation
import com.example.sparqlqueryeasy.rdf.SparqlSyntaxValidator
import com.example.sparqlqueryeasy.wikidata.query.DisplaySelectQuery
import com.example.sparqlqueryeasy.wikidata.query.QueryVariable
import com.example.sparqlqueryeasy.wikidata.query.TriplePattern
import com.example.sparqlqueryeasy.wikidata.query.WikidataQueryGenerator

data class SparqlQueryGenerationRequest(
    val variable: QueryVariable,
    val patterns: List<TriplePattern> = emptyList(),
    val limit: Int = 20,
)

sealed interface SparqlQueryGenerationResult {
    data class Success(val query: String) : SparqlQueryGenerationResult

    data class InvalidInput(val diagnostic: String) : SparqlQueryGenerationResult

    data class InvalidGeneratedQuery(val diagnostic: String) : SparqlQueryGenerationResult
}

/** Generates the C# GetSparqlQuery form without executing it. */
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
                        // GetSparqlQuery passes no FilterType to the builder. Keep that
                        // observable behavior; the typed generator's filter support is used
                        // by later use cases.
                        patterns = request.patterns.map { it.copy(filter = null) },
                        limit = request.limit,
                        useWikidataPrefixes = endpoint.isWikidata,
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

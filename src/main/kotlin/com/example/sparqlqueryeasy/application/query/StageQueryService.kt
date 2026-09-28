package com.example.sparqlqueryeasy.application.query

import com.example.sparqlqueryeasy.application.endpoints.EndpointContext
import com.example.sparqlqueryeasy.application.endpoints.EndpointContextResolution
import com.example.sparqlqueryeasy.domain.model.BoundSparqlBinding
import com.example.sparqlqueryeasy.domain.model.Literal
import com.example.sparqlqueryeasy.domain.model.RdfFailure
import com.example.sparqlqueryeasy.domain.model.RdfValue
import com.example.sparqlqueryeasy.domain.model.SparqlSelectResult
import com.example.sparqlqueryeasy.domain.model.SparqlVariable
import com.example.sparqlqueryeasy.rdf.SparqlSyntaxValidation
import com.example.sparqlqueryeasy.rdf.SparqlSyntaxValidator
import com.example.sparqlqueryeasy.wikidata.query.QueryVariable
import com.example.sparqlqueryeasy.wikidata.query.StageBinding
import com.example.sparqlqueryeasy.wikidata.query.StageCandidateQuery
import com.example.sparqlqueryeasy.wikidata.query.TermObject
import com.example.sparqlqueryeasy.wikidata.query.TriplePattern
import com.example.sparqlqueryeasy.wikidata.query.VariableTerm
import com.example.sparqlqueryeasy.wikidata.query.WikidataQueryGenerator

const val STAGE_MAX_LIMIT = 50
const val STAGE_MAX_OFFSET = 10_000
const val STAGE_MAX_BINDINGS = 16
private const val RESERVED_VARIABLE_PREFIX = "__stage"
private const val LABEL_OUTPUT = "__stageLabelOut"

data class StageQueryRequest(
    val variable: QueryVariable,
    val patterns: List<TriplePattern>,
    val bindings: List<StageBinding> = emptyList(),
    val limit: Int = 20,
    val offset: Int = 0,
)

/** A distinct typed value; [label] is display-only and never used as a binding. */
data class StageCandidate(
    val value: RdfValue,
    val label: String?,
)

data class StageCandidatePage(
    val variable: QueryVariable,
    val offset: Int,
    val limit: Int,
    val hasMore: Boolean,
    val candidates: List<StageCandidate>,
)

sealed interface StageQueryResult {
    data class Success(
        val page: StageCandidatePage,
        val query: String,
    ) : StageQueryResult

    data class InvalidInput(val diagnostic: String) : StageQueryResult

    data class InvalidQuery(
        val query: String,
        val diagnostic: String,
    ) : StageQueryResult

    data class LocalGraphUnavailable(val endpointUrl: String) : StageQueryResult

    data class InvalidEndpoint(
        val endpointUrl: String,
        val diagnostic: String,
    ) : StageQueryResult

    data class ExecutionFailure(
        val query: String,
        val diagnostic: String,
        val cause: RdfFailure,
    ) : StageQueryResult
}

/** Executes one bounded stage of ordered exploration (DEC-008/API-002). */
class StageQueryService(
    private val queryGenerator: WikidataQueryGenerator,
    private val syntaxValidator: SparqlSyntaxValidator,
) {
    suspend fun execute(
        request: StageQueryRequest,
        endpoint: EndpointContextResolution,
    ): StageQueryResult =
        when (endpoint) {
            is EndpointContextResolution.Resolved -> execute(request, endpoint.context)
            is EndpointContextResolution.LocalGraphUnavailable ->
                StageQueryResult.LocalGraphUnavailable(endpoint.endpointUrl)
            is EndpointContextResolution.InvalidRemoteEndpoint ->
                StageQueryResult.InvalidEndpoint(endpoint.endpointUrl, endpoint.diagnostic)
        }

    suspend fun execute(
        request: StageQueryRequest,
        endpoint: EndpointContext,
    ): StageQueryResult {
        val invalid = validate(request)
        if (invalid != null) return StageQueryResult.InvalidInput(invalid)
        return generate(request, endpoint).fold(
            onSuccess = { query -> executeGenerated(request, endpoint, query) },
            onFailure = { failure -> StageQueryResult.InvalidInput(failure.message ?: failure.javaClass.simpleName) },
        )
    }

    private suspend fun executeGenerated(
        request: StageQueryRequest,
        endpoint: EndpointContext,
        query: String,
    ): StageQueryResult =
        when (val validation = syntaxValidator.validate(query)) {
            is SparqlSyntaxValidation.Invalid -> StageQueryResult.InvalidQuery(query, validation.diagnostic)
            SparqlSyntaxValidation.Valid -> executeValidated(request, endpoint, query)
        }

    private fun generate(
        request: StageQueryRequest,
        endpoint: EndpointContext,
    ): Result<String> =
        try {
            Result.success(
                queryGenerator.generate(
                    StageCandidateQuery(
                        variable = request.variable,
                        patterns = request.patterns,
                        bindings = request.bindings,
                        limit = request.limit,
                        offset = request.offset,
                        useWikidataLabels = endpoint.isWikidata,
                    ),
                ),
            )
        } catch (exception: IllegalArgumentException) {
            Result.failure(exception)
        }

    private suspend fun executeValidated(
        request: StageQueryRequest,
        endpoint: EndpointContext,
        query: String,
    ): StageQueryResult =
        try {
            StageQueryResult.Success(page(request, endpoint.executor.execute(query)), query)
        } catch (exception: RdfFailure) {
            StageQueryResult.ExecutionFailure(query, exception.message ?: exception.javaClass.simpleName, exception)
        }

    private fun validate(request: StageQueryRequest): String? {
        val patternVariables = request.patterns.flatMap(TriplePattern::variables).toSet()
        val bindingVariables = request.bindings.map(StageBinding::variable)
        val allVariables = patternVariables + bindingVariables + request.variable
        return when {
            request.patterns.isEmpty() -> "A staged query requires at least one where pattern"
            request.limit !in 1..STAGE_MAX_LIMIT -> "limit must be between 1 and $STAGE_MAX_LIMIT"
            request.offset !in 0..STAGE_MAX_OFFSET -> "offset must be between 0 and $STAGE_MAX_OFFSET"
            request.bindings.size > STAGE_MAX_BINDINGS -> "At most $STAGE_MAX_BINDINGS bindings are allowed"
            allVariables.any { it.name.startsWith(RESERVED_VARIABLE_PREFIX) } ->
                "Variable names starting with $RESERVED_VARIABLE_PREFIX are reserved"
            request.variable !in patternVariables -> "variableName must occur in where"
            bindingVariables.distinct().size != bindingVariables.size -> "Each binding variable may appear only once"
            request.variable in bindingVariables -> "variableName cannot also be bound"
            bindingVariables.any { it !in patternVariables } -> "Every binding variable must occur in where"
            else -> null
        }
    }

    private fun page(
        request: StageQueryRequest,
        result: SparqlSelectResult,
    ): StageCandidatePage {
        val variable = SparqlVariable(request.variable.name)
        val label = SparqlVariable(LABEL_OUTPUT)
        val candidates =
            result.rows.mapNotNull { row ->
                val value = (row.binding(variable) as? BoundSparqlBinding)?.value ?: return@mapNotNull null
                val labelValue = (row.binding(label) as? BoundSparqlBinding)?.value as? Literal
                StageCandidate(value, labelValue?.lexicalForm)
            }.distinctBy(StageCandidate::value)
        return StageCandidatePage(
            variable = request.variable,
            offset = request.offset,
            limit = request.limit,
            hasMore = candidates.size > request.limit,
            candidates = candidates.take(request.limit),
        )
    }
}

private fun TriplePattern.variables(): List<QueryVariable> =
    listOfNotNull(
        (subject as? VariableTerm)?.variable,
        (predicate as? VariableTerm)?.variable,
        ((`object` as? TermObject)?.term as? VariableTerm)?.variable,
    )

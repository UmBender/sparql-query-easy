package com.example.sparqlqueryeasy.application.query

import com.example.sparqlqueryeasy.application.endpoints.EndpointContext
import com.example.sparqlqueryeasy.application.endpoints.EndpointContextResolution
import com.example.sparqlqueryeasy.domain.model.BoundSparqlBinding
import com.example.sparqlqueryeasy.domain.model.Literal
import com.example.sparqlqueryeasy.domain.model.RdfFailure
import com.example.sparqlqueryeasy.domain.model.RdfValue
import com.example.sparqlqueryeasy.domain.model.SparqlResultRow
import com.example.sparqlqueryeasy.domain.model.SparqlVariable
import com.example.sparqlqueryeasy.rdf.SparqlSyntaxValidation
import com.example.sparqlqueryeasy.rdf.SparqlSyntaxValidator
import com.example.sparqlqueryeasy.wikidata.query.IriTerm
import com.example.sparqlqueryeasy.wikidata.query.NumericProfileQuery
import com.example.sparqlqueryeasy.wikidata.query.QueryTerm
import com.example.sparqlqueryeasy.wikidata.query.TermObject
import com.example.sparqlqueryeasy.wikidata.query.TriplePattern
import com.example.sparqlqueryeasy.wikidata.query.VariableTerm
import com.example.sparqlqueryeasy.wikidata.query.WikidataQueryGenerator
import java.math.BigDecimal

const val PROFILE_DEFAULT_LIMIT = 500
const val PROFILE_MAX_LIMIT = 1_000
private const val RESERVED_VARIABLE_PREFIX = "__profile"

data class NumericProfileRequest(
    val subject: QueryTerm,
    val predicate: IriTerm,
    val patterns: List<TriplePattern>,
    val limit: Int = PROFILE_DEFAULT_LIMIT,
)

/** One distinct entity/value pair; [label] is display-only. */
data class NumericProfileValue(
    val entity: RdfValue,
    val label: String?,
    val value: Literal,
    val number: BigDecimal,
)

data class NumericProfile(
    val subject: QueryTerm,
    val predicate: IriTerm,
    val count: Int,
    val minimum: BigDecimal?,
    val maximum: BigDecimal?,
    val truncated: Boolean,
    val values: List<NumericProfileValue>,
)

sealed interface NumericProfileResult {
    data class Success(val profile: NumericProfile) : NumericProfileResult

    data class InvalidInput(val diagnostic: String) : NumericProfileResult

    data class InvalidQuery(
        val query: String,
        val diagnostic: String,
    ) : NumericProfileResult

    data class LocalGraphUnavailable(val endpointUrl: String) : NumericProfileResult

    data class InvalidEndpoint(
        val endpointUrl: String,
        val diagnostic: String,
    ) : NumericProfileResult

    data class ExecutionFailure(
        val diagnostic: String,
        val cause: RdfFailure,
    ) : NumericProfileResult
}

/** Distribution of a numeric relation under the rest of a query (BE-003). */
class NumericProfileService(
    private val queryGenerator: WikidataQueryGenerator,
    private val syntaxValidator: SparqlSyntaxValidator,
) {
    suspend fun execute(
        request: NumericProfileRequest,
        endpoint: EndpointContextResolution,
    ): NumericProfileResult =
        when (endpoint) {
            is EndpointContextResolution.Resolved -> execute(request, endpoint.context)
            is EndpointContextResolution.LocalGraphUnavailable ->
                NumericProfileResult.LocalGraphUnavailable(endpoint.endpointUrl)
            is EndpointContextResolution.InvalidRemoteEndpoint ->
                NumericProfileResult.InvalidEndpoint(endpoint.endpointUrl, endpoint.diagnostic)
        }

    suspend fun execute(
        request: NumericProfileRequest,
        endpoint: EndpointContext,
    ): NumericProfileResult {
        val queries = generate(request, endpoint)
        val invalid =
            queries.exceptionOrNull()?.let { NumericProfileResult.InvalidInput(it.message ?: it.javaClass.simpleName) }
                ?: queries.getOrThrow().toList().firstNotNullOfOrNull { query ->
                    (syntaxValidator.validate(query) as? SparqlSyntaxValidation.Invalid)
                        ?.let { NumericProfileResult.InvalidQuery(query, it.diagnostic) }
                }
        return invalid ?: executeValidated(request, endpoint, queries.getOrThrow())
    }

    private fun generate(
        request: NumericProfileRequest,
        endpoint: EndpointContext,
    ): Result<Pair<String, String>> =
        try {
            validate(request)?.let { throw IllegalArgumentException(it) }
            Result.success(query(request, endpoint, values = false) to query(request, endpoint, values = true))
        } catch (exception: IllegalArgumentException) {
            Result.failure(exception)
        }

    private suspend fun executeValidated(
        request: NumericProfileRequest,
        endpoint: EndpointContext,
        queries: Pair<String, String>,
    ): NumericProfileResult {
        val (statsQuery, valuesQuery) = queries
        return try {
            val stats = endpoint.executor.execute(statsQuery).rows.singleOrNull()
            val values = endpoint.executor.execute(valuesQuery).rows.mapNotNull(::profileValue)
            val count = stats?.number(COUNT)?.toInt() ?: 0
            NumericProfileResult.Success(
                NumericProfile(
                    subject = request.subject,
                    predicate = request.predicate,
                    count = count,
                    minimum = stats?.number(MIN),
                    maximum = stats?.number(MAX),
                    truncated = count > values.size,
                    values = values,
                ),
            )
        } catch (exception: RdfFailure) {
            NumericProfileResult.ExecutionFailure(exception.message ?: exception.javaClass.simpleName, exception)
        }
    }

    private fun query(
        request: NumericProfileRequest,
        endpoint: EndpointContext,
        values: Boolean,
    ): String =
        queryGenerator.generate(
            NumericProfileQuery(
                subject = request.subject,
                predicate = request.predicate,
                patterns = request.patterns,
                limit = request.limit,
                useWikidataLabels = endpoint.isWikidata,
                values = values,
            ),
        )

    private fun validate(request: NumericProfileRequest): String? {
        val subjectVariable = (request.subject as? VariableTerm)?.variable
        val variables = request.patterns.flatMap(TriplePattern::variables) + listOfNotNull(subjectVariable)
        return when {
            request.limit !in 1..PROFILE_MAX_LIMIT -> "limit must be between 1 and $PROFILE_MAX_LIMIT"
            variables.any { it.name.startsWith(RESERVED_VARIABLE_PREFIX) } ->
                "Variable names starting with $RESERVED_VARIABLE_PREFIX are reserved"
            else -> null
        }
    }

    private fun profileValue(row: SparqlResultRow): NumericProfileValue? {
        val entity = row.value(ENTITY)
        val value = row.value(VALUE) as? Literal
        val number = value?.lexicalForm?.toBigDecimalOrNull()
        return if (entity == null || value == null || number == null) {
            null
        } else {
            NumericProfileValue(entity, (row.value(LABEL) as? Literal)?.lexicalForm, value, number)
        }
    }

    private companion object {
        val ENTITY = SparqlVariable("__profileEntity")
        val VALUE = SparqlVariable("__profileValue")
        val LABEL = SparqlVariable("__profileLabelOut")
        val COUNT = SparqlVariable("__profileCount")
        val MIN = SparqlVariable("__profileMin")
        val MAX = SparqlVariable("__profileMax")
    }
}

private fun SparqlResultRow.value(variable: SparqlVariable): RdfValue? {
    val binding = binding(variable) as? BoundSparqlBinding
    return binding?.value
}

private fun SparqlResultRow.number(variable: SparqlVariable): BigDecimal? {
    val literal = value(variable) as? Literal
    return literal?.lexicalForm?.toBigDecimalOrNull()
}

private fun TriplePattern.variables() =
    listOfNotNull(
        (subject as? VariableTerm)?.variable,
        (predicate as? VariableTerm)?.variable,
        ((`object` as? TermObject)?.term as? VariableTerm)?.variable,
    )

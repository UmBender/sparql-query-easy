package com.example.sparqlqueryeasy.application.study

import com.example.sparqlqueryeasy.application.endpoints.EndpointContextResolution
import com.example.sparqlqueryeasy.application.endpoints.EndpointContextResolver
import com.example.sparqlqueryeasy.application.query.GeneralQueryRequest
import com.example.sparqlqueryeasy.application.query.GeneralQueryService
import com.example.sparqlqueryeasy.application.query.GeneralQueryTerms
import com.example.sparqlqueryeasy.domain.model.RdfValue
import kotlinx.serialization.json.Json
import java.time.Clock

sealed interface AnswerRun {
    data class Complete(val result: ExpectedResult) : AnswerRun

    /** More than the task's result cap came back, so the result is cut; [values] holds the first rows. */
    data class Truncated(val sparql: String, val maxResults: Int, val values: List<RdfValue>) : AnswerRun

    /** The request or query was invalid or failed on the endpoint ([sparql] null when no query was built). */
    data class Failed(val sparql: String?, val diagnostic: String) : AnswerRun
}

/**
 * Runs a drawn query's request on a task's endpoint through [GeneralQueryService] (DEC-014 Q5), with the task's
 * result cap instead of the editor's limit (Q4). Any endpoint or limit the client sent is replaced.
 */
class StudyQueryRunner(
    private val queries: GeneralQueryService,
    private val endpoints: EndpointContextResolver,
) {
    suspend fun run(
        endpoint: String,
        request: GeneralQueryRequest,
        maxResults: Int,
    ): AnswerRun {
        val context =
            when (val resolution = endpoints.resolve(endpoint)) {
                is EndpointContextResolution.Resolved -> resolution.context
                else -> return AnswerRun.Failed(null, "The task's endpoint is unavailable: $endpoint")
            }
        // One row more than the cap tells a complete result from a cut one.
        val capped = request.copy(limit = maxResults + 1, ignoreWikidata = true)
        return when (val result = queries.executeTerms(capped, context)) {
            is GeneralQueryTerms.Failure -> AnswerRun.Failed(result.query, result.diagnostic)
            is GeneralQueryTerms.Success ->
                if (result.values.size > maxResults) {
                    AnswerRun.Truncated(result.query, maxResults, result.values)
                } else {
                    AnswerRun.Complete(ExpectedResult(result.query, result.values))
                }
        }
    }
}

sealed interface TaskSaveResult {
    data class Saved(val task: StudyTask) : TaskSaveResult

    data class Invalid(val message: String) : TaskSaveResult

    data object KeyTaken : TaskSaveResult

    data object NotFound : TaskSaveResult
}

sealed interface PreviewResult {
    data class Ready(val expected: ExpectedResult) : PreviewResult

    data class Invalid(val message: String) : PreviewResult
}

/**
 * Admin management of proposed tasks (STUDY-006, DEC-014 Q3 = B). The server runs the reference query and stores
 * its result; a client never supplies expected rows. A task is never deleted, only deactivated.
 */
class StudyTaskService(
    private val store: StudyTaskStore,
    private val runner: StudyQueryRunner,
    private val clock: Clock = Clock.systemUTC(),
) {
    suspend fun list(): List<StudyTask> = store.list()

    suspend fun find(key: String): StudyTask? = store.find(key)

    /** Runs the reference without saving anything. */
    suspend fun preview(
        endpoint: String,
        reference: DrawnQuery,
        maxResults: Int,
    ): PreviewResult {
        validateRun(endpoint, maxResults)?.let { return PreviewResult.Invalid(it) }
        return when (val expected = expectedResult(endpoint, reference, maxResults)) {
            is Either.Left -> PreviewResult.Invalid(expected.message)
            is Either.Right -> PreviewResult.Ready(expected.value)
        }
    }

    suspend fun create(draft: TaskDraft): TaskSaveResult {
        val clean = draft.normalized()
        validate(clean)?.let { return TaskSaveResult.Invalid(it) }
        return when (val expected = expectedResult(clean.endpoint, clean.reference, clean.maxResults)) {
            is Either.Left -> TaskSaveResult.Invalid(expected.message)
            is Either.Right -> {
                val created = store.create(clean, expected.value, clock.instant())
                if (created == null) TaskSaveResult.KeyTaken else TaskSaveResult.Saved(created)
            }
        }
    }

    /**
     * Replaces the task under [key] ([TaskDraft.key] is ignored). The reference runs again only when the derived
     * request, endpoint or cap changed, so a title edit keeps the expected snapshot. Changing the statement,
     * reference request, comparison, endpoint or cap increments the revision.
     */
    suspend fun update(
        key: String,
        draft: TaskDraft,
    ): TaskSaveResult {
        val current = store.find(key) ?: return TaskSaveResult.NotFound
        val clean = draft.normalized().copy(key = current.key)
        val rerun =
            !sameJson(clean.reference.requestJson, current.referenceRequestJson) ||
                clean.endpoint != current.endpoint ||
                clean.maxResults != current.maxResults
        val invalid = validate(clean)
        val expected: Either<ExpectedResult> =
            when {
                invalid != null -> Either.Left(invalid)
                rerun -> expectedResult(clean.endpoint, clean.reference, clean.maxResults)
                else -> Either.Right(current.expected)
            }
        return when (expected) {
            is Either.Left -> TaskSaveResult.Invalid(expected.message)
            is Either.Right -> {
                val revised = current.revised(clean, expected.value, rerun)
                TaskSaveResult.Saved(store.update(revised, clock.instant()))
            }
        }
    }

    suspend fun setActive(
        key: String,
        active: Boolean,
    ): StudyTask? = store.setActive(key, active, clock.instant())

    private suspend fun expectedResult(
        endpoint: String,
        reference: DrawnQuery,
        maxResults: Int,
    ): Either<ExpectedResult> =
        when (val run = runner.run(endpoint, reference.request, maxResults)) {
            is AnswerRun.Complete -> Either.Right(run.result)
            is AnswerRun.Truncated ->
                Either.Left(
                    "The reference query returns more than ${run.maxResults} results, so the expected result would " +
                        "be cut. Narrow the query or raise the result cap.",
                )
            is AnswerRun.Failed -> Either.Left("The reference query failed: ${run.diagnostic}")
        }

    private sealed interface Either<out T> {
        data class Left(val message: String) : Either<Nothing>

        data class Right<T>(val value: T) : Either<T>
    }

    companion object {
        const val MAX_TITLE_LENGTH = 200
        const val MAX_STATEMENT_LENGTH = 10_000
        private val KEY = Regex("[a-z0-9][a-z0-9-]{0,63}")
        private const val KEY_RULE =
            "Key must have 1 to 64 lowercase letters, digits or '-', starting with a letter or digit"
        private val ENDPOINT_RULE = "Endpoint must be one of the built-in graphs: ${TASK_ENDPOINTS.joinToString()}"

        /** [draft] applied to this task; a change of meaning increments the revision. */
        private fun StudyTask.revised(
            draft: TaskDraft,
            expected: ExpectedResult,
            rerun: Boolean,
        ): StudyTask {
            val changesMeaning = rerun || draft.statement != statement || draft.comparison != comparison
            return copy(
                title = draft.title,
                statement = draft.statement,
                endpoint = draft.endpoint,
                startingGraphJson = draft.startingGraphJson,
                referenceGraphJson = draft.reference.graphJson,
                referenceRequestJson = draft.reference.requestJson,
                expected = expected,
                comparison = draft.comparison,
                maxResults = draft.maxResults,
                revision = if (changesMeaning) revision + 1 else revision,
            )
        }

        /** JSONB storage normalizes key order and spacing, so stored and sent JSON compare as values. */
        private fun sameJson(
            first: String,
            second: String,
        ): Boolean = Json.parseToJsonElement(first) == Json.parseToJsonElement(second)

        private fun TaskDraft.normalized(): TaskDraft {
            return copy(key = key.trim(), title = title.trim(), statement = statement.trim())
        }

        private fun validate(draft: TaskDraft): String? =
            when {
                !KEY.matches(draft.key) -> KEY_RULE
                draft.title.length !in 1..MAX_TITLE_LENGTH -> "Title must have 1 to $MAX_TITLE_LENGTH characters"
                draft.statement.length !in 1..MAX_STATEMENT_LENGTH ->
                    "Statement must have 1 to $MAX_STATEMENT_LENGTH characters"
                else -> validateRun(draft.endpoint, draft.maxResults)
            }

        private fun validateRun(
            endpoint: String,
            maxResults: Int,
        ): String? =
            when {
                endpoint !in TASK_ENDPOINTS -> ENDPOINT_RULE
                maxResults !in 1..MAX_MAX_RESULTS -> "Result cap must be between 1 and $MAX_MAX_RESULTS"
                else -> null
            }
    }
}

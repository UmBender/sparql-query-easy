package com.example.sparqlqueryeasy.application.study

import com.example.sparqlqueryeasy.application.endpoints.SELECTABLE_ENDPOINTS
import com.example.sparqlqueryeasy.application.endpoints.SelectableEndpointKind
import com.example.sparqlqueryeasy.application.query.GeneralQueryRequest
import com.example.sparqlqueryeasy.domain.model.RdfValue
import java.time.Instant

/** How a participant's result is compared with the expected one (DEC-014 Q4). [wire] is the stored spelling. */
enum class Comparison {
    /** The distinct values of the answer variable equal the expected distinct values. */
    SET,

    /** The answer variable's values, one per result row, equal the expected ones with their repetitions. */
    MULTISET,
    ;

    val wire: String get() = name.lowercase()

    companion object {
        fun fromWire(value: String): Comparison? = entries.singleOrNull { it.wire == value }
    }
}

/**
 * A drawn query as the client sends it (DEC-014 Q5): the saved graph (FE-042 JSON, stored as given) and the
 * request the client derived from it with the Run Query mapping (stored as given, run as [request]).
 */
data class DrawnQuery(
    val graphJson: String,
    val requestJson: String,
    val request: GeneralQueryRequest,
)

/** What an admin writes for a task (STUDY-006); the expected result is never part of it. */
data class TaskDraft(
    val key: String,
    val title: String,
    val statement: String,
    val endpoint: String,
    val startingGraphJson: String?,
    val reference: DrawnQuery,
    val comparison: Comparison,
    val maxResults: Int = DEFAULT_MAX_RESULTS,
)

/** The reference query's result as the server computed it: generated SPARQL and the answer variable's terms. */
data class ExpectedResult(
    val sparql: String,
    val values: List<RdfValue>,
)

data class StudyTask(
    val id: Long,
    val key: String,
    val title: String,
    val statement: String,
    val endpoint: String,
    val startingGraphJson: String?,
    val referenceGraphJson: String,
    val referenceRequestJson: String,
    val expected: ExpectedResult,
    val comparison: Comparison,
    val maxResults: Int,
    val revision: Int,
    val active: Boolean,
    val createdAt: Instant,
    val updatedAt: Instant,
)

/**
 * Storage port for proposed tasks. Implementations throw
 * [com.example.sparqlqueryeasy.application.persistence.PersistenceUnavailableException] when the database
 * cannot be used.
 */
interface StudyTaskStore {
    /** Inserts the task with revision 1, or returns null when [TaskDraft.key] is taken. */
    suspend fun create(
        draft: TaskDraft,
        expected: ExpectedResult,
        now: Instant,
    ): StudyTask?

    /** Replaces everything but key, id, active and createdAt. */
    suspend fun update(
        task: StudyTask,
        now: Instant,
    ): StudyTask

    suspend fun find(key: String): StudyTask?

    /** Every task, active or not, by key. */
    suspend fun list(): List<StudyTask>

    suspend fun setActive(
        key: String,
        active: Boolean,
        now: Instant,
    ): StudyTask?
}

const val DEFAULT_MAX_RESULTS = 1000
const val MAX_MAX_RESULTS = 10_000

/** Built-in local graphs only; remote endpoints wait for DEC-004 (STUDY-006). */
val TASK_ENDPOINTS: List<String> =
    SELECTABLE_ENDPOINTS.filter { it.kind == SelectableEndpointKind.LOCAL }.map { it.id }

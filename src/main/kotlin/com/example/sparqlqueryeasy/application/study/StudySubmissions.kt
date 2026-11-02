package com.example.sparqlqueryeasy.application.study

import com.example.sparqlqueryeasy.domain.model.RdfValue
import java.time.Instant

/** One variable's run: the comparison and the variable's terms, one per result row. */
data class AttemptResult(
    val outcome: ComparisonOutcome,
    val values: List<RdfValue>,
    /** The answer returned more rows than the task's cap; it is no match whatever the counts say. */
    val truncated: Boolean,
)

/** One answer variable checked against the expected values (DEC-020 C2). [result] is null when it could not run. */
data class VariableCheck(
    /** The variable with its `?`. */
    val variable: String,
    val sparql: String?,
    val result: AttemptResult?,
    /** Why the query could not run; null when it ran. */
    val diagnostic: String?,
) {
    val match: Boolean get() = result?.outcome?.correct == true

    /** For example "?pokemon: Incorrect: 3 of 7 expected results." */
    val summary: String
        get() {
            val outcome = diagnostic?.let { "The query could not run: $it" } ?: result?.outcome?.feedback.orEmpty()
            return "$variable: $outcome"
        }
}

/**
 * The automatic check of a saved answer (DEC-020 C1, C2): a hint for the researcher, shown only to the admin and
 * never to the participant.
 */
sealed interface AnswerCheck {
    val match: Boolean

    /** One line for the researcher. */
    val summary: String

    /** An answer without variables: its drawn triples compared as a set with the reference's (C1). */
    data class Structural(
        val missing: Int,
        val extra: Int,
    ) : AnswerCheck {
        override val match: Boolean get() = missing == 0 && extra == 0

        override val summary: String
            get() =
                if (match) {
                    "Structural: the same triples as the reference."
                } else {
                    "Structural: $missing reference triples missing; $extra extra."
                }
    }

    /**
     * An answer with variables: each of its first [MAX_CHECKED_VARIABLES] variables run and compared with the
     * expected values (C2); [unchecked] are the variables beyond that cap.
     */
    data class ByVariable(
        val variables: List<VariableCheck>,
        val unchecked: List<String> = emptyList(),
    ) : AnswerCheck {
        init {
            require(variables.isNotEmpty()) { "A variable check needs at least one variable" }
        }

        /** The first variable whose values equal the expected ones, if any. */
        val matched: VariableCheck? get() = variables.firstOrNull { it.match }

        /** The variable the stored summary columns describe: the matched one, else the first. */
        val primary: VariableCheck get() = matched ?: variables.first()

        override val match: Boolean get() = matched != null

        /** No variable's query could run. */
        val invalid: Boolean get() = variables.all { it.result == null }

        override val summary: String
            get() {
                val verdict =
                    matched?.let { "${it.variable} matches the expected values." }
                        ?: "No variable matches the expected values."
                return (listOf(verdict) + variables.map { it.summary }).joinToString(" ")
            }
    }
}

/** At most this many variables of an answer are run for the automatic check (DEC-020 C2: a small cap). */
const val MAX_CHECKED_VARIABLES = 6

/** One stored save of an answer (STUDY-004, STUDY-016). Earlier saves are kept; the last one counts. */
data class Submission(
    val id: Long,
    val userId: Long,
    val taskId: Long,
    val taskRevision: Int,
    /** The drawn graph and the request derived from it, as the client sent them (DEC-014 Q5). */
    val graphJson: String,
    val requestJson: String,
    val check: AnswerCheck,
    val createdAt: Instant,
    val timeSpentMillis: Long,
)

/**
 * Storage port for saves. Implementations throw
 * [com.example.sparqlqueryeasy.application.persistence.PersistenceUnavailableException] when the database
 * cannot be used.
 */
interface StudySubmissionStore {
    /** Stores [submission] (its id is ignored) and returns it with its id. */
    suspend fun add(submission: Submission): Submission

    /** The user's saves of the task, oldest first. */
    suspend fun list(
        userId: Long,
        taskId: Long,
    ): List<Submission>

    /** For each task the user saved an answer to: the time of the last save, at any task revision. */
    suspend fun lastSaveByTask(userId: Long): Map<Long, Instant>
}

/** Where the caller stands on a task, from their own saves only (STUDY-014, DEC-020 C8); never correctness. */
enum class StudyTaskStatus {
    NOT_STARTED,
    ANSWERED,
}

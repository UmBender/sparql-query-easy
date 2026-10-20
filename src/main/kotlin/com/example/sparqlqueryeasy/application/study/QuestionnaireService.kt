package com.example.sparqlqueryeasy.application.study

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import java.time.Clock
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

/** A definition as stored: its row id and JSON. */
data class StoredForm(
    val id: Long,
    val definitionJson: String,
)

/**
 * Storage port for questionnaire definitions. Implementations throw
 * [com.example.sparqlqueryeasy.application.persistence.PersistenceUnavailableException] when the database
 * cannot be used.
 */
interface FormStore {
    /** Stores the definition unless its (slug, version) exists; returns the stored row either way. */
    suspend fun store(
        slug: String,
        version: Int,
        definitionJson: String,
        now: Instant,
    ): StoredForm

    suspend fun replace(
        id: Long,
        definitionJson: String,
    )
}

/** One user's response to a questionnaire (STUDY-010). */
data class FormResponse(
    val id: Long,
    val userId: Long,
    val formId: Long,
    val slug: String,
    val version: Int,
    val consentVersion: Int,
    /** Question id -> value, as [FormAnswerValidator] normalized them. */
    val answersJson: String,
    val submittedAt: Instant,
)

/**
 * Storage port for responses. Implementations throw
 * [com.example.sparqlqueryeasy.application.persistence.PersistenceUnavailableException] when the database
 * cannot be used.
 */
interface FormResponseStore {
    /** Stores [response] (its id is ignored); null when the user already answered this questionnaire. */
    suspend fun add(response: FormResponse): FormResponse?

    suspend fun find(
        userId: Long,
        slug: String,
    ): FormResponse?

    suspend fun hasResponses(formId: Long): Boolean
}

sealed interface FormSubmitResult {
    data class Stored(val response: FormResponse) : FormSubmitResult

    data class Invalid(val errors: Map<String, String>) : FormSubmitResult

    data object NotFound : FormSubmitResult

    /** The client answered a version that is not the current one. */
    data object NotCurrent : FormSubmitResult

    data object AlreadyAnswered : FormSubmitResult

    /** The after-the-study questionnaire before the final submission (DEC-015 Q3). */
    data object FinishRequired : FormSubmitResult
}

/**
 * The questionnaires (STUDY-009/010, DEC-015 Q2/Q3/Q6): the repository files are the source; each version is
 * stored on its first use, and a stored version whose file changed is brought up to date until it has responses.
 * Each user answers each questionnaire once, whatever its version.
 */
class QuestionnaireService(
    private val resources: StudyResources,
    private val store: FormStore,
    private val responses: FormResponseStore,
    private val clock: Clock = Clock.systemUTC(),
) {
    val flow: StudyFlow get() = resources.flow

    private val storedIds = ConcurrentHashMap<Pair<String, Int>, Long>()

    /** The current version of every questionnaire: the flow's order, then the others by slug. */
    fun currentForms(): List<FormDefinition> {
        val order = listOfNotNull(flow.beforeTasks, flow.afterFinish)
        return resources.currentForms.values.sortedWith(
            compareBy({ order.indexOf(it.slug).let { index -> if (index < 0) order.size else index } }, { it.slug }),
        )
    }

    /** The current version of [slug], or null when there is no such questionnaire. */
    fun current(slug: String): FormDefinition? = resources.currentForms[slug]

    /** The row id of [definition], storing or updating it first when needed. */
    suspend fun storedId(definition: FormDefinition): Long {
        val key = definition.slug to definition.version
        storedIds[key]?.let { return it }
        val json = definitionJson.encodeToString(definition)
        val stored = store.store(definition.slug, definition.version, json, clock.instant())
        if (definitionJson.decodeFromString<FormDefinition>(stored.definitionJson) != definition) {
            check(!responses.hasResponses(stored.id)) {
                "Questionnaire ${definition.slug} v${definition.version} changed after responses were stored; " +
                    "add a new version file instead"
            }
            store.replace(stored.id, json)
        }
        storedIds[key] = stored.id
        return stored.id
    }

    /** The user's response to [slug], or null. */
    suspend fun response(
        userId: Long,
        slug: String,
    ): FormResponse? = responses.find(userId, slug)

    /** Whether the proposed tasks are open to the user: the before-the-tasks questionnaire is answered. */
    suspend fun readyForTasks(userId: Long): Boolean = flow.beforeTasks?.let { response(userId, it) != null } ?: true

    /**
     * Checks and stores the user's answers to the current version of [slug] (STUDY-010). [finished] tells
     * whether the user made the final submission; [consentVersion] is the consent they accepted.
     */
    @Suppress("ReturnCount")
    suspend fun submit(
        userId: Long,
        slug: String,
        version: Int?,
        answers: JsonObject,
        consentVersion: Int,
        finished: Boolean,
    ): FormSubmitResult {
        val definition = current(slug) ?: return FormSubmitResult.NotFound
        if (slug == flow.afterFinish && !finished) return FormSubmitResult.FinishRequired
        if (version != definition.version) return FormSubmitResult.NotCurrent
        if (response(userId, slug) != null) return FormSubmitResult.AlreadyAnswered
        val check = FormAnswerValidator.validate(definition, answers)
        if (check.errors.isNotEmpty()) return FormSubmitResult.Invalid(check.errors)
        val stored =
            responses.add(
                FormResponse(
                    id = 0,
                    userId = userId,
                    formId = storedId(definition),
                    slug = slug,
                    version = definition.version,
                    consentVersion = consentVersion,
                    answersJson = check.answers.toString(),
                    submittedAt = clock.instant(),
                ),
            )
        return stored?.let { FormSubmitResult.Stored(it) } ?: FormSubmitResult.AlreadyAnswered
    }

    private companion object {
        val definitionJson = Json { ignoreUnknownKeys = false }
    }
}

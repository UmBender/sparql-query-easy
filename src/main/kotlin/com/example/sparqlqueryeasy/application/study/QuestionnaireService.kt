package com.example.sparqlqueryeasy.application.study

import kotlinx.serialization.json.Json
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

/**
 * The questionnaires (STUDY-009, DEC-015 Q2): the repository files are the source; each version is stored on its
 * first use, and a stored version whose file changed is brought up to date.
 */
class QuestionnaireService(
    private val resources: StudyResources,
    private val store: FormStore,
    private val clock: Clock = Clock.systemUTC(),
) {
    private val storedIds = ConcurrentHashMap<Pair<String, Int>, Long>()

    /** The current version of [slug], or null when there is no such questionnaire. */
    fun current(slug: String): FormDefinition? = resources.currentForms[slug]

    /** The row id of [definition], storing or updating it first when needed. */
    suspend fun storedId(definition: FormDefinition): Long {
        val key = definition.slug to definition.version
        storedIds[key]?.let { return it }
        val json = definitionJson.encodeToString(definition)
        val stored = store.store(definition.slug, definition.version, json, clock.instant())
        if (definitionJson.decodeFromString<FormDefinition>(stored.definitionJson) != definition) {
            store.replace(stored.id, json)
        }
        storedIds[key] = stored.id
        return stored.id
    }

    private companion object {
        val definitionJson = Json { ignoreUnknownKeys = false }
    }
}

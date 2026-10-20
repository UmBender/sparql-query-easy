package com.example.sparqlqueryeasy.application.study

import java.time.Clock
import java.time.Instant

/** One version of the consent text (STUDY-008); a new version asks every participant again. */
data class ConsentText(
    val version: Int,
    val text: String,
)

/**
 * Storage port for consents. Implementations throw
 * [com.example.sparqlqueryeasy.application.persistence.PersistenceUnavailableException] when the database
 * cannot be used.
 */
interface ConsentStore {
    /** Records the user's consent to [version] at [now] unless one exists; returns the stored time either way. */
    suspend fun accept(
        userId: Long,
        version: Int,
        now: Instant,
    ): Instant

    /** When the user accepted [version], or null. */
    suspend fun acceptedAt(
        userId: Long,
        version: Int,
    ): Instant?
}

sealed interface ConsentResult {
    data class Accepted(val acceptedAt: Instant) : ConsentResult

    /** The client accepted a version that is not the current one; nothing is stored. */
    data object NotCurrent : ConsentResult
}

/**
 * Research consent (STUDY-008, DEC-015 Q1): without a consent to the [current] text no questionnaire response
 * and no task attempt is stored.
 */
class ConsentService(
    val current: ConsentText,
    private val store: ConsentStore,
    private val clock: Clock = Clock.systemUTC(),
) {
    /** When the user accepted the current text, or null. */
    suspend fun acceptedAt(userId: Long): Instant? = store.acceptedAt(userId, current.version)

    suspend fun hasConsented(userId: Long): Boolean = acceptedAt(userId) != null

    /** Accepting the same version again keeps the first time. */
    suspend fun accept(
        userId: Long,
        version: Int,
    ): ConsentResult =
        if (version == current.version) {
            ConsentResult.Accepted(store.accept(userId, version, clock.instant()))
        } else {
            ConsentResult.NotCurrent
        }
}

package com.example.sparqlqueryeasy.application.persistence

/**
 * Application-owned view of the database (BE-005). Query routes never depend on it; only account
 * and study features do, and they report [PersistenceUnavailableException] as a temporary failure.
 */
sealed interface PersistenceStatus {
    /** No database is configured (development without `EASYQUERY_DB_URL`). */
    data object NotConfigured : PersistenceStatus

    /** Migrations are applied and connections are available. */
    data object Ready : PersistenceStatus

    /** A database is configured but could not be reached or migrated. */
    data class Unavailable(val reason: String) : PersistenceStatus
}

class PersistenceUnavailableException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)

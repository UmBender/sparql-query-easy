package com.example.sparqlqueryeasy.application

import com.example.sparqlqueryeasy.application.persistence.PersistenceStatus
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Database connectivity on `GET /health` (BE-007). It never carries hosts, URLs or error text. */
@Serializable
enum class DatabaseHealth {
    @SerialName("ready")
    READY,

    @SerialName("not-configured")
    NOT_CONFIGURED,

    @SerialName("unavailable")
    UNAVAILABLE,
}

@Serializable
data class HealthResponse(val status: String, val database: DatabaseHealth)

/**
 * The process answers `ok` whatever the database state (DEC-009): query routes work without it, and a
 * non-2xx answer would mark the container unhealthy. [databaseStatus] must not block (BE-007).
 */
class HealthService(private val databaseStatus: () -> PersistenceStatus = { PersistenceStatus.NotConfigured }) {
    fun current(): HealthResponse =
        HealthResponse(
            status = "ok",
            database =
                when (databaseStatus()) {
                    PersistenceStatus.Ready -> DatabaseHealth.READY
                    PersistenceStatus.NotConfigured -> DatabaseHealth.NOT_CONFIGURED
                    is PersistenceStatus.Unavailable -> DatabaseHealth.UNAVAILABLE
                },
        )
}

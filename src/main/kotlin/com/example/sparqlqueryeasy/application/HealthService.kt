package com.example.sparqlqueryeasy.application

import kotlinx.serialization.Serializable

@Serializable
data class HealthResponse(val status: String)

class HealthService {
    fun current(): HealthResponse = HealthResponse(status = "ok")
}

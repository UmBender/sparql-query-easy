package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.HealthService
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import kotlinx.serialization.json.Json

fun Application.configureSerialization() {
    install(ContentNegotiation) {
        json(
            Json {
                encodeDefaults = true
                explicitNulls = true
            },
        )
    }
}

fun Application.configureRouting() {
    val healthService = HealthService()
    routing {
        get("/health") {
            call.respond(healthService.current())
        }
    }
}

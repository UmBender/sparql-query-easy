package com.example.sparqlqueryeasy.http

import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.plugins.calllogging.CallLogging
import io.ktor.server.plugins.calllogging.processingTimeMillis
import io.ktor.server.request.httpMethod
import io.ktor.server.request.path
import org.slf4j.LoggerFactory
import org.slf4j.event.Level

const val REQUEST_LOGGER = "com.example.sparqlqueryeasy.http.Requests"

/**
 * OPS-010: one line per request, `<status> <method> <path> <ms> ms`. Only the path: no query string, header,
 * cookie or body is logged, so passwords, session tokens and answers never reach the log. `/health` is
 * skipped because the Compose health check calls it every few seconds.
 */
fun Application.configureRequestLogging() {
    install(CallLogging) {
        logger = LoggerFactory.getLogger(REQUEST_LOGGER)
        level = Level.INFO
        disableDefaultColors()
        filter { call -> call.request.path() != "/health" }
        format { call ->
            val status = call.response.status()?.value ?: "-"
            "$status ${call.request.httpMethod.value} ${call.request.path()} ${call.processingTimeMillis()} ms"
        }
    }
}

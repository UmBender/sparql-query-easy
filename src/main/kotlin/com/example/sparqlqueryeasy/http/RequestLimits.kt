package com.example.sparqlqueryeasy.http

import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.createApplicationPlugin
import io.ktor.server.application.hooks.ReceiveRequestBytes
import io.ktor.server.plugins.PayloadTooLargeException
import io.ktor.server.request.contentLength
import io.ktor.server.request.path
import io.ktor.utils.io.ByteReadChannel
import io.ktor.utils.io.readAvailable
import io.ktor.utils.io.writeFully
import io.ktor.utils.io.writer
import kotlinx.coroutines.Dispatchers
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** QUAL-023: the largest JSON request body. A drawn query or a questionnaire answer is a few kilobytes. */
internal const val MAX_REQUEST_BODY_BYTES = 1024L * 1024

/** QUAL-023: the largest `limit` of a general, SPARQL or search request (the study's result cap, MAX_MAX_RESULTS). */
internal const val MAX_REQUEST_LIMIT = 10_000

/** QUAL-023: the most `where` patterns and `variableFilters` one request may hold. */
internal const val MAX_WHERE_PATTERNS = 100
internal const val MAX_VARIABLE_FILTERS = 100

/** The Turtle upload is multipart and has its own limit (QUAL-021). */
private const val UPLOAD_PATH = "/api/local-database"

/**
 * QUAL-023: a body above [MAX_REQUEST_BODY_BYTES] answers 413 before any route reads it. A declared
 * Content-Length is checked first; a chunked body is counted while it is read.
 */
internal val RequestBodyLimit =
    createApplicationPlugin("RequestBodyLimit") {
        on(ReceiveRequestBytes) { call, body ->
            if (call.request.path() == UPLOAD_PATH) return@on body
            val declared = call.request.contentLength()
            if (declared != null && declared > MAX_REQUEST_BODY_BYTES) {
                throw PayloadTooLargeException(MAX_REQUEST_BODY_BYTES)
            }
            call.limited(body, MAX_REQUEST_BODY_BYTES)
        }
    }

private fun ApplicationCall.limited(
    body: ByteReadChannel,
    limit: Long,
): ByteReadChannel =
    application.writer(Dispatchers.Unconfined) {
        val buffer = ByteArray(BUFFER_BYTES)
        var total = 0L
        while (true) {
            val read = body.readAvailable(buffer)
            if (read == -1) break
            total += read
            if (total > limit) throw PayloadTooLargeException(limit)
            channel.writeFully(buffer, 0, read)
        }
    }.channel

private const val BUFFER_BYTES = 8 * 1024

/**
 * Malformed JSON of a study or admin body becomes [HttpRequestValidationFailure] (400). QUAL-022: only the
 * JSON path of the failure is kept (`$.reference.graph`); kotlinx's message names Kotlin classes.
 */
internal inline fun <T> malformedAsValidation(block: () -> T): T =
    try {
        block()
    } catch (failure: SerializationException) {
        throw HttpRequestValidationFailure(malformedMessage(failure), failure)
    } catch (failure: IllegalArgumentException) {
        throw HttpRequestValidationFailure(malformedMessage(failure), failure)
    }

internal fun malformedMessage(failure: Throwable): String =
    JSON_PATH.find(failure.message.orEmpty())?.let { "$MALFORMED_BODY at ${it.value}" } ?: MALFORMED_BODY

private val JSON_PATH = Regex("""\$(?:\.[A-Za-z0-9_]+|\[\d+])+""")

/** QUAL-023: PostgreSQL text and jsonb cannot hold U+0000, so stored bodies refuse it (it answered 503). */
internal const val NUL_REFUSED = "Text must not contain the NUL character (U+0000)"

/** QUAL-023: a saved graph nests about five levels; kotlinx parses arrays recursively, so depth is capped first. */
internal const val MAX_JSON_DEPTH = 32

/** Counts `[`/`{` nesting outside strings; deeper than [MAX_JSON_DEPTH] is 400 before any parsing. */
internal fun requireShallowJson(text: String) {
    var depth = 0
    var inString = false
    var escaped = false
    for (character in text) {
        when {
            escaped -> escaped = false
            inString && character == '\\' -> escaped = true
            character == '"' -> inString = !inString
            inString -> Unit
            character == '[' || character == '{' ->
                if (++depth > MAX_JSON_DEPTH) {
                    throw HttpRequestValidationFailure("JSON must not nest deeper than $MAX_JSON_DEPTH levels")
                }
            character == ']' || character == '}' -> depth--
        }
    }
}

/** True when a string or key anywhere in this element holds U+0000. */
internal fun JsonElement.containsNul(): Boolean = texts().any { '\u0000' in it }

/** Every key and string value, walked with a stack, so deep nesting is safe. */
private fun JsonElement.texts(): Sequence<String> =
    sequence {
        val pending = ArrayDeque<JsonElement>().apply { add(this@texts) }
        while (pending.isNotEmpty()) {
            when (val element = pending.removeLast()) {
                is JsonObject -> {
                    yieldAll(element.keys)
                    pending.addAll(element.values)
                }
                is JsonArray -> pending.addAll(element)
                is JsonPrimitive -> if (element.isString) yield(element.content)
            }
        }
    }

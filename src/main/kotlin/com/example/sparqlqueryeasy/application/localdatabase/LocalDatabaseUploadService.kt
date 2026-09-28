package com.example.sparqlqueryeasy.application.localdatabase

import com.example.sparqlqueryeasy.domain.model.RdfGraph
import com.example.sparqlqueryeasy.domain.model.RdfGraphHandle
import com.example.sparqlqueryeasy.domain.model.TurtleParsingFailure
import com.example.sparqlqueryeasy.rdf.TurtleParser
import java.util.UUID

/** Ktor-independent upload boundary. The adapter owns its underlying stream and closes it on [close]. */
interface TurtleUpload : AutoCloseable {
    fun readUtf8(): String
}

data class LocalDatabaseUploadRequest(val upload: TurtleUpload?)

fun interface LocalGraphHandleGenerator {
    fun next(): RdfGraphHandle
}

class RandomUuidLocalGraphHandleGenerator : LocalGraphHandleGenerator {
    override fun next(): RdfGraphHandle = RdfGraphHandle(UUID.randomUUID().toString())
}

sealed interface LocalDatabaseUploadResult {
    data class Success(val databaseId: RdfGraphHandle) : LocalDatabaseUploadResult

    data object MissingUpload : LocalDatabaseUploadResult

    data class InvalidTurtle(val failure: TurtleParsingFailure) : LocalDatabaseUploadResult
}

/**
 * C# LocalDatabaseController.Post before HTTP response formatting.
 *
 * The service owns and closes a present [TurtleUpload]. Parsing completes before the immutable graph is
 * stored, so invalid Turtle can never create a visible cache entry. Unexpected read, close, cache, and
 * non-parser failures deliberately propagate just as the C# controller leaves infrastructure failures
 * unhandled.
 */
class LocalDatabaseUploadService(
    private val parser: TurtleParser,
    private val graphCache: LocalGraphCache,
    private val handleGenerator: LocalGraphHandleGenerator = RandomUuidLocalGraphHandleGenerator(),
) {
    fun upload(request: LocalDatabaseUploadRequest): LocalDatabaseUploadResult {
        // C# creates its Guid before dereferencing ttlFile; keep that observable dependency order.
        val databaseId = handleGenerator.next()
        return request.upload?.use { upload ->
            when (val parsed = parse(upload)) {
                is ParsedTurtle.Invalid -> LocalDatabaseUploadResult.InvalidTurtle(parsed.failure)
                is ParsedTurtle.Graph -> {
                    graphCache.put(databaseId, parsed.graph)
                    LocalDatabaseUploadResult.Success(databaseId)
                }
            }
        } ?: LocalDatabaseUploadResult.MissingUpload
    }

    private fun parse(upload: TurtleUpload): ParsedTurtle =
        try {
            ParsedTurtle.Graph(parser.parse(upload.readUtf8()))
        } catch (failure: TurtleParsingFailure) {
            ParsedTurtle.Invalid(failure)
        }

    private sealed interface ParsedTurtle {
        data class Graph(val graph: RdfGraph) : ParsedTurtle

        data class Invalid(val failure: TurtleParsingFailure) : ParsedTurtle
    }
}

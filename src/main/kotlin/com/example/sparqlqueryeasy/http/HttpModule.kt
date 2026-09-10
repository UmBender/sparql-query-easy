package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.HealthService
import com.example.sparqlqueryeasy.application.localdatabase.InMemoryLocalGraphCache
import com.example.sparqlqueryeasy.application.localdatabase.LocalDatabaseUploadRequest
import com.example.sparqlqueryeasy.application.localdatabase.LocalDatabaseUploadResult
import com.example.sparqlqueryeasy.application.localdatabase.LocalDatabaseUploadService
import com.example.sparqlqueryeasy.application.localdatabase.TurtleUpload
import com.example.sparqlqueryeasy.rdf.jena.JenaTurtleParser
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.PartData
import io.ktor.http.content.forEachPart
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.request.receiveMultipart
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import io.ktor.utils.io.toByteArray
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class DataResponse(val data: String)

@Serializable
data class ErrorResponse(val error: String)

data class HttpDependencies(
    val localDatabaseUploadService: LocalDatabaseUploadService,
)

fun defaultHttpDependencies(): HttpDependencies =
    HttpDependencies(
        LocalDatabaseUploadService(JenaTurtleParser(), InMemoryLocalGraphCache()),
    )

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

fun Application.configureRouting(dependencies: HttpDependencies = defaultHttpDependencies()) {
    val healthService = HealthService()
    routing {
        get("/health") {
            call.respond(healthService.current())
        }
        route("/api/local-database") {
            post {
                var upload: TurtleUpload? = null
                call.receiveMultipart().forEachPart { part ->
                    if (part is PartData.FileItem && part.name == "ttlFile" && upload == null) {
                        upload = ByteArrayTurtleUpload(part.provider().toByteArray())
                    }
                    part.dispose()
                }
                when (val result = dependencies.localDatabaseUploadService.upload(LocalDatabaseUploadRequest(upload))) {
                    is LocalDatabaseUploadResult.Success ->
                        call.respond(DataResponse(result.databaseId.identifier))
                    LocalDatabaseUploadResult.MissingUpload ->
                        call.respond(HttpStatusCode.BadRequest, ErrorResponse("Missing required upload: ttlFile"))
                    is LocalDatabaseUploadResult.InvalidTurtle ->
                        call.respond(
                            HttpStatusCode.BadRequest,
                            ErrorResponse(result.failure.message ?: "Invalid Turtle"),
                        )
                }
            }
        }
    }
}

private class ByteArrayTurtleUpload(
    private val bytes: ByteArray,
) : TurtleUpload {
    override fun readUtf8(): String = bytes.toString(Charsets.UTF_8)

    override fun close() = Unit
}

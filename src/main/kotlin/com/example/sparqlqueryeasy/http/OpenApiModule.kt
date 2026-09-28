@file:OptIn(io.ktor.utils.io.ExperimentalKtorApi::class)
@file:Suppress("LongMethod", "TooManyFunctions")

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.HealthResponse
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.openapi.JsonSchema
import io.ktor.openapi.OpenApiDoc
import io.ktor.openapi.OpenApiInfo
import io.ktor.openapi.jsonSchema
import io.ktor.server.plugins.swagger.swaggerUI
import io.ktor.server.response.respondText
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.openapi.OpenApiDocSource
import io.ktor.server.routing.openapi.describe
import io.ktor.server.routing.openapi.hide
import kotlinx.serialization.Serializable

private const val OPEN_API_VERSION = "3.1.0"
private const val API_VERSION = "1.0.0"

private val openApiInfo =
    OpenApiInfo(
        title = "SPARQL EasyQuery API",
        version = API_VERSION,
        description =
            "Build and execute constrained SPARQL queries against uploaded, built-in, or remote RDF graphs. " +
                "Authentication is intentionally deferred; every documented operation is currently public.",
    )

@Serializable
private data class TurtleUploadOpenApiRequest(
    @JsonSchema.Description("UTF-8 Turtle document uploaded as a file.")
    @JsonSchema.Format("binary")
    val ttlFile: String,
)

internal fun Route.openApiDocumentationRoutes() {
    val source = OpenApiDocSource.Routing(contentType = ContentType.Application.Json)
    get("/openapi.json") {
        val rendered =
            source.read(
                call.application,
                OpenApiDoc(openapi = OPEN_API_VERSION, info = openApiInfo),
            )
        call.respondText(rendered.content, rendered.contentType)
    }.hide()
    swaggerUI("/swagger") {
        openapiVersion = OPEN_API_VERSION
        info = openApiInfo
        this.source = source
    }
}

internal fun hideFromOpenApi(route: Route) {
    route.hide()
}

internal fun Route.documentRootRedirect(): Route =
    describe {
        operationId = "redirectToFrontend"
        summary = "Open the browser frontend"
        description = "Redirects to the authoritative packaged frontend at /index2.html."
        tag("Application")
        responses {
            HttpStatusCode.Found { description = "Redirect to /index2.html." }
        }
    }

internal fun Route.documentHealth(): Route =
    describe {
        operationId = "getHealth"
        summary = "Check application health"
        description = "Returns process health. This endpoint has no external-service side effects."
        tag("Operations")
        responses {
            HttpStatusCode.OK {
                description = "The application process is healthy."
                schema = jsonSchema<HealthResponse>()
            }
        }
    }

internal fun Route.documentLocalDatabaseUpload(): Route =
    describe {
        operationId = "uploadLocalDatabase"
        summary = "Upload a local Turtle graph"
        description =
            "Parses a required ttlFile part and stores the graph in the process-local sliding cache. " +
            "The returned opaque identifier is used as endpointUrl by query routes."
        tag("Local database")
        requestBody {
            required = true
            description = "Multipart form containing one Turtle file."
            ContentType.MultiPart.FormData { schema = jsonSchema<TurtleUploadOpenApiRequest>() }
        }
        responses {
            HttpStatusCode.OK {
                description = "Opaque identifier for the cached graph."
                schema = jsonSchema<DataResponse<String>>()
            }
            HttpStatusCode.BadRequest {
                description = "ttlFile is missing or the Turtle document is invalid."
                schema = jsonSchema<ErrorResponse>()
            }
        }
    }

internal fun Route.documentRelationships(): Route =
    describeJsonQuery<RelationshipsHttpRequest>(
        operationId = "getElementRelationships",
        summary = "List relationships for an RDF element",
        description =
            "Builds and executes the relationship query for the selected endpoint. " +
                "limit is retained for request compatibility but is not consumed by this operation.",
        successDescription = "Relationships mapped to application property values.",
        includeUpstreamFailure = true,
    )

internal fun Route.documentRelationshipValue(): Route =
    describeJsonQuery<RelationshipValueHttpRequest>(
        operationId = "getRelationshipValue",
        summary = "List values for a subject and predicate",
        description =
            "Builds and executes the relationship-value query for the selected endpoint. " +
                "subjectId and predicateId are semantically required; limit is accepted but unused.",
        successDescription = "Relationship values mapped to application property values.",
        includeUpstreamFailure = true,
    )

internal fun Route.documentSearch(): Route =
    describeJsonQuery<SearchHttpRequest>(
        operationId = "searchNodes",
        summary = "Search graph nodes",
        description =
            "Uses Wikidata entity search for the Wikidata endpoint and generated SPARQL for other endpoints. " +
                "A null, omitted, or empty search returns an empty data array.",
        successDescription = "Matching nodes mapped to application property values.",
        includeUpstreamFailure = true,
    )

internal fun Route.documentGeneralQuery(): Route =
    describeJsonQuery<GeneralQueryHttpRequest>(
        operationId = "executeGeneralQuery",
        summary = "Generate and execute a query",
        description =
            "Generates constrained SPARQL from the requested graph patterns and executes it. " +
                "variableName and where are semantically required; where may be an empty array.",
        successDescription = "Query results mapped to application property values.",
        includeUpstreamFailure = true,
    )

internal fun Route.documentSparqlGeneration(): Route =
    describe {
        operationId = "generateSparql"
        summary = "Generate SPARQL without executing it"
        description = "Uses the general-query request shape. ignoreWikidata and filterType do not affect this route."
        tag("Query")
        requestBody {
            required = true
            ContentType.Application.Json { schema = jsonSchema<GeneralQueryHttpRequest>() }
        }
        responses {
            HttpStatusCode.OK {
                description = "Generated SPARQL query text."
                schema = jsonSchema<DataResponse<String>>()
            }
            commonQueryErrors(includeUpstreamFailure = false)
        }
    }

private inline fun <reified Request : Any> Route.describeJsonQuery(
    operationId: String,
    summary: String,
    description: String,
    successDescription: String,
    includeUpstreamFailure: Boolean,
): Route =
    describe {
        this.operationId = operationId
        this.summary = summary
        this.description = description
        tag("Query")
        requestBody {
            required = true
            ContentType.Application.Json { schema = jsonSchema<Request>() }
        }
        responses {
            HttpStatusCode.OK {
                this.description = successDescription
                schema = jsonSchema<DataResponse<List<PropertyDtoResponse>>>()
            }
            commonQueryErrors(includeUpstreamFailure)
        }
    }

private fun io.ktor.openapi.Responses.Builder.commonQueryErrors(includeUpstreamFailure: Boolean) {
    HttpStatusCode.BadRequest {
        description = "Malformed JSON, missing/invalid fields, invalid endpoint, or invalid generated query."
        schema = jsonSchema<ErrorResponse>()
    }
    HttpStatusCode.NotFound {
        description = "The selected uploaded local graph is unavailable."
        schema = jsonSchema<ErrorResponse>()
    }
    if (includeUpstreamFailure) {
        HttpStatusCode.BadGateway {
            description = "Remote SPARQL or Wikidata execution failed."
            schema = jsonSchema<ErrorResponse>()
        }
    }
}

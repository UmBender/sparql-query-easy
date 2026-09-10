@file:Suppress("CyclomaticComplexMethod", "LongMethod", "MaxLineLength")

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.HealthService
import com.example.sparqlqueryeasy.application.endpoints.ClasspathTurtleTextSource
import com.example.sparqlqueryeasy.application.endpoints.EndpointContextResolution
import com.example.sparqlqueryeasy.application.endpoints.EndpointContextResolver
import com.example.sparqlqueryeasy.application.endpoints.EndpointExecutionResolverAdapter
import com.example.sparqlqueryeasy.application.endpoints.InvalidEndpointFailure
import com.example.sparqlqueryeasy.application.endpoints.LocalGraphUnavailableFailure
import com.example.sparqlqueryeasy.application.endpoints.ParsedBuiltInGraphProvider
import com.example.sparqlqueryeasy.application.localdatabase.InMemoryLocalGraphCache
import com.example.sparqlqueryeasy.application.localdatabase.LocalDatabaseUploadRequest
import com.example.sparqlqueryeasy.application.localdatabase.LocalDatabaseUploadResult
import com.example.sparqlqueryeasy.application.localdatabase.LocalDatabaseUploadService
import com.example.sparqlqueryeasy.application.localdatabase.TurtleUpload
import com.example.sparqlqueryeasy.application.query.GeneralQueryRequest
import com.example.sparqlqueryeasy.application.query.GeneralQueryResult
import com.example.sparqlqueryeasy.application.query.GeneralQueryService
import com.example.sparqlqueryeasy.application.query.ResultFilteringService
import com.example.sparqlqueryeasy.application.querygeneration.SparqlQueryGenerationRequest
import com.example.sparqlqueryeasy.application.querygeneration.SparqlQueryGenerationResult
import com.example.sparqlqueryeasy.application.querygeneration.SparqlQueryGenerationService
import com.example.sparqlqueryeasy.application.relationships.ElementRelationshipsRequest
import com.example.sparqlqueryeasy.application.relationships.ElementRelationshipsService
import com.example.sparqlqueryeasy.application.relationships.RelationshipValueRequest
import com.example.sparqlqueryeasy.application.relationships.RelationshipValueService
import com.example.sparqlqueryeasy.application.search.SearchRequest
import com.example.sparqlqueryeasy.application.search.SearchResult
import com.example.sparqlqueryeasy.application.search.SearchService
import com.example.sparqlqueryeasy.rdf.jena.JenaGraphEndpointExecution
import com.example.sparqlqueryeasy.rdf.jena.JenaSparqlSyntaxValidator
import com.example.sparqlqueryeasy.rdf.jena.JenaTurtleParser
import com.example.sparqlqueryeasy.wikidata.client.RemoteSparqlEndpointExecution
import com.example.sparqlqueryeasy.wikidata.entitysearch.KtorWikidataEntitySearchClient
import com.example.sparqlqueryeasy.wikidata.query.CSharpCompatibleWikidataQueryGenerator
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.PartData
import io.ktor.http.content.forEachPart
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.request.receive
import io.ktor.server.request.receiveMultipart
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.RoutingContext
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import io.ktor.utils.io.toByteArray
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class DataResponse<T>(val data: T)

@Serializable
data class ErrorResponse(val error: String)

data class QueryHttpDependencies(
    val endpointContextResolver: EndpointContextResolver,
    val elementRelationshipsService: ElementRelationshipsService,
    val relationshipValueService: RelationshipValueService,
    val searchService: SearchService,
    val generalQueryService: GeneralQueryService,
    val sparqlQueryGenerationService: SparqlQueryGenerationService,
)

data class HttpDependencies(
    val localDatabaseUploadService: LocalDatabaseUploadService,
    val query: QueryHttpDependencies? = null,
)

fun defaultHttpDependencies(): HttpDependencies {
    val cache = InMemoryLocalGraphCache()
    val parser = JenaTurtleParser()
    val httpClient = HttpClient(CIO)
    val generator = CSharpCompatibleWikidataQueryGenerator()
    val filtering = ResultFilteringService()
    val endpointResolver =
        EndpointContextResolver(
            cache,
            ParsedBuiltInGraphProvider(ClasspathTurtleTextSource(), parser),
            { graph -> JenaGraphEndpointExecution(graph) },
            { endpoint, isWikidata -> RemoteSparqlEndpointExecution(endpoint.value, isWikidata, httpClient) },
        )
    val relationshipResolver = EndpointExecutionResolverAdapter(endpointResolver)
    return HttpDependencies(
        LocalDatabaseUploadService(parser, cache),
        QueryHttpDependencies(
            endpointResolver,
            ElementRelationshipsService(relationshipResolver, generator, filtering),
            RelationshipValueService(relationshipResolver, generator, filtering),
            SearchService(generator, filtering, KtorWikidataEntitySearchClient("https://www.wikidata.org/w/api.php", httpClient)),
            GeneralQueryService(generator, JenaSparqlSyntaxValidator(), filtering),
            SparqlQueryGenerationService(generator, JenaSparqlSyntaxValidator()),
        ),
    )
}

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
        get("/health") { call.respond(healthService.current()) }
        localDatabaseRoutes(dependencies.localDatabaseUploadService)
        dependencies.query?.let(::queryRoutes)
    }
}

private fun Route.localDatabaseRoutes(uploadService: LocalDatabaseUploadService) {
    route("/api/local-database") {
        post {
            var upload: TurtleUpload? = null
            call.receiveMultipart().forEachPart { part ->
                if (part is PartData.FileItem && part.name == "ttlFile" && upload == null) {
                    upload = ByteArrayTurtleUpload(part.provider().toByteArray())
                }
                part.dispose()
            }
            when (val result = uploadService.upload(LocalDatabaseUploadRequest(upload))) {
                is LocalDatabaseUploadResult.Success -> call.respond(DataResponse(result.databaseId.identifier))
                LocalDatabaseUploadResult.MissingUpload ->
                    call.respond(HttpStatusCode.BadRequest, ErrorResponse("Missing required upload: ttlFile"))
                is LocalDatabaseUploadResult.InvalidTurtle ->
                    call.respond(HttpStatusCode.BadRequest, ErrorResponse(result.failure.message ?: "Invalid Turtle"))
            }
        }
    }
}

private fun Route.queryRoutes(dependencies: QueryHttpDependencies) {
    route("/api/query") {
        post("relationships") {
            runQueryRoute {
                val request = call.receive<RelationshipsHttpRequest>()
                val values =
                    dependencies.elementRelationshipsService.getElementRelationships(
                        ElementRelationshipsRequest(request.endpointUrl, request.toElement()),
                    )
                call.respond(DataResponse(values.map { it.toRelationshipResponse() }))
            }
        }
        post("relationship-value") {
            runQueryRoute {
                val request = call.receive<RelationshipValueHttpRequest>()
                val values =
                    dependencies.relationshipValueService.getRelationshipValue(
                        RelationshipValueRequest(request.endpointUrl, request.toSubject(), request.toPredicate(), request.isLiteral),
                    )
                call.respond(DataResponse(values.map { it.toRelationshipValueResponse(request.isLiteral) }))
            }
        }
        post("search") {
            runQueryRoute {
                val request = call.receive<SearchHttpRequest>()
                when (
                    val result =
                        dependencies.searchService.search(
                            SearchRequest(request.search.orEmpty(), request.limit),
                            dependencies.endpointContextResolver.resolve(request.endpointUrl),
                        )
                ) {
                    is SearchResult.Success -> call.respond(DataResponse(result.values.map { it.toSearchResponse() }))
                    is SearchResult.InvalidInput -> badRequest(result.diagnostic)
                    is SearchResult.LocalGraphUnavailable -> notFound(result.endpointUrl)
                    is SearchResult.InvalidEndpoint -> badRequest(result.diagnostic)
                    is SearchResult.ExecutionFailure -> upstreamFailure(result.diagnostic)
                }
            }
        }
        post {
            runQueryRoute {
                val request = call.receive<GeneralQueryHttpRequest>()
                when (
                    val result =
                        dependencies.generalQueryService.execute(
                            GeneralQueryRequest(request.toVariable(), request.toPatterns(), request.limit, request.ignoreWikidata),
                            dependencies.endpointContextResolver.resolve(request.endpointUrl),
                        )
                ) {
                    is GeneralQueryResult.Success -> call.respond(DataResponse(result.values.map { it.toQueryResponse() }))
                    is GeneralQueryResult.InvalidInput -> badRequest(result.diagnostic)
                    is GeneralQueryResult.InvalidQuery -> badRequest(result.diagnostic)
                    is GeneralQueryResult.LocalGraphUnavailable -> notFound(result.endpointUrl)
                    is GeneralQueryResult.InvalidEndpoint -> badRequest(result.diagnostic)
                    is GeneralQueryResult.ExecutionFailure -> upstreamFailure(result.diagnostic)
                }
            }
        }
        post("sparql") {
            runQueryRoute {
                val request = call.receive<GeneralQueryHttpRequest>()
                when (val endpoint = dependencies.endpointContextResolver.resolve(request.endpointUrl)) {
                    is EndpointContextResolution.Resolved ->
                        when (
                            val result =
                                dependencies.sparqlQueryGenerationService.generate(
                                    SparqlQueryGenerationRequest(request.toVariable(), request.toPatterns(), request.limit),
                                    endpoint.context,
                                )
                        ) {
                            is SparqlQueryGenerationResult.Success -> call.respond(DataResponse(result.query))
                            is SparqlQueryGenerationResult.InvalidInput -> badRequest(result.diagnostic)
                            is SparqlQueryGenerationResult.InvalidGeneratedQuery -> badRequest(result.diagnostic)
                        }
                    is EndpointContextResolution.LocalGraphUnavailable -> notFound(endpoint.endpointUrl)
                    is EndpointContextResolution.InvalidRemoteEndpoint -> badRequest(endpoint.diagnostic)
                }
            }
        }
    }
}

private suspend fun RoutingContext.runQueryRoute(block: suspend RoutingContext.() -> Unit) {
    try {
        block()
    } catch (failure: LocalGraphUnavailableFailure) {
        notFound(failure.endpointUrl)
    } catch (failure: InvalidEndpointFailure) {
        badRequest(failure.message ?: "Invalid endpoint")
    } catch (failure: HttpRequestValidationFailure) {
        badRequest(failure.message ?: "Invalid request")
    } catch (failure: IllegalArgumentException) {
        badRequest(failure.message ?: "Invalid request")
    }
}

private suspend fun RoutingContext.badRequest(diagnostic: String) {
    call.respond(HttpStatusCode.BadRequest, ErrorResponse(diagnostic))
}

private suspend fun RoutingContext.notFound(endpoint: String) {
    call.respond(HttpStatusCode.NotFound, ErrorResponse("Local RDF graph is unavailable: $endpoint"))
}

private suspend fun RoutingContext.upstreamFailure(diagnostic: String) {
    call.respond(HttpStatusCode.BadGateway, ErrorResponse(diagnostic))
}

private class ByteArrayTurtleUpload(private val bytes: ByteArray) : TurtleUpload {
    override fun readUtf8(): String = bytes.toString(Charsets.UTF_8)

    override fun close() = Unit
}

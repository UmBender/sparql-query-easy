@file:Suppress("CyclomaticComplexMethod", "LongMethod", "MaxLineLength")

package com.example.sparqlqueryeasy.http

import com.example.sparqlqueryeasy.application.HealthService
import com.example.sparqlqueryeasy.application.auth.AttemptLimiter
import com.example.sparqlqueryeasy.application.auth.AuthService
import com.example.sparqlqueryeasy.application.endpoints.ClasspathTurtleTextSource
import com.example.sparqlqueryeasy.application.endpoints.EndpointContextResolution
import com.example.sparqlqueryeasy.application.endpoints.EndpointContextResolver
import com.example.sparqlqueryeasy.application.endpoints.EndpointExecutionResolverAdapter
import com.example.sparqlqueryeasy.application.endpoints.InvalidEndpointFailure
import com.example.sparqlqueryeasy.application.endpoints.LocalGraphUnavailableFailure
import com.example.sparqlqueryeasy.application.endpoints.POKEMON_ENDPOINT_ID
import com.example.sparqlqueryeasy.application.endpoints.POKEMON_RESOURCE_NAME
import com.example.sparqlqueryeasy.application.endpoints.ParsedBuiltInGraphProvider
import com.example.sparqlqueryeasy.application.endpoints.SELECTABLE_ENDPOINTS
import com.example.sparqlqueryeasy.application.localdatabase.InMemoryLocalGraphCache
import com.example.sparqlqueryeasy.application.localdatabase.LocalDatabaseUploadRequest
import com.example.sparqlqueryeasy.application.localdatabase.LocalDatabaseUploadResult
import com.example.sparqlqueryeasy.application.localdatabase.LocalDatabaseUploadService
import com.example.sparqlqueryeasy.application.localdatabase.TurtleUpload
import com.example.sparqlqueryeasy.application.query.GeneralQueryRequest
import com.example.sparqlqueryeasy.application.query.GeneralQueryResult
import com.example.sparqlqueryeasy.application.query.GeneralQueryService
import com.example.sparqlqueryeasy.application.query.NumericProfileResult
import com.example.sparqlqueryeasy.application.query.NumericProfileService
import com.example.sparqlqueryeasy.application.query.ResultCountResult
import com.example.sparqlqueryeasy.application.query.ResultCountService
import com.example.sparqlqueryeasy.application.query.ResultFilteringService
import com.example.sparqlqueryeasy.application.query.StageQueryResult
import com.example.sparqlqueryeasy.application.query.StageQueryService
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
import com.example.sparqlqueryeasy.config.AppSettings
import com.example.sparqlqueryeasy.domain.model.SparqlQueryExecutionFailure
import com.example.sparqlqueryeasy.persistence.DatabaseConnector
import com.example.sparqlqueryeasy.persistence.PostgresAccountStore
import com.example.sparqlqueryeasy.persistence.reportDatabaseStartup
import com.example.sparqlqueryeasy.rdf.jena.JenaGraphEndpointExecution
import com.example.sparqlqueryeasy.rdf.jena.JenaSparqlSyntaxValidator
import com.example.sparqlqueryeasy.rdf.jena.JenaTurtleParser
import com.example.sparqlqueryeasy.security.Argon2PasswordHasher
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
import io.ktor.server.application.ApplicationStopped
import io.ktor.server.application.install
import io.ktor.server.plugins.BadRequestException
import io.ktor.server.plugins.ContentTransformationException
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.plugins.statuspages.StatusPages
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
    val stageQueryService: StageQueryService =
        StageQueryService(CSharpCompatibleWikidataQueryGenerator(), JenaSparqlSyntaxValidator()),
    val numericProfileService: NumericProfileService =
        NumericProfileService(CSharpCompatibleWikidataQueryGenerator(), JenaSparqlSyntaxValidator()),
    val resultCountService: ResultCountService =
        ResultCountService(CSharpCompatibleWikidataQueryGenerator(), JenaSparqlSyntaxValidator()),
)

data class HttpDependencies(
    val localDatabaseUploadService: LocalDatabaseUploadService,
    val query: QueryHttpDependencies? = null,
    val auth: AuthHttpDependencies? = null,
    private val ownedResources: List<AutoCloseable> = emptyList(),
    val health: HealthService = HealthService(),
) : AutoCloseable {
    override fun close() {
        ownedResources.forEach(AutoCloseable::close)
    }
}

fun defaultHttpDependencies(settings: AppSettings = AppSettings.load()): HttpDependencies {
    val cache = InMemoryLocalGraphCache()
    val parser = JenaTurtleParser()
    val httpClient = HttpClient(CIO)
    val generator = CSharpCompatibleWikidataQueryGenerator(settings.extremeResultLimit)
    val filtering = ResultFilteringService()
    val endpointResolver =
        EndpointContextResolver(
            cache,
            ParsedBuiltInGraphProvider(ClasspathTurtleTextSource(), parser),
            { graph -> JenaGraphEndpointExecution(graph) },
            { endpoint, isWikidata -> RemoteSparqlEndpointExecution(endpoint.value, isWikidata, httpClient) },
            mapOf(POKEMON_ENDPOINT_ID to ParsedBuiltInGraphProvider(ClasspathTurtleTextSource(POKEMON_RESOURCE_NAME), parser)),
        )
    val relationshipResolver = EndpointExecutionResolverAdapter(endpointResolver)
    // BE-005: migrations run before routes serve; query routes never wait for the database.
    val database = DatabaseConnector(settings.database).also { reportDatabaseStartup(it.connect()) }
    return HttpDependencies(
        LocalDatabaseUploadService(parser, cache),
        QueryHttpDependencies(
            endpointResolver,
            ElementRelationshipsService(relationshipResolver, generator, filtering),
            RelationshipValueService(relationshipResolver, generator, filtering),
            SearchService(generator, filtering, KtorWikidataEntitySearchClient("https://www.wikidata.org/w/api.php", httpClient)),
            GeneralQueryService(generator, JenaSparqlSyntaxValidator(), filtering),
            SparqlQueryGenerationService(generator, JenaSparqlSyntaxValidator()),
            StageQueryService(generator, JenaSparqlSyntaxValidator()),
            NumericProfileService(generator, JenaSparqlSyntaxValidator()),
            ResultCountService(generator, JenaSparqlSyntaxValidator()),
        ),
        AuthHttpDependencies(
            AuthService(
                PostgresAccountStore(database),
                Argon2PasswordHasher(settings.auth.argon2),
                adminUsernames = settings.auth.adminUsernames,
            ),
            AttemptLimiter(settings.auth.authAttemptsPerMinute),
            secureCookies = settings.secureCookies,
            trustProxy = settings.auth.trustProxy,
        ),
        ownedResources = listOf(httpClient, database),
        health = HealthService(database::poll),
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

/** The approved public error contract also covers malformed JSON before route binding can begin. */
fun Application.configureErrorHandling() {
    install(StatusPages) {
        exception<ContentTransformationException> { call, cause ->
            call.respond(HttpStatusCode.BadRequest, ErrorResponse(cause.message ?: "Malformed request body"))
        }
        exception<BadRequestException> { call, cause ->
            call.respond(HttpStatusCode.BadRequest, ErrorResponse(cause.message ?: "Malformed request body"))
        }
    }
}

fun Application.configureRouting(dependencies: HttpDependencies = defaultHttpDependencies()) {
    environment.monitor.subscribe(ApplicationStopped) { dependencies.close() }
    routing {
        // FE-049: the API only. The SvelteKit app is served by the web service (deploy/Caddyfile)
        // or the Vite dev server, which proxy these routes on the same origin.
        get("/health") { call.respond(dependencies.health.current()) }.documentHealth()
        get("/api/endpoints") {
            call.respond(
                DataResponse(SELECTABLE_ENDPOINTS.map { EndpointHttpItem(it.id, it.label, it.kind.name.lowercase()) }),
            )
        }.documentEndpoints()
        localDatabaseRoutes(dependencies.localDatabaseUploadService)
        dependencies.query?.let(::queryRoutes)
        dependencies.auth?.let {
            authRoutes(it)
            adminRoutes(it)
        }
        openApiDocumentationRoutes()
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
        }.documentLocalDatabaseUpload()
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
        }.documentRelationships()
        post("relationship-value") {
            runQueryRoute {
                val request = call.receive<RelationshipValueHttpRequest>()
                val values =
                    dependencies.relationshipValueService.getRelationshipValue(
                        RelationshipValueRequest(request.endpointUrl, request.toSubject(), request.toPredicate(), request.isLiteral),
                    )
                call.respond(DataResponse(values.map { it.toRelationshipValueResponse(request.isLiteral) }))
            }
        }.documentRelationshipValue()
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
        }.documentSearch()
        post {
            runQueryRoute {
                val request = call.receive<GeneralQueryHttpRequest>()
                when (
                    val result =
                        dependencies.generalQueryService.execute(
                            GeneralQueryRequest(
                                request.toVariable(),
                                request.toPatterns(),
                                request.limit,
                                request.ignoreWikidata,
                                request.toVariableFilters(),
                            ),
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
        }.documentGeneralQuery()
        post("stage") {
            runQueryRoute {
                val request = call.receive<StageQueryHttpRequest>()
                when (
                    val result =
                        dependencies.stageQueryService.execute(
                            request.toStageRequest(),
                            dependencies.endpointContextResolver.resolve(request.endpointUrl),
                        )
                ) {
                    is StageQueryResult.Success -> call.respond(DataResponse(result.page.toResponse()))
                    is StageQueryResult.InvalidInput -> badRequest(result.diagnostic)
                    is StageQueryResult.InvalidQuery -> badRequest(result.diagnostic)
                    is StageQueryResult.LocalGraphUnavailable -> notFound(result.endpointUrl)
                    is StageQueryResult.InvalidEndpoint -> badRequest(result.diagnostic)
                    is StageQueryResult.ExecutionFailure -> upstreamFailure(result.diagnostic)
                }
            }
        }.documentStageQuery()
        post("numeric-profile") {
            runQueryRoute {
                val request = call.receive<NumericProfileHttpRequest>()
                when (
                    val result =
                        dependencies.numericProfileService.execute(
                            request.toProfileRequest(),
                            dependencies.endpointContextResolver.resolve(request.endpointUrl),
                        )
                ) {
                    is NumericProfileResult.Success -> call.respond(DataResponse(result.profile.toResponse()))
                    is NumericProfileResult.InvalidInput -> badRequest(result.diagnostic)
                    is NumericProfileResult.InvalidQuery -> badRequest(result.diagnostic)
                    is NumericProfileResult.LocalGraphUnavailable -> notFound(result.endpointUrl)
                    is NumericProfileResult.InvalidEndpoint -> badRequest(result.diagnostic)
                    is NumericProfileResult.ExecutionFailure -> upstreamFailure(result.diagnostic)
                }
            }
        }.documentNumericProfile()
        post("count") {
            runQueryRoute {
                val request = call.receive<ResultCountHttpRequest>()
                when (
                    val result =
                        dependencies.resultCountService.execute(
                            request.toCountRequest(),
                            dependencies.endpointContextResolver.resolve(request.endpointUrl),
                        )
                ) {
                    is ResultCountResult.Success ->
                        call.respond(DataResponse(ResultCountHttpResponse(result.variable.render(), result.count)))
                    is ResultCountResult.InvalidInput -> badRequest(result.diagnostic)
                    is ResultCountResult.InvalidQuery -> badRequest(result.diagnostic)
                    is ResultCountResult.LocalGraphUnavailable -> notFound(result.endpointUrl)
                    is ResultCountResult.InvalidEndpoint -> badRequest(result.diagnostic)
                    is ResultCountResult.ExecutionFailure -> upstreamFailure(result.diagnostic)
                }
            }
        }.documentResultCount()
        post("sparql") {
            runQueryRoute {
                val request = call.receive<GeneralQueryHttpRequest>()
                when (val endpoint = dependencies.endpointContextResolver.resolve(request.endpointUrl)) {
                    is EndpointContextResolution.Resolved ->
                        when (
                            val result =
                                dependencies.sparqlQueryGenerationService.generate(
                                    SparqlQueryGenerationRequest(
                                        request.toVariable(),
                                        request.toPatterns(),
                                        request.limit,
                                        request.toVariableFilters(),
                                    ),
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
        }.documentSparqlGeneration()
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
    } catch (failure: SparqlQueryExecutionFailure) {
        upstreamFailure(failure.diagnostic)
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

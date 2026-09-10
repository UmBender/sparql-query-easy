package com.example.sparqlqueryeasy.application.endpoints

import com.example.sparqlqueryeasy.application.localdatabase.LocalGraphCache
import com.example.sparqlqueryeasy.application.relationships.EndpointExecution
import com.example.sparqlqueryeasy.domain.model.RdfGraph
import com.example.sparqlqueryeasy.domain.model.RdfGraphHandle
import com.example.sparqlqueryeasy.rdf.TurtleParser
import java.net.URI
import java.net.URISyntaxException

const val BRASILEIRAO_ENDPOINT_ID = "CampeonatoBrasileiro2023"
private const val WIKIDATA_ENDPOINT_MARKER = "query.wikidata.org/sparql"

/** A Ktor-free source of UTF-8 Turtle text. Implementations close their own underlying resources. */
fun interface TurtleTextSource {
    fun readUtf8(): String
}

class BuiltInGraphLoadingFailure(
    val resourceName: String,
    cause: Throwable? = null,
) : RuntimeException("Built-in Brazilian graph resource is unavailable: $resourceName", cause)

/** Reads the bundled C# runtime asset after Gradle copies it to the Kotlin classpath. */
class ClasspathTurtleTextSource(
    private val resourceName: String = "futebol_completo.ttl",
    private val classLoader: ClassLoader = ClasspathTurtleTextSource::class.java.classLoader,
) : TurtleTextSource {
    override fun readUtf8(): String =
        classLoader.getResourceAsStream(resourceName)?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }
            ?: throw BuiltInGraphLoadingFailure(resourceName)
}

interface BuiltInGraphProvider {
    fun graph(): RdfGraph
}

/** Eager, process-lifetime graph equivalent of C#'s singleton BrasileiraoDatabase construction. */
class ParsedBuiltInGraphProvider(
    turtleSource: TurtleTextSource,
    turtleParser: TurtleParser,
) : BuiltInGraphProvider {
    private val loadedGraph: RdfGraph = turtleParser.parse(turtleSource.readUtf8())

    override fun graph(): RdfGraph = loadedGraph
}

class RemoteSparqlEndpoint private constructor(val value: String) {
    companion object {
        fun parse(value: String): RemoteSparqlEndpoint {
            require(value == value.trim()) { "Endpoint URL must not have surrounding whitespace" }
            val uri =
                try {
                    URI(value)
                } catch (exception: URISyntaxException) {
                    throw IllegalArgumentException("Invalid remote endpoint URL: $value", exception)
                }
            require(uri.scheme.equals("http", ignoreCase = true) || uri.scheme.equals("https", ignoreCase = true)) {
                "Remote endpoint URL must use HTTP(S)"
            }
            require(!uri.host.isNullOrBlank()) { "Remote endpoint URL must include a host" }
            return RemoteSparqlEndpoint(value)
        }
    }
}

/** Factories create request-scoped execution capabilities without executing a query during resolution. */
fun interface LocalEndpointExecutorFactory {
    fun create(graph: RdfGraph): EndpointExecution
}

fun interface RemoteEndpointExecutorFactory {
    fun create(
        endpoint: RemoteSparqlEndpoint,
        isWikidata: Boolean,
    ): EndpointExecution
}

sealed interface EndpointContext {
    val endpointUrl: String
    val executor: EndpointExecution
    val isLocal: Boolean
    val isWikidata: Boolean
}

data class UploadedGraphEndpointContext(
    override val endpointUrl: String,
    val graphHandle: RdfGraphHandle,
    val graph: RdfGraph,
    override val executor: EndpointExecution,
) : EndpointContext {
    override val isLocal: Boolean = true
    override val isWikidata: Boolean = false
}

data class BuiltInGraphEndpointContext(
    val graph: RdfGraph,
    override val executor: EndpointExecution,
) : EndpointContext {
    override val endpointUrl: String = BRASILEIRAO_ENDPOINT_ID
    override val isLocal: Boolean = true
    override val isWikidata: Boolean = false
}

data class WikidataEndpointContext(
    val endpoint: RemoteSparqlEndpoint,
    override val executor: EndpointExecution,
) : EndpointContext {
    override val endpointUrl: String = endpoint.value
    override val isLocal: Boolean = false
    override val isWikidata: Boolean = true
}

data class RemoteSparqlEndpointContext(
    val endpoint: RemoteSparqlEndpoint,
    override val executor: EndpointExecution,
) : EndpointContext {
    override val endpointUrl: String = endpoint.value
    override val isLocal: Boolean = false
    override val isWikidata: Boolean = false
}

sealed interface EndpointContextResolution {
    data class Resolved(val context: EndpointContext) : EndpointContextResolution

    data class LocalGraphUnavailable(val endpointUrl: String) : EndpointContextResolution

    data class InvalidRemoteEndpoint(
        val endpointUrl: String,
        val diagnostic: String,
    ) : EndpointContextResolution
}

/** Stateless replacement for C# EndpointService.SetEndpoint. */
class EndpointContextResolver(
    private val localGraphCache: LocalGraphCache,
    private val builtInGraphProvider: BuiltInGraphProvider,
    private val localExecutorFactory: LocalEndpointExecutorFactory,
    private val remoteExecutorFactory: RemoteEndpointExecutorFactory,
) {
    fun resolve(endpointUrl: String): EndpointContextResolution =
        when {
            endpointUrl == BRASILEIRAO_ENDPOINT_ID -> builtInContext()
            endpointUrl.isCSharpGuid() -> uploadedGraphContext(endpointUrl)
            else -> remoteContext(endpointUrl)
        }

    private fun builtInContext(): EndpointContextResolution {
        val graph = builtInGraphProvider.graph()
        return EndpointContextResolution.Resolved(
            BuiltInGraphEndpointContext(graph, localExecutorFactory.create(graph)),
        )
    }

    private fun uploadedGraphContext(endpointUrl: String): EndpointContextResolution {
        val graphHandle = RdfGraphHandle(endpointUrl)
        val graph =
            localGraphCache.get(graphHandle)
                ?: return EndpointContextResolution.LocalGraphUnavailable(endpointUrl)
        return EndpointContextResolution.Resolved(
            UploadedGraphEndpointContext(endpointUrl, graphHandle, graph, localExecutorFactory.create(graph)),
        )
    }

    private fun remoteContext(endpointUrl: String): EndpointContextResolution {
        val endpoint =
            try {
                RemoteSparqlEndpoint.parse(endpointUrl)
            } catch (exception: IllegalArgumentException) {
                return EndpointContextResolution.InvalidRemoteEndpoint(
                    endpointUrl,
                    exception.message ?: exception.javaClass.simpleName,
                )
            }
        val isWikidata = endpointUrl.contains(WIKIDATA_ENDPOINT_MARKER)
        val execution = remoteExecutorFactory.create(endpoint, isWikidata)
        val context =
            if (isWikidata) {
                WikidataEndpointContext(endpoint, execution)
            } else {
                RemoteSparqlEndpointContext(endpoint, execution)
            }
        return EndpointContextResolution.Resolved(context)
    }
}

private fun String.isCSharpGuid(): Boolean {
    val candidate = trim()
    return listOf(canonicalGuid, noDashGuid, bracedGuid, parenthesizedGuid, hexadecimalGuid).any { pattern ->
        pattern.matches(candidate)
    }
}

private val canonicalGuid = Regex("[0-9A-Fa-f]{8}-(?:[0-9A-Fa-f]{4}-){3}[0-9A-Fa-f]{12}")
private val noDashGuid = Regex("[0-9A-Fa-f]{32}")
private val bracedGuid = Regex("\\{${canonicalGuid.pattern}\\}")
private val parenthesizedGuid = Regex("\\(${canonicalGuid.pattern}\\)")
private val hexadecimalGuid =
    Regex("\\{0x[0-9A-Fa-f]{8},0x[0-9A-Fa-f]{4},0x[0-9A-Fa-f]{4},\\{(?:0x[0-9A-Fa-f]{2},){7}0x[0-9A-Fa-f]{2}\\}\\}")

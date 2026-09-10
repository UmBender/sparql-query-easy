package com.example.sparqlqueryeasy.application.endpoints

import com.example.sparqlqueryeasy.application.localdatabase.InMemoryLocalGraphCache
import com.example.sparqlqueryeasy.application.localdatabase.LocalGraphCache
import com.example.sparqlqueryeasy.application.relationships.EndpointExecution
import com.example.sparqlqueryeasy.domain.model.RdfGraph
import com.example.sparqlqueryeasy.domain.model.RdfGraphHandle
import com.example.sparqlqueryeasy.domain.model.SparqlSelectResult
import com.example.sparqlqueryeasy.domain.model.TurtleParsingFailure
import com.example.sparqlqueryeasy.rdf.TurtleParser
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import org.junit.jupiter.api.Test
import kotlin.test.assertFailsWith

class EndpointContextResolverTest {
    @Test
    fun `BUILTIN-GRAPH-001 resolves the exact built-in identifier to the eager singleton graph`() {
        val graph = RdfGraph()
        val builtIn = CountingBuiltInGraphProvider(graph)
        val localFactory = RecordingLocalFactory()
        val resolver = resolver(InMemoryLocalGraphCache(), builtIn, localFactory, RecordingRemoteFactory())

        val context = resolved(resolver.resolve(BRASILEIRAO_ENDPOINT_ID))

        val builtInContext = context.shouldBeInstanceOf<BuiltInGraphEndpointContext>()
        builtInContext.graph shouldBe graph
        builtInContext.isLocal shouldBe true
        builtInContext.isWikidata shouldBe false
        builtIn.calls shouldBe 1
        localFactory.graphs shouldBe listOf(graph)
        (builtInContext.executor as RecordingExecution).executeCalls shouldBe 0
    }

    @Test
    fun `existing canonical uploaded UUID resolves the exact cached graph`() {
        val handle = RdfGraphHandle("c5d43c99-10c4-4cc0-b3e4-c8e7a7d18153")
        val graph = RdfGraph()
        val cache = InMemoryLocalGraphCache().also { it.put(handle, graph) }
        val localFactory = RecordingLocalFactory()
        val resolver = resolver(cache, CountingBuiltInGraphProvider(RdfGraph()), localFactory, RecordingRemoteFactory())

        val context = resolved(resolver.resolve(handle.identifier))

        val uploaded = context.shouldBeInstanceOf<UploadedGraphEndpointContext>()
        uploaded.graphHandle shouldBe handle
        uploaded.graph shouldBe graph
        uploaded.endpointUrl shouldBe handle.identifier
        uploaded.isLocal shouldBe true
        uploaded.isWikidata shouldBe false
        localFactory.graphs shouldBe listOf(graph)
    }

    @Test
    fun `LOCAL-CACHE-MISS-001 reports an explicitly unavailable canonical local graph`() {
        val endpoint = "c5d43c99-10c4-4cc0-b3e4-c8e7a7d18153"
        val localFactory = RecordingLocalFactory()
        val remoteFactory = RecordingRemoteFactory()
        val resolver =
            resolver(
                InMemoryLocalGraphCache(),
                CountingBuiltInGraphProvider(RdfGraph()),
                localFactory,
                remoteFactory,
            )

        resolver.resolve(endpoint) shouldBe EndpointContextResolution.LocalGraphUnavailable(endpoint)
        localFactory.graphs shouldBe emptyList()
        remoteFactory.endpoints shouldBe emptyList()
    }

    @Test
    fun `WIKIDATA-GENERATION-001 preserves raw case-sensitive Wikidata substring detection`() {
        val remoteFactory = RecordingRemoteFactory()
        val resolver =
            resolver(
                InMemoryLocalGraphCache(),
                CountingBuiltInGraphProvider(RdfGraph()),
                RecordingLocalFactory(),
                remoteFactory,
            )
        val variants =
            listOf(
                "https://query.wikidata.org/sparql",
                "https://query.wikidata.org/sparql/",
                "https://example.test/query.wikidata.org/sparql",
            )

        variants.forEach { endpoint ->
            val context = resolved(resolver.resolve(endpoint)).shouldBeInstanceOf<WikidataEndpointContext>()
            context.endpointUrl shouldBe endpoint
            context.isLocal shouldBe false
            context.isWikidata shouldBe true
        }
        remoteFactory.endpoints.map(RemoteSparqlEndpoint::value) shouldBe variants
    }

    @Test
    fun `case variants and trailing slash preserve C sharp classification without URL normalization`() {
        val resolver =
            resolver(
                InMemoryLocalGraphCache(),
                CountingBuiltInGraphProvider(RdfGraph()),
                RecordingLocalFactory(),
                RecordingRemoteFactory(),
            )

        resolved(
            resolver.resolve("https://query.wikidata.org/sparql/"),
        ).shouldBeInstanceOf<WikidataEndpointContext>()
        resolved(
            resolver.resolve("https://query.wikidata.org/SPARQL"),
        ).shouldBeInstanceOf<RemoteSparqlEndpointContext>()
        resolved(
            resolver.resolve("HTTPS://QUERY.WIKIDATA.ORG/SPARQL"),
        ).shouldBeInstanceOf<RemoteSparqlEndpointContext>()
        resolver.resolve(
            "CampeonatoBrasileiro2023/",
        ).shouldBeInstanceOf<EndpointContextResolution.InvalidRemoteEndpoint>()
    }

    @Test
    fun `generic HTTP remote endpoint is selected without opening a query`() {
        val remoteFactory = RecordingRemoteFactory()
        val resolver =
            resolver(
                InMemoryLocalGraphCache(),
                CountingBuiltInGraphProvider(RdfGraph()),
                RecordingLocalFactory(),
                remoteFactory,
            )

        val context = resolved(resolver.resolve("https://dbpedia.org/sparql"))

        val remote = context.shouldBeInstanceOf<RemoteSparqlEndpointContext>()
        remote.endpoint.value shouldBe "https://dbpedia.org/sparql"
        remote.isLocal shouldBe false
        remote.isWikidata shouldBe false
        (remote.executor as RecordingExecution).executeCalls shouldBe 0
    }

    @Test
    fun `invalid empty and whitespace endpoints return explicit validation failures`() {
        val resolver =
            resolver(
                InMemoryLocalGraphCache(),
                CountingBuiltInGraphProvider(RdfGraph()),
                RecordingLocalFactory(),
                RecordingRemoteFactory(),
            )

        val malformed =
            resolver.resolve("not a URL").shouldBeInstanceOf<EndpointContextResolution.InvalidRemoteEndpoint>()
        malformed.endpointUrl shouldBe "not a URL"
        resolver.resolve("").shouldBeInstanceOf<EndpointContextResolution.InvalidRemoteEndpoint>()
        resolver.resolve(
            " https://query.wikidata.org/sparql ",
        ).shouldBeInstanceOf<EndpointContextResolution.InvalidRemoteEndpoint>()
    }

    @Test
    fun `GUID classification follows C sharp forms but raw cache keys are never normalized`() {
        val canonical = "c5d43c99-10c4-4cc0-b3e4-c8e7a7d18153"
        val cache =
            InMemoryLocalGraphCache().also { graphCache ->
                graphCache.put(RdfGraphHandle(canonical), RdfGraph())
            }
        val resolver =
            resolver(
                cache,
                CountingBuiltInGraphProvider(RdfGraph()),
                RecordingLocalFactory(),
                RecordingRemoteFactory(),
            )

        val uppercase = canonical.uppercase()
        resolver.resolve(uppercase) shouldBe EndpointContextResolution.LocalGraphUnavailable(uppercase)
        resolver.resolve("{$canonical}") shouldBe EndpointContextResolution.LocalGraphUnavailable("{$canonical}")
        val noDash = canonical.replace("-", "")
        resolver.resolve(noDash) shouldBe EndpointContextResolution.LocalGraphUnavailable(noDash)
        val padded = " $canonical "
        resolver.resolve(padded) shouldBe EndpointContextResolution.LocalGraphUnavailable(padded)
        val hexadecimal = "{0xc5d43c99,0x10c4,0x4cc0,{0xb3,0xe4,0xc8,0xe7,0xa7,0xd1,0x81,0x53}}"
        resolver.resolve(hexadecimal) shouldBe EndpointContextResolution.LocalGraphUnavailable(hexadecimal)
    }

    @Test
    fun `interleaved contexts have independent immutable executor capabilities`() {
        val uploadedHandle = RdfGraphHandle("00000000-0000-0000-0000-000000000001")
        val uploadedGraph = RdfGraph()
        val cache = InMemoryLocalGraphCache().also { it.put(uploadedHandle, uploadedGraph) }
        val localFactory = RecordingLocalFactory()
        val remoteFactory = RecordingRemoteFactory()
        val resolver =
            resolver(
                cache,
                CountingBuiltInGraphProvider(RdfGraph()),
                localFactory,
                remoteFactory,
            )

        val local =
            resolved(
                resolver.resolve(uploadedHandle.identifier),
            ).shouldBeInstanceOf<UploadedGraphEndpointContext>()
        val remote =
            resolved(
                resolver.resolve("https://dbpedia.org/sparql"),
            ).shouldBeInstanceOf<RemoteSparqlEndpointContext>()
        val wikidata =
            resolved(
                resolver.resolve("https://query.wikidata.org/sparql"),
            ).shouldBeInstanceOf<WikidataEndpointContext>()
        val localAgain =
            resolved(
                resolver.resolve(uploadedHandle.identifier),
            ).shouldBeInstanceOf<UploadedGraphEndpointContext>()

        (local.executor === localAgain.executor) shouldBe false
        (local.executor === remote.executor) shouldBe false
        (remote.executor === wikidata.executor) shouldBe false
        local.graph shouldBe uploadedGraph
        remote.isWikidata shouldBe false
        wikidata.isWikidata shouldBe true
        localFactory.graphs shouldBe listOf(uploadedGraph, uploadedGraph)
        remoteFactory.endpoints.map(RemoteSparqlEndpoint::value) shouldBe
            listOf("https://dbpedia.org/sparql", "https://query.wikidata.org/sparql")
        remoteFactory.wikidataModes shouldBe listOf(false, true)
    }

    @Test
    fun `bundled Brazilian Turtle is available and parsed built-in graph is loaded once`() {
        ClasspathTurtleTextSource().readUtf8().contains("fut:CampeonatoBrasileiro2023") shouldBe true
        val source = CountingTurtleTextSource("@prefix ex: <https://example.test/> .")
        val parser = CountingTurtleParser(RdfGraph())

        val provider = ParsedBuiltInGraphProvider(source, parser)

        provider.graph() shouldBe RdfGraph()
        provider.graph() shouldBe RdfGraph()
        source.calls shouldBe 1
        parser.calls shouldBe 1
    }

    @Test
    fun `built-in resource loading failures are explicit and parser failures retain their type`() {
        assertFailsWith<BuiltInGraphLoadingFailure> {
            ClasspathTurtleTextSource("missing-built-in.ttl").readUtf8()
        }
        val parserFailure = TurtleParsingFailure("broken built-in Turtle")
        val failure =
            assertFailsWith<TurtleParsingFailure> {
                ParsedBuiltInGraphProvider(CountingTurtleTextSource("invalid"), ThrowingTurtleParser(parserFailure))
            }
        failure shouldBe parserFailure
    }

    private fun resolver(
        cache: LocalGraphCache,
        builtIn: BuiltInGraphProvider,
        localFactory: LocalEndpointExecutorFactory,
        remoteFactory: RemoteEndpointExecutorFactory,
    ) = EndpointContextResolver(cache, builtIn, localFactory, remoteFactory)

    private fun resolved(resolution: EndpointContextResolution): EndpointContext =
        resolution.shouldBeInstanceOf<EndpointContextResolution.Resolved>().context

    private class CountingBuiltInGraphProvider(private val loadedGraph: RdfGraph) : BuiltInGraphProvider {
        var calls = 0

        override fun graph(): RdfGraph {
            calls++
            return loadedGraph
        }
    }

    private class RecordingLocalFactory : LocalEndpointExecutorFactory {
        val graphs = mutableListOf<RdfGraph>()

        override fun create(graph: RdfGraph): EndpointExecution {
            graphs += graph
            return RecordingExecution(isLocal = true, isWikidata = false)
        }
    }

    private class RecordingRemoteFactory : RemoteEndpointExecutorFactory {
        val endpoints = mutableListOf<RemoteSparqlEndpoint>()
        val wikidataModes = mutableListOf<Boolean>()

        override fun create(
            endpoint: RemoteSparqlEndpoint,
            isWikidata: Boolean,
        ): EndpointExecution {
            endpoints += endpoint
            wikidataModes += isWikidata
            return RecordingExecution(isLocal = false, isWikidata = isWikidata)
        }
    }

    private class RecordingExecution(
        override val isLocal: Boolean,
        override val isWikidata: Boolean,
    ) : EndpointExecution {
        var executeCalls = 0

        override suspend fun execute(query: String): SparqlSelectResult {
            executeCalls++
            return SparqlSelectResult(emptyList(), emptyList())
        }
    }

    private class CountingTurtleTextSource(private val turtle: String) : TurtleTextSource {
        var calls = 0

        override fun readUtf8(): String {
            calls++
            return turtle
        }
    }

    private class CountingTurtleParser(private val graph: RdfGraph) : TurtleParser {
        var calls = 0

        override fun parse(
            turtle: String,
            baseIri: com.example.sparqlqueryeasy.domain.model.Iri?,
        ): RdfGraph {
            calls++
            return graph
        }
    }

    private class ThrowingTurtleParser(private val failure: TurtleParsingFailure) : TurtleParser {
        override fun parse(
            turtle: String,
            baseIri: com.example.sparqlqueryeasy.domain.model.Iri?,
        ): RdfGraph = throw failure
    }
}

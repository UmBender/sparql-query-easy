package com.example.sparqlqueryeasy.application.localdatabase

import com.example.sparqlqueryeasy.domain.model.BlankNode
import com.example.sparqlqueryeasy.domain.model.Iri
import com.example.sparqlqueryeasy.domain.model.Literal
import com.example.sparqlqueryeasy.domain.model.RdfGraph
import com.example.sparqlqueryeasy.domain.model.RdfGraphHandle
import com.example.sparqlqueryeasy.domain.model.RdfStatement
import com.example.sparqlqueryeasy.rdf.jena.JenaTurtleParser
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId

class LocalDatabaseUploadServiceTest {
    private val parser = JenaTurtleParser()

    @Test
    fun `TTL-SIMPLE-001 stores a complete simple graph under the generated UUID`() {
        val cache = InMemoryLocalGraphCache()
        val service = service(cache, "c5d43c99-10c4-4cc0-b3e4-c8e7a7d18153")
        val upload = TrackedTurtleUpload(resource("turtle/simple.ttl"))

        val result = service.upload(LocalDatabaseUploadRequest(upload))

        result shouldBe LocalDatabaseUploadResult.Success(RdfGraphHandle("c5d43c99-10c4-4cc0-b3e4-c8e7a7d18153"))
        stored(cache, RdfGraphHandle("c5d43c99-10c4-4cc0-b3e4-c8e7a7d18153")).statements shouldHaveSize 5
        upload.closeCalls shouldBe 1
    }

    @Test
    fun `TTL-PREFIX-001 preserves prefix expansion in the stored graph`() {
        val cache = InMemoryLocalGraphCache()
        val handle = RdfGraphHandle("00000000-0000-0000-0000-000000000001")

        service(cache, handle.identifier).upload(
            LocalDatabaseUploadRequest(TrackedTurtleUpload(resource("turtle/prefixes.ttl"))),
        )

        stored(cache, handle).statements shouldContain
            RdfStatement(
                Iri("https://example.test/prefix/prefixed-resource"),
                Iri("https://example.test/vocabulary/hasValue"),
                Iri("https://example.test/prefix/prefixed-target"),
            )
    }

    @Test
    fun `TTL-BASE-001 uses the document base IRI before storing the graph`() {
        val cache = InMemoryLocalGraphCache()
        val handle = RdfGraphHandle("00000000-0000-0000-0000-000000000002")

        service(cache, handle.identifier).upload(
            LocalDatabaseUploadRequest(TrackedTurtleUpload(resource("turtle/base-iri.ttl"))),
        )

        stored(cache, handle).statements shouldContain
            RdfStatement(
                Iri("https://example.test/base/relative-item"),
                Iri("https://example.test/base/related"),
                Iri("https://example.test/base/relative-target"),
            )
    }

    @Test
    fun `TTL-IRI-UNICODE-001 preserves escaped and direct Unicode IRIs`() {
        val cache = InMemoryLocalGraphCache()
        val handle = RdfGraphHandle("00000000-0000-0000-0000-000000000003")

        service(cache, handle.identifier).upload(
            LocalDatabaseUploadRequest(TrackedTurtleUpload(resource("turtle/escaped-unicode-iris.ttl"))),
        )

        stored(cache, handle).statements.map { it.subject } shouldContainExactlyInAnyOrder
            listOf(
                Iri("https://example.test/café"),
                Iri("https://example.test/café"),
                Iri("https://example.test/naïve"),
                Iri("https://example.test/naïve"),
            )
    }

    @Test
    fun `TTL-BNODE-001 preserves distinct blank node graph identity`() {
        val cache = InMemoryLocalGraphCache()
        val handle = RdfGraphHandle("00000000-0000-0000-0000-000000000004")

        service(cache, handle.identifier).upload(
            LocalDatabaseUploadRequest(TrackedTurtleUpload(resource("turtle/blank-nodes.ttl"))),
        )

        stored(cache, handle).statements.flatMap { statement ->
            listOfNotNull(statement.subject as? BlankNode, statement.`object` as? BlankNode)
        }.distinct() shouldHaveSize 2
    }

    @Test
    fun `TTL-LITERAL-001 and TTL-NUMERIC-001 preserve literal lexical datatype and language data`() {
        val cache = InMemoryLocalGraphCache()
        val literalHandle = RdfGraphHandle("00000000-0000-0000-0000-000000000005")
        val numericHandle = RdfGraphHandle("00000000-0000-0000-0000-000000000006")
        val generator = FixedHandleGenerator(listOf(literalHandle, numericHandle))
        val service = LocalDatabaseUploadService(parser, cache, generator)

        service.upload(LocalDatabaseUploadRequest(TrackedTurtleUpload(resource("turtle/literals.ttl"))))
        service.upload(LocalDatabaseUploadRequest(TrackedTurtleUpload(resource("turtle/numeric-literals.ttl"))))

        val xsd = "http://www.w3.org/2001/XMLSchema#"
        stored(cache, literalHandle).statements.map(RdfStatement::`object`) shouldContain
            Literal("plain text", Iri("${xsd}string"))
        stored(cache, literalHandle).statements.map(RdfStatement::`object`) shouldContain
            Literal("olá", Literal.RDF_LANG_STRING, "pt-BR")
        stored(cache, literalHandle).statements.map(RdfStatement::`object`) shouldContain
            Literal("typed text", Iri("${xsd}string"))
        stored(cache, numericHandle).statements.map(RdfStatement::`object`) shouldContain
            Literal("7", Iri("${xsd}integer"))
        stored(cache, numericHandle).statements.map(RdfStatement::`object`) shouldContain
            Literal("7.50", Iri("${xsd}decimal"))
    }

    @Test
    fun `TTL-EMPTY-001 stores an empty valid graph`() {
        val cache = InMemoryLocalGraphCache()
        val handle = RdfGraphHandle("00000000-0000-0000-0000-000000000007")

        service(cache, handle.identifier).upload(
            LocalDatabaseUploadRequest(TrackedTurtleUpload(resource("turtle/empty.ttl"))),
        )

        stored(cache, handle).statements shouldBe emptySet()
    }

    @Test
    fun `TTL-INVALID-001 returns parser diagnostics closes the upload and leaves no cache entry`() {
        val cache = InMemoryLocalGraphCache()
        val handle = RdfGraphHandle("00000000-0000-0000-0000-000000000008")
        val upload = TrackedTurtleUpload(resource("turtle/invalid-unclosed-string.ttl"))

        val result = service(cache, handle.identifier).upload(LocalDatabaseUploadRequest(upload))

        (result as LocalDatabaseUploadResult.InvalidTurtle).failure.diagnostic.isNotBlank() shouldBe true
        cache.get(handle) shouldBe null
        upload.closeCalls shouldBe 1
    }

    @Test
    fun `TTL-INVALID-002 returns parser diagnostics and leaves no cache entry`() {
        val cache = InMemoryLocalGraphCache()
        val handle = RdfGraphHandle("00000000-0000-0000-0000-000000000009")

        val result =
            service(cache, handle.identifier).upload(
                LocalDatabaseUploadRequest(TrackedTurtleUpload(resource("turtle/invalid-prefix.ttl"))),
            )

        (result is LocalDatabaseUploadResult.InvalidTurtle) shouldBe true
        cache.get(handle) shouldBe null
    }

    @Test
    fun `HTTP-MISSING-UPLOAD-001 is distinguishable at the application boundary`() {
        val generator = FixedHandleGenerator(listOf(RdfGraphHandle("00000000-0000-0000-0000-000000000010")))
        val service = LocalDatabaseUploadService(parser, InMemoryLocalGraphCache(), generator)

        service.upload(LocalDatabaseUploadRequest(upload = null)) shouldBe LocalDatabaseUploadResult.MissingUpload
        generator.calls shouldBe 1
    }

    @Test
    fun `unexpected upload reads propagate and still close the upload without caching a graph`() {
        val cache = InMemoryLocalGraphCache()
        val handle = RdfGraphHandle("00000000-0000-0000-0000-000000000014")
        val upload = FailingTurtleUpload()
        val service = service(cache, handle.identifier)

        val failure = runCatching { service.upload(LocalDatabaseUploadRequest(upload)) }.exceptionOrNull()

        failure shouldBe upload.failure
        upload.closeCalls shouldBe 1
        cache.get(handle) shouldBe null
    }

    @Test
    fun `cache failures propagate after parsing and still close the upload`() {
        val expected = IllegalStateException("cache failed")
        val cache = ThrowingCache(expected)
        val upload = TrackedTurtleUpload(resource("turtle/empty.ttl"))
        val service = service(cache, "00000000-0000-0000-0000-000000000016")

        val failure = runCatching { service.upload(LocalDatabaseUploadRequest(upload)) }.exceptionOrNull()

        failure shouldBe expected
        upload.closeCalls shouldBe 1
    }

    @Test
    fun `two uploads retain independent graphs and cache replacement is last write wins`() {
        val cache = InMemoryLocalGraphCache()
        val first = RdfGraphHandle("00000000-0000-0000-0000-000000000011")
        val second = RdfGraphHandle("00000000-0000-0000-0000-000000000012")
        val service = LocalDatabaseUploadService(parser, cache, FixedHandleGenerator(listOf(first, second)))

        service.upload(LocalDatabaseUploadRequest(TrackedTurtleUpload(resource("turtle/simple.ttl"))))
        service.upload(LocalDatabaseUploadRequest(TrackedTurtleUpload(resource("turtle/empty.ttl"))))

        stored(cache, first).statements shouldHaveSize 5
        stored(cache, second).statements shouldBe emptySet()
        cache.put(first, parser.parse(resource("turtle/empty.ttl")))
        stored(cache, first).statements shouldBe emptySet()
    }

    @Test
    fun `cache misses after its C sharp sliding expiration and renews on successful access`() {
        val clock = MutableClock(Instant.parse("2026-09-09T12:00:00Z"))
        val cache = InMemoryLocalGraphCache(clock, Duration.ofHours(12))
        val handle = RdfGraphHandle("00000000-0000-0000-0000-000000000013")
        cache.put(handle, parser.parse(resource("turtle/empty.ttl")))

        clock.advance(Duration.ofHours(11))
        cache.get(handle) shouldBe parser.parse(resource("turtle/empty.ttl"))
        clock.advance(Duration.ofHours(11))
        cache.get(handle) shouldBe parser.parse(resource("turtle/empty.ttl"))
        clock.advance(Duration.ofHours(12))

        cache.get(handle) shouldBe null
    }

    @Test
    fun `cache returns null for a graph handle that was never stored`() {
        val handle = RdfGraphHandle("00000000-0000-0000-0000-000000000015")

        InMemoryLocalGraphCache().get(handle) shouldBe null
    }

    private fun service(
        cache: LocalGraphCache,
        handle: String,
    ): LocalDatabaseUploadService =
        LocalDatabaseUploadService(
            parser,
            cache,
            FixedHandleGenerator(listOf(RdfGraphHandle(handle))),
        )

    private fun resource(path: String): String =
        requireNotNull(javaClass.classLoader.getResourceAsStream(path)).bufferedReader().use { it.readText() }

    private fun stored(
        cache: LocalGraphCache,
        handle: RdfGraphHandle,
    ): RdfGraph = requireNotNull(cache.get(handle))

    private class TrackedTurtleUpload(private val turtle: String) : TurtleUpload {
        var closeCalls = 0

        override fun readUtf8(): String = turtle

        override fun close() {
            closeCalls++
        }
    }

    private class FailingTurtleUpload : TurtleUpload {
        val failure = IllegalStateException("stream failed")
        var closeCalls = 0

        override fun readUtf8(): String = throw failure

        override fun close() {
            closeCalls++
        }
    }

    private class FixedHandleGenerator(
        private val handles: List<RdfGraphHandle>,
    ) : LocalGraphHandleGenerator {
        var calls = 0

        override fun next(): RdfGraphHandle = handles[calls++]
    }

    private class ThrowingCache(private val failure: RuntimeException) : LocalGraphCache {
        override fun put(
            handle: RdfGraphHandle,
            graph: RdfGraph,
        ): Nothing = throw failure

        override fun get(handle: RdfGraphHandle): RdfGraph? = null
    }

    private class MutableClock(private var current: Instant) : Clock() {
        override fun getZone(): ZoneId = ZoneId.of("UTC")

        override fun withZone(zone: ZoneId): Clock = this

        override fun instant(): Instant = current

        fun advance(duration: Duration) {
            current = current.plus(duration)
        }
    }
}

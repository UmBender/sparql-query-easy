@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.rdf.jena

import com.example.sparqlqueryeasy.domain.model.SparqlQueryExecutionFailure
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import java.net.InetAddress
import java.net.ServerSocket
import java.net.SocketException
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread
import kotlin.test.assertFailsWith

/**
 * QUAL-020: local graphs never run SERVICE, whatever query reaches them. The SERVICE target is a
 * socket on the loopback interface that counts connections, so the test needs no network and
 * proves no request was even attempted.
 */
class LocalServiceRefusalTest {
    private val graph = JenaTurtleParser().parse("<urn:s> <urn:p> \"o\" .")
    private val executor = JenaLocalSparqlExecutor()
    private val connections = AtomicInteger()
    private lateinit var server: ServerSocket
    private val endpoint get() = "http://127.0.0.1:${server.localPort}/sparql"

    @BeforeEach
    fun listen() {
        server = ServerSocket(0, 1, InetAddress.getLoopbackAddress())
        thread(isDaemon = true) {
            try {
                while (true) server.accept().use { connections.incrementAndGet() }
            } catch (_: SocketException) {
                // closed by stop()
            }
        }
    }

    @AfterEach
    fun stop() = server.close()

    private fun refuses(query: String) {
        val failure = assertFailsWith<SparqlQueryExecutionFailure> { runBlocking { executor.execute(graph, query) } }
        failure.diagnostic shouldBe SERVICE_REFUSED
        connections.get() shouldBe 0
    }

    @Test
    fun `a SERVICE pattern is refused before any request`() = refuses("SELECT * WHERE { SERVICE <$endpoint> { ?s ?p ?o } }")

    @Test
    fun `SERVICE SILENT is refused too instead of silently answering`() =
        refuses("SELECT * WHERE { ?s ?p ?o . SERVICE SILENT <$endpoint> { ?s ?p ?x } }")

    @Test
    fun `a SERVICE nested in FILTER EXISTS or a subquery is refused`() {
        refuses("SELECT * WHERE { ?s ?p ?o FILTER EXISTS { SERVICE <$endpoint> { ?s ?p ?o } } }")
        refuses("SELECT * WHERE { { SELECT ?s WHERE { SERVICE <$endpoint> { ?s ?p ?o } } } }")
        refuses("SELECT * WHERE { ?s ?p ?o OPTIONAL { SERVICE ?where { ?s ?p ?x } } VALUES ?where { <$endpoint> } }")
    }

    @Test
    fun `a query without SERVICE still runs`() {
        val result = runBlocking { executor.execute(graph, "SELECT * WHERE { ?s ?p ?o }") }
        (result as com.example.sparqlqueryeasy.domain.model.SparqlSelectResult).rows.size shouldBe 1
    }
}

@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.security

import com.example.sparqlqueryeasy.application.endpoints.POKEMON_ENDPOINT_ID
import com.example.sparqlqueryeasy.http.configureErrorHandling
import com.example.sparqlqueryeasy.http.configureRouting
import com.example.sparqlqueryeasy.http.configureSerialization
import io.kotest.assertions.withClue
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.PropTestConfig
import io.kotest.property.arbitrary.choice
import io.kotest.property.arbitrary.element
import io.kotest.property.arbitrary.list
import io.kotest.property.arbitrary.map
import io.kotest.property.checkAll
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.Test

/**
 * QUAL-020, property-based on top of the fixed payload list: random strings built from SPARQL
 * delimiters, escapes, control characters and keywords go into every drawn-query field (View SPARQL
 * and the count on PokemonGen1) and every staged binding, with the same oracle.
 */
class SparqlInjectionPropertyTest {
    private val characters =
        "\"'\\{}<>?\$#.;,()[]|^`@:/=&!*+- \n\r\t\u0000\u0007\u001b\u007f\u0085\u00a0\u2028\ufeffé_aAxsSo0159eEu".map(Char::toString)
    private val tokens =
        listOf(
            "SERVICE <http://attacker.invalid/> { ?s ?p ?o }", "UNION", "FILTER", "} ", " {", "\\u0022", "\\u003E",
            "INSERT DATA", "DROP ALL", "FROM <http://attacker.invalid/>", "?s ?p ?o", "\"\"\"", "'''", "^^", "@en", "..",
        )
    private val text = Arb.list(Arb.choice(Arb.element(characters), Arb.element(tokens)), 0..16).map { it.joinToString("") }
    private val config = PropTestConfig(iterations = ITERATIONS)

    private fun property(slots: List<InjectionSlot>) =
        testApplication {
            val recorder = QueryRecorder()
            application {
                configureSerialization()
                configureErrorHandling()
                configureRouting(recordingHttpDependencies(recorder))
            }
            slots.forEach { slot ->
                val baseline = client.baseline(slot, recorder)
                checkAll(config, text) { value ->
                    if (slot.admits(value)) {
                        withClue("$slot <- ${js(value)}") { client.probe(slot, recorder, baseline, value) shouldBe null }
                    }
                }
            }
        }

    @Test
    fun `random text in any drawn-query field never changes the generated query`() =
        property(drawnQueryRouteSlots(POKEMON_ENDPOINT_ID).filter { it.path == "/api/query/sparql" || it.path == "/api/query/count" })

    @Test
    fun `random text in any staged binding never changes the generated query`() = property(stageBindingSlots(POKEMON_ENDPOINT_ID))

    private companion object {
        const val ITERATIONS = 150
    }
}

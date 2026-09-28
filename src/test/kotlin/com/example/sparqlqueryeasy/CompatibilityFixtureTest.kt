package com.example.sparqlqueryeasy

import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test
import java.io.InputStream

class CompatibilityFixtureTest {
    @Test
    fun `shared Turtle fixture is available to tests`() {
        val fixture: InputStream? = javaClass.getResourceAsStream("/turtle/simple.ttl")

        val loadedFixture = requireNotNull(fixture) { "Expected a compatibility fixture resource" }
        loadedFixture.bufferedReader().use { reader ->
            reader.readLine() shouldBe "@prefix ex: <https://example.test/> ."
        }
    }
}

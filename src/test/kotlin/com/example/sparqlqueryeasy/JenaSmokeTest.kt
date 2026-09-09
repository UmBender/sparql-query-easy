package com.example.sparqlqueryeasy

import com.example.sparqlqueryeasy.rdf.jena.JenaRdfStore
import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test

class JenaSmokeTest {
    @Test
    fun `initial Jena adapter starts with an empty model`() {
        JenaRdfStore().statementCount() shouldBe 0L
    }
}

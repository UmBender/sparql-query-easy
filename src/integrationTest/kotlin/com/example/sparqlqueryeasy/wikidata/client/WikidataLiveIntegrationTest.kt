package com.example.sparqlqueryeasy.wikidata.client

import io.kotest.matchers.collections.shouldNotBeEmpty
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Test

/** Live network coverage; this class is only compiled/executed by the opt-in integrationTest task. */
class WikidataLiveIntegrationTest {
    @Test
    fun `configured Wikidata endpoint accepts a basic SELECT`() {
        val endpoint = System.getenv("WIKIDATA_SPARQL_ENDPOINT") ?: "https://query.wikidata.org/sparql"
        createWikidataHttpClient(endpoint).use { client ->
            runBlocking {
                client.execute("SELECT ?item WHERE { VALUES ?item { <https://www.wikidata.org/entity/Q42> } }")
                    .rows.shouldNotBeEmpty()
            }
        }
    }
}

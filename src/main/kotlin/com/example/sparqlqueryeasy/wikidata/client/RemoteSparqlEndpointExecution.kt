package com.example.sparqlqueryeasy.wikidata.client

import com.example.sparqlqueryeasy.application.relationships.EndpointExecution
import com.example.sparqlqueryeasy.domain.model.SparqlSelectResult
import io.ktor.client.HttpClient

/** Request-scoped transport adapter for both Wikidata and generic SPARQL JSON endpoints. */
class RemoteSparqlEndpointExecution(
    endpoint: String,
    override val isWikidata: Boolean,
    httpClient: HttpClient,
) : EndpointExecution {
    private val client = KtorWikidataHttpClient(endpoint, httpClient)

    override val isLocal: Boolean = false

    override suspend fun execute(query: String): SparqlSelectResult = client.execute(query)
}

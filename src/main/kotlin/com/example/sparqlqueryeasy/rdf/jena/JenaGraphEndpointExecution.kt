@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.rdf.jena

import com.example.sparqlqueryeasy.application.relationships.EndpointExecution
import com.example.sparqlqueryeasy.domain.model.RdfGraph
import com.example.sparqlqueryeasy.domain.model.SparqlSelectResult

/** Request-scoped local execution adapter. Jena remains confined to rdf.jena. */
class JenaGraphEndpointExecution(
    private val graph: RdfGraph,
    private val executor: JenaLocalSparqlExecutor = JenaLocalSparqlExecutor(),
) : EndpointExecution {
    override val isLocal: Boolean = true
    override val isWikidata: Boolean = false

    override suspend fun execute(query: String): SparqlSelectResult = executor.execute(graph, query) as SparqlSelectResult
}

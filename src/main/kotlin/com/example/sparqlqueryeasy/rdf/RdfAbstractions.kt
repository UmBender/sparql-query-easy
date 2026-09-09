package com.example.sparqlqueryeasy.rdf

import com.example.sparqlqueryeasy.domain.model.Iri
import com.example.sparqlqueryeasy.domain.model.RdfGraph
import com.example.sparqlqueryeasy.domain.model.RdfValue
import com.example.sparqlqueryeasy.domain.model.SparqlResult

interface RdfStore {
    fun statementCount(): Long
}

interface SparqlExecutor {
    suspend fun execute(query: String): SparqlResult
}

interface TurtleParser {
    fun parse(
        turtle: String,
        baseIri: Iri? = null,
    ): RdfGraph
}

interface LocalSparqlExecutor {
    suspend fun execute(
        graph: RdfGraph,
        query: String,
    ): SparqlResult
}

interface RdfValueFormatter {
    fun format(
        value: RdfValue,
        removeIriDelimiters: Boolean = false,
    ): String
}

interface RdfValueMapper<in Source> {
    fun map(value: Source): RdfValue
}

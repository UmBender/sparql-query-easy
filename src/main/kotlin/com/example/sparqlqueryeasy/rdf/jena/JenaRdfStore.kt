package com.example.sparqlqueryeasy.rdf.jena

import com.example.sparqlqueryeasy.rdf.RdfStore
import org.apache.jena.rdf.model.Model
import org.apache.jena.rdf.model.ModelFactory

/** Initial Jena adapter. Jena types remain private to this infrastructure package. */
class JenaRdfStore : RdfStore {
    private val model: Model = ModelFactory.createDefaultModel()

    override fun statementCount(): Long = model.size()
}

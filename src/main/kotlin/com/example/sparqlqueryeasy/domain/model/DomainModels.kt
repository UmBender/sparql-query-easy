package com.example.sparqlqueryeasy.domain.model

import java.net.URI
import java.net.URISyntaxException

/** Application-owned RDF representation; RDF library types must not cross this boundary. */
sealed interface RdfValue

sealed interface RdfResource : RdfValue

data class Iri(val value: String) : RdfResource {
    init {
        require(value.isNotBlank()) { "An IRI must not be blank" }

        val parsed =
            try {
                URI(value)
            } catch (exception: URISyntaxException) {
                throw IllegalArgumentException("Invalid IRI: $value", exception)
            }

        require(parsed.isAbsolute) { "An IRI must be absolute: $value" }
    }
}

data class BlankNode(val identifier: String) : RdfResource {
    init {
        require(identifier.isNotBlank()) { "A blank node identifier must not be blank" }
    }
}

data class Literal(
    val lexicalForm: String,
    val datatype: Iri? = null,
    val language: String? = null,
) : RdfValue {
    init {
        language?.let {
            require(languageTag.matches(it)) { "Invalid language tag: $it" }
            require(datatype == null || datatype == RDF_LANG_STRING) {
                "A language-tagged literal may only declare rdf:langString as its datatype"
            }
        }
        require(language != null || datatype != RDF_LANG_STRING) {
            "rdf:langString requires a language tag"
        }
    }

    companion object {
        val RDF_LANG_STRING = Iri("http://www.w3.org/1999/02/22-rdf-syntax-ns#langString")

        private val languageTag = Regex("[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*")
    }
}

data class RdfStatement(
    val subject: RdfResource,
    val predicate: Iri,
    val `object`: RdfValue,
)

data class RdfGraph(val statements: Set<RdfStatement> = emptySet())

@JvmInline
value class RdfGraphHandle(val identifier: String) {
    init {
        require(identifier.isNotBlank()) { "An RDF graph handle must not be blank" }
    }
}

@JvmInline
value class SparqlVariable(val name: String) {
    init {
        require(name.isNotBlank()) { "A SPARQL variable name must not be blank" }
        require(!name.startsWith('?') && !name.startsWith('$')) {
            "A SPARQL variable name must not include a query sigil"
        }
    }
}

sealed interface SparqlBinding {
    val variable: SparqlVariable
}

data class BoundSparqlBinding(
    override val variable: SparqlVariable,
    val value: RdfValue,
) : SparqlBinding

data class UnboundSparqlBinding(
    override val variable: SparqlVariable,
) : SparqlBinding

data class SparqlResultRow(val bindings: List<SparqlBinding>) {
    init {
        require(bindings.map(SparqlBinding::variable).distinct().size == bindings.size) {
            "A SPARQL result row cannot contain more than one binding for a variable"
        }
    }

    fun binding(variable: SparqlVariable): SparqlBinding? = bindings.singleOrNull { it.variable == variable }
}

sealed interface SparqlResult

data class SparqlSelectResult(
    val projectedVariables: List<SparqlVariable>,
    val rows: List<SparqlResultRow>,
) : SparqlResult {
    init {
        require(projectedVariables.distinct().size == projectedVariables.size) {
            "Projected SPARQL variables must be unique"
        }

        val projectedVariableSet = projectedVariables.toSet()
        rows.forEach { row ->
            require(row.bindings.map(SparqlBinding::variable).toSet() == projectedVariableSet) {
                "Every projected variable must be bound or explicitly unbound in each row"
            }
        }
    }
}

data class SparqlAskResult(val value: Boolean) : SparqlResult

data class SparqlConstructResult(val graph: RdfGraph) : SparqlResult

sealed class RdfFailure(
    message: String,
    cause: Throwable? = null,
) : RuntimeException(message, cause)

class TurtleParsingFailure(
    val diagnostic: String,
    val baseIri: Iri? = null,
    cause: Throwable? = null,
) : RdfFailure("Turtle parsing failed: $diagnostic", cause)

class SparqlQueryExecutionFailure(
    val query: String,
    val diagnostic: String,
    cause: Throwable? = null,
) : RdfFailure("SPARQL query execution failed: $diagnostic", cause)

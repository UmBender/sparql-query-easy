package com.example.sparqlqueryeasy.rdf.jena

import com.example.sparqlqueryeasy.domain.model.BlankNode
import com.example.sparqlqueryeasy.domain.model.BoundSparqlBinding
import com.example.sparqlqueryeasy.domain.model.Iri
import com.example.sparqlqueryeasy.domain.model.Literal
import com.example.sparqlqueryeasy.domain.model.RdfGraph
import com.example.sparqlqueryeasy.domain.model.RdfResource
import com.example.sparqlqueryeasy.domain.model.RdfStatement
import com.example.sparqlqueryeasy.domain.model.RdfValue
import com.example.sparqlqueryeasy.domain.model.SparqlAskResult
import com.example.sparqlqueryeasy.domain.model.SparqlConstructResult
import com.example.sparqlqueryeasy.domain.model.SparqlQueryExecutionFailure
import com.example.sparqlqueryeasy.domain.model.SparqlResult
import com.example.sparqlqueryeasy.domain.model.SparqlResultRow
import com.example.sparqlqueryeasy.domain.model.SparqlSelectResult
import com.example.sparqlqueryeasy.domain.model.SparqlVariable
import com.example.sparqlqueryeasy.domain.model.TurtleParsingFailure
import com.example.sparqlqueryeasy.domain.model.UnboundSparqlBinding
import com.example.sparqlqueryeasy.rdf.LocalSparqlExecutor
import com.example.sparqlqueryeasy.rdf.RdfValueFormatter
import com.example.sparqlqueryeasy.rdf.RdfValueMapper
import com.example.sparqlqueryeasy.rdf.TurtleParser
import org.apache.jena.query.QueryException
import org.apache.jena.query.QueryExecution
import org.apache.jena.query.QueryFactory
import org.apache.jena.rdf.model.AnonId
import org.apache.jena.rdf.model.Model
import org.apache.jena.rdf.model.ModelFactory
import org.apache.jena.rdf.model.RDFNode
import org.apache.jena.riot.Lang
import org.apache.jena.riot.RDFParser
import org.apache.jena.riot.RiotException
import org.apache.jena.sparql.ARQException

/** Maps Jena nodes at the RDF infrastructure boundary into application-owned values. */
class JenaRdfValueMapper : RdfValueMapper<RDFNode> {
    override fun map(value: RDFNode): RdfValue =
        when {
            value.isURIResource -> Iri(requireNotNull(value.asResource().uri))
            value.isAnon -> BlankNode(value.asResource().id.labelString)
            value.isLiteral -> {
                val literal = value.asLiteral()
                val language = literal.language.ifBlank { null }
                // Jena represents RDF 1.1 simple strings as xsd:string; retaining this is
                // necessary to avoid losing datatype information at the infrastructure boundary.
                Literal(
                    lexicalForm = literal.lexicalForm,
                    datatype = literal.datatypeURI?.let(::Iri),
                    language = language,
                )
            }
            else -> error("Unsupported Jena RDF node")
        }
}

/** Explicit compatibility formatter matching SparqlResultExtension.GetStringValue in the C# service. */
class DotNetRdfValueFormatter : RdfValueFormatter {
    override fun format(
        value: RdfValue,
        removeIriDelimiters: Boolean,
    ): String =
        when (value) {
            is Iri -> if (removeIriDelimiters) value.value else "<${value.value}>"
            is BlankNode -> "blank"
            is Literal -> value.lexicalForm
        }
}

class JenaTurtleParser(
    private val mapper: JenaRdfValueMapper = JenaRdfValueMapper(),
) : TurtleParser {
    override fun parse(
        turtle: String,
        baseIri: Iri?,
    ): RdfGraph {
        val model = ModelFactory.createDefaultModel()
        try {
            val parser = RDFParser.fromString(turtle, Lang.TURTLE)
            if (baseIri != null) {
                parser.base(baseIri.value)
            }
            parser.parse(model)
            return model.toDomainGraph(mapper)
        } catch (exception: RiotException) {
            throw TurtleParsingFailure(
                diagnostic = exception.message ?: exception.javaClass.simpleName,
                baseIri = baseIri,
                cause = exception,
            )
        }
    }
}

class JenaLocalSparqlExecutor(
    private val mapper: JenaRdfValueMapper = JenaRdfValueMapper(),
) : LocalSparqlExecutor {
    override suspend fun execute(
        graph: RdfGraph,
        query: String,
    ): SparqlResult =
        try {
            val jenaQuery = QueryFactory.create(query)
            val model = graph.toJenaModel()
            QueryExecution.create(jenaQuery, model).use { execution ->
                when {
                    jenaQuery.isSelectType -> {
                        val resultSet = execution.execSelect()
                        val projectedVariables = resultSet.resultVars.map(::SparqlVariable)
                        val rows =
                            buildList {
                                while (resultSet.hasNext()) {
                                    val solution = resultSet.next()
                                    add(
                                        SparqlResultRow(
                                            projectedVariables.map { variable ->
                                                val node = solution.get(variable.name)
                                                if (node == null) {
                                                    UnboundSparqlBinding(variable)
                                                } else {
                                                    BoundSparqlBinding(variable, mapper.map(node))
                                                }
                                            },
                                        ),
                                    )
                                }
                            }
                        SparqlSelectResult(projectedVariables, rows)
                    }
                    jenaQuery.isAskType -> SparqlAskResult(execution.execAsk())
                    jenaQuery.isConstructType -> SparqlConstructResult(execution.execConstruct().toDomainGraph(mapper))
                    jenaQuery.isDescribeType -> SparqlConstructResult(execution.execDescribe().toDomainGraph(mapper))
                    else -> throw IllegalArgumentException("Only SPARQL query operations are supported")
                }
            }
        } catch (exception: SparqlQueryExecutionFailure) {
            throw exception
        } catch (exception: QueryException) {
            throw queryFailure(query, exception)
        } catch (exception: ARQException) {
            throw queryFailure(query, exception)
        } catch (exception: IllegalArgumentException) {
            throw queryFailure(query, exception)
        }
}

private fun queryFailure(
    query: String,
    exception: RuntimeException,
) = SparqlQueryExecutionFailure(
    query = query,
    diagnostic = exception.message ?: exception.javaClass.simpleName,
    cause = exception,
)

/** Uses Jena's isomorphism check so blank-node labels and serialized triple order do not affect comparison. */
class JenaRdfGraphComparator {
    fun areIsomorphic(
        left: RdfGraph,
        right: RdfGraph,
    ): Boolean = left.toJenaModel().isIsomorphicWith(right.toJenaModel())
}

private fun Model.toDomainGraph(mapper: JenaRdfValueMapper): RdfGraph {
    val iterator = listStatements()
    return try {
        RdfGraph(
            buildSet {
                while (iterator.hasNext()) {
                    val statement = iterator.nextStatement()
                    add(
                        RdfStatement(
                            subject = mapper.map(statement.subject) as RdfResource,
                            predicate = Iri(statement.predicate.uri),
                            `object` = mapper.map(statement.`object`),
                        ),
                    )
                }
            },
        )
    } finally {
        iterator.close()
    }
}

private fun RdfGraph.toJenaModel(): Model =
    ModelFactory.createDefaultModel().also { model ->
        statements.forEach { statement ->
            model.add(
                model.createStatement(
                    statement.subject.toJenaResource(model),
                    model.createProperty(statement.predicate.value),
                    statement.`object`.toJenaNode(model),
                ),
            )
        }
    }

private fun RdfResource.toJenaResource(model: Model) =
    when (this) {
        is Iri -> model.createResource(value)
        is BlankNode -> model.createResource(AnonId(identifier))
    }

private fun RdfValue.toJenaNode(model: Model): RDFNode =
    when (this) {
        is Iri -> model.createResource(value)
        is BlankNode -> model.createResource(AnonId(identifier))
        is Literal ->
            when {
                language != null -> model.createLiteral(lexicalForm, language)
                datatype != null -> model.createTypedLiteral(lexicalForm, datatype.value)
                else -> model.createLiteral(lexicalForm)
            }
    }

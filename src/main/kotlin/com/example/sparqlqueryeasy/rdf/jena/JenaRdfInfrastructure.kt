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
import com.example.sparqlqueryeasy.rdf.SparqlSyntaxValidation
import com.example.sparqlqueryeasy.rdf.SparqlSyntaxValidator
import com.example.sparqlqueryeasy.rdf.TurtleParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.apache.jena.query.ARQ
import org.apache.jena.query.Query
import org.apache.jena.query.QueryCancelledException
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
import org.apache.jena.sparql.algebra.Algebra
import org.apache.jena.sparql.algebra.OpVisitorBase
import org.apache.jena.sparql.algebra.op.OpService
import org.apache.jena.sparql.algebra.walker.Walker
import org.apache.jena.sparql.expr.ExprVisitorBase
import java.net.URI
import java.util.concurrent.TimeUnit
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

/** Maps Jena nodes at the RDF infrastructure boundary into application-owned values. */
class JenaRdfValueMapper : RdfValueMapper<RDFNode> {
    override fun map(value: RDFNode): RdfValue =
        when {
            value.isURIResource -> Iri(requireNotNull(value.asResource().uri).toDotNetAbsoluteUri())
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

/** Syntax-only validation at the Jena boundary; this never executes a query. */
class JenaSparqlSyntaxValidator : SparqlSyntaxValidator {
    override fun validate(query: String): SparqlSyntaxValidation =
        try {
            QueryFactory.create(query)
            SparqlSyntaxValidation.Valid
        } catch (exception: QueryException) {
            SparqlSyntaxValidation.Invalid(exception.message ?: exception.javaClass.simpleName)
        } catch (exception: IllegalArgumentException) {
            SparqlSyntaxValidation.Invalid(exception.message ?: exception.javaClass.simpleName)
        }
}

/** QUAL-023: a local query stops after this long, like a remote request (WikidataHttpClient). */
val LOCAL_QUERY_TIMEOUT: Duration = 30.seconds

class JenaLocalSparqlExecutor(
    private val mapper: JenaRdfValueMapper = JenaRdfValueMapper(),
    private val timeout: Duration = LOCAL_QUERY_TIMEOUT,
) : LocalSparqlExecutor {
    // QUAL-023: Jena blocks, so it runs off the request thread, and its overall timeout stops it.
    override suspend fun execute(
        graph: RdfGraph,
        query: String,
    ): SparqlResult = withContext(Dispatchers.IO) { executeBlocking(graph, query) }

    private fun executeBlocking(
        graph: RdfGraph,
        query: String,
    ): SparqlResult =
        try {
            val jenaQuery = QueryFactory.create(query)
            require(!jenaQuery.usesService()) { SERVICE_REFUSED }
            val model = graph.toJenaModel()
            // Defense in depth: ARQ itself refuses SERVICE in this execution.
            val localOnly =
                QueryExecution.create()
                    .query(jenaQuery)
                    .model(model)
                    .set(ARQ.httpServiceAllowed, false)
                    .timeout(timeout.inWholeMilliseconds, TimeUnit.MILLISECONDS)
            localOnly.build().use { execution ->
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
        } catch (exception: QueryCancelledException) {
            throw SparqlQueryExecutionFailure(query, "Query timed out after $timeout", exception)
        } catch (exception: QueryException) {
            throw queryFailure(query, exception)
        } catch (exception: ARQException) {
            throw queryFailure(query, exception)
        } catch (exception: IllegalArgumentException) {
            throw queryFailure(query, exception)
        }
}

/** QUAL-020: a local graph answers from its own triples only; SERVICE would make the server fetch a URL. */
internal const val SERVICE_REFUSED = "SERVICE is not allowed on a local graph"

/** True when any part of the query, EXISTS filters and subqueries included, is a SERVICE call. */
private fun Query.usesService(): Boolean {
    var found = false
    val services =
        object : OpVisitorBase() {
            override fun visit(opService: OpService) {
                found = true
            }
        }
    Walker.walk(Algebra.compile(this), services, ExprVisitorBase())
    return found
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
                            predicate = mapper.map(statement.predicate) as Iri,
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

/** .NET Uri.AbsoluteUri inserts `/` between an authority and a fragment/query when the path is empty. */
private fun String.toDotNetAbsoluteUri(): String {
    val parsed = URI(this)
    val ascii = parsed.toASCIIString()
    if (parsed.rawAuthority == null || parsed.rawPath.isNotEmpty()) return ascii

    val authorityStart = ascii.indexOf("//", startIndex = parsed.scheme.length + 1) + 2
    val queryStart = ascii.indexOf('?', startIndex = authorityStart).takeIf { it >= 0 } ?: ascii.length
    val fragmentStart = ascii.indexOf('#', startIndex = authorityStart).takeIf { it >= 0 } ?: ascii.length
    val authorityEnd = minOf(queryStart, fragmentStart)
    return ascii.substring(0, authorityEnd) + "/" + ascii.substring(authorityEnd)
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

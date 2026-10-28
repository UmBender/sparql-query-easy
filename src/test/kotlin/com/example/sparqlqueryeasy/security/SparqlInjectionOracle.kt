@file:Suppress("MaxLineLength")

package com.example.sparqlqueryeasy.security

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.apache.jena.graph.Node
import org.apache.jena.graph.NodeFactory
import org.apache.jena.irix.IRIs
import org.apache.jena.query.Query
import org.apache.jena.query.QueryFactory
import org.apache.jena.query.Syntax
import org.apache.jena.sparql.algebra.Algebra
import org.apache.jena.sparql.algebra.Op
import org.apache.jena.sparql.algebra.TransformCopy
import org.apache.jena.sparql.algebra.Transformer
import org.apache.jena.sparql.algebra.op.OpTable
import org.apache.jena.sparql.algebra.optimize.TransformPathFlatten
import org.apache.jena.sparql.algebra.table.TableN
import org.apache.jena.sparql.core.Var
import org.apache.jena.sparql.engine.binding.BindingBuilder
import org.apache.jena.sparql.graph.NodeTransform
import org.apache.jena.sparql.graph.NodeTransformLib

/** One entry of `src/test/resources/security/sparql-payloads.json`. */
internal data class SparqlPayload(val id: String, val value: String) {
    override fun toString(): String = id
}

/** The shared QUAL-020 payload list; `repeat` expands to the repeated value. */
internal val sparqlPayloads: List<SparqlPayload> by lazy {
    val text =
        checkNotNull(SparqlPayload::class.java.getResourceAsStream("/security/sparql-payloads.json")) {
            "Missing security/sparql-payloads.json"
        }.bufferedReader().use { it.readText() }
    Json.parseToJsonElement(text).jsonObject.getValue("payloads").jsonArray.map { element ->
        val entry = element.jsonObject
        val repeat = entry["repeat"]?.jsonPrimitive?.int ?: 1
        SparqlPayload(entry.getValue("id").jsonPrimitive.content, entry.getValue("value").jsonPrimitive.content.repeat(repeat))
    }
}

/**
 * QUAL-020 oracle: a generated query as Jena parses it (SPARQL 1.1 syntax, never string comparison).
 * [shape] is the SPARQL algebra with every variable renamed canonically, every IRI one placeholder
 * and every literal one placeholder, so two queries have the same shape exactly when they have the
 * same operators, patterns, filters and functions, whatever terms fill them. [terms] lists every
 * RDF term of the algebra, including those inside filter expressions and VALUES rows.
 */
internal class ParsedSparql private constructor(
    val text: String,
    val query: Query,
    algebra: Op,
) {
    val terms: List<Node> =
        mutableListOf<Node>().also { seen ->
            val record = NodeTransform { node -> node.also { seen += it } }
            NodeTransformLib.transform(record, algebra)
            // NodeTransformLib renames VALUES variables but keeps their row values.
            algebra.transformTables(record)
        }

    val shape: String =
        Canonical().let { canonical -> NodeTransformLib.transform(canonical, algebra).transformTables(canonical) }.toString()

    /** A violation of the scope every generated query must keep, or null. */
    fun scopeViolation(): String? =
        when {
            !query.isSelectType -> "not a SELECT query"
            query.hasDatasetDescription() -> "declares a dataset (FROM / FROM NAMED)"
            SCOPE_ESCAPES.any { it in shape } -> "uses ${SCOPE_ESCAPES.first { it in shape }}"
            else -> null
        }

    fun hasLiteral(lexicalForm: String): Boolean = terms.any { it.isLiteral && it.literalLexicalForm == lexicalForm }

    fun hasIri(iri: String): Boolean = terms.any { it.isURI && it.uri in iri.asParsed() }

    fun hasDatatype(iri: String): Boolean = terms.any { it.isLiteral && it.literalDatatypeURI in iri.asParsed() }

    /** The IRI as sent and as the parser resolves it (RFC 3986 removes `.` and `..` segments). */
    private fun String.asParsed(): Set<String> = setOfNotNull(this, runCatching { IRIs.resolve(this) }.getOrNull())

    fun hasVariable(name: String): Boolean = terms.any { it.isVariable && it.name == name }

    /** Variables first seen in order become ?v0, ?v1…; IRIs and literals lose their values. */
    private class Canonical : NodeTransform {
        private val names = mutableMapOf<String, Var>()

        override fun apply(node: Node): Node =
            when {
                node.isVariable -> names.getOrPut(node.name) { Var.alloc("v${names.size}") }
                node.isURI -> PLACEHOLDER_IRI
                node.isLiteral -> PLACEHOLDER_LITERAL
                node.isBlank -> PLACEHOLDER_BLANK
                else -> node
            }
    }

    companion object {
        private fun Op.transformTables(transform: NodeTransform): Op =
            Transformer.transform(
                object : TransformCopy() {
                    override fun transform(opTable: OpTable): Op {
                        val table = TableN(opTable.table.vars)
                        opTable.table.rows().forEach { row ->
                            val builder = BindingBuilder.create()
                            row.vars().forEach { variable -> builder.add(variable, transform.apply(row.get(variable))) }
                            table.addBinding(builder.build())
                        }
                        return OpTable.create(table)
                    }
                },
                this,
            )

        private val PLACEHOLDER_IRI = NodeFactory.createURI("urn:qual-020:iri")
        private val PLACEHOLDER_LITERAL = NodeFactory.createLiteralString("L")
        private val PLACEHOLDER_BLANK = NodeFactory.createBlankNode("b")
        private val SCOPE_ESCAPES = listOf("(service", "(graph", "(dataset", "(quadpattern", "(load", "(insert")

        /** Parses [text] as exactly one SPARQL 1.1 query; an update or trailing text fails here. */
        fun parse(text: String): ParsedSparql {
            val query = QueryFactory.create(text, Syntax.syntaxSPARQL_11)
            // Sequence paths become triples, so their IRIs are terms like any other.
            return ParsedSparql(text, query, Transformer.transform(TransformPathFlatten(), Algebra.compile(query)))
        }
    }
}

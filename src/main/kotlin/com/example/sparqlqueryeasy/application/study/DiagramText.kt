package com.example.sparqlqueryeasy.application.study

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * The plain-text diagram of a saved query (STUDY-018, DEC-020 C4, C5): a header naming its source, the nodes
 * numbered `[1]`, `[2]`… in the saved order with their kind, IRI or term and filter, then each relation by
 * number as `[n] --label--> [m]` followed by its predicate. `diagram.json` stays the source of truth; this text
 * loses positions, order, limit and endpoint.
 *
 * Nothing a user types can make two nodes or relations read alike: nodes are told apart by number and IRI,
 * relations by their numbers and predicate, and every run of whitespace in a label (line breaks included)
 * becomes one space, so each node and relation is exactly one line.
 */
@Suppress("TooManyFunctions") // One small function per node kind, term and filter keeps each rule readable.
object DiagramText {
    /** [graphJson] (formatVersion 1) under [title]; the title is the first line, then a blank line. */
    fun render(
        title: String,
        graphJson: String,
    ): String {
        val graph = Json.parseToJsonElement(graphJson).jsonObject
        val nodes = graph.array("nodes")
        val numbers = nodes.mapIndexed { index, node -> node.string("id") to index + 1 }.toMap()
        val edges = graph.array("edges")
        val lines = mutableListOf(oneLine(title), "", "Nodes")
        if (nodes.isEmpty()) lines += "(none)"
        nodes.forEachIndexed { index, node -> lines += "[${index + 1}] ${describeNode(node)}" }
        lines += listOf("", "Relations")
        if (edges.isEmpty()) lines += "(none)"
        edges.forEach { edge ->
            val source = numbers[edge.string("source")]?.let { "[$it]" } ?: "[?]"
            val target = numbers[edge.string("target")]?.let { "[$it]" } ?: "[?]"
            lines += "$source --${relationLabel(edge)}--> $target (${describePredicate(edge)})"
        }
        return lines.joinToString("\n", postfix = "\n")
    }

    /** Whitespace runs, line breaks included, become one space; an empty label is named. */
    fun oneLine(text: String): String = text.split(WHITESPACE).filter { it.isNotEmpty() }.joinToString(" ")

    /**
     * A label on one line; one that holds `--`, `[`, `]`, `—`, `"` or `\\` is written in double quotes with `"`
     * and `\\` escaped, so it can never read as a number, a separator or another relation.
     */
    private fun label(text: String?): String {
        val shown = oneLine(text.orEmpty())
        return when {
            shown.isEmpty() -> "(no label)"
            QUOTED.any { it in shown } -> quoted(shown)
            else -> shown
        }
    }

    private fun quoted(text: String): String = "\"" + escape(text) + "\""

    private fun describeNode(node: JsonObject): String {
        val shown = label(node.string("label"))
        return when (node.string("kind")) {
            "entity" -> "$shown — entity ${iri(node.string("value"))}"
            "class" -> "$shown — class ${iri(node.string("value"))}"
            "variable" -> {
                val many = if (node["many"]?.jsonPrimitive?.contentOrNull == "true") " (many results)" else ""
                "${node.string("name")} — variable$many"
            }
            "valueVariable" -> {
                val filter = node["filter"] as? JsonObject
                val code = filter?.get("code")?.jsonPrimitive?.intOrNull
                val text = filter?.let { filterText(code, it.string("value"), exactWhenNull = true) }
                "${node.string("name")} — value variable" + (text?.let { ", filter: $it" } ?: "")
            }
            "value" -> {
                val term = node["term"]?.jsonObject
                val code = node["filter"]?.jsonPrimitive?.intOrNull
                val lexical = term?.string("value").orEmpty()
                val filter = code?.let { ", filter: ${filterText(it, lexical, exactWhenNull = false)}" } ?: ""
                "$shown — value ${term?.let(::termText) ?: "(no term)"}$filter"
            }
            else -> "$shown — ${oneLine(node.string("kind").orEmpty())}"
        }
    }

    /** A predicate variable's relation is named by its variable when its label is only `?`. */
    private fun relationLabel(edge: JsonObject): String {
        val shown = oneLine(edge.string("label").orEmpty())
        val predicate = edge.string("predicate")
        val variable = (shown.isEmpty() || shown == "?") && predicate?.startsWith("?") == true
        return if (variable) label(predicate) else label(shown)
    }

    private fun describePredicate(edge: JsonObject): String {
        val predicate = edge.string("predicate")
        return when {
            predicate == null -> "no predicate"
            predicate.startsWith("?") -> "predicate variable $predicate"
            else -> "predicate ${iri(predicate)}"
        }
    }

    private fun filterText(
        code: Int?,
        value: String?,
        exactWhenNull: Boolean,
    ): String {
        val shown = oneLine(value.orEmpty())
        return when (code) {
            STARTS_WITH -> "starts with ${quoted(shown)}"
            CONTAINS -> "contains ${quoted(shown)}"
            AT_LEAST -> "at least $shown"
            AT_MOST -> "at most $shown"
            MAX -> "the maximum"
            MIN -> "the minimum"
            BETWEEN ->
                shown.split("..").map { it.trim() }.takeIf { it.size == 2 }
                    ?.let { (low, high) -> "between $low and $high" } ?: "between $shown"
            null -> if (exactWhenNull) "equals ${quoted(shown)}" else quoted(shown)
            else -> "code $code ${quoted(shown)}"
        }
    }

    private fun termText(term: JsonObject): String {
        val value = term.string("value").orEmpty()
        return when (term.string("type")) {
            "iri" -> iri(value)
            "bnode" -> "_:${oneLine(value)}"
            else -> {
                val language = term.string("language")
                val datatype = term.string("datatype")
                val quoted = "\"" + escape(value) + "\""
                when {
                    language != null -> "$quoted@$language"
                    datatype != null -> "$quoted^^${iri(datatype)}"
                    else -> quoted
                }
            }
        }
    }

    /** A lexical form on one line: `\` and `"` escaped, each control or line-break character as `\uXXXX`. */
    private fun escape(value: String): String =
        buildString {
            value.forEach { char ->
                when {
                    char == '\\' -> append("\\\\")
                    char == '"' -> append("\\\"")
                    char.isISOControl() || char in LINE_BREAKS -> append("\\u%04X".format(char.code))
                    else -> append(char)
                }
            }
        }

    /** An IRI in angle brackets, whether or not it was stored with them. */
    private fun iri(value: String?): String {
        val bare = oneLine(value.orEmpty()).removePrefix("<").removeSuffix(">")
        return "<$bare>"
    }

    private fun JsonObject.string(name: String): String? = (this[name] as? JsonPrimitive)?.contentOrNull

    private fun JsonObject.array(name: String): List<JsonObject> {
        val items = this[name] as? JsonArray ?: return emptyList()
        return items.map { it.jsonObject }
    }

    // Unicode white space, so U+2028, U+2029 and U+0085 cannot break a line either.
    private val WHITESPACE = Regex("(?U)\\s+")
    private val LINE_BREAKS = setOf('\u2028', '\u2029')
    private val QUOTED = listOf("--", "[", "]", "—", "\"", "\\")
    private const val STARTS_WITH = 0
    private const val CONTAINS = 1
    private const val AT_LEAST = 2
    private const val AT_MOST = 3
    private const val MAX = 4
    private const val MIN = 5
    private const val BETWEEN = 6
}

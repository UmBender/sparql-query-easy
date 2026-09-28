package com.example.sparqlqueryeasy.application.query

import com.example.sparqlqueryeasy.domain.model.BlankNode
import com.example.sparqlqueryeasy.domain.model.BoundSparqlBinding
import com.example.sparqlqueryeasy.domain.model.Iri
import com.example.sparqlqueryeasy.domain.model.Literal
import com.example.sparqlqueryeasy.domain.model.RdfValue
import com.example.sparqlqueryeasy.domain.model.SparqlResultRow
import com.example.sparqlqueryeasy.domain.model.SparqlSelectResult
import java.util.Locale

/** Application-owned equivalent of the PropertyDto values returned by the C# EndpointService. */
data class PropertyResult(
    val propertyId: String,
    val propertyLabel: String,
    val propertyType: String = "",
    val propertyClass: String = "",
)

/**
 * Ports EndpointService's result mapping/filtering functions only. Query construction,
 * execution, endpoint selection, and HTTP routing intentionally remain outside this class.
 */
class ResultFilteringService {
    /** C#: EndpointService.GetElementRelationships, after ExecuteAsync. */
    fun elementRelationships(
        results: SparqlSelectResult,
        isLocal: Boolean,
    ): List<PropertyResult> {
        val relationships =
            results.rows.map { result ->
                PropertyResult(
                    propertyId = result.value("property"),
                    propertyLabel = result.value("propertyLabel"),
                    propertyType = result.value("propertyType"),
                )
            }

        if (isLocal) return relationships

        return relationships.filter { relationship ->
            relationship.propertyLabel.isNotEmpty() && relationship.propertyType != "outro"
        }
    }

    /** C#: EndpointService.GetRelationshipValue, after ExecuteAsync. */
    fun relationshipValues(
        results: SparqlSelectResult,
        isLiteral: Boolean,
    ): List<PropertyResult> =
        results.rows.map { result ->
            if (isLiteral) {
                val property = result.value("property", removeIriDelimiters = true)
                PropertyResult(
                    propertyId = property,
                    propertyLabel = property,
                    propertyType = "text",
                )
            } else {
                PropertyResult(
                    propertyId = result.value("property"),
                    propertyLabel = result.value("propertyLabel"),
                )
            }
        }.filter { relationship -> relationship.propertyLabel.isNotEmpty() }

    /** C#: EndpointService.GetSearch, after its null/empty request guard and ExecuteAsync. */
    fun search(
        results: SparqlSelectResult,
        search: String,
        isLocal: Boolean,
    ): List<PropertyResult> {
        if (search.isEmpty()) return emptyList()

        val relationships =
            results.rows.map { result ->
                PropertyResult(
                    propertyId = result.value("property"),
                    propertyLabel = result.value("propertyLabel"),
                    propertyType = result.value("propertyParentType"),
                )
            }

        return if (isLocal) {
            // C# String.ToLower() uses the current culture and does not trim either operand.
            val normalizedSearch = search.lowercase(Locale.getDefault())
            relationships.filter { relationship ->
                relationship.propertyLabel.lowercase(Locale.getDefault()).contains(normalizedSearch) &&
                    relationship.propertyType == "objetoClasse"
            }.take(20)
        } else {
            relationships
        }
    }

    /** C#: EndpointService.GetQuery, after ExecuteAsync. */
    fun query(
        results: SparqlSelectResult,
        variableName: String,
        whereIsEmpty: Boolean,
    ): List<PropertyResult> {
        // Replace, rather than removing only a leading sigil, matches C# variableName.Replace("?", "").
        val variable = variableName.replace("?", "")
        val relationships =
            results.rows.map { result ->
                val propertyId = result.value(variable)
                val label = result.value("${variable}Label")
                PropertyResult(
                    propertyId = propertyId,
                    propertyLabel = if (label.isEmpty()) propertyId else label,
                    propertyType = result.value("${variable}ParentType"),
                    propertyClass = result.value("${variable}RdfType"),
                )
            }

        val labeled = relationships.filter { relationship -> relationship.propertyLabel.isNotEmpty() }
        return if (whereIsEmpty) {
            labeled.filter { relationship -> relationship.propertyType == "objetoClasse" }
        } else {
            labeled
        }
    }
}

private fun SparqlResultRow.value(
    name: String,
    removeIriDelimiters: Boolean = false,
): String {
    // C# TryGetValue accepts the supplied name and reports an absent key as an empty value.
    // Avoid constructing SparqlVariable here so malformed caller input does not gain validation.
    val binding = bindings.singleOrNull { it.variable.name == name } as? BoundSparqlBinding ?: return ""
    return binding.value.toCSharpString(removeIriDelimiters)
}

private fun RdfValue.toCSharpString(removeIriDelimiters: Boolean): String =
    when (this) {
        is Iri -> if (removeIriDelimiters) value else "<$value>"
        is BlankNode -> "blank"
        is Literal -> lexicalForm
    }

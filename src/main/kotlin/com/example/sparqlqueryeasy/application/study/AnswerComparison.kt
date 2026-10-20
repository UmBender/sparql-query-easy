package com.example.sparqlqueryeasy.application.study

import com.example.sparqlqueryeasy.domain.model.Literal
import com.example.sparqlqueryeasy.domain.model.RdfValue
import java.util.Locale

/**
 * How an answer's result compares with the expected one (DEC-014 Q2, Q4): the verdict and counts, never the
 * expected values. In `set` mode the counts are of distinct values; in `multiset` mode of values with their
 * repetitions.
 */
data class ComparisonOutcome(
    val correct: Boolean,
    val matched: Int,
    val missing: Int,
    val extra: Int,
    val expectedCount: Int,
) {
    /** For example "Incorrect: 3 of 7 expected results; 2 extra." */
    val feedback: String
        get() =
            if (correct) {
                "Correct: all $expectedCount expected results."
            } else {
                listOfNotNull(
                    "Incorrect: $matched of $expectedCount expected results",
                    "$extra extra".takeIf { extra > 0 },
                ).joinToString("; ") + "."
            }
}

/**
 * Compares typed RDF terms (STUDY-004): an IRI with an IRI, a literal by lexical form, datatype and language
 * (language tags regardless of case), never by display label. Order never matters.
 */
object AnswerComparison {
    fun compare(
        expected: List<RdfValue>,
        actual: List<RdfValue>,
        comparison: Comparison,
    ): ComparisonOutcome {
        val wanted = counts(expected, comparison)
        val got = counts(actual, comparison)
        val matched = wanted.entries.sumOf { (term, count) -> minOf(count, got[term] ?: 0) }
        val missing = wanted.values.sum() - matched
        val extra = got.values.sum() - matched
        return ComparisonOutcome(missing == 0 && extra == 0, matched, missing, extra, wanted.values.sum())
    }

    private fun counts(
        values: List<RdfValue>,
        comparison: Comparison,
    ): Map<RdfValue, Int> {
        val normalized = values.map(::normalize)
        return when (comparison) {
            Comparison.SET -> normalized.distinct().associateWith { 1 }
            Comparison.MULTISET -> normalized.groupingBy { it }.eachCount()
        }
    }

    private fun normalize(value: RdfValue): RdfValue {
        val language = (value as? Literal)?.language ?: return value
        return (value as Literal).copy(language = language.lowercase(Locale.ROOT))
    }
}

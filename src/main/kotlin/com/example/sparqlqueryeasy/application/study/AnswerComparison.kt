package com.example.sparqlqueryeasy.application.study

import com.example.sparqlqueryeasy.domain.model.Literal
import com.example.sparqlqueryeasy.domain.model.RdfValue
import com.example.sparqlqueryeasy.wikidata.query.TriplePattern
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

    /**
     * DEC-020 C1: an answer without variables against the reference, as sets of drawn triples (subject, predicate,
     * object and any literal filter). Order and repeated triples never matter; nothing is run.
     */
    fun compareStructure(
        reference: List<TriplePattern>,
        answer: List<TriplePattern>,
    ): AnswerCheck.Structural {
        val wanted = reference.toSet()
        val got = answer.toSet()
        return AnswerCheck.Structural(missing = (wanted - got).size, extra = (got - wanted).size)
    }

    /**
     * DEC-020 C2: one answer variable's run against the expected values. A cut result (more rows than the task's
     * cap) is never a match; a failed run keeps its diagnostic.
     */
    fun checkVariable(
        variable: String,
        run: AnswerRun,
        expected: List<RdfValue>,
        comparison: Comparison,
    ): VariableCheck =
        when (run) {
            is AnswerRun.Failed -> VariableCheck(variable, run.sparql, null, run.diagnostic)
            is AnswerRun.Complete -> {
                val outcome = compare(expected, run.result.values, comparison)
                VariableCheck(variable, run.result.sparql, AttemptResult(outcome, run.result.values, false), null)
            }
            is AnswerRun.Truncated -> {
                val outcome = compare(expected, run.values, comparison).copy(correct = false)
                VariableCheck(variable, run.sparql, AttemptResult(outcome, run.values, truncated = true), null)
            }
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

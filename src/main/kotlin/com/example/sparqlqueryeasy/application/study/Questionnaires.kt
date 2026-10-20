package com.example.sparqlqueryeasy.application.study

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull

/**
 * A questionnaire as its versioned JSON file in `src/main/resources/study/forms/` (STUDY-009, DEC-015 Q2). The
 * same shape is served to the frontend, which renders it and builds its Zod schema from it.
 */
@Serializable
data class FormDefinition(
    val slug: String,
    val version: Int,
    val title: String,
    val description: String? = null,
    val pages: List<FormPage>,
) {
    val questions: List<Question> get() = pages.flatMap { it.questions }
}

@Serializable
data class FormPage(
    val id: String,
    val title: String,
    val questions: List<Question>,
)

@Serializable
enum class QuestionType {
    @SerialName("single_choice")
    SINGLE_CHOICE,

    @SerialName("multiple_choice")
    MULTIPLE_CHOICE,

    @SerialName("likert")
    LIKERT,

    @SerialName("short_text")
    SHORT_TEXT,

    @SerialName("long_text")
    LONG_TEXT,

    @SerialName("number")
    NUMBER,
}

@Serializable
data class ChoiceOption(
    val value: String,
    val label: String,
)

/** One question; the fields after [required] apply to the types named in their comments. */
@Serializable
data class Question(
    val id: String,
    val type: QuestionType,
    val text: String,
    val required: Boolean,
    val description: String? = null,
    /** Single and multiple choice. */
    val options: List<ChoiceOption>? = null,
    /** Multiple choice. */
    val minSelected: Int? = null,
    val maxSelected: Int? = null,
    /** Likert: the scale runs from 1 to [scaleMax] (default 5). */
    val scaleMax: Int? = null,
    val minLabel: String? = null,
    val maxLabel: String? = null,
    /** Short text (default and limit 200) and long text (default and limit 2000). */
    val maxLength: Int? = null,
    /** Number. */
    val min: Double? = null,
    val max: Double? = null,
    val integer: Boolean? = null,
)

/** Reads and checks a definition file; a malformed one fails with a message naming the file. */
object FormDefinitions {
    private val strict = Json { ignoreUnknownKeys = false }
    private val slugPattern = Regex("^[a-z0-9][a-z0-9-]{0,39}$")
    private val idPattern = Regex("^[a-z][a-z0-9_]{0,63}$")

    fun parse(
        text: String,
        name: String,
    ): FormDefinition {
        val definition =
            try {
                strict.decodeFromString<FormDefinition>(text)
            } catch (failure: IllegalArgumentException) {
                // SerializationException is an IllegalArgumentException.
                throw IllegalArgumentException("$name: ${failure.message}", failure)
            }
        problems(definition).firstOrNull()?.let { throw IllegalArgumentException("$name: $it") }
        return definition
    }

    /** What is wrong with [definition], first problem first; empty when it is valid. */
    fun problems(definition: FormDefinition): List<String> =
        buildList {
            if (!slugPattern.matches(definition.slug)) add("slug must be 1-40 lowercase letters, digits or '-'")
            if (definition.version < 1) add("version must be at least 1")
            if (definition.title.isBlank()) add("title is empty")
            if (definition.pages.isEmpty()) add("there are no pages")
            duplicates(definition.pages.map { it.id }).forEach { add("page id '$it' is repeated") }
            definition.pages.forEach { page ->
                if (!idPattern.matches(page.id)) add("page id '${page.id}' is not a lowercase identifier")
                if (page.questions.isEmpty()) add("page '${page.id}' has no questions")
            }
            duplicates(definition.questions.map { it.id }).forEach { add("question id '$it' is repeated") }
            definition.questions.forEach { addAll(questionProblems(it)) }
        }

    @Suppress("CyclomaticComplexMethod")
    private fun questionProblems(question: Question): List<String> =
        buildList {
            val id = question.id
            if (!idPattern.matches(id)) add("question id '$id' is not a lowercase identifier")
            if (question.text.isBlank()) add("question '$id' has no text")
            val choice = question.type == QuestionType.SINGLE_CHOICE || question.type == QuestionType.MULTIPLE_CHOICE
            val options = question.options.orEmpty()
            if (choice) {
                if (options.size < 2) add("question '$id' needs at least two options")
                if (options.any { it.value.isBlank() || it.label.isBlank() }) add("question '$id' has an empty option")
                duplicates(options.map { it.value }).forEach { add("question '$id' repeats option '$it'") }
            } else if (question.options != null) {
                add("question '$id' is not a choice and cannot have options")
            }
            when (question.type) {
                QuestionType.MULTIPLE_CHOICE -> {
                    val min = question.minSelected
                    val max = question.maxSelected
                    if (min != null && min !in 1..options.size) add("question '$id' minSelected is out of range")
                    if (max != null && max !in 1..options.size) add("question '$id' maxSelected is out of range")
                    if (min != null && max != null && min > max) add("question '$id' minSelected exceeds maxSelected")
                }
                QuestionType.LIKERT ->
                    if (question.scaleMax != null && question.scaleMax !in 2..MAX_SCALE) {
                        add("question '$id' scaleMax must be from 2 to $MAX_SCALE")
                    }
                QuestionType.SHORT_TEXT, QuestionType.LONG_TEXT -> {
                    val limit = textLimit(question.type)
                    if (question.maxLength != null && question.maxLength !in 1..limit) {
                        add("question '$id' maxLength must be from 1 to $limit")
                    }
                }
                QuestionType.NUMBER ->
                    if (question.min != null && question.max != null && question.min > question.max) {
                        add("question '$id' min exceeds max")
                    }
                QuestionType.SINGLE_CHOICE -> Unit
            }
        }

    private fun duplicates(values: List<String>): Set<String> {
        val counts = values.groupingBy { it }.eachCount()
        return counts.filterValues { it > 1 }.keys
    }
}

internal const val MAX_SCALE = 10
private const val DEFAULT_SCALE = 5
private const val SHORT_TEXT_LIMIT = 200
private const val TEXT_LIMIT = 2000

internal fun textLimit(type: QuestionType): Int = if (type == QuestionType.SHORT_TEXT) SHORT_TEXT_LIMIT else TEXT_LIMIT

/** The answers checked against a definition: the error per question id, and the answers to store. */
data class FormCheck(
    val errors: Map<String, String>,
    /** Trimmed text; unanswered questions left out. Only meaningful when [errors] is empty. */
    val answers: JsonObject,
)

/**
 * The server's answer rules (STUDY-009). They are the frontend's `validateAnswers` (`domain/forms.ts`) rule for
 * rule and message for message; `frontend/src/lib/domain/fixtures/forms/parity.json` holds the cases both run.
 */
object FormAnswerValidator {
    const val REQUIRED = "Answer this question."
    const val INVALID = "Invalid answer."
    const val UNKNOWN = "Unknown question."
    const val CHOICE = "Choose one of the options."
    const val CHOICES = "Choose from the options, each at most once."
    const val NUMBER = "Enter a number."
    const val INTEGER = "Enter a whole number."

    fun validate(
        definition: FormDefinition,
        answers: JsonObject,
    ): FormCheck {
        val errors = linkedMapOf<String, String>()
        val stored = linkedMapOf<String, JsonElement>()
        val known = definition.questions.map { it.id }.toSet()
        answers.keys.filterNot { it in known }.forEach { errors[it] = UNKNOWN }
        definition.questions.forEach { question ->
            when (val result = check(question, answers[question.id])) {
                is Checked.Error -> errors[question.id] = result.message
                is Checked.Value -> result.value?.let { stored[question.id] = it }
            }
        }
        return FormCheck(errors, JsonObject(stored))
    }

    private sealed interface Checked {
        /** [value] is null when the question was left unanswered. */
        data class Value(val value: JsonElement?) : Checked

        data class Error(val message: String) : Checked
    }

    private fun check(
        question: Question,
        value: JsonElement?,
    ): Checked {
        val result = checkGiven(question, value)
        val unanswered = result is Checked.Value && result.value == null
        return if (unanswered && question.required) Checked.Error(REQUIRED) else result
    }

    private fun checkGiven(
        question: Question,
        value: JsonElement?,
    ): Checked =
        if (value == null || value is JsonNull) {
            Checked.Value(null)
        } else {
            when (question.type) {
                QuestionType.SINGLE_CHOICE -> single(question, value)
                QuestionType.MULTIPLE_CHOICE -> multiple(question, value)
                QuestionType.LIKERT -> likert(question, value)
                QuestionType.SHORT_TEXT, QuestionType.LONG_TEXT -> text(question, value)
                QuestionType.NUMBER -> number(question, value)
            }
        }

    private fun options(question: Question): Set<String> = question.options.orEmpty().map { it.value }.toSet()

    private fun single(
        question: Question,
        value: JsonElement,
    ): Checked {
        val text = (value as? JsonPrimitive)?.takeIf { it.isString }?.content ?: return Checked.Error(INVALID)
        return when {
            text.isEmpty() -> Checked.Value(null)
            text in options(question) -> Checked.Value(value)
            else -> Checked.Error(CHOICE)
        }
    }

    private fun multiple(
        question: Question,
        value: JsonElement,
    ): Checked {
        val chosen =
            (value as? JsonArray)
                ?.map { (it as? JsonPrimitive)?.takeIf { item -> item.isString }?.content }
                ?.takeIf { texts -> texts.none { it == null } }
                ?.filterNotNull()
                ?: return Checked.Error(INVALID)
        val min = question.minSelected
        val max = question.maxSelected
        return when {
            chosen.isEmpty() -> Checked.Value(null)
            chosen.toSet().size != chosen.size || !options(question).containsAll(chosen) -> Checked.Error(CHOICES)
            min != null && chosen.size < min -> Checked.Error("Choose at least $min.")
            max != null && chosen.size > max -> Checked.Error("Choose at most $max.")
            else -> Checked.Value(value)
        }
    }

    private fun likert(
        question: Question,
        value: JsonElement,
    ): Checked {
        val number = numberOf(value) ?: return Checked.Error(INVALID)
        val max = question.scaleMax ?: DEFAULT_SCALE
        return if (number % 1.0 == 0.0 && number >= 1 && number <= max) {
            Checked.Value(value)
        } else {
            Checked.Error("Choose a value from 1 to $max.")
        }
    }

    private fun text(
        question: Question,
        value: JsonElement,
    ): Checked {
        val text = (value as? JsonPrimitive)?.takeIf { it.isString }?.content?.trim() ?: return Checked.Error(INVALID)
        val limit = question.maxLength ?: textLimit(question.type)
        return when {
            text.isEmpty() -> Checked.Value(null)
            text.length > limit -> Checked.Error("Use at most $limit characters.")
            else -> Checked.Value(JsonPrimitive(text))
        }
    }

    private fun number(
        question: Question,
        value: JsonElement,
    ): Checked {
        val number = numberOf(value) ?: return Checked.Error(INVALID)
        val min = question.min
        val max = question.max
        return when {
            !number.isFinite() -> Checked.Error(NUMBER)
            question.integer == true && number % 1.0 != 0.0 -> Checked.Error(INTEGER)
            (min != null && number < min) || (max != null && number > max) -> Checked.Error(range(min, max))
            else -> Checked.Value(value)
        }
    }

    /** A JSON number; strings and booleans are not numbers. */
    private fun numberOf(value: JsonElement): Double? {
        val primitive = value as? JsonPrimitive
        return primitive?.takeIf { !it.isString && it !is JsonNull }?.doubleOrNull
    }
}

private fun range(
    min: Double?,
    max: Double?,
): String =
    when {
        min != null && max != null -> "Enter a number from ${format(min)} to ${format(max)}."
        min != null -> "Enter a number of at least ${format(min)}."
        else -> "Enter a number of at most ${format(checkNotNull(max))}."
    }

/** As JavaScript prints a number: no ".0" on whole numbers. */
private fun format(number: Double): String =
    if (number % 1.0 == 0.0 && kotlin.math.abs(number) < 1e15) number.toLong().toString() else number.toString()

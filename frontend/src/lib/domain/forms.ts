/**
 * Questionnaire definitions and their answer rules (STUDY-009, DEC-015 Q2).
 * A definition is the versioned JSON the server serves from
 * `src/main/resources/study/forms/`; `validateAnswers` repeats the Kotlin
 * `FormAnswerValidator` rule for rule and message for message, which the
 * shared fixtures in `fixtures/forms/parity.json` check on both sides.
 * `formSchema` turns the same rules into the Zod schema Superforms uses.
 */
import { z } from 'zod';

export type QuestionType =
	'single_choice' | 'multiple_choice' | 'likert' | 'short_text' | 'long_text' | 'number';

export type ChoiceOption = { value: string; label: string };

export type Question = {
	id: string;
	type: QuestionType;
	text: string;
	required: boolean;
	description?: string | null;
	options?: ChoiceOption[] | null;
	minSelected?: number | null;
	maxSelected?: number | null;
	scaleMax?: number | null;
	minLabel?: string | null;
	maxLabel?: string | null;
	maxLength?: number | null;
	min?: number | null;
	max?: number | null;
	integer?: boolean | null;
};

export type FormPage = { id: string; title: string; questions: Question[] };

export type FormDefinition = {
	slug: string;
	version: number;
	title: string;
	description?: string | null;
	pages: FormPage[];
};

/** An answer as the form holds it; `null`, `''` and `[]` mean unanswered. */
export type AnswerValue = string | number | string[] | null;
export type Answers = Record<string, AnswerValue>;

export const MESSAGES = {
	required: 'Answer this question.',
	invalid: 'Invalid answer.',
	unknown: 'Unknown question.',
	choice: 'Choose one of the options.',
	choices: 'Choose from the options, each at most once.',
	number: 'Enter a number.',
	integer: 'Enter a whole number.'
} as const;

const atLeast = (count: number) => `Choose at least ${count}.`;
const atMost = (count: number) => `Choose at most ${count}.`;
const scale = (max: number) => `Choose a value from 1 to ${max}.`;
const tooLong = (count: number) => `Use at most ${count} characters.`;
const range = (min: number | null | undefined, max: number | null | undefined) =>
	min != null && max != null
		? `Enter a number from ${min} to ${max}.`
		: min != null
			? `Enter a number of at least ${min}.`
			: `Enter a number of at most ${max}.`;

export const questionsOf = (definition: FormDefinition): Question[] =>
	definition.pages.flatMap((page) => page.questions);

/** The value a question starts with in the form. */
export function emptyAnswer(question: Question): AnswerValue {
	if (question.type === 'multiple_choice') return [];
	if (question.type === 'likert' || question.type === 'number') return null;
	return '';
}

/** One question's check: the stored value (null when unanswered) or the error message. */
export function checkAnswer(
	question: Question,
	value: unknown
): { value: Exclude<AnswerValue, null> | null } | { error: string } {
	const result = checkGiven(question, value);
	if ('error' in result) return result;
	if (result.value === null && question.required) return { error: MESSAGES.required };
	return result;
}

function checkGiven(
	question: Question,
	value: unknown
): { value: Exclude<AnswerValue, null> | null } | { error: string } {
	if (value === null || value === undefined) return { value: null };
	switch (question.type) {
		case 'single_choice': {
			if (typeof value !== 'string') return { error: MESSAGES.invalid };
			if (value === '') return { value: null };
			return optionValues(question).has(value) ? { value } : { error: MESSAGES.choice };
		}
		case 'multiple_choice': {
			if (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
				return { error: MESSAGES.invalid };
			if (value.length === 0) return { value: null };
			const options = optionValues(question);
			if (new Set(value).size !== value.length || value.some((item) => !options.has(item)))
				return { error: MESSAGES.choices };
			if (question.minSelected != null && value.length < question.minSelected)
				return { error: atLeast(question.minSelected) };
			if (question.maxSelected != null && value.length > question.maxSelected)
				return { error: atMost(question.maxSelected) };
			return { value: value as string[] };
		}
		case 'likert': {
			if (typeof value !== 'number' || !Number.isFinite(value))
				return { error: MESSAGES.invalid };
			const max = question.scaleMax ?? 5;
			return Number.isInteger(value) && value >= 1 && value <= max
				? { value }
				: { error: scale(max) };
		}
		case 'short_text':
		case 'long_text': {
			if (typeof value !== 'string') return { error: MESSAGES.invalid };
			const text = value.trim();
			if (text === '') return { value: null };
			const limit = question.maxLength ?? (question.type === 'short_text' ? 200 : 2000);
			return text.length <= limit ? { value: text } : { error: tooLong(limit) };
		}
		case 'number': {
			if (typeof value !== 'number') return { error: MESSAGES.invalid };
			if (!Number.isFinite(value)) return { error: MESSAGES.number };
			if (question.integer && !Number.isInteger(value)) return { error: MESSAGES.integer };
			if (
				(question.min != null && value < question.min) ||
				(question.max != null && value > question.max)
			)
				return { error: range(question.min, question.max) };
			return { value };
		}
	}
}

const optionValues = (question: Question) =>
	new Set((question.options ?? []).map((option) => option.value));

/**
 * Every question of the definition against `answers`: the error per question
 * id (also for ids the definition does not have), and the answers to store,
 * normalized (trimmed text, unanswered questions left out).
 */
export function validateAnswers(
	definition: FormDefinition,
	answers: Record<string, unknown>
): { errors: Record<string, string>; answers: Record<string, Exclude<AnswerValue, null>> } {
	const errors: Record<string, string> = {};
	const stored: Record<string, Exclude<AnswerValue, null>> = {};
	const questions = questionsOf(definition);
	const known = new Set(questions.map((question) => question.id));
	for (const id of Object.keys(answers)) if (!known.has(id)) errors[id] = MESSAGES.unknown;
	for (const question of questions) {
		const result = checkAnswer(question, answers[question.id]);
		if ('error' in result) errors[question.id] = result.error;
		else if (result.value !== null) stored[question.id] = result.value;
	}
	return { errors, answers: stored };
}

function fieldSchema(question: Question) {
	const base =
		question.type === 'multiple_choice'
			? z.array(z.string())
			: question.type === 'likert' || question.type === 'number'
				? z.number().nullable()
				: z.string();
	return base.superRefine((value, context) => {
		const result = checkAnswer(question, value);
		if ('error' in result) context.addIssue({ code: 'custom', message: result.error });
	});
}

/**
 * The Zod schema of the whole form, or of one page when `pageIndex` is given
 * (the other questions are then not checked).
 */
export function formSchema(definition: FormDefinition, pageIndex?: number) {
	const pages = pageIndex === undefined ? definition.pages : [definition.pages[pageIndex]];
	return z.object(
		Object.fromEntries(
			pages
				.flatMap((page) => page.questions)
				.map((question) => [question.id, fieldSchema(question)])
		)
	);
}

/** The form's starting values: every question unanswered. */
export function emptyAnswers(definition: FormDefinition): Answers {
	return Object.fromEntries(
		questionsOf(definition).map((question) => [question.id, emptyAnswer(question)])
	);
}

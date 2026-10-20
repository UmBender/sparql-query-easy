import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	MESSAGES,
	checkAnswer,
	emptyAnswers,
	formSchema,
	questionsOf,
	validateAnswers,
	type FormDefinition,
	type Question
} from './forms.js';
import parity from './fixtures/forms/parity.json';

const definition = parity.definition as FormDefinition;
const shipped = (name: string) =>
	JSON.parse(
		readFileSync(
			new URL(`../../../../src/main/resources/study/forms/${name}`, import.meta.url),
			'utf8'
		)
	) as FormDefinition;

describe('questionnaire answers: parity with the Kotlin validator (STUDY-009)', () => {
	for (const item of parity.cases) {
		it(item.name, () => {
			const result = validateAnswers(definition, item.answers);
			expect(result.errors).toEqual(item.errors);
			if ('stored' in item) expect(result.answers).toEqual(item.stored);
		});
	}
});

describe('questionnaire answers: the rules', () => {
	const number = (extra: Partial<Question>): Question => ({
		id: 'n',
		type: 'number',
		text: 'N',
		required: false,
		...extra
	});

	it('words a one-sided number range and rejects non-finite numbers', () => {
		expect(checkAnswer(number({ max: 3 }), 4)).toEqual({
			error: 'Enter a number of at most 3.'
		});
		expect(checkAnswer(number({ min: 1 }), 0)).toEqual({
			error: 'Enter a number of at least 1.'
		});
		expect(checkAnswer(number({}), Number.NaN)).toEqual({ error: MESSAGES.number });
		expect(checkAnswer(number({}), 2.5)).toEqual({ value: 2.5 });
	});

	it('uses the default likert scale and text limits', () => {
		const likert: Question = { id: 'l', type: 'likert', text: 'L', required: false };
		expect(checkAnswer(likert, 6)).toEqual({ error: 'Choose a value from 1 to 5.' });
		expect(checkAnswer(likert, Number.POSITIVE_INFINITY)).toEqual({ error: MESSAGES.invalid });
		const short: Question = { id: 's', type: 'short_text', text: 'S', required: false };
		const long: Question = { id: 'g', type: 'long_text', text: 'G', required: false };
		expect(checkAnswer(short, 'x'.repeat(201))).toEqual({
			error: 'Use at most 200 characters.'
		});
		expect(checkAnswer(long, 'x'.repeat(2000))).toEqual({ value: 'x'.repeat(2000) });
		expect(checkAnswer(long, 'x'.repeat(2001))).toEqual({
			error: 'Use at most 2000 characters.'
		});
	});

	it('checks the minimum number of choices and treats undefined as unanswered', () => {
		const multi: Question = {
			id: 'm',
			type: 'multiple_choice',
			text: 'M',
			required: false,
			options: [
				{ value: 'a', label: 'A' },
				{ value: 'b', label: 'B' }
			],
			minSelected: 2
		};
		expect(checkAnswer(multi, ['a'])).toEqual({ error: 'Choose at least 2.' });
		expect(checkAnswer(multi, undefined)).toEqual({ value: null });
		expect(checkAnswer({ ...multi, options: null }, ['a'])).toEqual({
			error: MESSAGES.choices
		});
	});
});

describe('questionnaire schema for Superforms', () => {
	it('starts every question unanswered', () => {
		expect(emptyAnswers(definition)).toEqual({
			single: '',
			multi: [],
			scale: null,
			short: '',
			long: '',
			count: null,
			ratio: null
		});
	});

	it('checks the whole form with the same messages', () => {
		const result = formSchema(definition).safeParse(emptyAnswers(definition));
		expect(result.success).toBe(false);
		const messages = Object.fromEntries(
			(result.error?.issues ?? []).map((issue) => [issue.path.join('.'), issue.message])
		);
		expect(messages).toEqual({
			single: MESSAGES.required,
			multi: MESSAGES.required,
			scale: MESSAGES.required,
			count: MESSAGES.required
		});
	});

	it('checks only one page when asked', () => {
		const answers = { ...emptyAnswers(definition), single: 'a', multi: ['x'], scale: 4 };
		expect(formSchema(definition, 0).safeParse(answers).success).toBe(true);
		const second = formSchema(definition, 1).safeParse(answers);
		expect(second.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['count']);
	});
});

describe('shipped placeholder questionnaires', () => {
	it.each(['profile.v1.json', 'usability.v1.json'])('%s is a marked placeholder', (name) => {
		const form = shipped(name);
		expect(form.title).toMatch(/^PLACEHOLDER/);
		for (const question of questionsOf(form)) expect(question.text).toMatch(/^PLACEHOLDER/);
	});

	it('rejects the invalid programming years the e2e uses', () => {
		const profile = shipped('profile.v1.json');
		const years = questionsOf(profile).find((question) => question.id === 'programming_years')!;
		expect(checkAnswer(years, 99)).toEqual({ error: 'Enter a number from 0 to 60.' });
	});
});

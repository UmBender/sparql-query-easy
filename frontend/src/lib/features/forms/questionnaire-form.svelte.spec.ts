/**
 * STUDY-009: each question type renders, takes a valid answer and shows the
 * shared rule's error for an invalid one; the paged form blocks Next on an
 * invalid page and sends the answers once the whole form is valid. Superforms
 * needs SvelteKit's `$app/*` modules, replaced here as in auth-form.svelte.spec.ts.
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { FormDefinition, Question } from '#lib/domain/forms.js';
import QuestionnaireForm from './questionnaire-form.svelte';

vi.hoisted(() => {
	(globalThis as { STORIES?: unknown }).STORIES = [];
});

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/study'), form: null, status: 200, data: {} },
	navigating: { to: null },
	updated: { current: false, check: async () => false }
}));
vi.mock('$app/navigation', () => {
	const noop = () => {};
	const done = async () => {};
	return {
		afterNavigate: noop,
		beforeNavigate: noop,
		onNavigate: noop,
		disableScrollHandling: noop,
		goto: done,
		invalidate: done,
		invalidateAll: done,
		refreshAll: done,
		preloadCode: done,
		preloadData: done,
		pushState: noop,
		replaceState: noop
	};
});
vi.mock('$app/forms', () => ({
	applyAction: async () => {},
	deserialize: (text: string) => JSON.parse(text),
	enhance: (form: HTMLFormElement, submit: (input: object) => unknown) => {
		const listener = (event: SubmitEvent) => {
			event.preventDefault();
			void submit({
				action: new URL(form.action),
				formData: new FormData(form),
				formElement: form,
				controller: new AbortController(),
				submitter: event.submitter,
				cancel: () => {}
			});
		};
		form.addEventListener('submit', listener);
		return { destroy: () => form.removeEventListener('submit', listener) };
	}
}));

const single: Question = {
	id: 'single',
	type: 'single_choice',
	text: 'Pick one',
	required: true,
	options: [
		{ value: 'a', label: 'Apple' },
		{ value: 'b', label: 'Banana' }
	]
};
const multi: Question = {
	id: 'multi',
	type: 'multiple_choice',
	text: 'Pick some',
	required: true,
	options: [
		{ value: 'x', label: 'Ex' },
		{ value: 'y', label: 'Why' },
		{ value: 'z', label: 'Zed' }
	],
	maxSelected: 2
};
const likert: Question = {
	id: 'scale',
	type: 'likert',
	text: 'Rate it',
	required: true,
	scaleMax: 5,
	minLabel: 'Disagree',
	maxLabel: 'Agree'
};
const short: Question = {
	id: 'short',
	type: 'short_text',
	text: 'In brief',
	required: false,
	maxLength: 5
};
const long: Question = {
	id: 'long',
	type: 'long_text',
	text: 'In detail',
	required: true,
	maxLength: 20
};
const count: Question = {
	id: 'count',
	type: 'number',
	text: 'How many',
	required: true,
	min: 0,
	max: 60,
	integer: true
};

const oneQuestion = (question: Question): FormDefinition => ({
	slug: 'demo',
	version: 1,
	title: 'Demo form',
	pages: [{ id: 'p', title: 'Only page', questions: [question] }]
});

async function submitOne(question: Question) {
	const onsubmit = vi.fn(async () => null);
	const screen = await render(QuestionnaireForm, { definition: oneQuestion(question), onsubmit });
	const submit = () => screen.getByRole('button', { name: 'Submit' }).click();
	return { screen, onsubmit, submit };
}

describe('question types', () => {
	it('single choice: requires an option and sends the chosen one', async () => {
		const { screen, onsubmit, submit } = await submitOne(single);
		await submit();
		await expect.element(screen.getByText('Answer this question.')).toBeVisible();
		await screen.getByLabelText('Banana').click();
		await submit();
		await vi.waitFor(() => expect(onsubmit).toHaveBeenCalledWith({ single: 'b' }));
	});

	it('multiple choice: rejects too many options and sends them in option order', async () => {
		const { screen, onsubmit, submit } = await submitOne(multi);
		await screen.getByLabelText('Zed').click();
		await screen.getByLabelText('Ex').click();
		await screen.getByLabelText('Why').click();
		await submit();
		await expect.element(screen.getByText('Choose at most 2.')).toBeVisible();
		await screen.getByLabelText('Why').click();
		await submit();
		await vi.waitFor(() => expect(onsubmit).toHaveBeenCalledWith({ multi: ['x', 'z'] }));
	});

	it('likert: requires a point of the scale', async () => {
		const { screen, onsubmit, submit } = await submitOne(likert);
		await submit();
		await expect.element(screen.getByText('Answer this question.')).toBeVisible();
		await screen.getByLabelText('5 (Agree)').click();
		await submit();
		await vi.waitFor(() => expect(onsubmit).toHaveBeenCalledWith({ scale: 5 }));
	});

	it('short text: optional, limited in length', async () => {
		const { screen, onsubmit, submit } = await submitOne(short);
		await expect.element(screen.getByText('Up to 5 characters.')).toBeVisible();
		await screen.getByLabelText('In brief (optional)').fill('too long');
		await submit();
		await expect.element(screen.getByText('Use at most 5 characters.')).toBeVisible();
		await screen.getByLabelText('In brief (optional)').fill('ok');
		await submit();
		await vi.waitFor(() => expect(onsubmit).toHaveBeenCalledWith({ short: 'ok' }));
	});

	it('long text: required, limited in length', async () => {
		const { screen, onsubmit, submit } = await submitOne(long);
		await submit();
		await expect.element(screen.getByText('Answer this question.')).toBeVisible();
		await screen.getByLabelText('In detail').fill('fine');
		await submit();
		await vi.waitFor(() => expect(onsubmit).toHaveBeenCalledWith({ long: 'fine' }));
	});

	it('number: rejects an out-of-range value and sends a number', async () => {
		const { screen, onsubmit, submit } = await submitOne(count);
		await expect.element(screen.getByText('From 0 to 60. A whole number.')).toBeVisible();
		await screen.getByLabelText('How many').fill('99');
		await submit();
		await expect.element(screen.getByText('Enter a number from 0 to 60.')).toBeVisible();
		await screen.getByLabelText('How many').fill('7');
		await submit();
		await vi.waitFor(() => expect(onsubmit).toHaveBeenCalledWith({ count: 7 }));
	});
});

describe('paged form', () => {
	const definition: FormDefinition = {
		slug: 'paged',
		version: 1,
		title: 'Paged form',
		description: 'Two pages.',
		pages: [
			{ id: 'one', title: 'First page', questions: [single] },
			{ id: 'two', title: 'Second page', questions: [count] }
		]
	};

	it('blocks Next on an invalid page, reports progress and shows server errors', async () => {
		const onsubmit = vi.fn(async () => ({ count: 'Enter a number from 0 to 60.' }));
		const onprogress = vi.fn();
		const screen = await render(QuestionnaireForm, { definition, onsubmit, onprogress });
		await expect.element(screen.getByTestId('form-page')).toHaveTextContent('Page 1 of 2');
		await screen.getByRole('button', { name: 'Next' }).click();
		await expect.element(screen.getByText('Answer this question.')).toBeVisible();
		expect(onprogress).not.toHaveBeenCalled();

		await screen.getByLabelText('Apple').click();
		await screen.getByRole('button', { name: 'Next' }).click();
		await expect.element(screen.getByRole('heading', { name: 'Second page' })).toBeVisible();
		expect(onprogress).toHaveBeenCalledWith({ single: 'a', count: null }, 1);

		await screen.getByLabelText('How many').fill('3');
		await screen.getByRole('button', { name: 'Submit' }).click();
		await vi.waitFor(() => expect(onsubmit).toHaveBeenCalledWith({ single: 'a', count: 3 }));
		await expect.element(screen.getByText('Enter a number from 0 to 60.')).toBeVisible();

		await screen.getByRole('button', { name: 'Back' }).click();
		await expect.element(screen.getByLabelText('Apple')).toBeChecked();
	});

	it('starts from saved answers and page', async () => {
		const screen = await render(QuestionnaireForm, {
			definition,
			onsubmit: async () => null,
			initialAnswers: { single: 'b', count: 12 },
			initialPage: 1
		});
		await expect.element(screen.getByLabelText('How many')).toHaveValue(12);
		await screen.getByRole('button', { name: 'Back' }).click();
		await expect.element(screen.getByLabelText('Banana')).toBeChecked();
	});

	it('shows a failure to send', async () => {
		const screen = await render(QuestionnaireForm, {
			definition: oneQuestion(short),
			onsubmit: async () => {
				throw new Error('Saving the answers failed (503).');
			}
		});
		await screen.getByRole('button', { name: 'Submit' }).click();
		await expect
			.element(screen.getByRole('alert'))
			.toHaveTextContent('Saving the answers failed (503).');
	});
});

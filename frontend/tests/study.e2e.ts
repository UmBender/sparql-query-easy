/**
 * QUAL-013: the proposed-task page and the profile questionnaire offline,
 * driven through their page objects with typed mock data. The real-stack
 * suites cover the same pages against Ktor (tests-stack/study-*.e2e.ts).
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { components } from '../src/lib/api/schema';
import { guardOffline } from './support/offline';
import { mockApi, type MockApi } from './support/mock-api';
import { QuestionnairePage } from './support/pages/questionnaire-page';
import { EditorPage } from './support/pages/editor-page';
import { TaskPage } from './support/pages/task-page';

type Schemas = components['schemas'];

const FIRE_SPEED = JSON.parse(
	readFileSync(
		new URL('../src/lib/domain/fixtures/fire-speed-at-least-90.query.json', import.meta.url),
		'utf8'
	)
);
const PROFILE: Schemas['FormDefinition'] = JSON.parse(
	readFileSync(
		new URL('../../src/main/resources/study/forms/profile.v2.json', import.meta.url),
		'utf8'
	)
);

let unexpected: string[];
let api: MockApi;

test.beforeEach(async ({ page, baseURL }) => {
	unexpected = await guardOffline(page, baseURL!);
	api = await mockApi(page);
	const user: Schemas['SessionUserHttpResponse'] = { username: 'ana', role: 'participant' };
	api.override('/api/auth/session', () => ({ data: user }));
});

test.afterEach(() => {
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});

test('a task starts from its drawn query, submits it and lists the attempt', async ({ page }) => {
	const task: Schemas['StudyTaskHttpResponse'] = {
		key: 'fire-fast',
		title: 'Fast Fire-type Pokémon',
		statement: 'Find every Fire-type Pokémon with a speed of at least 90.',
		endpoint: 'PokemonGen1',
		startingGraph: FIRE_SPEED
	};
	const attempts: Schemas['StudySubmissionHttpResponse'][] = [];
	api.override('/api/study/tasks/fire-fast', () => ({ data: task }));
	api.override('/api/study/submissions', () => ({ data: attempts }));
	api.override('/api/study/tasks/fire-fast/submissions', () => {
		const attempt: Schemas['StudySubmissionHttpResponse'] = {
			attempt: attempts.length + 1,
			correct: true,
			invalid: false,
			feedback: 'Correct: all 7 expected results.',
			matched: 7,
			missing: 0,
			extra: 0,
			expectedCount: 7,
			taskRevision: 1,
			timeSpentMs: 61_000,
			createdAt: '2026-10-20T12:00:00Z'
		};
		attempts.push(attempt);
		return { data: attempt };
	});

	const taskPage = new TaskPage(page);
	await taskPage.open('fire-fast');
	await expect(taskPage.statement).toHaveText(task.statement);
	await expect(taskPage.editor.nodeCount).toHaveText('Nodes: 3');
	await expect(taskPage.answerVariable('pokemon')).toBeChecked();
	await taskPage.submit();
	await expect(taskPage.feedback).toHaveText('Correct: all 7 expected results.');
	await expect(taskPage.attempts).toHaveCount(1);
	await expect(taskPage.attempts.first()).toContainText('#1 · Correct');
	const [sent] = api.bodies('/api/study/tasks/fire-fast/submissions') as {
		query: { variableName: string; variableFilters: unknown[] };
	}[];
	expect(sent.query.variableName).toBe('?pokemon');
	expect(sent.query.variableFilters).toEqual([
		{ variableName: '?speed', filterType: 2, value: '90' }
	]);
});

test('STUDY-014 the task list marks each task and updates after an attempt', async ({ page }) => {
	const attempts: Schemas['StudySubmissionHttpResponse'][] = [];
	const summaries = (): Schemas['StudyTaskSummaryHttpResponse'][] => [
		{
			key: 'fire-fast',
			title: 'Fast Fire-type Pokémon',
			summary: 'Speed of at least 90.',
			status: attempts.some((attempt) => attempt.correct)
				? 'solved'
				: attempts.length
					? 'attempted'
					: 'not_started'
		},
		{ key: 'water', title: 'Water', summary: 'Every Water type.', status: 'attempted' },
		{ key: 'grass', title: 'Grass', summary: 'Every Grass type.', status: 'solved' }
	];
	api.override('/api/study/tasks', () => ({ data: summaries() }));
	api.override('/api/study/tasks/fire-fast', () => ({
		data: {
			key: 'fire-fast',
			title: 'Fast Fire-type Pokémon',
			statement: 'Find every Fire-type Pokémon with a speed of at least 90.',
			endpoint: 'PokemonGen1',
			startingGraph: FIRE_SPEED
		}
	}));
	api.override('/api/study/submissions', () => ({ data: attempts }));
	api.override('/api/study/tasks/fire-fast/submissions', () => {
		const attempt: Schemas['StudySubmissionHttpResponse'] = {
			attempt: 1,
			correct: true,
			invalid: false,
			feedback: 'Correct: all 7 expected results.',
			matched: 7,
			missing: 0,
			extra: 0,
			expectedCount: 7,
			taskRevision: 1,
			timeSpentMs: 1_000,
			createdAt: '2026-10-20T12:00:00Z'
		};
		attempts.push(attempt);
		return { data: attempt };
	});

	await page.addInitScript(() => window.localStorage.setItem('easyquery-tour-seen', 'true'));
	await page.goto('/study');
	const tasks = page.getByTestId('study-task');
	const markers = page.getByTestId('study-task-status');
	await expect(tasks).toHaveCount(3);
	await expect(markers).toHaveText(['Not started', 'Attempted', 'Solved']);
	await expect(tasks.nth(0)).toHaveAccessibleName(/Fast Fire-type Pokémon.*Not started/);

	const taskPage = new TaskPage(page);
	await tasks.nth(0).click();
	await expect(taskPage.title).toBeVisible();
	await taskPage.submit();
	await expect(taskPage.feedback).toHaveText('Correct: all 7 expected results.');
	await page.getByRole('link', { name: 'Proposed queries' }).click();
	await expect(markers.first()).toHaveText('Solved');
	await expect(markers.first()).toHaveAttribute('data-status', 'solved');
});

test('FE-061 the app bar links to the study, through login when logged out', async ({ page }) => {
	const editor = new EditorPage(page);
	await editor.open('/');
	const study = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', {
		name: 'Study'
	});
	await study.focus();
	await expect(study).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/\/study$/);
	await expect(page.getByRole('heading', { name: 'Proposed queries' })).toBeVisible();

	api.override('/api/auth/session', () => ({ status: 401, json: { error: 'Login required' } }));
	await editor.open('/');
	await study.click();
	await expect(page).toHaveURL(/\/login\?next=%2Fstudy$/);
});

test('FE-061 a task goes back to the list, and a correct answer offers the next task', async ({
	page
}) => {
	const summaries: Schemas['StudyTaskSummaryHttpResponse'][] = [
		{ key: 'first', title: 'First task', summary: 'One', status: 'not_started' },
		{ key: 'second', title: 'Second task', summary: 'Two', status: 'not_started' }
	];
	const task = (key: string, title: string): Schemas['StudyTaskHttpResponse'] => ({
		key,
		title,
		statement: `Solve ${title}.`,
		endpoint: 'PokemonGen1',
		startingGraph: FIRE_SPEED
	});
	let correct = false;
	const attempt = (): Schemas['StudySubmissionHttpResponse'] => ({
		attempt: 1,
		correct,
		invalid: false,
		feedback: correct
			? 'Correct: all 7 expected results.'
			: 'Incorrect: 6 of 7 expected results; 0 extra.',
		matched: correct ? 7 : 6,
		missing: correct ? 0 : 1,
		extra: 0,
		expectedCount: 7,
		taskRevision: 1,
		timeSpentMs: 1_000,
		createdAt: '2026-10-20T12:00:00Z'
	});
	api.override('/api/study/tasks', () => ({ data: summaries }));
	api.override('/api/study/tasks/first', () => ({ data: task('first', 'First task') }));
	api.override('/api/study/tasks/second', () => ({ data: task('second', 'Second task') }));
	api.override('/api/study/tasks/first/submissions', () => ({ data: attempt() }));
	api.override('/api/study/tasks/second/submissions', () => ({ data: attempt() }));
	api.override('/api/study/submissions', () => ({ data: [] }));

	await page.addInitScript(() => window.localStorage.setItem('easyquery-tour-seen', 'true'));
	await page.goto('/study');
	await page.getByTestId('study-task').first().click();
	const taskPage = new TaskPage(page);
	await expect(taskPage.title).toHaveText('First task');

	// The back link at the top returns to the list; browser Back returns to the task.
	const back = page.getByRole('link', { name: 'Proposed queries' });
	await expect(back).toBeVisible();
	await back.click();
	await expect(page).toHaveURL(/\/study$/);
	await page.goBack();
	await expect(taskPage.title).toHaveText('First task');

	// An incorrect verdict offers nothing; a correct one offers back and next.
	const after = page.getByRole('navigation', { name: 'After a correct answer' });
	await taskPage.submit();
	await expect(taskPage.feedback).toContainText('Incorrect');
	await expect(after).toHaveCount(0);
	correct = true;
	await taskPage.submit();
	await expect(taskPage.feedback).toContainText('Correct');
	await expect(after.getByRole('link', { name: 'Back to the tasks' })).toBeVisible();
	await after.getByRole('link', { name: 'Next task' }).click();
	await expect(page).toHaveURL(/\/study\/second$/);
	await expect(taskPage.title).toHaveText('Second task');

	// The last task in the group's order has no Next task.
	await taskPage.submit();
	await expect(taskPage.feedback).toContainText('Correct');
	await expect(after.getByRole('link', { name: 'Next task' })).toHaveCount(0);
	await after.getByRole('link', { name: 'Back to the tasks' }).click();
	await expect(page).toHaveURL(/\/study$/);
	await page.goBack();
	await expect(taskPage.title).toHaveText('Second task');
});

test('the profile questionnaire shows a field error before sending its answers', async ({
	page
}) => {
	const forms: Schemas['StudyFormSummaryHttpResponse'][] = [
		{
			slug: 'profile',
			title: PROFILE.title,
			version: PROFILE.version,
			phase: 'before_tasks',
			submittedAt: null
		},
		{
			slug: 'usability',
			title: 'Questionário de Avaliação',
			version: 2,
			phase: 'after_finish',
			submittedAt: null
		}
	];
	api.override('/api/study/forms', () => ({ data: forms }));
	api.override('/api/study/forms/profile', () => ({ data: PROFILE }));
	api.override('/api/study/forms/profile/responses', () => {
		forms[0].submittedAt = '2026-10-20T12:00:00Z';
		const sent: Schemas['StudyFormSubmittedHttpResponse'] = {
			slug: 'profile',
			version: PROFILE.version,
			submittedAt: '2026-10-20T12:00:00Z'
		};
		return { data: sent };
	});
	await page.addInitScript(() => window.localStorage.setItem('easyquery-tour-seen', 'true'));
	await page.goto('/study');

	const questionnaire = new QuestionnairePage(page);
	await expect(questionnaire.form).toBeVisible();
	expect(await questionnaire.slug()).toBe('profile');
	await questionnaire.send();
	await expect(questionnaire.form.getByText('Answer this question.')).toBeVisible();
	expect(api.bodies('/api/study/forms/profile/responses')).toEqual([]);
	await questionnaire.rate('1. Qual é o seu nível de conhecimento sobre SPARQL/RDF?', 2);
	await questionnaire.send();
	await expect(page.getByTestId('no-tasks')).toBeVisible();
	expect(api.bodies('/api/study/forms/profile/responses')).toEqual([
		{ version: 2, answers: { q01_sparql_knowledge: 2 } }
	]);
});

test('DEC-019 only a legacy multiset task offers the comparison, to move it to set', async ({
	page
}) => {
	const admin: Schemas['SessionUserHttpResponse'] = { username: 'ana', role: 'admin' };
	api.override('/api/auth/session', () => ({ data: admin }));
	const comparison = page.getByRole('group', { name: 'Comparison' });

	await page.addInitScript(() => window.localStorage.setItem('easyquery-tour-seen', 'true'));
	await page.goto('/admin/tasks/new');
	await expect(page.getByRole('button', { name: 'Save task' })).toBeVisible();
	await expect(comparison).toHaveCount(0);

	const legacy: Schemas['AdminTaskHttpResponse'] = {
		key: 'fire-legacy',
		title: 'Fast Fire-type Pokémon',
		statement: 'Find every Fire-type Pokémon with a speed of at least 90.',
		endpoint: 'PokemonGen1',
		startingGraph: null,
		referenceGraph: FIRE_SPEED,
		referenceQuery: {
			variableName: '?pokemon',
			where: [],
			variableFilters: []
		} as unknown as Schemas['AnswerQueryHttpRequest'],
		referenceSparql: 'SELECT DISTINCT ?pokemon WHERE {}',
		expected: [],
		comparison: 'multiset',
		maxResults: 1000,
		revision: 1,
		active: true,
		createdAt: '2026-10-20T12:00:00Z',
		updatedAt: '2026-10-20T12:00:00Z'
	};
	// GET returns the stored task; the PUT that saves it returns the new revision.
	api.override('/api/admin/tasks/fire-legacy', (body) =>
		body ? { data: { ...legacy, comparison: 'set', revision: 2 } } : { data: legacy }
	);
	await page.goto('/admin/tasks/fire-legacy');
	await expect(comparison).toBeVisible();
	await expect(
		comparison.getByRole('radio', { name: 'Every result row (multiset)' })
	).toBeChecked();
	await comparison.getByRole('radio', { name: 'Set of answer values' }).check();
	await page.getByRole('button', { name: 'Save task' }).click();
	await expect
		.poll(() =>
			(api.bodies('/api/admin/tasks/fire-legacy') as ({ comparison?: string } | null)[])
				.filter((body) => body)
				.map((body) => body!.comparison)
		)
		.toEqual(['set']);
});

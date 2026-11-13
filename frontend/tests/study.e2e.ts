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
		new URL('../../src/main/resources/study/forms/profile.v3.json', import.meta.url),
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

/** A saved answer as the server answers it: when, never whether it is correct (DEC-020). */
const save = (
	number: number,
	savedAt = '2026-10-20T12:00:00Z'
): Schemas['StudySubmissionHttpResponse'] => ({
	save: number,
	taskRevision: 1,
	timeSpentMs: 61_000,
	savedAt
});

test('STUDY-016 a task starts from its drawn query and saves it with both variables, telling only when', async ({
	page
}) => {
	const task: Schemas['StudyTaskHttpResponse'] = {
		key: 'fire-fast',
		title: 'Fast Fire-type Pokémon',
		statement: 'Find every Fire-type Pokémon with a speed of at least 90.',
		endpoint: 'PokemonGen1',
		startingGraph: FIRE_SPEED
	};
	const saves: Schemas['StudySubmissionHttpResponse'][] = [];
	api.override('/api/study/tasks/fire-fast', () => ({ data: task }));
	api.override('/api/study/submissions', () => ({ data: saves }));
	api.override('/api/study/tasks/fire-fast/submissions', () => {
		saves.push(save(saves.length + 1));
		return { data: saves.at(-1)! };
	});

	const taskPage = new TaskPage(page);
	await taskPage.open('fire-fast');
	await expect(taskPage.statement).toHaveText(task.statement);
	await expect(taskPage.editor.nodeCount).toHaveText('Nodes: 3');
	await expect(taskPage.feedback).toHaveText('No answer saved yet.');
	await expect(page.getByRole('radio')).toHaveCount(0);
	await taskPage.save();
	await expect(taskPage.savedAt).toHaveAttribute('datetime', '2026-10-20T12:00:00Z');
	await expect(taskPage.feedback).toContainText('Saved at');
	await expect(taskPage.feedback).not.toContainText(/correct|incorrect|invalid|expected/i);
	const [sent] = api.bodies('/api/study/tasks/fire-fast/submissions') as {
		query: Record<string, unknown>;
	}[];
	expect(sent.query).not.toHaveProperty('variableName');
	expect(sent.query.variableFilters).toEqual([
		{ variableName: '?speed', filterType: 2, value: '90' }
	]);
});

/** Charizard has type Fire: two entities and one relation, no variable. */
const CHARIZARD_FIRE = {
	formatVersion: 1,
	endpoint: { kind: 'builtIn', id: 'PokemonGen1' },
	limit: 150,
	order: [],
	nodes: [
		{
			id: '<http://easyquery.example.org/pokemon#Charizard>',
			kind: 'entity',
			label: 'Charizard',
			value: '<http://easyquery.example.org/pokemon#Charizard>',
			position: { x: 150, y: 150 }
		},
		{
			id: '<http://easyquery.example.org/pokemon#FireType>',
			kind: 'entity',
			label: 'Fire',
			value: '<http://easyquery.example.org/pokemon#FireType>',
			position: { x: 410, y: 150 }
		}
	],
	edges: [
		{
			id: 'type',
			label: 'has type',
			predicate: '<http://easyquery.example.org/pokemon#hasType>',
			source: '<http://easyquery.example.org/pokemon#Charizard>',
			target: '<http://easyquery.example.org/pokemon#FireType>'
		}
	]
};

test('STUDY-016 an entity-only diagram is saved with its relation and no variable', async ({
	page
}) => {
	const task: Schemas['StudyTaskHttpResponse'] = {
		key: 'charizard',
		title: 'Charizard',
		statement: 'Draw Charizard and its type.',
		endpoint: 'PokemonGen1',
		startingGraph:
			CHARIZARD_FIRE as unknown as Schemas['StudyTaskHttpResponse']['startingGraph']
	};
	api.override('/api/study/tasks/charizard', () => ({ data: task }));
	api.override('/api/study/submissions', () => ({ data: [] }));
	api.override('/api/study/tasks/charizard/submissions', () => ({ data: save(1) }));

	const taskPage = new TaskPage(page);
	await taskPage.open('charizard');
	await expect(taskPage.editor.nodeCount).toHaveText('Nodes: 2');
	await taskPage.save();
	await expect(taskPage.feedback).toContainText('Saved at');
	const [sent] = api.bodies('/api/study/tasks/charizard/submissions') as {
		query: Record<string, unknown>;
	}[];
	expect(sent.query).toEqual({
		where: [
			{
				subject: '<http://easyquery.example.org/pokemon#Charizard>',
				predicate: '<http://easyquery.example.org/pokemon#hasType>',
				object: '<http://easyquery.example.org/pokemon#FireType>',
				filterType: null
			}
		]
	});
});

test('STUDY-016 the task list marks each task not started or answered and updates after a save', async ({
	page
}) => {
	const saves: Schemas['StudySubmissionHttpResponse'][] = [];
	const summaries = (): Schemas['StudyTaskSummaryHttpResponse'][] => [
		{
			key: 'fire-fast',
			title: 'Fast Fire-type Pokémon',
			summary: 'Speed of at least 90.',
			status: saves.length ? 'answered' : 'not_started',
			lastSavedAt: saves.at(-1)?.savedAt ?? null
		},
		{
			key: 'water',
			title: 'Water',
			summary: 'Every Water type.',
			status: 'answered',
			lastSavedAt: '2026-10-19T09:30:00Z'
		}
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
	api.override('/api/study/submissions', () => ({ data: saves }));
	api.override('/api/study/tasks/fire-fast/submissions', () => {
		saves.push(save(1));
		return { data: saves[0] };
	});

	await page.addInitScript(() => window.localStorage.setItem('easyquery-tour-seen', 'true'));
	await page.goto('/study');
	const tasks = page.getByTestId('study-task');
	const markers = page.getByTestId('study-task-status');
	await expect(tasks).toHaveCount(2);
	await expect(markers.nth(0)).toHaveText('Not started');
	await expect(markers.nth(1)).toContainText('Answered, saved');
	await expect(markers.nth(1).locator('time')).toHaveAttribute(
		'datetime',
		'2026-10-19T09:30:00Z'
	);
	await expect(tasks.nth(0)).toHaveAccessibleName(/Fast Fire-type Pokémon.*Not started/);

	const taskPage = new TaskPage(page);
	await tasks.nth(0).click();
	await expect(taskPage.title).toBeVisible();
	await taskPage.save();
	await expect(taskPage.feedback).toContainText('Saved at');
	await page.getByRole('link', { name: 'Proposed queries' }).click();
	await expect(markers.first()).toContainText('Answered');
	await expect(markers.first()).toHaveAttribute('data-status', 'answered');
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

test('FE-061 a task goes back to the list, and a save offers the next task', async ({ page }) => {
	const summaries: Schemas['StudyTaskSummaryHttpResponse'][] = [
		{
			key: 'first',
			title: 'First task',
			summary: 'One',
			status: 'not_started',
			lastSavedAt: null
		},
		{
			key: 'second',
			title: 'Second task',
			summary: 'Two',
			status: 'not_started',
			lastSavedAt: null
		}
	];
	const task = (key: string, title: string): Schemas['StudyTaskHttpResponse'] => ({
		key,
		title,
		statement: `Solve ${title}.`,
		endpoint: 'PokemonGen1',
		startingGraph: FIRE_SPEED
	});
	api.override('/api/study/tasks', () => ({ data: summaries }));
	api.override('/api/study/tasks/first', () => ({ data: task('first', 'First task') }));
	api.override('/api/study/tasks/second', () => ({ data: task('second', 'Second task') }));
	api.override('/api/study/tasks/first/submissions', () => ({ data: save(1) }));
	api.override('/api/study/tasks/second/submissions', () => ({ data: save(1) }));
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

	// Nothing is offered before a save; any save offers back and next, whatever the answer.
	const after = page.getByRole('navigation', { name: 'After saving' });
	await expect(after).toHaveCount(0);
	await taskPage.save();
	await expect(taskPage.feedback).toContainText('Saved at');
	await expect(after.getByRole('link', { name: 'Back to the tasks' })).toBeVisible();
	await after.getByRole('link', { name: 'Next task' }).click();
	await expect(page).toHaveURL(/\/study\/second$/);
	await expect(taskPage.title).toHaveText('Second task');

	// The last task in the group's order has no Next task.
	await taskPage.save();
	await expect(after.getByRole('link', { name: 'Back to the tasks' })).toBeVisible();
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
			version: 3,
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
	await questionnaire.rate('Qual é o seu nível de conhecimento sobre SPARQL/RDF?', 2);
	await questionnaire.send();
	await expect(page.getByTestId('no-tasks')).toBeVisible();
	expect(api.bodies('/api/study/forms/profile/responses')).toEqual([
		{ version: 3, answers: { a1_sparql_knowledge: 2 } }
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

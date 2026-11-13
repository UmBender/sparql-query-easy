/**
 * QUAL-022: text from the API — labels, literals, generated SPARQL, task
 * titles and statements, attempt feedback, questionnaire texts and admin
 * lists — renders as text. A payload that became markup would run a handler,
 * add an <img src="x">, add a <script>, open a dialog or break the
 * Content-Security-Policy (recorded by guardOffline).
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { components } from '../src/lib/api/schema';
import { clickNode } from './support/editor';
import { guardOffline } from './support/offline';
import { mockApi, type MockApi } from './support/mock-api';
import { EditorPage } from './support/pages/editor-page';
import { TaskPage } from './support/pages/task-page';

type Schemas = components['schemas'];

const PAYLOAD =
	'<img src=x onerror="window.__xss=1;alert(1)"><script>window.__xss=2</script><b>bold</b>';
const SHOWN = '<img src=x onerror=';
const ENTITY = '<https://example.test/xss>';
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
let dialogs: string[];

test.beforeEach(async ({ page, baseURL }) => {
	unexpected = await guardOffline(page, baseURL!);
	api = await mockApi(page);
	dialogs = [];
	page.on('dialog', (dialog) => {
		dialogs.push(dialog.message());
		void dialog.dismiss();
	});
	await page.addInitScript(() => window.localStorage.setItem('easyquery-tour-seen', 'true'));
});

test.afterEach(() => {
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});

/** Nothing of the payload became markup or ran. */
async function expectInert(page: Page, where: string) {
	expect(await page.evaluate(() => (window as { __xss?: number }).__xss), where).toBeUndefined();
	await expect(page.locator('img[src="x"]'), where).toHaveCount(0);
	await expect(page.locator('b', { hasText: /^bold$/ }), where).toHaveCount(0);
	const scripts = await page
		.locator('script')
		.evaluateAll((items) => items.filter((item) => item.textContent?.includes('__xss')).length);
	expect(scripts, where).toBe(0);
	expect(dialogs, where).toEqual([]);
}

const session = (role: 'participant' | 'admin') => {
	const user: Schemas['SessionUserHttpResponse'] = { username: 'ana', role };
	api.override('/api/auth/session', () => ({ data: user }));
};

test('search results, the results table, node labels and View SPARQL show API text as text', async ({
	page
}) => {
	api.override('/api/query/search', () => ({
		data: [
			{
				propertyId: ENTITY,
				propertyLabel: PAYLOAD,
				propertyType: 'objetoClasse',
				propertyClass: null
			}
		]
	}));
	api.override('/api/query/relationships', () => ({
		data: [
			{
				propertyId: '<https://example.test/p>',
				propertyLabel: PAYLOAD,
				propertyType: 'label',
				propertyClass: null
			}
		]
	}));
	api.override('/api/query/relationship-value', () => ({
		data: [
			{
				propertyId: PAYLOAD,
				propertyLabel: PAYLOAD,
				propertyType: 'text',
				propertyClass: null
			}
		]
	}));
	api.override('/api/query/sparql', () => ({ data: `SELECT ?x WHERE { ?x ?p "${PAYLOAD}" }` }));
	const editor = new EditorPage(page);
	await editor.open();

	await page.getByRole('combobox', { name: 'Search nodes' }).fill('xss');
	const option = page.getByRole('option').filter({ hasText: SHOWN });
	await expect(option).toBeVisible();
	await expectInert(page, 'search list');
	await option.click();
	await expect(editor.nodeCount).toHaveText('Nodes: 1');

	await clickNode(page, ENTITY);
	await page
		.locator('#node-action-menu')
		.getByRole('button', { name: 'Explore relationships' })
		.click();
	const row = page.locator('#table-results-body tr').filter({ hasText: SHOWN });
	await expect(row).toBeVisible();
	await expectInert(page, 'results table');
	await row.click();
	await expect(editor.nodeCount).toHaveText('Nodes: 2');
	await expectInert(page, 'canvas labels');

	await page.getByRole('button', { name: 'View SPARQL' }).click();
	await expect(page.getByRole('dialog')).toContainText(SHOWN);
	await expectInert(page, 'View SPARQL');
});

test('the task list, a task page and its feedback show titles and statements as text', async ({
	page
}) => {
	session('participant');
	const summary: Schemas['StudyTaskSummaryHttpResponse'] = {
		key: 'xss',
		title: PAYLOAD,
		summary: PAYLOAD,
		status: 'not_started',
		lastSavedAt: null
	};
	api.override('/api/study/tasks', () => ({ data: [summary] }));
	api.override('/api/study/tasks/xss', () => ({
		data: {
			key: 'xss',
			title: PAYLOAD,
			statement: PAYLOAD,
			endpoint: 'PokemonGen1',
			startingGraph: FIRE_SPEED
		}
	}));
	api.override('/api/study/submissions', () => ({ data: [] }));
	// STUDY-016: a save shows no server text, but a refused one shows the server's error.
	api.override('/api/study/tasks/xss/submissions', () => ({
		status: 400,
		json: { error: PAYLOAD }
	}));

	await page.goto('/study');
	await expect(page.getByTestId('study-task')).toContainText(SHOWN);
	await expectInert(page, 'task list');

	const taskPage = new TaskPage(page);
	await page.getByTestId('study-task').click();
	await expect(taskPage.title).toContainText(SHOWN);
	await expect(page.getByText(PAYLOAD).first()).toBeVisible();
	await expectInert(page, 'task page');
	await taskPage.save();
	await expect(taskPage.feedback).toContainText(SHOWN);
	await expectInert(page, 'save error');
});

test('questionnaire titles, questions and labels show as text', async ({ page }) => {
	session('participant');
	const form: Schemas['FormDefinition'] = JSON.parse(JSON.stringify(PROFILE));
	form.title = PAYLOAD;
	form.description = PAYLOAD;
	for (const formPage of form.pages) {
		formPage.title = PAYLOAD;
		for (const question of formPage.questions) {
			question.text = PAYLOAD;
			question.minLabel = PAYLOAD;
		}
	}
	const forms: Schemas['StudyFormSummaryHttpResponse'][] = [
		{
			slug: 'profile',
			title: PAYLOAD,
			version: form.version,
			phase: 'before_tasks',
			submittedAt: null
		}
	];
	api.override('/api/study/forms', () => ({ data: forms }));
	api.override('/api/study/forms/profile', () => ({ data: form }));

	await page.goto('/study');
	await expect(page.getByText(PAYLOAD).first()).toBeVisible();
	await expectInert(page, 'questionnaire');
});

test('admin task and group lists, and the help page, show names as text', async ({ page }) => {
	session('admin');
	const task: Schemas['AdminTaskSummaryHttpResponse'] = {
		key: 'xss',
		title: PAYLOAD,
		endpoint: 'PokemonGen1',
		comparison: 'set',
		revision: 1,
		active: true,
		expectedCount: 1,
		updatedAt: '2026-10-20T12:00:00Z'
	};
	const group: Schemas['StudyGroupHttpResponse'] = {
		id: 1,
		name: PAYLOAD,
		tasks: [],
		members: [PAYLOAD],
		updatedAt: '2026-10-20T12:00:00Z'
	};
	api.override('/api/admin/tasks', () => ({ data: [task] }));
	api.override('/api/admin/groups', () => ({ data: [group] }));

	await page.goto('/admin/tasks');
	await expect(page.getByText(PAYLOAD).first()).toBeVisible();
	await expectInert(page, 'admin tasks');
	await page.goto('/admin/groups');
	await expect(page.getByText(PAYLOAD).first()).toBeVisible();
	await expectInert(page, 'admin groups');
	await page.goto('/help');
	await expect(page.getByRole('heading').first()).toBeVisible();
	await expectInert(page, 'help');
});

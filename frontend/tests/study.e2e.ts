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
		new URL('../../src/main/resources/study/forms/profile.v1.json', import.meta.url),
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
	await expect(taskPage.answerVariable('?pokemon')).toBeChecked();
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

test('the profile questionnaire shows a field error before sending its answers', async ({
	page
}) => {
	const forms: Schemas['StudyFormSummaryHttpResponse'][] = [
		{
			slug: 'profile',
			title: PROFILE.title,
			version: 1,
			phase: 'before_tasks',
			submittedAt: null
		},
		{
			slug: 'usability',
			title: 'Using the editor',
			version: 1,
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
			version: 1,
			submittedAt: '2026-10-20T12:00:00Z'
		};
		return { data: sent };
	});
	await page.addInitScript(() => window.localStorage.setItem('easyquery-tour-seen', 'true'));
	await page.goto('/study');

	const questionnaire = new QuestionnairePage(page);
	await expect(questionnaire.form).toBeVisible();
	expect(await questionnaire.slug()).toBe('profile');
	await questionnaire.choose('I have heard of it');
	await questionnaire.check('SQL');
	await questionnaire.fill('PLACEHOLDER How many years have you programmed?', '99');
	await questionnaire.rate('PLACEHOLDER I am comfortable exploring data in tables.', 4);
	await questionnaire.send();
	await expect(questionnaire.form.getByText('Enter a number from 0 to 60.')).toBeVisible();
	expect(api.bodies('/api/study/forms/profile/responses')).toEqual([]);
	await questionnaire.fill('PLACEHOLDER How many years have you programmed?', '4');
	await questionnaire.send();
	await expect(page.getByTestId('no-tasks')).toBeVisible();
	expect(api.bodies('/api/study/forms/profile/responses')).toEqual([
		{
			version: 1,
			answers: {
				sparql_familiarity: 'heard_of',
				query_languages: ['sql'],
				programming_years: 4,
				data_comfort: 4,
				// Optional and unanswered: sent empty, stored as no answer (STUDY-009 rules).
				role: ''
			}
		}
	]);
});

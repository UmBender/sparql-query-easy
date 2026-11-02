/**
 * The participant's side of the study on the real stack (STUDY-003): the
 * tasks of their group in order, a task page with the statement and the
 * editor on the starting graph with the endpoint locked, and the note for a
 * participant without a group. STUDY-004/016: two saved answers that show
 * only when they were saved, never a verdict. STUDY-005: the final submission
 * closes the tasks. STUDY-008: the consent screen comes first. STUDY-010: the profile questionnaire before the
 * tasks and the usability questionnaire after the final submission, with per-page progress kept in the browser.
 * Test data comes from the admin API.
 */
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { QuestionnairePage } from '../tests/support/pages/questionnaire-page';
import { TaskPage } from '../tests/support/pages/task-page';
import {
	FIRE_SPEED,
	PROFILE_ANSWERS,
	PROFILE_QUESTION,
	PROFILE_VERSION,
	answerPage,
	guardOffline,
	joinStudy,
	loginAs,
	seedStudy,
	shippedPages
} from './support.js';

let unexpected: string[];

test.beforeEach(({ page, baseURL }) => {
	unexpected = guardOffline(page, baseURL!);
});

test.afterEach(() => {
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});

test('a participant sees their group tasks in order and opens one in the editor', async ({
	page,
	browser
}) => {
	const participant = `solver-${Date.now()}`;
	const keys = await seedStudy(browser, participant);
	await loginAs(page.request, participant);

	await page.goto('/study');
	const tasks = page.getByTestId('study-task');
	await expect(tasks).toHaveCount(3);
	await expect(tasks.nth(0)).toContainText('1. All Water Pokémon');
	await expect(tasks.nth(1)).toContainText('2. Fast Fire Pokémon');
	await expect(tasks.nth(2)).toContainText('3. All Grass Pokémon');

	await tasks.nth(1).click();
	await expect(page).toHaveURL(new RegExp(`/study/${keys[1]}$`));
	await expect(page.getByTestId('task-statement')).toHaveText(
		'Find the Fire-type Pokémon with speed of at least 90.'
	);
	await expect(page.locator('#status-nodes')).toHaveText('Nodes: 3');
	await expect(page.locator('#input-endpoint-sparql')).toBeDisabled();
	await expect(page.locator('#input-endpoint-sparql')).toHaveValue(/Pok/);

	await page.getByRole('link', { name: 'Proposed queries' }).click();
	await tasks.nth(0).click();
	await expect(page.locator('#status-nodes')).toHaveText('Nodes: 0');
});

test('a participant without a group is told no tasks are assigned', async ({ page }) => {
	await loginAs(page.request, `lonely-${Date.now()}`);
	await joinStudy(page.request);
	await page.goto('/study');
	await expect(page.getByTestId('no-tasks')).toContainText('No tasks are assigned to you yet');
	await page.goto('/study/not-mine');
	await expect(page.getByRole('alert')).toHaveText('Task not found');
});

test('a participant saves two answers, sees only when, and the task shows as answered', async ({
	page,
	browser
}) => {
	const participant = `answerer-${Date.now()}`;
	const keys = await seedStudy(browser, participant);
	await loginAs(page.request, participant);

	const taskPage = new TaskPage(page);
	await taskPage.open(keys[1]);
	await expect(taskPage.editor.nodeCount).toHaveText('Nodes: 3');
	await expect(taskPage.feedback).toHaveText('No answer saved yet.');
	await taskPage.save();
	await expect(taskPage.feedback).toContainText('Saved at');

	// The same query without its speed filter: every Fire-type Pokémon. Still only a save time (DEC-020).
	const saved = JSON.parse(readFileSync(FIRE_SPEED, 'utf8'));
	for (const node of saved.nodes) if (node.kind === 'valueVariable') node.filter = null;
	await taskPage.editor.uploadQuery('fire-any-speed.query.json', saved);
	// "Saved at" is already shown, so wait for the second save itself.
	await Promise.all([
		page.waitForResponse(
			(reply) => reply.request().method() === 'POST' && reply.url().includes('/submissions')
		),
		taskPage.save()
	]);
	await expect(taskPage.feedback).toContainText('Saved at');
	await expect(taskPage.feedback).not.toContainText(/correct|expected|invalid/i);
	const saves = await page.request.get(`/api/study/submissions?task=${keys[1]}`);
	const body = (await saves.json()) as { data: Record<string, unknown>[] };
	expect(body.data.map((item) => item.save)).toEqual([1, 2]);
	for (const item of body.data)
		expect(Object.keys(item).sort()).toEqual([
			'save',
			'savedAt',
			'taskRevision',
			'timeSpentMs'
		]);
	await page.reload();
	await expect(taskPage.feedback).toContainText('Saved at');

	// DEC-020 C8: the list shows answered, never solved.
	await page.getByRole('link', { name: 'Proposed queries' }).click();
	const markers = page.getByTestId('study-task-status');
	await expect(markers.nth(0)).toHaveText('Not started');
	await expect(markers.nth(1)).toContainText('Answered, saved');
	await expect(markers.nth(2)).toHaveText('Not started');
});

test('after the final submission the task pages show the finished page', async ({
	page,
	browser
}) => {
	const participant = `finisher-${Date.now()}`;
	const keys = await seedStudy(browser, participant);
	await loginAs(page.request, participant);

	await page.goto(`/study/${keys[0]}`);
	await expect(page.getByTestId('task-statement')).toBeVisible();
	await page.getByRole('link', { name: 'Proposed queries' }).click();
	await page.getByRole('button', { name: 'Finish the study' }).click();
	const dialog = page.getByRole('dialog', { name: 'Finish the study?' });
	await dialog.getByRole('button', { name: 'Keep working' }).click();
	await expect(page.getByTestId('study-task')).toHaveCount(3);

	await page.getByRole('button', { name: 'Finish the study' }).click();
	await dialog.getByRole('button', { name: 'Finish and submit' }).click();
	await expect(page.getByTestId('questionnaire')).toHaveAttribute('data-slug', 'usability');
	await expect(page.getByTestId('study-task')).toHaveCount(0);

	await page.goto(`/study/${keys[0]}`);
	await expect(page.getByRole('heading', { name: 'Study finished' })).toBeVisible();
	await expect(page.locator('#cy')).toHaveCount(0);
	const submit = await page.request.post(`/api/study/tasks/${keys[0]}/submissions`, {
		data: { graph: {}, query: {} }
	});
	expect(submit.status()).toBe(403);
});

test('a new participant sees the consent screen first and the tasks only after agreeing', async ({
	page
}) => {
	const participant = `consenting-${Date.now()}`;
	await loginAs(page.request, participant);

	await page.goto('/study');
	await expect(page.getByRole('heading', { name: 'Consent to take part' })).toBeVisible();
	await expect(page.getByTestId('consent-text')).toContainText('PLACEHOLDER');
	const results = await new AxeBuilder({ page })
		.include('[data-testid="consent-screen"]')
		.analyze();
	expect(results.violations.map((violation) => violation.id)).toEqual([]);
	const before = await page.request.get('/api/study/tasks');
	expect(before.status()).toBe(403);

	await page.getByRole('button', { name: 'I do not agree' }).click();
	await expect(page.getByTestId('consent-declined')).toBeVisible();
	await page.getByRole('button', { name: 'Read it again' }).click();
	await page.getByRole('button', { name: 'I agree to take part' }).click();

	// STUDY-010: the profile questionnaire before the tasks, checked in the browser and on the server.
	const questionnaire = new QuestionnairePage(page);
	const form = questionnaire.form;
	await expect(form).toHaveAttribute('data-slug', 'profile');
	const tasksBefore = await page.request.get('/api/study/tasks');
	expect(await tasksBefore.json()).toEqual({ error: 'profile_required' });
	const axe = await new AxeBuilder({ page }).include('[data-testid="questionnaire"]').analyze();
	expect(axe.violations.map((violation) => violation.id)).toEqual([]);
	await questionnaire.send();
	await expect(form.getByText('Answer this question.')).toBeVisible();
	const bypass = await page.request.post('/api/study/forms/profile/responses', {
		data: { version: PROFILE_VERSION, answers: { ...PROFILE_ANSWERS, q01_sparql_knowledge: 6 } }
	});
	expect(bypass.status()).toBe(400);
	expect((await bypass.json()).errors).toEqual({
		q01_sparql_knowledge: 'Choose a value from 1 to 5.'
	});
	await questionnaire.rate(PROFILE_QUESTION, 2);
	await questionnaire.send();
	await expect(page.getByTestId('no-tasks')).toBeVisible();

	await page.goto('/study/not-mine');
	await expect(page.getByRole('alert')).toHaveText('Task not found');
});

test('a task link opened before consenting leads to the consent screen', async ({ page }) => {
	await loginAs(page.request, `early-${Date.now()}`);
	await page.goto('/study/any-task');
	await expect(page).toHaveURL(/\/study$/);
	await expect(page.getByTestId('consent-screen')).toBeVisible();
});

test('the usability questionnaire keeps its first page across a reload until logout', async ({
	page
}) => {
	const participant = `rater-${Date.now()}`;
	await loginAs(page.request, participant);
	await joinStudy(page.request);
	expect((await page.request.post('/api/study/finish', { data: {} })).status()).toBe(200);

	await page.goto('/study');
	const questionnaire = new QuestionnairePage(page);
	const form = questionnaire.form;
	await expect(form).toHaveAttribute('data-slug', 'usability');
	await expect(questionnaire.pageLabel).toHaveText('Page 1 of 2');
	const [tool, notation] = shippedPages('usability.v2.json');
	const ease = form.getByRole('group', { name: tool[1].text }).getByRole('radio', { name: '4' });
	await answerPage(questionnaire, tool, 4, 3);
	await questionnaire.next();
	await expect(questionnaire.pageLabel).toHaveText('Page 2 of 2');

	await page.reload();
	await expect(questionnaire.pageLabel).toHaveText('Page 2 of 2');
	await questionnaire.back();
	await expect(ease).toBeChecked();
	await expect(questionnaire.field(tool[0].text)).toHaveValue('3');

	await page.getByRole('button', { name: 'Log out' }).click();
	await expect(page).toHaveURL(/\/login/);
	const kept = await page.evaluate(() =>
		Object.keys(window.localStorage).filter((key) => key.startsWith('easyquery-form:'))
	);
	expect(kept).toEqual([]);

	await loginAs(page.request, participant);
	await page.goto('/study');
	await expect(questionnaire.pageLabel).toHaveText('Page 1 of 2');
	await expect(ease).not.toBeChecked();
	await answerPage(questionnaire, tool, 5);
	await questionnaire.next();
	await answerPage(questionnaire, notation, 5);
	await questionnaire.send();
	await expect(page.getByTestId('study-finished')).toBeVisible();
	const status = await page.request.get('/api/study/forms/usability/response');
	expect(((await status.json()) as { data: { answered: boolean } }).data.answered).toBe(true);
});

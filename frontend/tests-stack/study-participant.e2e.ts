/**
 * The participant's side of the study on the real stack (STUDY-003): the
 * tasks of their group in order, a task page with the statement and the
 * editor on the starting graph with the endpoint locked, and the note for a
 * participant without a group. STUDY-004: a correct and a wrong answer, the
 * server's feedback and the attempt history. STUDY-005: the final submission
 * closes the tasks. STUDY-008: the consent screen comes first. Test data comes from the admin API.
 */
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { FIRE_SPEED, guardOffline, joinStudy, loginAs, seedStudy } from './support.js';

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

	await page.getByRole('link', { name: 'All tasks' }).click();
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

test('a participant submits a correct and a wrong answer and sees the feedback and both attempts', async ({
	page,
	browser
}) => {
	const participant = `answerer-${Date.now()}`;
	const keys = await seedStudy(browser, participant);
	await loginAs(page.request, participant);

	await page.goto(`/study/${keys[1]}`);
	await expect(page.locator('#status-nodes')).toHaveText('Nodes: 3');
	await expect(page.getByRole('radio', { name: '?pokemon' })).toBeChecked();
	await page.locator('#submit-answer-btn').click();
	await expect(page.getByTestId('answer-feedback')).toHaveText(
		/^Correct: all \d+ expected results\.$/
	);

	// The same query without its speed filter: every Fire-type Pokémon.
	const saved = JSON.parse(readFileSync(FIRE_SPEED, 'utf8'));
	for (const node of saved.nodes) if (node.kind === 'valueVariable') node.filter = null;
	await page.locator('#upload-json').setInputFiles({
		name: 'fire-any-speed.query.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(saved))
	});
	await page.locator('#submit-answer-btn').click();
	await expect(page.getByTestId('answer-feedback')).toHaveText(
		/^Incorrect: (\d+) of \1 expected results; \d+ extra\.$/
	);

	const history = page.getByTestId('attempt-history').getByRole('listitem');
	await expect(history).toHaveCount(2);
	await expect(history.nth(0)).toContainText('#2 · Incorrect');
	await expect(history.nth(1)).toContainText('#1 · Correct');
	await page.reload();
	await expect(page.getByTestId('attempt-history').getByRole('listitem')).toHaveCount(2);
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
	await page.getByRole('link', { name: 'All tasks' }).click();
	await page.getByRole('button', { name: 'Finish the study' }).click();
	const dialog = page.getByRole('dialog', { name: 'Finish the study?' });
	await dialog.getByRole('button', { name: 'Keep working' }).click();
	await expect(page.getByTestId('study-task')).toHaveCount(3);

	await page.getByRole('button', { name: 'Finish the study' }).click();
	await dialog.getByRole('button', { name: 'Finish and submit' }).click();
	await expect(page.getByTestId('study-finished')).toBeVisible();
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

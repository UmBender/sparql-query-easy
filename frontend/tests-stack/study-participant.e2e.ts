/**
 * The participant's side of the study on the real stack (STUDY-003): the
 * tasks of their group in order, a task page with the statement and the
 * editor on the starting graph with the endpoint locked, and the note for a
 * participant without a group. Test data comes from the admin API.
 */
import { expect, test } from '@playwright/test';
import { guardOffline, loginAs, seedStudy } from './support.js';

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
	await page.goto('/study');
	await expect(page.getByTestId('no-tasks')).toContainText('No tasks are assigned to you yet');
	await page.goto('/study/not-mine');
	await expect(page.getByRole('alert')).toHaveText('Task not found');
});

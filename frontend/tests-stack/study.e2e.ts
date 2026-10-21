/**
 * The proposed-task study on the real stack (Ktor, Testcontainers PostgreSQL,
 * PokemonGen1). STUDY-006: the configured `stack-admin` creates a task by
 * drawing its reference query in the shared editor and finds it in the list.
 * STUDY-007: the admin creates a group, adds a task and a participant.
 */
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { FIRE_SPEED, createTask, guardOffline, loginAs } from './support.js';

let unexpected: string[];

test.beforeEach(({ page, baseURL }) => {
	unexpected = guardOffline(page, baseURL!);
});

test.afterEach(() => {
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});

test('an admin creates a task by drawing the reference query and sees it in the list', async ({
	page
}) => {
	const key = `fire-fast-${Date.now()}`;
	await loginAs(page.request, 'stack-admin');

	await page.goto('/admin/tasks/new');
	await page.getByLabel('Key').fill(key);
	await page.getByLabel('Title').fill('Fast Fire Pokémon');
	await page
		.getByLabel('Statement')
		.fill('Find the Fire-type Pokémon with speed of at least 90.');
	await page.locator('#upload-json').setInputFiles(FIRE_SPEED.pathname);
	await expect(page.locator('#status-nodes')).toHaveText('Nodes: 3');
	await expect(page.locator('#input-endpoint-sparql')).toBeDisabled();
	await expect(page.getByRole('radio', { name: 'pokemon' })).toBeChecked();
	// The upload's toast can cover the button, and hovering it keeps it open: wait until it closes.
	await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 });

	await page.getByRole('button', { name: 'Preview expected result' }).click();
	await expect(page.getByTestId('preview-count')).toContainText('distinct values');
	await expect(page.getByRole('region', { name: 'Expected result' })).toContainText('Charizard');

	await page.getByRole('button', { name: 'Save task' }).click();
	await expect(page).toHaveURL(new RegExp(`/admin/tasks/${key}$`));
	await expect(page.getByTestId('task-revision')).toHaveText('Revision 1 · active');

	await page.getByRole('link', { name: 'All tasks' }).click();
	const row = page.getByTestId('task-row').filter({ hasText: key });
	await expect(row).toContainText('Fast Fire Pokémon');
	await expect(row).toContainText('Active');
});

test('an admin creates a group, adds a task and a participant', async ({ page, browser }) => {
	const stamp = Date.now();
	const participant = `part-${stamp}`;
	const other = await browser.newContext();
	await loginAs(other.request, participant);
	await other.close();

	await loginAs(page.request, 'stack-admin');
	const graph = JSON.parse(readFileSync(FIRE_SPEED, 'utf8'));
	const task = `water-${stamp}`;
	await createTask(page.request, task, 'All Water Pokémon', {
		graph,
		query: {
			variableName: '?pokemon',
			where: [
				{
					subject: '?pokemon',
					predicate: '<http://easyquery.example.org/pokemon#hasType>',
					object: '<http://easyquery.example.org/pokemon#WaterType>',
					filterType: null
				}
			]
		}
	});

	await page.goto('/admin');
	await page.getByRole('link', { name: 'Participant groups' }).click();
	await expect(page.getByTestId('unassigned')).toContainText(participant);
	const name = `Condition ${stamp}`;
	await page.getByLabel('New group name').fill(name);
	await page.getByRole('button', { name: 'Create group' }).click();
	await page.getByRole('link', { name: `Open ${name}` }).click();
	await expect(page.getByRole('heading', { name })).toBeVisible();

	await page.getByRole('button', { name: `Add task ${task}` }).click();
	await expect(page.getByTestId('group-tasks')).toContainText('All Water Pokémon');
	await page.getByRole('button', { name: `Add participant ${participant}` }).click();
	await expect(page.getByTestId('group-members')).toContainText(participant);

	await page.getByRole('link', { name: 'All groups' }).click();
	await expect(page.getByTestId('group-row').filter({ hasText: name })).toContainText(
		'1 tasks · 1 participants'
	);
	await expect(
		page.getByRole('region', { name: 'Participants without a group' })
	).not.toContainText(participant);
});

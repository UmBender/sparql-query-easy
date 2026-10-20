/**
 * The proposed-task study on the real stack (Ktor, Testcontainers PostgreSQL,
 * PokemonGen1). STUDY-006: the configured `stack-admin` creates a task by
 * drawing its reference query in the shared editor and finds it in the list.
 */
import { expect, test } from '@playwright/test';
import { guardOffline, loginAs } from './support.js';

const FIRE_SPEED = new URL(
	'../src/lib/domain/fixtures/fire-speed-at-least-90.query.json',
	import.meta.url
);

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
	await expect(page.getByRole('radio', { name: '?pokemon' })).toBeChecked();

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

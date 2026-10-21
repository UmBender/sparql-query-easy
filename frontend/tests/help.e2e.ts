/**
 * DOC-006: the in-app user guide at /help (DEC-018 Q4 C), offline with the
 * mocked API. The images are written by `npm run help:screens`.
 */
import { expect, test } from '@playwright/test';
import { guardOffline } from './support/offline';
import { mockApi } from './support/mock-api';
import { openEditor } from './support/editor';

let unexpected: string[];

test.beforeEach(async ({ page, baseURL }) => {
	unexpected = await guardOffline(page, baseURL!);
	await mockApi(page);
});

test.afterEach(() => {
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});

const SECTIONS = [
	'Getting started',
	'A worked example',
	'Node kinds',
	'Relations and the action list',
	'Filters',
	'Running the query',
	'Filter funnel and badges',
	'View SPARQL',
	'Files: triples and saved queries',
	'Search, layout and undo',
	'Accounts and the study'
];

test('/help opens without a session, lists every section and loads every image', async ({
	page
}) => {
	await page.goto('/help');
	await expect(page.getByRole('heading', { name: 'Help', level: 1 })).toBeVisible();
	await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Contents', ...SECTIONS]);
	const contents = page.getByRole('navigation', { name: 'Help contents' }).getByRole('link');
	await expect(contents).toHaveText(SECTIONS);
	await contents.filter({ hasText: 'Filter funnel and badges' }).click();
	await expect(page).toHaveURL(/#funnel$/);

	const images = page.locator('main img');
	await expect(images).toHaveCount(6);
	for (const image of await images.all()) {
		await image.scrollIntoViewIfNeeded();
		await expect(image).toHaveAttribute('alt', /^.{20,}$/);
		await expect
			.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
			.toBe(1280);
	}
});

test('the toolbar Help link opens /help and Back returns to the editor', async ({ page }) => {
	await openEditor(page);
	await page.locator('#help-link').click();
	await expect(page).toHaveURL(/\/help$/);
	await page.getByRole('link', { name: 'Back to the editor' }).first().click();
	await expect(page.locator('#cy')).toBeVisible();
	await expect(page.locator('#guided-tour')).toHaveCount(0);
});

test('Start the tour on /help shows the guided tour again on the editor', async ({ page }) => {
	await openEditor(page);
	await expect(page.locator('#guided-tour')).toHaveCount(0);
	await page.goto('/help');
	await page.getByTestId('start-tour').click();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByRole('dialog', { name: /^Step 1 of/ })).toBeVisible();
});

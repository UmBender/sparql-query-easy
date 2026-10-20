/**
 * QUAL-017: a small smoke of the production images through Caddy (DEC-016 Q1
 * C): the SPA and its fallback, the proxied API with a ready database, login
 * and logout with the session cookie, one PokemonGen1 query and one study
 * task, all on the `web` origin. Data comes from the API only. The detailed
 * real-stack suites stay in tests-stack/ (`test:stack`).
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { EditorPage } from '../tests/support/pages/editor-page';
import { TaskPage } from '../tests/support/pages/task-page';
import { FIRE_SPEED, PASSWORD, guardOffline, loginAs, seedStudy } from '../tests-stack/support';

let unexpected: string[];

test.beforeEach(({ page, baseURL }) => {
	unexpected = guardOffline(page, baseURL!);
});

test.afterEach(() => {
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});

test('Caddy serves the SPA with its fallback and proxies the API to a ready backend', async ({
	page,
	request
}) => {
	const health = await request.get('/health');
	expect(health.status()).toBe(200);
	expect(await health.json()).toEqual({ status: 'ok', database: 'ready' });
	const endpoints = await request.get('/api/endpoints');
	expect(endpoints.status()).toBe(200);
	expect(
		((await endpoints.json()) as { data: { id: string }[] }).data.map((item) => item.id)
	).toContain('PokemonGen1');
	const spec = await request.get('/openapi.json');
	expect(spec.status()).toBe(200);
	expect(Object.keys(((await spec.json()) as { paths: object }).paths)).toContain(
		'/api/query/stage'
	);
	expect((await request.get('/')).headers()['x-content-type-options']).toBe('nosniff');

	// A deep link is served by the index.html fallback; the route guard sends it to login.
	await page.goto('/study/some-task');
	await expect(page).toHaveURL(/\/login\?next=/);
	await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
});

test('a visitor creates an account, is logged in by the session cookie and logs out', async ({
	page
}) => {
	const username = `compose-${Date.now()}`;
	await page.goto('/login');
	await page.getByRole('button', { name: 'Create an account' }).click();
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByLabel('Repeat the password').fill(PASSWORD);
	await page
		.getByRole('form', { name: 'Create an account' })
		.getByRole('button', { name: 'Create account' })
		.click();
	await expect(page.getByTestId('account-name')).toHaveText(username);
	const cookies = await page.context().cookies();
	expect(cookies.find((cookie) => cookie.httpOnly)?.secure).toBe(true);

	await page.reload();
	await expect(page.getByTestId('account-name')).toHaveText(username);
	await page.getByRole('button', { name: 'Log out' }).click();
	await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
	expect((await page.request.get('/api/auth/session')).status()).toBe(401);
});

test('a saved PokemonGen1 query runs as a staged query through Caddy', async ({ page }) => {
	const editor = new EditorPage(page);
	// The production build has no e2e hook (window.__easyquery): only the UI is used here.
	await editor.open();
	await editor.uploadQuery(
		'fire-speed-at-least-90.query.json',
		JSON.parse(readFileSync(FIRE_SPEED, 'utf8'))
	);
	await expect(editor.nodeCount).toHaveText('Nodes: 3');
	await editor.runQuery();
	await expect(editor.stageHeading).toHaveText('Stage 1 of 2: ?pokemon');
	// ?speed is the second stage. The legacy capture (fixtures/legacy/fire-speed-at-least-90), as a multiset.
	await expect(editor.candidates).toHaveCount(7);
	const labels = (await editor.candidates.allInnerTexts()).map((text) => text.split(/\s/)[0]);
	expect(labels.sort()).toEqual([
		'Arcanine',
		'Charizard',
		'Magmar',
		'Moltres',
		'Ninetales',
		'Ponyta',
		'Rapidash'
	]);
});

test('a participant seeded through the API answers a proposed task', async ({ page, browser }) => {
	// Usernames have at most 32 characters.
	const participant = `compose-p-${Date.now()}`;
	const keys = await seedStudy(browser, participant);
	await loginAs(page.request, participant);
	await page.goto('/study');
	await expect(page.getByTestId('study-task')).toHaveCount(3);

	const taskPage = new TaskPage(page);
	await taskPage.open(keys[1]);
	await expect(taskPage.editor.nodeCount).toHaveText('Nodes: 3');
	await taskPage.submit();
	await expect(taskPage.feedback).toHaveText(/^Correct: all \d+ expected results\.$/);
	await expect(taskPage.attempts).toHaveCount(1);
});

/**
 * FE-048 parity: Auto Layout (P-08), Upload Triples (P-09), Upload/Export
 * Query (P-10) and the guided tour with the first-node hint (P-12).
 * The API is mocked; no external request is allowed.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { guardOffline } from './support/offline';
import { mockApi, type MockApi } from './support/mock-api';
import { addGraph, expectCanvasMatchesStore, graphOf, openEditor } from './support/editor';

let unexpected: string[];
let api: MockApi;

test.beforeEach(async ({ page, baseURL }) => {
	unexpected = await guardOffline(page, baseURL!);
	api = await mockApi(page);
});

test.afterEach(async ({ page }) => {
	await expectCanvasMatchesStore(page);
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});

const positions = (page: Page) =>
	page.evaluate(() => {
		const { store } = (
			window as never as {
				__easyquery: {
					store: {
						graph: { elements: { id: string; position?: { x: number; y: number } }[] };
					};
				};
			}
		).__easyquery;
		return Object.fromEntries(
			store.graph.elements
				.filter((element) => element.position)
				.map((element) => [element.id, element.position])
		);
	});
const endpointUrl = (page: Page) =>
	page.evaluate(
		() =>
			(
				window as never as {
					__easyquery: { store: { context: { endpointUrl: string } } };
				}
			).__easyquery.store.context.endpointUrl
	);
const toast = (page: Page, text: string | RegExp) =>
	page.locator('[data-sonner-toast]').filter({ hasText: text });

test('P-08 Auto Layout decides whether adding a node runs the cose layout', async ({ page }) => {
	await openEditor(page);
	await page.evaluate(() => {
		const handle = window as never as {
			__layouts: string[];
			__easyquery: { view: { cy: import('cytoscape').Core } };
		};
		const cy = handle.__easyquery.view.cy;
		handle.__layouts = [];
		const original = cy.layout.bind(cy);
		cy.layout = (options) => {
			handle.__layouts.push(options.name);
			return original(options);
		};
	});
	const layouts = () =>
		page.evaluate(() => (window as never as { __layouts: string[] }).__layouts);
	// openEditor starts with Auto Layout off.
	await expect(page.getByLabel('Auto Layout')).not.toBeChecked();
	await page.locator('#add-variable-btn').click();
	await expect(page.locator('#status-nodes')).toHaveText('Nodes: 1');
	expect(await layouts()).toEqual([]);
	await page.getByLabel('Auto Layout').click();
	await page.locator('#add-variable-btn').click();
	await page.locator('#add-variable-btn').click();
	await expect(page.locator('#status-nodes')).toHaveText('Nodes: 3');
	expect(await layouts()).toEqual(['cose', 'cose']);
	const placed = Object.values(await positions(page)) as { x: number; y: number }[];
	expect(new Set(placed.map((point) => `${point.x},${point.y}`)).size).toBe(3);
});

test('P-09 Upload Triples posts the Turtle file and switches to the uploaded graph', async ({
	page
}) => {
	await openEditor(page);
	await page.locator('#upload-triple').setInputFiles({
		name: 'data.ttl',
		mimeType: 'text/turtle',
		buffer: Buffer.from('<urn:a> <urn:p> <urn:b> .\n')
	});
	await expect(toast(page, 'Triples uploaded — endpoint updated.')).toBeVisible();
	const upload = api.requests.find((request) => request.path === '/api/local-database');
	expect(upload?.method).toBe('POST');
	expect(String(upload?.body)).toContain('name="ttlFile"');
	expect(String(upload?.body)).toContain('<urn:a> <urn:p> <urn:b> .');
	expect(await endpointUrl(page)).toBe('00000000-0000-0000-0000-000000000001');
	await expect(page.locator('#input-endpoint-sparql')).toHaveValue(
		'00000000-0000-0000-0000-000000000001'
	);
});

test('P-10 Export Query downloads the versioned file and Upload Query restores it', async ({
	page
}) => {
	await openEditor(page);
	await addGraph(page, [
		{ id: '?team', kind: 'variable', x: 10, y: 20 },
		{ id: '<https://example.test/team-a>', kind: 'entity', label: 'Team A', x: 200, y: 20 },
		{ edge: 'e1', source: '?team', target: '<https://example.test/team-a>', predicate: '<p>' }
	]);
	const saved = await graphOf(page);
	const downloading = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export Query' }).click();
	const download = await downloading;
	expect(download.suggestedFilename()).toBe('easyquery-query.json');
	const text = await readFile(await download.path(), 'utf8');
	expect(JSON.parse(text).formatVersion).toBe(1);
	await expect(toast(page, 'Query exported.')).toBeVisible();

	await page.evaluate(() =>
		(window as never as { __easyquery: { store: { clear(): void } } }).__easyquery.store.clear()
	);
	expect((await graphOf(page)).nodes).toEqual([]);
	await page.locator('#upload-json').setInputFiles({
		name: 'easyquery-query.json',
		mimeType: 'application/json',
		buffer: Buffer.from(text)
	});
	await expect(toast(page, 'Query loaded successfully.')).toBeVisible();
	expect(await graphOf(page)).toEqual(saved);
});

test('P-10 a file exported by the old page is refused with an explanation', async ({ page }) => {
	await openEditor(page);
	const legacy = fileURLToPath(
		new URL('../../fixtures/legacy/funnel-step-off.export.json', import.meta.url)
	);
	await page.locator('#upload-json').setInputFiles(legacy);
	await expect(toast(page, /This file has no formatVersion/)).toBeVisible();
	expect((await graphOf(page)).nodes).toEqual([]);
});

test('P-12 the guided tour shows nine steps on the first visit only', async ({ page }) => {
	await openEditor(page, { tour: true });
	const tour = page.getByRole('dialog', { name: /Step 1 of 9/ });
	await expect(tour).toBeVisible();
	await expect(page.getByTestId('tour-text')).toContainText(/search/i);
	for (let step = 2; step <= 9; step++) {
		await page.getByRole('button', { name: 'Next' }).click();
		await expect(page.locator('#guided-tour-title')).toHaveText(`Step ${step} of 9`);
	}
	await page.getByRole('button', { name: 'Back' }).click();
	await expect(page.locator('#guided-tour-title')).toHaveText('Step 8 of 9');
	await page.getByRole('button', { name: 'Next' }).click();
	await page.getByRole('button', { name: 'Done' }).click();
	await expect(page.locator('#guided-tour')).toHaveCount(0);

	await page.reload();
	await expect(page.locator('#cy')).toBeVisible();
	await expect(page.locator('#guided-tour')).toHaveCount(0);
});

test('P-12 Escape skips the tour', async ({ page }) => {
	await openEditor(page, { tour: true });
	await expect(page.locator('#guided-tour')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.locator('#guided-tour')).toHaveCount(0);
});

test('P-12 the first added node shows the action-list hint once', async ({ page }) => {
	await openEditor(page);
	const search = page.getByRole('combobox', { name: 'Search nodes' });
	await search.fill('Team');
	await page.getByRole('option', { name: /Team A/ }).click();
	await expect(toast(page, 'Click a node to open its action list.')).toBeVisible();
	expect(await page.evaluate(() => localStorage.getItem('newNode'))).toBe('true');
});

/**
 * QUAL-007 screenshot and accessibility layers on the editor. Screenshots
 * cover the canvas shapes and token colours with labels hidden: text
 * rasterisation differs between machines, colours and shapes do not.
 * Refresh baselines deliberately: `npx playwright test visual --update-snapshots`.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { guardOffline } from './support/offline';
import { mockApi } from './support/mock-api';
import { addGraph, openEditor } from './support/editor';

let unexpected: string[];

test.beforeEach(async ({ page, baseURL }) => {
	unexpected = await guardOffline(page, baseURL!);
	await mockApi(page);
	await page.setViewportSize({ width: 1280, height: 800 });
	await openEditor(page);
	await addGraph(page, [
		{ id: '?team', kind: 'variable', x: 100, y: 100 },
		{ id: '<https://example.test/team-a>', kind: 'entity', label: 'Team A', x: 320, y: 100 },
		{ id: '<https://example.test/Team>', kind: 'class', label: 'Team', x: 540, y: 100 },
		{ id: '?points', kind: 'valueVariable', x: 100, y: 300 },
		{ id: 'v1', kind: 'value', value: '42', x: 320, y: 300 },
		{ edge: 'e1', source: '?team', target: '<https://example.test/team-a>', predicate: '<p>' },
		{
			edge: 'e2',
			source: '<https://example.test/team-a>',
			target: '<https://example.test/Team>',
			predicate: '<type>'
		},
		{ edge: 'e3', source: '?team', target: '?points', predicate: '<points>' },
		{ edge: 'e4', source: '?points', target: 'v1', predicate: '?rel' }
	]);
});

test.afterEach(() => {
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});

// Overlays over the canvas (legend, zoom, menus) carry text; only the canvas is compared.
const CANVAS_ONLY =
	'#legend, #zoom-controls, #node-action-menu, #edge-action-menu { visibility: hidden !important; }';

async function hideLabels(page: Page) {
	await page.addStyleTag({ content: CANVAS_ONLY });
	await page.evaluate(async () => {
		const { view } = (
			window as never as { __easyquery: { view: { cy: import('cytoscape').Core } } }
		).__easyquery;
		view.cy.style().selector('node, edge').style({ label: '' }).update();
		view.cy.fit(undefined, 40);
		await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	});
}

test('the canvas draws every node kind and relation with the design tokens', async ({ page }) => {
	await hideLabels(page);
	await expect(page.locator('#cy')).toHaveScreenshot('canvas-node-kinds.png', {
		maxDiffPixelRatio: 0.01
	});
});

test('a selected node keeps its selection ring', async ({ page }) => {
	await page.evaluate(() =>
		(
			window as never as {
				__easyquery: { store: { select(selection: { kind: 'node'; id: string }): void } };
			}
		).__easyquery.store.select({ kind: 'node', id: '?team' })
	);
	await hideLabels(page);
	await expect(page.locator('#cy')).toHaveScreenshot('canvas-selected.png', {
		maxDiffPixelRatio: 0.01
	});
});

for (const theme of ['light', 'dark'] as const) {
	test(`axe reports no violations on the editor in the ${theme} theme`, async ({ page }) => {
		if (theme === 'dark') {
			await page.evaluate(() => document.documentElement.classList.add('dark'));
		}
		await page.locator('#filter-funnel-btn').click();
		await expect(page.locator('#filter-funnel-panel')).toBeVisible();
		// An open tooltip is portalled to <body>, outside the landmarks; its trigger carries the label.
		const results = await new AxeBuilder({ page })
			.exclude('[data-bits-floating-content-wrapper]')
			.analyze();
		expect(
			results.violations.map((violation) => ({
				id: violation.id,
				nodes: violation.nodes.map((node) => node.target.join(' '))
			}))
		).toEqual([]);
	});
}

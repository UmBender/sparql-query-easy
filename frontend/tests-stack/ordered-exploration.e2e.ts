/**
 * QUAL-002 on the new app (FE-046 acceptance): the four offline end-to-end
 * scenarios of frontend-tests/e2e/ordered-exploration.spec.mjs against the
 * real Ktor backend, with a local Turtle graph uploaded first.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { guardOffline } from '../tests/support/offline';

const FIXTURE = new URL('./fixtures/ordered-exploration.ttl', import.meta.url);

let unexpected: string[];
let stageRequests: { variableName: string; bindings: { variableName: string }[]; limit: number }[];
let legacyQueryRequests: number;

type Handle = {
	store: { autoLayout: boolean; commit(graph: unknown): void; graph: unknown; order: string[] };
};

test.beforeEach(async ({ page, baseURL }) => {
	unexpected = await guardOffline(page, baseURL!);
	// The real /health answers through the proxy; drop the offline stub for it.
	await page.unroute('**/*');
	await page.route('**/*', (route) => {
		const url = new URL(route.request().url());
		if (url.origin !== new URL(baseURL!).origin) {
			unexpected.push(url.href);
			return route.abort('blockedbyclient');
		}
		return route.fallback();
	});
	stageRequests = [];
	legacyQueryRequests = 0;
	page.on('request', (request) => {
		const { pathname } = new URL(request.url());
		if (pathname === '/api/query/stage') stageRequests.push(JSON.parse(request.postData()!));
		if (pathname === '/api/query') legacyQueryRequests += 1;
	});
	// Returning visitor: the first-visit guided tour (FE-048) would cover the toolbar.
	await page.addInitScript(() => window.localStorage.setItem('easyquery-tour-seen', 'true'));
	await page.goto('/');
	await expect(page.locator('#status-api')).toHaveText('API: online');
	const upload = await page.request.post('/api/local-database', {
		multipart: {
			ttlFile: {
				name: 'ordered-exploration.ttl',
				mimeType: 'text/turtle',
				buffer: readFileSync(FIXTURE)
			}
		}
	});
	const graphId = (await upload.json()).data as string;
	await page.getByRole('combobox', { name: 'SPARQL endpoint' }).fill(graphId);
	await page.evaluate(
		() => ((window as never as { __easyquery: Handle }).__easyquery.store.autoLayout = false)
	);
});

test.afterEach(() => {
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});

const candidates = (page: Page) => page.locator('#stage-candidates .stage-candidate');
const blockNames = (page: Page) => page.locator('#variable-order-list [data-slot="chip-label"]');

/** Adds typed nodes and edges in one store commit. */
async function addGraph(
	page: Page,
	nodes: Record<string, unknown>[],
	edges: Record<string, unknown>[]
) {
	await page.evaluate(
		({ nodes, edges }) => {
			const { store } = (window as never as { __easyquery: Handle }).__easyquery;
			const graph = structuredClone(store.graph) as {
				elements: unknown[];
				incident: Record<string, string[]>;
			};
			for (const node of nodes) {
				graph.elements.push(node);
				graph.incident[node.id as string] = [];
			}
			for (const edge of edges) {
				graph.elements.push({ kind: 'relation', ...edge });
				graph.incident[edge.source as string].push(edge.id as string);
				if (edge.target !== edge.source)
					graph.incident[edge.target as string].push(edge.id as string);
			}
			store.commit(graph);
		},
		{ nodes, edges }
	);
}

const variable = (id: string, x: number, y: number) => ({
	kind: 'variable',
	id,
	name: id,
	label: '?',
	position: { x, y }
});

function expectOnlyNextStageRequests(order: string[]) {
	for (const request of stageRequests) {
		expect(request.variableName).toBe(order[request.bindings.length]);
		expect(request.bindings.map(({ variableName }) => variableName)).toEqual(
			order.slice(0, request.bindings.length)
		);
		expect(request.limit).toBeLessThanOrEqual(50);
	}
}

const graphOf = (page: Page) =>
	page.evaluate(() => {
		const elements = (
			(window as never as { __easyquery: Handle }).__easyquery.store.graph as {
				elements: Record<string, unknown>[];
			}
		).elements;
		return {
			nodes: elements
				.filter((element) => element.kind !== 'relation')
				.map((element) => [element.id, element.label, element.kind])
				.sort(),
			edges: elements
				.filter((element) => element.kind === 'relation')
				.map((element) => [element.id, element.source, element.target, element.predicate])
		};
	});

test('a reordered three-variable exploration binds a predicate, a typed literal and an IRI through Ktor', async ({
	page
}) => {
	await addGraph(
		page,
		[variable('?team', 150, 250), variable('?value', 450, 250)],
		[{ id: 'attribute', source: '?team', target: '?value', predicate: '?attr', label: '?' }]
	);
	await expect(blockNames(page)).toHaveText(['?attr', '?team', '?value']);
	await page.getByRole('button', { name: 'Move ?value earlier' }).click();
	const order = ['?attr', '?value', '?team'];
	await expect(blockNames(page)).toHaveText(order);

	await page.locator('#run-query-btn').click();
	await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 3: ?attr');
	await expect(candidates(page)).toHaveText([
		/http:\/\/www\.w3\.org\/2000\/01\/rdf-schema#label\s*IRI/,
		/https:\/\/example\.test\/city\s*IRI/,
		/https:\/\/example\.test\/founded\s*IRI/
	]);
	await candidates(page).nth(1).hover();
	await expect(page.locator('#stage-preview-list li')).toHaveText([
		'Porto Alegre (IRI)',
		'Rio de Janeiro (IRI)'
	]);

	await candidates(page).nth(2).click();
	await expect(page.locator('#stage-heading')).toHaveText('Stage 2 of 3: ?value');
	await expect(candidates(page)).toHaveText([
		/1895\s*literal integer/,
		/1903\s*literal integer/,
		/1909\s*literal integer/
	]);
	await candidates(page).nth(1).click();
	await expect(page.locator('#stage-heading')).toHaveText('Stage 3 of 3: ?team');
	await expect(candidates(page)).toHaveText([/Grêmio\s*IRI/]);
	await candidates(page).first().click();
	await expect(page.locator('#stage-commitments li')).toHaveText([
		'?attr = https://example.test/founded',
		'?value = 1903',
		'?team = Grêmio'
	]);

	await page.getByRole('button', { name: 'Apply to graph' }).click();
	expect(await graphOf(page)).toEqual({
		nodes: [
			['1903', '1903', 'value'],
			['<https://example.test/gremio>', 'Grêmio', 'entity']
		],
		edges: [
			['attribute', '<https://example.test/gremio>', '1903', '<https://example.test/founded>']
		]
	});
	expectOnlyNextStageRequests(order);
	expect(legacyQueryRequests).toBe(0);
});

test('the typed literal binding returned by Ktor constrains the next stage exactly', async ({
	page
}) => {
	await addGraph(
		page,
		[variable('?team', 150, 250), variable('?year', 450, 250), variable('?city', 300, 450)],
		[
			{
				id: 'founded',
				source: '?team',
				target: '?year',
				predicate: '<https://example.test/founded>',
				label: 'founded'
			},
			{
				id: 'city',
				source: '?team',
				target: '?city',
				predicate: '<https://example.test/city>',
				label: 'city'
			}
		]
	);
	await page.getByRole('button', { name: 'Move ?team later' }).click();
	const order = ['?city', '?year', '?team'];
	await expect(blockNames(page)).toHaveText(order);
	await page.locator('#run-query-btn').click();
	await expect(candidates(page)).toHaveText([/Porto Alegre/, /Rio de Janeiro/]);
	await candidates(page).first().focus();
	await expect(page.locator('#stage-preview-list li')).toHaveText([
		'1903 (literal integer)',
		'1909 (literal integer)'
	]);
	await page.keyboard.press('Enter');
	await expect(candidates(page)).toHaveText([/1903/, /1909/]);
	await candidates(page).nth(1).click();
	await expect(candidates(page)).toHaveText([/Internacional\s*IRI/]);
	expectOnlyNextStageRequests(order);
});

test('one-variable Run Query is staged through Ktor', async ({ page }) => {
	await addGraph(
		page,
		[
			variable('?team', 150, 250),
			{
				kind: 'entity',
				id: '<https://example.test/poa>',
				value: '<https://example.test/poa>',
				label: 'Porto Alegre',
				position: { x: 450, y: 250 }
			}
		],
		[
			{
				id: 'city',
				source: '?team',
				target: '<https://example.test/poa>',
				predicate: '<https://example.test/city>',
				label: 'city'
			}
		]
	);
	await page.locator('#run-query-btn').click();
	await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 1: ?team');
	await expect(candidates(page)).toHaveText([/Grêmio\s*IRI/, /Internacional\s*IRI/]);
	expectOnlyNextStageRequests(['?team']);
	expect(legacyQueryRequests).toBe(0);
});

// BUG-005: a literal last variable stays staged after Assume.
test('Assume on a predicate leaves the literal last variable staged with its values', async ({
	page
}) => {
	await addGraph(
		page,
		[
			{
				kind: 'entity',
				id: '<https://example.test/gremio>',
				value: '<https://example.test/gremio>',
				label: 'Grêmio',
				position: { x: 150, y: 250 }
			},
			variable('?value', 450, 250)
		],
		[
			{
				id: 'attribute',
				source: '<https://example.test/gremio>',
				target: '?value',
				predicate: '?attr',
				label: '?',
				variableMark: true
			}
		]
	);
	await expect(blockNames(page)).toHaveText(['?attr', '?value']);
	await page.locator('#run-query-btn').click();
	await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 2: ?attr');
	await page
		.getByRole('button', {
			name: 'Assume ?attr = https://example.test/founded in the graph now'
		})
		.click();
	await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 1: ?value');
	await expect(candidates(page)).toHaveText([/1903\s*literal integer/]);
	await page.getByRole('button', { name: 'Close query variable exploration' }).click();
	await page.locator('#run-query-btn').click();
	await expect(candidates(page)).toHaveText([/1903\s*literal integer/]);
	expect(legacyQueryRequests).toBe(0);
});

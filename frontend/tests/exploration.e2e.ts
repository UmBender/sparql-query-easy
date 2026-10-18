/**
 * FE-046 parity: Run Query exploration (E-01–E-07) ported from
 * frontend-tests/index2.spec.mjs: component choice, stage-order chips,
 * emphasis, stage pages, preview, Back, Assume, Apply, the possible graph.
 */
import { expect, test, type Page } from '@playwright/test';
import { guardOffline } from './support/offline';
import { mockApi, type MockApi } from './support/mock-api';
import {
	addGraph,
	clickBackground,
	expectCanvasMatchesStore,
	graphOf,
	openEditor
} from './support/editor';

let unexpected: string[];
let api: MockApi;

test.beforeEach(async ({ page, baseURL }) => {
	unexpected = await guardOffline(page, baseURL!);
	api = await mockApi(page);
	await openEditor(page);
});

test.afterEach(async ({ page }) => {
	await expectCanvasMatchesStore(page);
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});

type Handle = {
	store: {
		order: string[];
		setOrder(order: string[]): void;
		graph: { elements: Record<string, unknown>[] };
		commit(graph: unknown): void;
	};
	view: { cy: import('cytoscape').Core };
	possibleCy: import('cytoscape').Core;
};
const handle = (page: Page) =>
	page.evaluateHandle(() => (window as never as { __easyquery: Handle }).__easyquery);
const order = (page: Page) =>
	page.evaluate(() => (window as never as { __easyquery: Handle }).__easyquery.store.order);
const panel = (page: Page) => page.locator('#two-variable-panel');
const run = (page: Page) => page.locator('#run-query-btn').click();
const candidates = (page: Page) => page.locator('#stage-candidates .stage-candidate');
const assumeButtons = (page: Page) => page.locator('#stage-candidates .stage-assume');
const blockNames = (page: Page) => page.locator('#variable-order-list [data-slot="chip-label"]');
const queryRequests = () => api.bodies('/api/query');
const stageRequests = () => api.bodies('/api/query/stage') as StageBody[];
const XSD_INTEGER = 'http://www.w3.org/2001/XMLSchema#integer';
const RDF_LANG_STRING = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';

type StageBody = {
	variableName: string;
	offset: number;
	limit: number;
	bindings: { variableName: string; term: { value: string } }[];
	where: unknown[];
};
const iri = (value: string, label: string | null = null) => ({
	term: { type: 'iri', value, datatype: null, language: null },
	label,
	selectable: true
});
const stagePage = (request: StageBody, list: unknown[], hasMore = false) => ({
	data: {
		variableName: request.variableName,
		offset: request.offset,
		limit: request.limit,
		hasMore,
		candidates: list
	}
});
const graphSnapshot = async (page: Page) => JSON.stringify(await graphOf(page));

/** Routes stage requests through `respond`, which may return {status, json} or a promise. */
function routeStages(respond: (request: StageBody, index: number) => unknown) {
	let index = 0;
	api.override('/api/query/stage', (body) => respond(body as unknown as StageBody, index++));
}

async function teamCity(page: Page) {
	await addGraph(page, [
		{ kind: 'variable', id: '?team', x: 200, y: 200 },
		{ kind: 'variable', id: '?city', x: 500, y: 200 },
		{
			edge: 'located',
			source: '?team',
			target: '?city',
			predicate: '<https://example.test/city>',
			label: 'city'
		}
	]);
	await expect(page.locator('#variable-order')).toBeVisible();
}

async function threeChain(page: Page) {
	await addGraph(page, [
		{ kind: 'variable', id: '?a', x: 200, y: 200 },
		{ kind: 'variable', id: '?c', x: 500, y: 200 },
		{ edge: 'rel', source: '?a', target: '?c', predicate: '?b', label: '?' }
	]);
	await expect(page.locator('#variable-order')).toBeVisible();
}

function cityTeam(hold?: (request: StageBody) => Promise<void> | undefined) {
	return async (request: StageBody) => {
		if (hold) await hold(request);
		if (request.variableName === '?city')
			return stagePage(request, [
				iri('https://example.test/poa', 'Porto Alegre'),
				iri('https://example.test/rio', 'Rio')
			]);
		const city =
			request.bindings.find((binding) => binding.variableName === '?city')?.term.value ??
			'none';
		const team = city.endsWith('/poa') ? 'Grêmio' : 'Flamengo';
		return stagePage(request, [iri(`https://example.test/${team}`, team)]);
	};
}

function threeStages({ failStageThreeOnce = false } = {}) {
	let failed = false;
	return (request: StageBody) => {
		const bound = Object.fromEntries(
			request.bindings.map(({ variableName, term }) => [variableName, term.value])
		);
		if (request.variableName === '?a')
			return stagePage(request, [
				iri('https://example.test/a1', 'Alpha'),
				iri('https://example.test/a2', 'Beta')
			]);
		if (request.variableName === '?b')
			return stagePage(
				request,
				bound['?a'] === 'https://example.test/a1'
					? [iri('https://example.test/p1', 'founded')]
					: []
			);
		if (failStageThreeOnce && !failed) {
			failed = true;
			return { status: 502, json: { error: 'Stage three failed' } };
		}
		return stagePage(request, [
			{
				term: { type: 'literal', value: '1903', datatype: XSD_INTEGER, language: null },
				label: null,
				selectable: true
			}
		]);
	};
}

function expectOnlyNextStageRequests(expected: string[]) {
	for (const request of stageRequests()) {
		expect(request.variableName).toBe(expected[request.bindings.length]);
		expect(request.bindings.map(({ variableName }) => variableName)).toEqual(
			expected.slice(0, request.bindings.length)
		);
	}
}

const possibleGraph = (page: Page) =>
	page.evaluate(() =>
		(window as never as { __easyquery: Handle }).__easyquery.possibleCy
			.elements()
			.map(
				(element) =>
					`${element.id()}|${element.classes().join(' ')}|${element.data('label')}`
			)
			.sort()
	);
const caption = (page: Page) => page.locator('#possible-graph-caption');

test('E-01 two variables open the staged panel; Escape, Close and the background close it', async ({
	page
}) => {
	await addGraph(page, [
		{ kind: 'variable', id: '?zeta', x: 220, y: 200 },
		{ kind: 'variable', id: '?alpha', x: 440, y: 200 },
		{
			edge: 'fixed',
			source: '?zeta',
			target: '?alpha',
			predicate: '<https://example.test/relation>',
			label: 'relation'
		}
	]);
	await run(page);
	await expect(page.getByRole('region', { name: 'Explore query variables' })).toBeVisible();
	await expect(page.locator('#two-variable-list')).toHaveText('?alpha?zeta');
	await expect(panel(page)).toContainText('Staged exploration');
	await expect(
		page.getByRole('button', { name: 'Close query variable exploration' })
	).toBeFocused();
	expect(queryRequests()).toEqual([]);
	await page.keyboard.press('Escape');
	await expect(panel(page)).toBeHidden();
	await expect(page.locator('#run-query-btn')).toBeFocused();
	await run(page);
	await page.getByRole('button', { name: 'Close query variable exploration' }).click();
	await expect(panel(page)).toBeHidden();
	await run(page);
	await expect(panel(page)).toBeVisible();
	await clickBackground(page);
	await expect(panel(page)).toBeHidden();
});

test('E-01 the variable group runs even when a fixed group came first; separate variable groups are rejected', async ({
	page
}) => {
	await addGraph(page, [
		{
			kind: 'entity',
			id: 'pikachu',
			value: '<https://example.test/pikachu>',
			label: 'Pikachu',
			x: 150,
			y: 150
		},
		{
			kind: 'entity',
			id: 'electric',
			value: '<https://example.test/electric>',
			label: 'Electric',
			x: 400,
			y: 150
		},
		{
			edge: 'resists',
			source: 'pikachu',
			target: 'electric',
			predicate: '<https://example.test/resistantTo>',
			label: 'resistant to'
		},
		{
			kind: 'entity',
			id: 'fire',
			value: '<https://example.test/fire>',
			label: 'Fire',
			x: 150,
			y: 380
		},
		{ kind: 'variable', id: '?node_1', x: 400, y: 380 },
		{
			edge: 'fire-relation',
			source: 'fire',
			target: '?node_1',
			predicate: '?predicate_1',
			label: '?'
		}
	]);
	await expect(blockNames(page)).toHaveText(['?node_1', '?predicate_1']);
	await run(page);
	await expect(page.locator('#two-variable-list')).toHaveText('?node_1?predicate_1');
	expect(queryRequests()).toEqual([]);
	await page.getByRole('button', { name: 'Close query variable exploration' }).click();

	await addGraph(page, [
		{ kind: 'variable', id: '?second', x: 700, y: 150 },
		{
			kind: 'entity',
			id: 'water',
			value: '<https://example.test/water>',
			label: 'Water',
			x: 900,
			y: 150
		},
		{
			edge: 'second-edge',
			source: 'water',
			target: '?second',
			predicate: '<https://example.test/q>',
			label: 'q'
		}
	]);
	await expect(page.locator('#variable-order')).toBeHidden();
	await run(page);
	await expect(page.getByText(/separate, unconnected parts/)).toBeVisible();
	await expect(panel(page)).toBeHidden();
});

test('E-01 a single later-group variable is staged; invalid variable-looking values are ignored', async ({
	page
}) => {
	await addGraph(page, [
		{
			kind: 'entity',
			id: 'fixed-node',
			value: '?alpha-bad',
			label: '?alpha-bad',
			x: 200,
			y: 200
		},
		{ kind: 'variable', id: '?real', x: 500, y: 200 },
		{
			edge: 'fixed-predicate',
			source: 'fixed-node',
			target: '?real',
			predicate: '<https://example.test/relation>',
			label: 'relation'
		}
	]);
	await run(page);
	await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 1: ?real');
	expect(stageRequests().at(-1)!.variableName).toBe('?real');
});

test('E-01 parallel predicate variables between fixed endpoints are rejected; successive ones run', async ({
	page
}) => {
	await addGraph(page, [
		{ kind: 'entity', id: 'source', value: '<https://example.test/source>', x: 200, y: 200 },
		{ kind: 'entity', id: 'target', value: '<https://example.test/target>', x: 500, y: 200 },
		{
			edge: 'relation-0',
			source: 'source',
			target: 'target',
			predicate: '?predicate_0',
			label: '?'
		},
		{
			edge: 'relation-1',
			source: 'source',
			target: 'target',
			predicate: '?predicate_1',
			label: '?'
		}
	]);
	const before = await graphSnapshot(page);
	await run(page);
	await expect(page.getByText(/Parallel predicate variables/)).toBeVisible();
	await expect(panel(page)).toBeHidden();
	expect(await graphSnapshot(page)).toBe(before);
	await page.getByRole('button', { name: 'New Query' }).click();
	await addGraph(page, [
		{ kind: 'entity', id: 'source', value: '<https://example.test/source>', x: 150, y: 200 },
		{ kind: 'entity', id: 'middle', value: '<https://example.test/middle>', x: 400, y: 200 },
		{ kind: 'entity', id: 'target', value: '<https://example.test/target>', x: 650, y: 200 },
		{
			edge: 'first',
			source: 'source',
			target: 'middle',
			predicate: '?predicate_1',
			label: '?'
		},
		{
			edge: 'second',
			source: 'middle',
			target: 'target',
			predicate: '?predicate_2',
			label: '?'
		}
	]);
	await run(page);
	await expect(page.locator('#two-variable-list')).toHaveText('?predicate_1?predicate_2');
});

test('E-02 chips appear for two or more variables, reorder by keyboard and pointer, and the order is session state', async ({
	page
}) => {
	await addGraph(page, [{ kind: 'variable', id: '?solo', x: 200, y: 200 }]);
	await expect(page.locator('#variable-order')).toBeHidden();
	await addGraph(page, [
		{ kind: 'variable', id: '?other', x: 500, y: 200 },
		{
			edge: 'solo-other',
			source: '?solo',
			target: '?other',
			predicate: '<https://example.test/p>',
			label: 'p'
		}
	]);
	await expect(page.getByRole('group', { name: 'Stage order' })).toBeVisible();
	await expect(page.locator('#variable-order-list [data-slot="chip-number"]')).toHaveText([
		'1',
		'2'
	]);
	await expect(blockNames(page)).toHaveText(['?other', '?solo']);
	await page.getByRole('button', { name: 'New Query' }).click();

	await threeChain(page);
	await expect(page.getByRole('button', { name: 'Move ?a earlier' })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Move ?c later' })).toBeDisabled();
	await page.getByRole('button', { name: 'Move ?c earlier' }).focus();
	await page.keyboard.press('Enter');
	await expect(blockNames(page)).toHaveText(['?a', '?c', '?b']);
	await expect(page.getByRole('button', { name: 'Move ?c earlier' })).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(blockNames(page)).toHaveText(['?c', '?a', '?b']);
	await expect(page.getByRole('button', { name: 'Move ?c later' })).toBeFocused();
	await expect(page.locator('#variable-order-status')).toHaveText('?c moved to stage 1 of 3.');
	await expect(page.getByRole('listitem', { name: 'Stage 1: ?c' })).toBeVisible();
	await run(page);
	await expect(page.locator('#two-variable-list')).toHaveText('?c?a?b');
	expect(stageRequests().map((request) => request.variableName)).toEqual(['?c']);
	await page.keyboard.press('Escape');

	const source = page.getByRole('listitem', { name: 'Stage 3: ?b' });
	const target = page.getByRole('listitem', { name: 'Stage 1: ?c' });
	const from = (await source.locator('[data-slot="chip-label"]').boundingBox())!;
	const to = (await target.locator('[data-slot="chip-label"]').boundingBox())!;
	await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
	await page.mouse.down();
	await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 5 });
	await page.mouse.up();
	await expect(blockNames(page)).toHaveText(['?b', '?c', '?a']);
	expect(await order(page)).toEqual(['?b', '?c', '?a']);

	await page.locator('#input-endpoint-sparql').fill('https://example.test/sparql');
	await expect.poll(() => order(page)).toEqual(['?a', '?b', '?c']);
});

test('E-02 a variable repeated as node and predicate is one chip; chips stay reachable at 360 px', async ({
	page
}) => {
	await page.setViewportSize({ width: 360, height: 740 });
	await addGraph(page, [
		{ kind: 'variable', id: '?x', x: 100, y: 200 },
		{ kind: 'variable', id: '?y', x: 260, y: 200 },
		{ edge: 'x-y', source: '?x', target: '?y', predicate: '?x', label: '?' }
	]);
	await expect(blockNames(page)).toHaveText(['?x', '?y']);
	const button = page.getByRole('button', { name: 'Move ?x later' });
	await button.focus();
	const box = (await button.boundingBox())!;
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(360);
	await page.keyboard.press('Enter');
	await expect(blockNames(page)).toHaveText(['?y', '?x']);
	await expect(page.locator('#variable-order-status')).toHaveText('?x moved to stage 2 of 2.');
});

test('E-03 hovering graph elements and chips emphasizes the variable on both sides', async ({
	page
}) => {
	await threeChain(page);
	await addGraph(page, [
		{
			kind: 'entity',
			id: 'fixed',
			value: '<https://example.test/f>',
			label: 'F',
			x: 500,
			y: 420
		},
		{
			edge: 'c-fixed',
			source: '?c',
			target: 'fixed',
			predicate: '<https://example.test/p>',
			label: 'p'
		}
	]);
	const emphasized = () =>
		page.evaluate(() =>
			(window as never as { __easyquery: Handle }).__easyquery.view.cy
				.elements('.emphasis')
				.map((element) => element.id())
				.sort()
		);
	const emphasizedChips = page.locator(
		'#variable-order-list [data-emphasized] [data-slot="chip-label"]'
	);
	const hover = async (id: string) => {
		const position = await page.evaluate((elementId) => {
			const element = (
				window as never as { __easyquery: Handle }
			).__easyquery.view.cy.getElementById(elementId);
			return element.isEdge()
				? (element as import('cytoscape').EdgeSingular).renderedMidpoint()
				: (element as import('cytoscape').NodeSingular).renderedPosition();
		}, id);
		await page.locator('#cy').hover({ position });
	};
	await hover('?a');
	await expect(emphasizedChips).toHaveText(['?a']);
	await expect.poll(emphasized).toEqual(['?a']);
	await hover('rel');
	await expect(emphasizedChips).toHaveText(['?b']);
	await expect.poll(emphasized).toEqual(['rel']);
	await page.locator('#cy').hover({ position: { x: 300, y: 30 } });
	await expect(emphasizedChips).toHaveCount(0);
	await hover('fixed');
	await expect(emphasizedChips).toHaveCount(0);
	await page.locator('#variable-order-list [data-variable="?c"]').hover();
	await expect.poll(emphasized).toEqual(['?c']);
	await expect(
		page.locator('#variable-order-list [data-variable="?c"] [data-slot="chip"]')
	).toHaveCSS('outline-color', 'rgb(0, 184, 212)');
	await page.getByRole('button', { name: 'Move ?a later' }).focus();
	await expect.poll(emphasized).toEqual(['?a']);
	await page.locator('#run-query-btn').focus();
	await page.locator('#cy').hover({ position: { x: 300, y: 30 } });
	await expect.poll(emphasized).toEqual([]);
});

test('E-04 the first stage requests typed candidates for the reordered first variable', async ({
	page
}) => {
	await teamCity(page);
	routeStages((request) =>
		stagePage(request, [
			iri('https://example.test/gremio', 'Grêmio'),
			{
				term: { type: 'literal', value: '1903', datatype: XSD_INTEGER, language: null },
				label: null,
				selectable: true
			},
			{
				term: {
					type: 'literal',
					value: 'Grêmio',
					datatype: RDF_LANG_STRING,
					language: 'pt'
				},
				label: null,
				selectable: true
			},
			{
				term: { type: 'bnode', value: 'b0', datatype: null, language: null },
				label: null,
				selectable: false
			}
		])
	);
	await page.getByRole('button', { name: 'Move ?team earlier' }).click();
	const before = await graphSnapshot(page);
	await run(page);
	await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 2: ?team');
	await expect(candidates(page)).toHaveText([
		/Grêmio\s*IRI/,
		/1903\s*literal integer/,
		/Grêmio\s*literal @pt/,
		/b0\s*blank node \(not selectable\)/
	]);
	await expect(candidates(page).nth(3)).toBeDisabled();
	await expect(assumeButtons(page)).toHaveCount(3);
	await expect(page.locator('#stage-status')).toHaveText('4 values for ?team.');
	expect(stageRequests()).toEqual([
		{
			endpointUrl: 'CampeonatoBrasileiro2023',
			variableName: '?team',
			where: [
				{
					subject: '?team',
					predicate: '<https://example.test/city>',
					object: '?city',
					filterType: null
				}
			],
			bindings: [],
			limit: 50,
			offset: 0
		}
	]);
	expect(await graphSnapshot(page)).toBe(before);
});

test('E-04 loading, empty, cache, error, retry, load more and a stale response', async ({
	page
}) => {
	await teamCity(page);
	let release: () => void = () => {};
	const gate = new Promise<void>((resolve) => (release = resolve));
	routeStages(async (request) => {
		await gate;
		return stagePage(request, []);
	});
	await page.locator('#input-max-results').fill('7');
	await run(page);
	await expect(page.locator('#stage-status')).toHaveText('Loading values for ?city…');
	release();
	await expect(page.locator('#stage-status')).toHaveText(
		'No values for ?city under the chosen bindings.'
	);
	expect(stageRequests().map((request) => request.limit)).toEqual([7]);
	await page.keyboard.press('Escape');
	await run(page);
	await expect(page.locator('#stage-status')).toHaveText(
		'No values for ?city under the chosen bindings.'
	);
	expect(stageRequests()).toHaveLength(1);
	await page.keyboard.press('Escape');

	await page.locator('#input-max-results').fill('2');
	routeStages((request, index) =>
		index === 0
			? { status: 502, json: { error: 'Upstream SPARQL endpoint failed' } }
			: request.offset === 0
				? stagePage(
						request,
						[
							iri('https://example.test/c1', 'City 1'),
							iri('https://example.test/c2', 'City 2')
						],
						true
					)
				: stagePage(request, [iri('https://example.test/c3', 'City 3')])
	);
	await run(page);
	await expect(page.locator('#stage-status')).toHaveText('Upstream SPARQL endpoint failed');
	await page.getByRole('button', { name: 'Retry' }).click();
	await expect(candidates(page)).toHaveCount(2);
	await expect(page.getByRole('button', { name: 'Retry' })).toBeHidden();
	await page.getByRole('button', { name: 'Load more' }).click();
	await expect(candidates(page)).toHaveText([/City 1/, /City 2/, /City 3/]);
	await expect(page.getByRole('button', { name: 'Load more' })).toBeHidden();
	expect(
		stageRequests()
			.slice(1)
			.map(({ offset, limit }) => [offset, limit])
	).toEqual([
		[0, 2],
		[0, 2],
		[2, 2]
	]);
	await page.keyboard.press('Escape');

	await page.locator('#input-max-results').fill('3');
	const releases: (() => void)[] = [];
	routeStages(
		(request) =>
			new Promise((resolve) =>
				releases.push(() =>
					resolve(
						stagePage(request, [
							iri(
								`https://example.test/${request.variableName.slice(1)}`,
								`${request.variableName} value`
							)
						])
					)
				)
			)
	);
	const before = stageRequests().length;
	await run(page);
	await expect.poll(() => stageRequests().length).toBe(before + 1);
	await page.getByRole('button', { name: 'Move ?team earlier' }).click();
	await expect.poll(() => stageRequests().length).toBe(before + 2);
	releases[0]();
	releases[1]();
	await expect(candidates(page)).toHaveText([/\?team value/]);
	await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 2: ?team');
});

test('E-04 editing the graph closes the exploration panel', async ({ page }) => {
	await teamCity(page);
	routeStages((request) => stagePage(request, [iri('https://example.test/c1', 'City 1')]));
	await run(page);
	await expect(candidates(page)).toHaveCount(1);
	await page.getByRole('button', { name: 'Add Variable' }).click();
	await expect(panel(page)).toBeHidden();
	await page.getByRole('button', { name: 'Undo' }).click();
	const before = await graphSnapshot(page);
	await run(page);
	await candidates(page).first().click();
	await page.locator('#input-endpoint-sparql').fill('https://example.test/sparql');
	await expect(panel(page)).toBeHidden();
	expect(await graphSnapshot(page)).toBe(before);
});

test('E-05 hovering or focusing a candidate previews the next variable; superseded and failed previews', async ({
	page
}) => {
	await teamCity(page);
	routeStages(cityTeam());
	await run(page);
	await expect(candidates(page)).toHaveCount(2);
	const before = await graphSnapshot(page);
	await candidates(page).first().hover();
	await expect(page.locator('#stage-preview-heading')).toHaveText(
		'If ?city = Porto Alegre, ?team could be:'
	);
	await expect(page.locator('#stage-preview-list')).toHaveText('Grêmio (IRI)');
	expect(stageRequests().filter((request) => request.variableName === '?team')).toEqual([
		{
			endpointUrl: 'CampeonatoBrasileiro2023',
			variableName: '?team',
			where: [
				{
					subject: '?team',
					predicate: '<https://example.test/city>',
					object: '?city',
					filterType: null
				}
			],
			bindings: [
				{
					variableName: '?city',
					term: {
						type: 'iri',
						value: 'https://example.test/poa',
						datatype: null,
						language: null
					}
				}
			],
			limit: 50,
			offset: 0
		}
	]);
	expect(await graphSnapshot(page)).toBe(before);
	await candidates(page).nth(1).focus();
	await expect(page.locator('#stage-preview-heading')).toHaveText(
		'If ?city = Rio, ?team could be:'
	);
	await expect(page.locator('#stage-preview-list')).toHaveText('Flamengo (IRI)');
	const count = stageRequests().length;
	await page.keyboard.press('Enter');
	await expect(page.locator('#stage-heading')).toHaveText('Stage 2 of 2: ?team');
	await expect(page.locator('#stage-heading')).toBeFocused();
	await expect(page.locator('#stage-commitments')).toHaveText('?city = Rio');
	await expect(candidates(page)).toHaveText([/Flamengo/]);
	await expect(page.locator('#stage-preview')).toBeHidden();
	expect(stageRequests().length).toBe(count);
});

test('E-05 rapid pointer movement sends only the settled preview request', async ({ page }) => {
	await teamCity(page);
	routeStages(cityTeam());
	await run(page);
	await expect(candidates(page)).toHaveCount(2);
	await page.evaluate(() => {
		const [first, second] = document.querySelectorAll('#stage-candidates .stage-candidate');
		for (let i = 0; i < 3; i += 1) {
			for (const button of [first, second]) {
				button.dispatchEvent(new MouseEvent('mouseenter'));
				button.dispatchEvent(new MouseEvent('mouseleave'));
			}
		}
		second.dispatchEvent(new MouseEvent('mouseenter'));
	});
	await expect(page.locator('#stage-preview-list')).toHaveText('Flamengo (IRI)');
	await page.waitForTimeout(500);
	expect(
		stageRequests()
			.filter((request) => request.variableName === '?team')
			.map(({ bindings }) => bindings[0].term.value)
	).toEqual(['https://example.test/rio']);
});

test('E-05 a superseded preview is never displayed and a failed one shows its error', async ({
	page
}) => {
	await teamCity(page);
	const releases = new Map<string, () => void>();
	routeStages(
		cityTeam((request) =>
			request.variableName === '?team'
				? new Promise<void>((resolve) =>
						releases.set(request.bindings[0].term.value, resolve)
					)
				: undefined
		)
	);
	await run(page);
	await expect(candidates(page)).toHaveCount(2);
	await candidates(page).first().hover();
	await expect.poll(() => releases.size).toBe(1);
	await candidates(page).nth(1).hover();
	await expect.poll(() => releases.size).toBe(2);
	releases.get('https://example.test/rio')!();
	await expect(page.locator('#stage-preview-list')).toHaveText('Flamengo (IRI)');
	releases.get('https://example.test/poa')!();
	await page.waitForTimeout(200);
	await expect(page.locator('#stage-preview-heading')).toHaveText(
		'If ?city = Rio, ?team could be:'
	);
	await page.keyboard.press('Escape');

	const ok = cityTeam();
	routeStages((request) =>
		request.variableName === '?team'
			? { status: 502, json: { error: 'Preview endpoint failed' } }
			: ok(request)
	);
	await page.locator('#input-max-results').fill('9');
	await run(page);
	await candidates(page).first().hover();
	await expect(page.locator('#stage-preview-status')).toHaveText('Preview endpoint failed');
	await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 2: ?city');
});

test('E-06 Back clears commitments and a reorder restarts without stale state', async ({
	page
}) => {
	await teamCity(page);
	routeStages(cityTeam());
	await run(page);
	await candidates(page).first().click();
	await expect(page.locator('#stage-commitments')).toHaveText('?city = Porto Alegre');
	await page.getByRole('button', { name: 'Back to previous stage' }).click();
	await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 2: ?city');
	await expect(page.locator('#stage-commitments li')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Back to previous stage' })).toBeHidden();
	await candidates(page).nth(1).click();
	await expect(page.locator('#stage-commitments')).toHaveText('?city = Rio');
	await page.getByRole('button', { name: 'Move ?team earlier' }).click();
	await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 2: ?team');
	await expect(page.locator('#stage-commitments li')).toHaveCount(0);
	expect(stageRequests().at(-1)).toMatchObject({ variableName: '?team', bindings: [] });
});

test('E-06 three stages end in a summary and only Apply to graph changes the graph', async ({
	page
}) => {
	await threeChain(page);
	routeStages(threeStages());
	const before = await graphSnapshot(page);
	await run(page);
	await expect(candidates(page)).toHaveCount(2);
	for (const heading of ['Stage 2 of 3: ?b', 'Stage 3 of 3: ?c', 'All variables chosen']) {
		await candidates(page).first().click();
		await expect(page.locator('#stage-heading')).toHaveText(heading);
	}
	await expect(page.locator('#stage-commitments li')).toHaveText([
		'?a = Alpha',
		'?b = founded',
		'?c = 1903'
	]);
	await expect(candidates(page)).toHaveCount(0);
	expect(await graphSnapshot(page)).toBe(before);
	expectOnlyNextStageRequests(['?a', '?b', '?c']);
	await page.getByRole('button', { name: 'Back to previous stage' }).click();
	await expect(page.locator('#stage-heading')).toHaveText('Stage 3 of 3: ?c');
	await expect(page.getByRole('button', { name: 'Apply to graph' })).toBeHidden();
	await candidates(page).first().click();
	await page.getByRole('button', { name: 'Apply to graph' }).click();
	await expect(panel(page)).toBeHidden();
	expect(await graphOf(page)).toEqual({
		nodes: ['1903|value|1903', '<https://example.test/a1>|entity|Alpha'],
		edges: ['rel|<https://example.test/a1>|<https://example.test/p1>|1903']
	});
	await expect(page.locator('#variable-order')).toBeHidden();
});

test('E-06 Assume on the first stage applies the value now and reopens the remaining variables in order', async ({
	page
}) => {
	await threeChain(page);
	routeStages(threeStages());
	await page.getByRole('button', { name: 'Move ?c earlier' }).click();
	await expect(blockNames(page)).toHaveText(['?a', '?c', '?b']);
	await run(page);
	await expect(candidates(page)).toHaveCount(2);
	await page.getByRole('button', { name: 'Assume ?a = Alpha in the graph now' }).click();
	expect((await graphOf(page)).edges).toEqual(['rel|<https://example.test/a1>|?b|?c']);
	await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 2: ?c');
	await expect(page.locator('#stage-commitments li')).toHaveCount(0);
	await expect(blockNames(page)).toHaveText(['?c', '?b']);
	const last = stageRequests().at(-1)!;
	expect(last).toMatchObject({
		variableName: '?c',
		bindings: [],
		where: [
			{
				subject: '<https://example.test/a1>',
				predicate: '?b',
				object: '?c',
				filterType: null
			}
		]
	});
});

test('E-06 Assume on a later stage stages the last variable (BUG-005); empty and failed stages recover', async ({
	page
}) => {
	await threeChain(page);
	routeStages(threeStages({ failStageThreeOnce: true }));
	await run(page);
	await candidates(page).nth(1).click();
	await expect(page.locator('#stage-status')).toHaveText(
		'No values for ?b under the chosen bindings.'
	);
	await page.getByRole('button', { name: 'Back to previous stage' }).click();
	await candidates(page).first().click();
	await candidates(page).first().click();
	await expect(page.locator('#stage-status')).toHaveText('Stage three failed');
	await expect(page.locator('#stage-commitments li')).toHaveText(['?a = Alpha', '?b = founded']);
	await page.getByRole('button', { name: 'Retry' }).click();
	await expect(candidates(page)).toHaveText([/1903\s*literal integer/]);
	await page.getByRole('button', { name: 'Back to previous stage' }).click();
	await expect(page.locator('#stage-heading')).toHaveText('Stage 2 of 3: ?b');
	await assumeButtons(page).first().click();
	expect((await graphOf(page)).edges).toEqual([
		'rel|<https://example.test/a1>|<https://example.test/p1>|?c'
	]);
	await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 1: ?c');
	await expect(candidates(page)).toHaveText([/1903\s*literal integer/]);
	expect(queryRequests()).toEqual([]);
	await candidates(page).first().click();
	await page.getByRole('button', { name: 'Apply to graph' }).click();
	expect((await graphOf(page)).edges).toEqual([
		'rel|<https://example.test/a1>|<https://example.test/p1>|1903'
	]);
});

test('E-06 parallel edges sharing one predicate variable are one stage and bind together', async ({
	page
}) => {
	await addGraph(page, [
		{ kind: 'entity', id: 'source', value: '<https://example.test/source>', x: 200, y: 200 },
		{ kind: 'entity', id: 'target', value: '<https://example.test/target>', x: 500, y: 200 },
		{
			edge: 'first',
			source: 'source',
			target: 'target',
			predicate: '?predicate_1',
			label: '?'
		},
		{
			edge: 'second',
			source: 'source',
			target: 'target',
			predicate: '?predicate_1',
			label: '?'
		}
	]);
	routeStages((request) =>
		stagePage(request, [iri('https://example.test/relation', 'relation')])
	);
	await run(page);
	await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 1: ?predicate_1');
	await candidates(page).first().click();
	await page.getByRole('button', { name: 'Apply to graph' }).click();
	expect((await graphOf(page)).edges).toEqual([
		'first|source|<https://example.test/relation>|target',
		'second|source|<https://example.test/relation>|target'
	]);
	await expect(page.locator('#status-nodes')).toHaveText('Nodes: 2');
});

test('E-07 the possible graph shows the assumed option, a next value, committed values and hides with the panel', async ({
	page
}) => {
	await threeChain(page);
	routeStages(threeStages());
	const before = await graphSnapshot(page);
	await run(page);
	await expect(candidates(page)).toHaveCount(2);
	const window = page.getByRole('region', { name: 'Possible graph' });
	await expect(window).toBeVisible();
	await expect(caption(page)).toHaveText('Hover or focus an option to preview it.');
	expect(await possibleGraph(page)).toEqual([
		'edge:rel|open|?b',
		'node:?a|open|?a',
		'node:?c|open|?c'
	]);
	await candidates(page).first().hover();
	await expect(caption(page)).toHaveText('If ?a = Alpha, ?b could be founded (1 of 1).');
	expect(await possibleGraph(page)).toEqual([
		'edge:rel|possible|founded',
		'node:?a|assumed iri|Alpha',
		'node:?c|open|?c'
	]);
	const [windowBox, panelBox] = await Promise.all([
		window.boundingBox(),
		panel(page).boundingBox()
	]);
	expect(windowBox!.x + windowBox!.width).toBeLessThanOrEqual(panelBox!.x);
	await candidates(page).nth(1).hover();
	await expect(caption(page)).toHaveText('If ?a = Beta, ?b has no values.');
	await candidates(page).first().click();
	expect(await possibleGraph(page)).toEqual([
		'edge:rel|open|?b',
		'node:?a|committed iri|Alpha',
		'node:?c|open|?c'
	]);
	await candidates(page).first().focus();
	await expect(caption(page)).toHaveText('If ?b = founded, ?c could be 1903 (1 of 1).');
	expect(await possibleGraph(page)).toEqual([
		'edge:rel|assumed|founded',
		'node:?a|committed iri|Alpha',
		'node:?c|possible literal|1903'
	]);
	await page.keyboard.press('Enter');
	await candidates(page).first().click();
	await expect(caption(page)).toHaveText('All variables chosen.');
	await page.getByRole('button', { name: 'Close query variable exploration' }).click();
	await expect(window).toBeHidden();
	expect(await graphSnapshot(page)).toBe(before);
});

test('E-07 long labels wrap under their element; three possible values cycle every three seconds', async ({
	page
}) => {
	const longName = 'International Business Machines Corporation of New York';
	await threeChain(page);
	routeStages((request) =>
		request.variableName === '?a'
			? stagePage(request, [
					iri('https://example.test/a1', longName),
					iri('https://example.test/a2', 'Beta')
				])
			: stagePage(
					request,
					['founded', 'named', 'located', 'owned'].map((name) =>
						iri(`https://example.test/${name}`, name)
					)
				)
	);
	await run(page);
	const window = page.getByRole('region', { name: 'Possible graph' });
	expect((await window.boundingBox())!.width).toBeGreaterThan(380);
	expect((await page.locator('#possible-graph-canvas').boundingBox())!.height).toBeGreaterThan(
		240
	);
	await candidates(page).first().hover();
	await expect(caption(page)).toHaveText(`If ?a = ${longName}, ?b could be founded (1 of 3).`);
	expect(await possibleGraph(page)).toContain(`node:?a|assumed iri label-below|${longName}`);
	const started = Date.now();
	await expect(caption(page)).toHaveText(`If ?a = ${longName}, ?b could be named (2 of 3).`, {
		timeout: 4000
	});
	expect(Date.now() - started).toBeGreaterThan(2000);
	await expect(caption(page)).toHaveText(`If ?a = ${longName}, ?b could be located (3 of 3).`, {
		timeout: 4000
	});
	await page.locator('#two-variable-panel h2').hover();
	await expect(caption(page)).toHaveText('Hover or focus an option to preview it.');
});

test('E-07 on a narrow screen the possible graph is a sheet below the exploration panel', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 800 });
	await threeChain(page);
	routeStages(threeStages());
	await run(page);
	const window = page.getByRole('region', { name: 'Possible graph' });
	await expect(window).toBeVisible();
	const [windowBox, panelBox] = await Promise.all([
		window.boundingBox(),
		panel(page).boundingBox()
	]);
	expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(windowBox!.y);
	expect(await possibleGraph(page)).toEqual([
		'edge:rel|open|?b',
		'node:?a|open|?a',
		'node:?c|open|?c'
	]);
});

test('P-15 Enter runs the query from the page and toolbar fields, not from buttons', async ({
	page
}) => {
	await teamCity(page);
	await page.locator('#input-max-results').focus();
	await page.keyboard.press('Enter');
	await expect(panel(page)).toBeVisible();
	await page.keyboard.press('Escape');
	// Enter on a button activates that button only (Zoom in leaves the graph as it is).
	await page.getByRole('button', { name: 'Zoom in' }).focus();
	await page.keyboard.press('Enter');
	await expect(panel(page)).toBeHidden();
	await page.locator('#status-bar').click();
	await page.keyboard.press('Enter');
	await expect(panel(page)).toBeVisible();
	void handle;
});

test('F-06 staged Run Query sends the value-variable filter and Assume settles it without the filter', async ({
	page
}) => {
	await addGraph(page, [
		{ kind: 'variable', id: '?mon', x: 200, y: 200 },
		{
			kind: 'valueVariable',
			id: '?hp',
			x: 500,
			y: 200,
			filter: { code: 2, value: '90' },
			label: '? ≥ 90'
		},
		{ edge: 'hp', source: '?mon', target: '?hp', predicate: '<https://e/hp>', label: 'HP' }
	]);
	routeStages((request) =>
		request.variableName === '?hp'
			? stagePage(request, [
					{
						term: {
							type: 'literal',
							value: '160',
							datatype: XSD_INTEGER,
							language: null
						},
						label: null,
						selectable: true
					}
				])
			: stagePage(request, [iri('https://e/Chansey', 'Chansey')])
	);
	await run(page);
	await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 2: ?hp');
	expect(stageRequests()[0]).toMatchObject({
		variableName: '?hp',
		variableFilters: [{ variableName: '?hp', filterType: 2, value: '90' }]
	});
	await page.getByRole('button', { name: 'Assume ?hp = 160 in the graph now' }).click();
	const settled = await page.evaluate(() =>
		(window as never as { __easyquery: Handle }).__easyquery.store.graph.elements.find(
			(element) => element.id === '160'
		)
	);
	expect(settled).toMatchObject({
		kind: 'value',
		filter: null,
		label: '160',
		term: { value: '160', datatype: XSD_INTEGER }
	});
	await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 1: ?mon');
	expect(stageRequests().at(-1)).toMatchObject({
		variableName: '?mon',
		where: [{ subject: '?mon', predicate: '<https://e/hp>', object: '160', filterType: null }]
	});
	expect(
		(stageRequests().at(-1) as unknown as { variableFilters?: unknown }).variableFilters
	).toBeUndefined();
});

/**
 * FE-047 parity: filter funnel and badges (B-01–B-05) ported from
 * frontend-tests/index2.spec.mjs (FE-028, FE-036, FE-039, BE-004).
 */
import { expect, test, type Page } from '@playwright/test';
import { guardOffline } from './support/offline';
import { mockApi, type MockApi } from './support/mock-api';
import { addGraph, expectCanvasMatchesStore, openEditor } from './support/editor';

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

const PK = 'https://example.test/';
type CountBody = {
	endpointUrl: string;
	variableName: string;
	where: { subject: string; predicate: string; object: string; filterType: number | null }[];
	variableFilters?: { variableName: string }[];
};
const countRequests = () => api.bodies('/api/query/count') as CountBody[];
const result = (page: Page) => page.locator('#filter-funnel-result');
const rows = (page: Page) =>
	page
		.locator('#filter-funnel-steps > li')
		.evaluateAll((items) =>
			items.map((item) =>
				[...item.querySelectorAll('.funnel-row-head > *')]
					.map((part) => part.textContent!.replace(/\s+/g, ' ').trim())
					.join(' | ')
			)
		);
const badge = (page: Page) => page.locator('#filter-badge-layer .filter-badge');
const chip = (page: Page) => page.locator('#filter-badge-layer .filter-actual-value');
const toggle = (page: Page, label: string) =>
	page.locator('#filter-funnel-steps .funnel-toggle', { hasText: label }).locator('input');

async function funnelGraph(
	page: Page,
	speed: { value: string; filter: number | null; label: string } = {
		value: '90',
		filter: 2,
		label: '≥ 90'
	}
) {
	await addGraph(page, [
		{ kind: 'variable', id: '?p', x: 200, y: 200 },
		{ kind: 'entity', id: 'fire', value: `<${PK}Fire>`, label: 'Fire', x: 500, y: 120 },
		{
			kind: 'value',
			id: 'speed-value',
			value: speed.value,
			label: speed.label,
			filter: speed.filter,
			x: 500,
			y: 330
		},
		{ edge: 'type', source: '?p', target: 'fire', predicate: `<${PK}type>`, label: 'type' },
		{
			edge: 'speed',
			source: '?p',
			target: 'speed-value',
			predicate: `<${PK}speed>`,
			label: 'speed'
		}
	]);
}

/** Pokédex-like counts: 151 with any value, 12 Fire, 40 fast, 7 both. */
function funnelCounts({ fail = false } = {}) {
	api.override('/api/query/count', (raw) => {
		const body = raw as unknown as CountBody;
		if (fail) return { status: 502, json: { error: 'endpoint unavailable' } };
		const fire = body.where.some((item) => item.object === `<${PK}Fire>`);
		const fast = body.where.some((item) => item.filterType === 2);
		return {
			data: {
				variableName: body.variableName,
				count: fire && fast ? 7 : fire ? 12 : fast ? 40 : 151
			}
		};
	});
}

test('B-01 the funnel counts after each cumulative filter with one request per step', async ({
	page
}) => {
	await funnelGraph(page);
	funnelCounts();
	await page.locator('#filter-funnel-btn').click();
	await expect(page.locator('#filter-funnel-panel')).toBeVisible();
	await expect(page.locator('#filter-funnel-btn')).toHaveAttribute('aria-expanded', 'true');
	await expect(result(page)).toHaveText('Result: 7 ?p of 151.');
	expect(await rows(page)).toEqual([
		'With these relations, any value | 151',
		'type = Fire | 12 −139',
		'speed ≥ 90 | 7 −5'
	]);
	await expect(page.locator('#filter-funnel-variable')).toHaveText('Counting distinct ?p');
	const type = {
		subject: '?p',
		predicate: `<${PK}type>`,
		object: `<${PK}Fire>`,
		filterType: null
	};
	const speed = { subject: '?p', predicate: `<${PK}speed>`, object: '90', filterType: 2 };
	expect(new Set(countRequests().map((request) => JSON.stringify(request)))).toEqual(
		new Set(
			[
				{
					endpointUrl: 'PokemonGen1',
					variableName: '?p',
					where: [
						{ ...type, object: '?__funnel0' },
						{ ...speed, object: '?__funnel1', filterType: null }
					]
				},
				{
					endpointUrl: 'PokemonGen1',
					variableName: '?p',
					where: [type, { ...speed, object: '?__funnel1', filterType: null }]
				},
				{
					endpointUrl: 'PokemonGen1',
					variableName: '?p',
					where: [type, speed]
				}
			].map((request) => JSON.stringify(request))
		)
	);
});

test('B-01 a MAX step is counted after the other filters, wherever it sits', async ({ page }) => {
	await addGraph(page, [
		{ kind: 'variable', id: '?p', x: 200, y: 200 },
		{ kind: 'value', id: 'hp-value', value: '1', label: 'MAX', filter: 4, x: 500, y: 80 },
		{ kind: 'entity', id: 'fire', value: `<${PK}Fire>`, label: 'Fire', x: 500, y: 250 },
		{ edge: 'hp', source: '?p', target: 'hp-value', predicate: `<${PK}hp>`, label: 'hp' },
		{ edge: 'type', source: '?p', target: 'fire', predicate: `<${PK}type>`, label: 'type' }
	]);
	api.override('/api/query/count', (raw) => {
		const body = raw as unknown as CountBody;
		const fire = body.where.some((item) => item.object === `<${PK}Fire>`);
		const max = body.where.some((item) => item.filterType === 4);
		return {
			data: {
				variableName: body.variableName,
				count: fire && max ? 2 : max ? 3 : fire ? 12 : 151
			}
		};
	});
	await page.locator('#filter-funnel-btn').click();
	await expect(result(page)).toHaveText(
		'Result: 2 ?p of 151. MAX/MIN keep every tied result and come after the other filters, as in the query.'
	);
	expect(await rows(page)).toEqual([
		'With these relations, any value | 151',
		'type = Fire | 12 −139',
		'hp MAX | 2 −10'
	]);
});

test('B-01 unticking a step previews later counts only and Run Query still sends every filter', async ({
	page
}) => {
	await funnelGraph(page);
	funnelCounts();
	await page.locator('#filter-funnel-btn').click();
	await expect(result(page)).toHaveText('Result: 7 ?p of 151.');
	await toggle(page, 'type = Fire').click();
	await expect(result(page)).toHaveText(
		'Result: 40 ?p of 151. Preview without 1 filter; Run Query still applies every filter.'
	);
	expect(await rows(page)).toEqual([
		'With these relations, any value | 151',
		'type = Fire | 151 (off)',
		'speed ≥ 90 | 40 −111'
	]);
	expect(
		countRequests()
			.at(-1)!
			.where.map((item) => item.object)
	).toEqual(['?__funnel0', '90']);
	const counted = countRequests().length;
	await toggle(page, 'type = Fire').click();
	await expect(result(page)).toHaveText('Result: 7 ?p of 151.');
	expect(countRequests()).toHaveLength(counted);
	await toggle(page, 'type = Fire').click();
	await page.locator('#run-query-btn').click();
	await expect.poll(() => api.bodies('/api/query/stage').length).toBeGreaterThan(0);
	expect(
		(api.bodies('/api/query/stage').at(-1) as CountBody).where.map((item) => item.object)
	).toEqual([`<${PK}Fire>`, '90']);
});

test('B-02 count errors retry; an empty query is explained; edits refresh once; a superseded refresh is dropped', async ({
	page
}) => {
	funnelCounts();
	await page.locator('#filter-funnel-btn').click();
	await expect(page.locator('#filter-funnel-status')).toHaveText(
		'Add a relation with a variable to see how its filters narrow the result.'
	);
	expect(countRequests()).toEqual([]);
	await funnelGraph(page);
	await expect(result(page)).toHaveText('Result: 7 ?p of 151.');
	await page.locator('#filter-funnel-close').click();

	funnelCounts({ fail: true });
	await page.locator('#input-endpoint-sparql').fill('https://example.test/sparql');
	await page.locator('#filter-funnel-btn').click();
	await expect(page.locator('#filter-funnel-status')).toHaveText(
		'Could not count results: endpoint unavailable'
	);
	funnelCounts();
	await page.locator('#filter-funnel-retry').click();
	await expect(result(page)).toHaveText('Result: 7 ?p of 151.');
	await expect(page.locator('#filter-funnel-retry')).toBeHidden();
	await page.locator('#filter-funnel-close').click();

	let release: () => void = () => {};
	let first = true;
	api.override('/api/query/count', async (raw) => {
		const body = raw as unknown as CountBody;
		if (first) {
			first = false;
			await new Promise<void>((resolve) => (release = resolve));
			return { data: { variableName: body.variableName, count: 999 } };
		}
		return { data: { variableName: body.variableName, count: 5 } };
	});
	await page.locator('#input-endpoint-sparql').fill('https://example.test/other');
	await page.locator('#filter-funnel-btn').click();
	await expect.poll(() => first).toBe(false);
	await toggle(page, 'type = Fire').click();
	await expect(result(page)).toHaveText(
		'Result: 5 ?p of 5. Preview without 1 filter; Run Query still applies every filter.'
	);
	release();
	await page.waitForTimeout(150);
	await expect(page.locator('#filter-funnel-steps')).not.toContainText('999');
});

test('B-02 the funnel is keyboard reachable, Escape returns focus, and it caps counted steps at a narrow width', async ({
	page
}) => {
	await funnelGraph(page);
	funnelCounts();
	await page.locator('#filter-funnel-btn').focus();
	await page.keyboard.press('Enter');
	await expect(page.locator('#filter-funnel-close')).toBeFocused();
	await expect(result(page)).toHaveText('Result: 7 ?p of 151.');
	await page.keyboard.press('Tab');
	await expect(page.locator('[data-step-key="type"]')).toBeFocused();
	await page.keyboard.press('Space');
	await expect(result(page)).toContainText('Result: 40 ?p');
	await page.keyboard.press('Escape');
	await expect(page.locator('#filter-funnel-panel')).toBeHidden();
	await expect(page.locator('#filter-funnel-btn')).toBeFocused();
	await expect(page.locator('#filter-funnel-btn')).toHaveAttribute('aria-expanded', 'false');

	await page.getByRole('button', { name: 'New Query' }).click();
	await page.setViewportSize({ width: 360, height: 740 });
	const items: Parameters<typeof addGraph>[1] = [{ kind: 'variable', id: '?p', x: 60, y: 60 }];
	for (let index = 0; index < 10; index++) {
		items.push({
			kind: 'value',
			id: `v${index}`,
			value: String(index),
			label: `≥ ${index}`,
			filter: 2,
			x: 200,
			y: 40 * index + 40
		});
		items.push({
			edge: `stat${index}`,
			source: '?p',
			target: `v${index}`,
			predicate: `<${PK}stat${index}>`,
			label: `stat${index}`
		});
	}
	await addGraph(page, items);
	await page.locator('#filter-funnel-btn').click();
	await expect(result(page)).toContainText('Only the first 8 filters are counted.');
	await expect(page.locator('#filter-funnel-steps > li')).toHaveCount(11);
	await expect(page.locator('#filter-funnel-steps > li.funnel-uncounted')).toHaveCount(2);
	await expect(page.locator('[data-step-key="stat9"]')).toBeDisabled();
	const box = (await page.locator('#filter-funnel-panel').boundingBox())!;
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(360);
});

test('B-03 a filter node shows a kept/total badge that never changes query data; stale and failed counts', async ({
	page
}) => {
	const speeds = [43, 45, 65, 90, 100, 100];
	api.override('/api/query/count', (raw) => {
		const body = raw as unknown as CountBody;
		const filter = body.where.find(
			(item) => item.predicate === `<${PK}speed>` && item.filterType != null
		);
		if (!filter) return { data: { variableName: body.variableName, count: speeds.length } };
		const value = Number(filter.object);
		const [min, max] = filter.object.split('..').map(Number);
		const keep: Record<number, (speed: number) => boolean> = {
			0: (speed) => String(speed).startsWith(filter.object),
			2: (speed) => speed >= value,
			3: (speed) => speed <= value,
			4: (speed) => speed === Math.max(...speeds),
			5: (speed) => speed === Math.min(...speeds),
			6: (speed) => speed >= min && speed <= max
		};
		return {
			data: {
				variableName: body.variableName,
				count: speeds.filter(keep[filter.filterType!]).length
			}
		};
	});
	await addGraph(page, [
		{ kind: 'variable', id: '?p', x: 200, y: 200 },
		{ kind: 'value', id: 'speed-value', value: '45', label: '45', x: 500, y: 200 },
		{
			edge: 'speed',
			source: '?p',
			target: 'speed-value',
			predicate: `<${PK}speed>`,
			label: 'speed'
		}
	]);
	await page.waitForTimeout(500);
	await expect(badge(page)).toHaveCount(0);
	const setFilter = (value: string, code: number | null, label: string) =>
		page.evaluate(
			({ value, code, label }) => {
				const { store } = (
					window as never as {
						__easyquery: {
							store: {
								graph: { elements: Record<string, unknown>[] };
								commit(graph: unknown): void;
							};
						};
					}
				).__easyquery;
				const graph = structuredClone(store.graph) as {
					elements: Record<string, unknown>[];
				};
				const node = graph.elements.find((element) => element.kind === 'value')!;
				Object.assign(node, { term: { type: 'literal', value }, filter: code, label });
				store.commit(graph);
			},
			{ value, code, label }
		);
	await setFilter('60', 2, '≥ 60');
	await expect(badge(page)).toHaveText('4 / 6');
	await expect(badge(page)).toHaveAttribute('data-state', 'kept');
	await expect(badge(page)).toHaveAttribute(
		'aria-label',
		'This filter keeps 4 of the 6 ?p that reach it.'
	);
	await setFilter('200..300', 6, '200–300');
	await expect(badge(page)).toHaveText('0 / 6');
	await expect(badge(page)).toHaveAttribute('data-state', 'empty');
	await expect
		.poll(() =>
			page.evaluate(() =>
				(
					window as never as { __easyquery: { view: { cy: import('cytoscape').Core } } }
				).__easyquery.view.cy
					.getElementById('speed-value')
					.hasClass('rejected')
			)
		)
		.toBe(true);
	await setFilter('90', 4, 'MAX');
	await expect(badge(page)).toHaveText('2 / 6');
	await setFilter('4', 0, 'starts with 4');
	await expect(badge(page)).toHaveText('2 / 6');
	await setFilter('45', null, '45');
	await expect(badge(page)).toHaveCount(0);

	api.override('/api/query/count', () => ({
		status: 502,
		json: { error: 'endpoint unavailable' }
	}));
	await setFilter('61', 2, '≥ 61');
	await expect(badge(page)).toHaveText('?');
	await expect(badge(page)).toHaveAttribute(
		'aria-label',
		'Could not count results: endpoint unavailable'
	);
	const before = (await badge(page).boundingBox())!;
	await page.evaluate(() => {
		const { store } = (
			window as never as {
				__easyquery: {
					store: {
						moveNode(id: string, position: object): void;
						graph: { elements: Record<string, unknown>[] };
					};
				};
			}
		).__easyquery;
		const node = store.graph.elements.find((element) => element.kind === 'value')!;
		const position = node.position as { x: number; y: number };
		store.moveNode(node.id as string, { x: position.x - 60, y: position.y + 40 });
	});
	await expect
		.poll(async () => (await badge(page).boundingBox())!.y)
		.toBeGreaterThan(before.y + 30);
});

test('B-04 after Assume the filtered node shows its actual value and checks it; empty and failed lookups', async ({
	page
}) => {
	await addGraph(page, [
		{ kind: 'variable', id: '?p', x: 200, y: 200 },
		{ kind: 'value', id: 'speed-value', value: '90', label: '≥ 90', filter: 2, x: 500, y: 200 },
		{
			edge: 'speed',
			source: '?p',
			target: 'speed-value',
			predicate: `<${PK}speed>`,
			label: 'speed'
		}
	]);
	api.override('/api/query/stage', (raw) => ({
		data: {
			variableName: (raw as { variableName: string }).variableName,
			offset: 0,
			limit: 50,
			hasMore: false,
			candidates: ['Pikachu', 'Mew'].map((name) => ({
				term: { type: 'iri', value: `${PK}${name}`, datatype: null, language: null },
				label: name,
				selectable: true
			}))
		}
	}));
	let values = ['90'];
	api.override('/api/query/relationship-value', () => ({
		data: values.map((value) => ({
			propertyId: value,
			propertyLabel: value,
			propertyType: 'text'
		}))
	}));
	await page.locator('#run-query-btn').click();
	await page.getByRole('button', { name: 'Assume ?p = Pikachu in the graph now' }).click();
	await expect(chip(page)).toHaveText('90');
	await expect(chip(page)).toHaveAttribute('aria-label', 'Actual value: 90');
	await expect(badge(page)).toHaveText('✓');
	await expect(badge(page)).toHaveAttribute(
		'aria-label',
		'The actual value 90 passes the filter ≥ 90.'
	);
	expect(api.bodies('/api/query/relationship-value')).toEqual([
		{
			endpointUrl: 'PokemonGen1',
			subjectId: `<${PK}Pikachu>`,
			predicateId: `<${PK}speed>`,
			isLiteral: true
		}
	]);
	const setFilter = (value: string, code: number | null, label: string) =>
		page.evaluate(
			({ value, code, label }) => {
				const { store } = (
					window as never as {
						__easyquery: {
							store: {
								graph: { elements: Record<string, unknown>[] };
								commit(graph: unknown): void;
							};
						};
					}
				).__easyquery;
				const graph = structuredClone(store.graph) as {
					elements: Record<string, unknown>[];
				};
				Object.assign(
					graph.elements.find((element) => element.id === 'speed-value')!,
					{ term: { type: 'literal', value }, filter: code, label }
				);
				store.commit(graph);
			},
			{ value, code, label }
		);
	await setFilter('100', 2, '≥ 100');
	await expect(badge(page)).toHaveText('✗');
	await expect(badge(page)).toHaveAttribute('data-state', 'fail');
	expect(api.bodies('/api/query/relationship-value')).toHaveLength(1);
	await setFilter('90', 4, 'MAX');
	await expect(badge(page)).toHaveCount(0);
	await expect(chip(page)).toHaveText('90');
	await setFilter('90', null, '90');
	await expect(chip(page)).toHaveCount(0);

	values = ['90', '95', '99', '120'];
	await page.locator('#input-endpoint-sparql').fill('CampeonatoBrasileiro2023');
	await setFilter('9', 0, 'starts with 9');
	await expect(chip(page)).toHaveText('90, 95, 99, …');
	await expect(chip(page)).toHaveAttribute('title', 'Actual value: 90, 95, 99, 120');
	await expect(badge(page)).toHaveText('✓');

	values = [];
	await page.locator('#input-endpoint-sparql').fill('https://example.test/sparql');
	await setFilter('80', 2, '≥ 80');
	await expect(chip(page)).toHaveAttribute(
		'title',
		'This entity has no value for this relation.'
	);
	await expect(badge(page)).toHaveAttribute(
		'aria-label',
		'This entity has no value for this relation. The filter ≥ 80 cannot be checked.'
	);
	api.override('/api/query/relationship-value', () => ({
		status: 502,
		json: { error: 'endpoint unavailable' }
	}));
	await page.locator('#input-endpoint-sparql').fill('https://example.test/other');
	await expect(chip(page)).toHaveText('value unknown');
	await expect(chip(page)).toHaveAttribute(
		'title',
		'Could not load the actual value: endpoint unavailable.'
	);
	await expect(badge(page)).toHaveText('?');
});

test('B-05 value-variable filters are funnel steps counted on the entity variable and badges show each step', async ({
	page
}) => {
	await addGraph(page, [
		{ kind: 'variable', id: '?p', x: 200, y: 250 },
		{ kind: 'entity', id: 'fire', value: `<${PK}Fire>`, label: 'Fire', x: 500, y: 100 },
		{
			kind: 'valueVariable',
			id: '?speed',
			x: 500,
			y: 250,
			filter: { code: 2, value: '90' },
			label: '? ≥ 90'
		},
		{
			kind: 'valueVariable',
			id: '?hp',
			x: 500,
			y: 400,
			filter: { code: 2, value: '80' },
			label: '? ≥ 80'
		},
		{ edge: 'type', source: '?p', target: 'fire', predicate: `<${PK}type>`, label: 'type' },
		{
			edge: 'speed_relation',
			source: '?p',
			target: '?speed',
			predicate: `<${PK}speed>`,
			label: 'speed'
		},
		{ edge: 'hp_relation', source: '?p', target: '?hp', predicate: `<${PK}hp>`, label: 'hp' }
	]);
	api.override('/api/query/count', (raw) => {
		const body = raw as unknown as CountBody;
		const fire = body.where.some((item) => item.object === `<${PK}Fire>`);
		const filtered = new Set((body.variableFilters ?? []).map((filter) => filter.variableName));
		return {
			data: {
				variableName: body.variableName,
				count: !fire ? 151 : filtered.has('?hp') ? 2 : filtered.has('?speed') ? 7 : 12
			}
		};
	});
	await page.locator('#filter-funnel-btn').click();
	await expect(result(page)).toHaveText('Result: 2 ?p of 151.');
	await expect(page.locator('#filter-funnel-variable-select')).toHaveValue('?p');
	expect(await rows(page)).toEqual([
		'With these relations, any value | 151',
		'type = Fire | 12 −139',
		'speed ≥ 90 | 7 −5',
		'hp ≥ 80 | 2 −5'
	]);
	const badgeOf = (id: string) =>
		page.locator(`#filter-badge-layer .filter-badge[data-node-id="${id}"]`);
	await expect(badgeOf('?speed')).toHaveText('7 / 12');
	await expect(badgeOf('?hp')).toHaveText('2 / 7');
	const base = countRequests().find((request) => request.where[0].object === '?__funnel0')!;
	expect(base.where.map((item) => item.object)).toEqual(['?__funnel0', '?speed', '?hp']);
	expect(base.variableFilters).toBeUndefined();
	await toggle(page, 'speed ≥ 90').click();
	await expect(result(page)).toContainText('Preview without 1 filter');
	await expect(badgeOf('?speed')).toHaveText('7 / 12');
});

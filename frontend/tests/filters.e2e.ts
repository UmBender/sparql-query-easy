/**
 * FE-045 parity: the filter rows (F-01–F-07, G-13) of the parity checklist,
 * ported from frontend-tests/index2.spec.mjs (FE-026, FE-030, FE-034,
 * FE-035, FE-038, QUAL-005) to the new filter editor.
 */
import { expect, test, type Page } from '@playwright/test';
import { guardOffline } from './support/offline';
import { mockApi, type MockApi } from './support/mock-api';
import {
	addGraph,
	clickBackground,
	clickNode,
	expectCanvasMatchesStore,
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

const editor = (page: Page) => page.locator('#filter-editor');
const valueInput = (page: Page) => page.locator('#filter-value');
const histogram = (page: Page) => page.locator('#filter-histogram');
const lo = (page: Page) => page.getByRole('slider', { name: 'Lowest kept value' });
const hi = (page: Page) => page.getByRole('slider', { name: 'Highest kept value' });
const checked = (page: Page) =>
	editor(page)
		.locator('input[name=filterType]:checked')
		.evaluate((input) => input.parentElement!.textContent!.trim());
const choose = (page: Page, label: string) =>
	editor(page).getByLabel(label, { exact: true }).check();
const cyclePosition = (page: Page) => page.getByTestId('cycle-position');
const cycleEntities = (page: Page) => page.getByTestId('cycle-entities');

async function speedGraph(page: Page) {
	await addGraph(page, [
		{ kind: 'variable', id: '?p', x: 200, y: 200 },
		{ kind: 'value', id: 'speed-value', value: '45', label: '45', x: 500, y: 200 },
		{
			edge: 'speed',
			source: '?p',
			target: 'speed-value',
			predicate: '<https://example.test/speed>',
			label: 'speed'
		}
	]);
}

/** The value node, found by kind (an edit replaces its id). */
const filterNode = (page: Page) =>
	page.evaluate(() => {
		const { store } = (
			window as never as {
				__easyquery: { store: { graph: { elements: Record<string, unknown>[] } } };
			}
		).__easyquery;
		const node = store.graph.elements.find((element) => element.kind === 'value') as {
			label: string;
			term: { value: string };
			filter: number | null;
		};
		return { label: node.label, value: node.term.value, filterType: node.filter };
	});

async function openValueEditor(page: Page) {
	await clickBackground(page);
	const id = await page.evaluate(() => {
		const { store } = (
			window as never as {
				__easyquery: { store: { graph: { elements: Record<string, unknown>[] } } };
			}
		).__easyquery;
		return store.graph.elements.find((element) => element.kind === 'value')!.id as string;
	});
	await clickNode(page, id);
	await page
		.locator('#node-action-menu')
		.getByRole('button', { name: 'Edit value', exact: true })
		.click();
	await expect(editor(page)).toBeVisible();
}

const speedProfile = (numbers: number[], extra: Record<string, unknown> = {}) => ({
	data: {
		subject: '?p',
		predicate: '<https://example.test/speed>',
		count: numbers.length,
		truncated: false,
		min: numbers.length ? Math.min(...numbers) : null,
		max: numbers.length ? Math.max(...numbers) : null,
		values: numbers.map((number, index) => ({
			entity: { type: 'iri', value: `https://example.test/p${index}` },
			label: `P${index}`,
			value: String(number),
			number
		})),
		...extra
	}
});
const twelveSpeeds = [20, 45, 45, 50, 55, 60, 65, 70, 75, 80, 90, 150];

test('F-01 the numeric editor offers at least, at most, between, MAX and MIN with readable labels', async ({
	page
}) => {
	await speedGraph(page);
	await openValueEditor(page);
	await expect(editor(page).getByRole('radio')).toHaveCount(6);
	expect(
		await editor(page)
			.locator('label')
			.filter({ has: page.locator('input[type=radio]') })
			.allTextContents()
	).toEqual(
		[
			'Exactly Equal',
			'At least (≥)',
			'At most (≤)',
			'Between (min..max, e.g. 40..80)',
			'MAX',
			'MIN'
		].map((label) => expect.stringContaining(label))
	);
	await choose(page, 'Between (min..max, e.g. 40..80)');
	await valueInput(page).fill('40..80');
	await page.locator('#apply-filter-btn').click();
	await expect(editor(page)).toBeHidden();
	expect(await filterNode(page)).toEqual({ label: '40–80', value: '40..80', filterType: 6 });

	await openValueEditor(page);
	await expect(valueInput(page)).toHaveValue('40..80');
	expect(await checked(page)).toBe('Between (min..max, e.g. 40..80)');
	await valueInput(page).fill('80..40');
	await page.locator('#apply-filter-btn').click();
	await expect(editor(page)).toContainText('Between needs two numbers as min..max');
	await page.getByRole('button', { name: 'Cancel' }).click();
	expect(await filterNode(page)).toEqual({ label: '40–80', value: '40..80', filterType: 6 });
});

test('F-01 an exact numeric match sends no filterType; a text value offers exact, starts with, contains', async ({
	page
}) => {
	await speedGraph(page);
	await openValueEditor(page);
	await choose(page, 'Exactly Equal');
	await valueInput(page).fill('42');
	await valueInput(page).press('Enter');
	await expect(editor(page)).toBeHidden();
	expect(await filterNode(page)).toEqual({ label: '42', value: '42', filterType: null });
	await page.getByRole('button', { name: 'View SPARQL' }).click();
	await expect.poll(() => api.bodies('/api/query/sparql')).toHaveLength(1);
	expect((api.bodies('/api/query/sparql')[0] as { where: unknown[] }).where).toEqual([
		{ subject: '?p', predicate: '<https://example.test/speed>', object: '42', filterType: null }
	]);
	// Close the dialog only once it is open; an early Escape is lost and the overlay stays.
	await expect(page.locator('#sparql-content')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.locator('#sparql-content')).toBeHidden();

	await addGraph(page, [
		{ kind: 'variable', id: '?q', x: 200, y: 380 },
		{ kind: 'value', id: 'Rio', x: 500, y: 380 },
		{
			edge: 'city',
			source: '?q',
			target: 'Rio',
			predicate: '<https://example.test/city>',
			label: 'city'
		}
	]);
	await clickBackground(page);
	await clickNode(page, 'Rio');
	await page
		.locator('#node-action-menu')
		.getByRole('button', { name: 'Edit value', exact: true })
		.click();
	expect(
		await editor(page)
			.locator('label')
			.filter({ has: page.locator('input[type=radio]') })
			.allTextContents()
	).toEqual(
		['Exact match', 'Starts with', 'Contains'].map((label) => expect.stringContaining(label))
	);
	await expect(histogram(page)).toHaveCount(0);
});

test('F-03 the histogram follows the handles and writes at least, between and at most', async ({
	page
}) => {
	await speedGraph(page);
	api.override('/api/query/numeric-profile', () => speedProfile([20, 45, 45, 60, 90, 150]));
	await openValueEditor(page);
	await expect(histogram(page)).toContainText('Keeps 2 of 6 values');
	await expect(lo(page)).toHaveValue('20');
	await expect(hi(page)).toHaveValue('150');
	await expect(valueInput(page)).toHaveValue('45');
	expect(api.bodies('/api/query/numeric-profile')).toEqual([
		{
			endpointUrl: 'PokemonGen1',
			where: [],
			subject: '?p',
			predicate: '<https://example.test/speed>',
			limit: 500
		}
	]);

	await lo(page).fill('40');
	await expect(histogram(page)).toContainText('Keeps 5 of 6 values');
	await expect(valueInput(page)).toHaveValue('40');
	expect(await checked(page)).toBe('At least (≥)');
	await hi(page).fill('90');
	await expect(histogram(page)).toContainText('Keeps 4 of 6 values');
	await expect(valueInput(page)).toHaveValue('40..90');
	expect(await checked(page)).toBe('Between (min..max, e.g. 40..80)');
	await lo(page).fill('20');
	await expect(valueInput(page)).toHaveValue('90');
	expect(await checked(page)).toBe('At most (≤)');
	await lo(page).fill('120');
	await expect(lo(page)).toHaveValue('90');
	await expect(valueInput(page)).toHaveValue('90..90');
	await lo(page).fill('45');
	await page.locator('#apply-filter-btn').click();
	expect(await filterNode(page)).toEqual({ label: '45–90', value: '45..90', filterType: 6 });

	await openValueEditor(page);
	await expect(histogram(page)).toContainText('Keeps 4 of 6 values');
	await expect(lo(page)).toHaveValue('45');
	await expect(hi(page)).toHaveValue('90');
	await valueInput(page).fill('50..150');
	await expect(lo(page)).toHaveValue('50');
	await expect(hi(page)).toHaveValue('150');
	await expect(histogram(page)).toContainText('Keeps 3 of 6 values');
});

test('F-03 a truncated profile says what it covers; loading, empty, error and unprofilable states', async ({
	page
}) => {
	await speedGraph(page);
	api.override('/api/query/numeric-profile', () =>
		speedProfile([10, 20, 30, 40], { count: 10, truncated: true, max: 99 })
	);
	await openValueEditor(page);
	await expect(histogram(page)).toContainText(
		'The histogram covers the lowest 4 of 10 values (up to 40; the largest is 99).'
	);
	await expect(histogram(page)).toContainText('Keeps at least 0 of 10 values');
	await lo(page).fill('25');
	await expect(histogram(page)).toContainText('Keeps 8 of 10 values');
	await page.getByRole('button', { name: 'Cancel' }).click();

	api.override('/api/query/numeric-profile', () => speedProfile([]));
	await openValueEditor(page);
	await expect(histogram(page)).toContainText(
		'No numeric values for this relation under the rest of the query.'
	);
	await page.getByRole('button', { name: 'Cancel' }).click();

	api.override('/api/query/numeric-profile', () => ({
		status: 502,
		json: { error: 'Upstream failed' }
	}));
	await openValueEditor(page);
	await expect(histogram(page)).toContainText(
		'Could not load the value distribution: Upstream failed'
	);
	await page.getByRole('button', { name: 'Cancel' }).click();

	await addGraph(page, [
		{ kind: 'variable', id: '?other', x: 700, y: 380 },
		{
			edge: 'second',
			source: '?other',
			target: 'speed-value',
			predicate: '<https://example.test/speed>',
			label: 'speed'
		}
	]);
	await openValueEditor(page);
	await expect(histogram(page)).toContainText(
		'No value distribution: this value needs exactly one fixed relation pointing at it.'
	);
});

test('F-04 previous, next and play cycle the kept entities five at a time; MIN ties; nothing kept', async ({
	page
}) => {
	await speedGraph(page);
	api.override('/api/query/numeric-profile', () => speedProfile(twelveSpeeds));
	const before = await filterNode(page);
	await openValueEditor(page);
	const next = page.getByRole('button', { name: 'Next entities' });
	await expect(cyclePosition(page)).toHaveText('1–2 of 2 kept');
	await expect(cycleEntities(page)).toHaveText('P1 45P2 45');
	await expect(next).toBeDisabled();
	await choose(page, 'At least (≥)');
	await valueInput(page).fill('40');
	await expect(cyclePosition(page)).toHaveText('1–5 of 11 kept');
	await next.click();
	await expect(cyclePosition(page)).toHaveText('6–10 of 11 kept');
	await expect(cycleEntities(page)).toHaveText('P6 65P7 70P8 75P9 80P10 90');
	await next.click();
	await expect(cyclePosition(page)).toHaveText('11 of 11 kept');
	await page.getByRole('button', { name: 'Previous entities' }).click();
	await expect(cyclePosition(page)).toHaveText('6–10 of 11 kept');
	await expect(valueInput(page)).toHaveValue('40');
	await lo(page).fill('60');
	await expect(cyclePosition(page)).toHaveText('1–5 of 7 kept');

	await choose(page, 'MAX');
	await expect(cycleEntities(page)).toHaveText('P11 150');
	await expect(histogram(page)).toContainText(
		'1 entity has the highest value; the query returns all of them, up to the server limit.'
	);
	await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled();

	await choose(page, 'At least (≥)');
	await valueInput(page).fill('20');
	const play = page.getByRole('button', { name: 'Play', exact: true });
	await play.click();
	await expect(page.getByRole('button', { name: 'Pause', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(cyclePosition(page)).toHaveText('11–12 of 12 kept', { timeout: 6000 });
	await page.getByRole('button', { name: 'Pause', exact: true }).click();
	const paused = await cyclePosition(page).textContent();
	await page.waitForTimeout(2000);
	await expect(cyclePosition(page)).toHaveText(paused!);
	await page.getByRole('button', { name: 'Cancel' }).click();
	expect(await filterNode(page)).toEqual(before);
	expect(api.bodies('/api/query/numeric-profile')).toHaveLength(1);

	api.override('/api/query/numeric-profile', () =>
		speedProfile([10, 10, 10, 10, 10, 10, 10, 40, 90])
	);
	await openValueEditor(page);
	await choose(page, 'MIN');
	await expect(cyclePosition(page)).toHaveText('1–5 of 7 kept');
	await expect(histogram(page)).toContainText(
		'7 entities have the lowest value; the query returns all of them, up to the server limit.'
	);
	await valueInput(page).fill('50');
	await choose(page, 'Exactly Equal');
	await expect(histogram(page)).toContainText('No entity is kept.');
	await expect(cyclePosition(page)).toHaveText('');
});

test('F-02 Add value filter lists datatype relations and opens the editor on a seeded value variable', async ({
	page
}) => {
	await addGraph(page, [
		{ kind: 'variable', id: '?mon', x: 200, y: 250 },
		{ kind: 'entity', id: '<https://e/Fire>', label: 'Fire', x: 500, y: 250 },
		{
			edge: 'type',
			source: '?mon',
			target: '<https://e/Fire>',
			predicate: '<https://e/hasType>',
			label: 'has type'
		}
	]);
	api.override('/api/query/relationships', () => ({
		data: [
			{ propertyId: '<https://e/speed>', propertyLabel: 'Speed', propertyType: 'label' },
			{
				propertyId: '<https://e/hasType>',
				propertyLabel: 'has type',
				propertyType: 'objeto'
			},
			{ propertyId: '<https://e/hp>', propertyLabel: 'HP', propertyType: 'label' },
			{ propertyId: '<https://e/category>', propertyLabel: 'category', propertyType: 'label' }
		]
	}));
	api.override('/api/query/numeric-profile', (body) =>
		body?.limit === 1
			? {
					data: {
						subject: '?mon',
						predicate: '<https://e/hp>',
						count: 3,
						min: 39,
						max: 78,
						truncated: true,
						values: [
							{
								entity: { type: 'iri', value: 'https://e/Charmander' },
								label: 'Charmander',
								value: '39',
								number: 39
							}
						]
					}
				}
			: speedProfile([39, 58, 78])
	);
	await clickNode(page, '?mon');
	await page
		.locator('#node-action-menu')
		.getByRole('button', { name: 'Add value filter' })
		.click();
	await expect(page.locator('#node-action-menu')).toContainText('Choose a value relation:');
	expect(
		await page
			.locator('#node-action-menu button[data-action="choose-predicate"]')
			.allTextContents()
	).toEqual(['category', 'HP', 'Speed']);
	await page
		.locator('#node-action-menu')
		.getByRole('button', { name: 'HP', exact: true })
		.click();
	await expect(valueInput(page)).toHaveValue('39');
	expect(await checked(page)).toBe('Any value');
	expect(api.bodies('/api/query/numeric-profile')[0]).toEqual({
		endpointUrl: 'PokemonGen1',
		where: [
			{
				subject: '?mon',
				predicate: '<https://e/hasType>',
				object: '<https://e/Fire>',
				filterType: null
			}
		],
		subject: '?mon',
		predicate: '<https://e/hp>',
		limit: 1
	});
	await choose(page, 'At least (≥)');
	await valueInput(page).fill('60');
	await page.locator('#apply-filter-btn').click();
	const valueVariable = await page.evaluate(() => {
		const { store } = (
			window as never as {
				__easyquery: { store: { graph: { elements: Record<string, unknown>[] } } };
			}
		).__easyquery;
		return store.graph.elements.find((element) => element.kind === 'valueVariable');
	});
	expect(valueVariable).toMatchObject({ label: '? ≥ 60', filter: { code: 2, value: '60' } });
	expect(String(valueVariable!.id)).toMatch(/^\?value_\d+$/);
});

test('F-05 typing in a value variable filter suggests values; a choice is an exact match', async ({
	page
}) => {
	await addGraph(page, [
		{ kind: 'variable', id: '?mon', x: 200, y: 250 },
		{ kind: 'valueVariable', id: '?name', x: 500, y: 250 },
		{
			edge: 'name',
			source: '?mon',
			target: '?name',
			predicate: '<https://e/name>',
			label: 'name'
		}
	]);
	api.override('/api/query/stage', (body) => ({
		data: {
			variableName: body?.variableName,
			offset: 0,
			limit: 20,
			hasMore: false,
			candidates: ['Pikachu', 'Pidgey', 'Pidgey'].map((value) => ({
				term: { type: 'literal', value },
				label: null,
				selectable: true
			}))
		}
	}));
	await clickNode(page, '?name');
	await page.locator('#node-action-menu').getByRole('button', { name: 'Edit filter' }).click();
	await choose(page, 'Starts with');
	await valueInput(page).fill('Pi');
	await expect(page.locator('#filter-suggestions button')).toHaveText(['Pikachu', 'Pidgey']);
	const suggestion = api.bodies('/api/query/stage').at(-1) as Record<string, unknown>;
	expect(suggestion).toEqual({
		endpointUrl: 'PokemonGen1',
		variableName: '?name',
		where: [
			{ subject: '?mon', predicate: '<https://e/name>', object: '?name', filterType: null }
		],
		bindings: [],
		limit: 20,
		offset: 0,
		variableFilters: [{ variableName: '?name', filterType: 0, value: 'Pi' }]
	});
	await valueInput(page).press('ArrowDown');
	await expect(page.locator('#filter-suggestions button').first()).toBeFocused();
	await page.locator('#filter-suggestions button', { hasText: 'Pidgey' }).click();
	await expect(valueInput(page)).toHaveValue('Pidgey');
	expect(await checked(page)).toBe('Exact match');
	await page.locator('#apply-filter-btn').click();
	const node = await page.evaluate(() =>
		(
			window as never as {
				__easyquery: { store: { graph: { elements: Record<string, unknown>[] } } };
			}
		).__easyquery.store.graph.elements.find((element) => element.id === '?name')
	);
	expect(node).toMatchObject({ label: '? = Pidgey', filter: { code: null, value: 'Pidgey' } });
});

test('F-05 Edit value on a value node suggests values containing the text through a stand-in variable', async ({
	page
}) => {
	await addGraph(page, [
		{ kind: 'variable', id: '?mon', x: 200, y: 250 },
		{ kind: 'value', id: 'Seed Pokémon', x: 500, y: 250 },
		{
			edge: 'category',
			source: '?mon',
			target: 'Seed Pokémon',
			predicate: '<https://e/category>',
			label: 'category'
		}
	]);
	await clickNode(page, 'Seed Pokémon');
	await page
		.locator('#node-action-menu')
		.getByRole('button', { name: 'Edit value', exact: true })
		.click();
	await choose(page, 'Contains');
	await valueInput(page).fill('Flame');
	await expect(page.locator('#filter-suggestions')).toContainText('No value contains “Flame”.');
	// The request for the settled text (an earlier keystroke may have been sent and aborted).
	const flame = (
		api.bodies('/api/query/stage') as { variableFilters?: { value: string }[] }[]
	).find((body) => body.variableFilters?.some((filter) => filter.value === 'Flame'));
	expect(flame).toMatchObject({
		variableName: '?suggestedValue',
		where: [
			{
				subject: '?mon',
				predicate: '<https://e/category>',
				object: '?suggestedValue',
				filterType: null
			}
		],
		variableFilters: [{ variableName: '?suggestedValue', filterType: 1, value: 'Flame' }]
	});
});

test('G-13 Toggle Boolean value replaces only its node', async ({ page }) => {
	await addGraph(page, [
		{ kind: 'variable', id: '?mon', x: 200, y: 250 },
		{ kind: 'value', id: 'true', x: 500, y: 250 },
		{
			edge: 'legendary',
			source: '?mon',
			target: 'true',
			predicate: '<https://e/legendary>',
			label: 'legendary'
		}
	]);
	await clickNode(page, 'true');
	await page
		.locator('#node-action-menu')
		.getByRole('button', { name: 'Toggle Boolean value' })
		.click();
	expect(await filterNode(page)).toEqual({ label: 'false', value: 'false', filterType: null });
	await expect(page.locator('#node-action-menu')).toHaveAttribute('data-node-id', /^node_\d+$/);
});

/**
 * DOC-006: the images of the /help page, taken from the editor on the worked
 * example (Fire-type Pokémon with a speed of at least 90, PokemonGen1). The
 * API is mocked offline: the counts and stage candidates are the captured
 * `fixtures/legacy/fire-speed-at-least-90` answers, the speeds come from
 * src/main/resources/pokemon_gen1.ttl. Each test writes one file in
 * static/help-images/; nothing is compared.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { guardOffline } from '../tests/support/offline';
import { mockApi, type MockApi } from '../tests/support/mock-api';
import { EditorPage } from '../tests/support/pages/editor-page';
import { useTheme } from '../tests/support/screens';

const PK = 'http://easyquery.example.org/pokemon#';
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const savedQuery = read('../src/lib/domain/fixtures/fire-speed-at-least-90.query.json');
// A triangle instead of the saved row, so the speed arrow does not cross the Fire node.
const POSITIONS: Record<string, { x: number; y: number }> = {
	'?pokemon': { x: 180, y: 220 },
	[`<${PK}FireType>`]: { x: 520, y: 100 },
	'?speed': { x: 520, y: 340 }
};
for (const node of savedQuery.nodes) node.position = POSITIONS[node.id];
const captured = read('../../fixtures/legacy/fire-speed-at-least-90.response.json') as {
	body: { data: unknown };
}[];
const [, , stageAnswer, sparqlAnswer] = captured.map((response) => response.body);

/** Speed of every Fire-type Pokémon in PokemonGen1. */
const FIRE_SPEEDS: [string, number][] = [
	['Charmander', 65],
	['Charmeleon', 80],
	['Charizard', 100],
	['Vulpix', 65],
	['Ninetales', 100],
	['Growlithe', 60],
	['Arcanine', 95],
	['Ponyta', 90],
	['Rapidash', 105],
	['Magmar', 93],
	['Flareon', 65],
	['Moltres', 90]
];

type CountBody = {
	variableName: string;
	where: { object: string }[];
	variableFilters?: unknown[];
};

let unexpected: string[];
let api: MockApi;

test.beforeEach(async ({ page, baseURL }) => {
	unexpected = await guardOffline(page, baseURL!);
	await page.setViewportSize({ width: 1280, height: 800 });
	await useTheme(page, 'light');
	api = await mockApi(page);
	// 151 Pokémon, 12 Fire, 42 with speed ≥ 90, 7 both (PokemonGen1).
	api.override('/api/query/count', (raw) => {
		const body = raw as unknown as CountBody;
		const fire = body.where.some((item) => item.object === `<${PK}FireType>`);
		const fast = (body.variableFilters ?? []).length > 0;
		return {
			data: {
				variableName: body.variableName,
				count: fire && fast ? 7 : fire ? 12 : fast ? 42 : 151
			}
		};
	});
	api.override('/api/query/numeric-profile', (body) => ({
		data: {
			subject: body?.subject,
			predicate: body?.predicate,
			count: FIRE_SPEEDS.length,
			min: 60,
			max: 105,
			truncated: false,
			values: FIRE_SPEEDS.map(([name, speed]) => ({
				entity: { type: 'iri', value: `${PK}${name}`, datatype: null, language: null },
				label: name,
				value: `${speed}`,
				number: speed,
				datatype: 'http://www.w3.org/2001/XMLSchema#integer'
			}))
		}
	}));
	// Stage ?pokemon: the captured candidates; the speed filter's text suggestions: the
	// distinct speeds that contain the typed text (only 90 for "90").
	api.override('/api/query/stage', (body) =>
		body?.variableName === '?speed'
			? {
					data: {
						variableName: '?speed',
						offset: 0,
						limit: body.limit,
						hasMore: false,
						candidates: [
							{
								term: {
									type: 'literal',
									value: '90',
									datatype: 'http://www.w3.org/2001/XMLSchema#integer',
									language: null
								},
								label: null,
								selectable: true
							}
						]
					}
				}
			: stageAnswer
	);
	api.override('/api/query/sparql', () => sparqlAnswer);
});

test.afterEach(() => {
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});

async function openExample(page: Page) {
	const editor = new EditorPage(page);
	await editor.open();
	await editor.setAutoLayout(false);
	await editor.uploadQuery('fire-speed-at-least-90.json', savedQuery);
	await expect(editor.nodeCount).toHaveText('Nodes: 3');
	await editor.setViewport(1, { x: 120, y: 60 });
	await expect(page.locator('#filter-badge-layer .filter-badge')).toHaveText(/7/);
	await page.locator('[data-sonner-toast] [data-close-button]').click();
	await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
	return editor;
}

/** Writes the picture without a focus tooltip or a hovered control. */
async function shoot(page: Page, name: string) {
	await page.mouse.move(0, 799);
	await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
	await expect(page.locator('[data-bits-floating-content-wrapper]')).toHaveCount(0);
	await page.screenshot({
		path: `static/help-images/${name}.png`,
		animations: 'disabled',
		caret: 'hide'
	});
}

test('editor', async ({ page }) => {
	await openExample(page);
	await shoot(page, 'editor');
});

test('action list', async ({ page }) => {
	const editor = await openExample(page);
	await editor.clickNode('?pokemon');
	await expect(page.locator('#node-action-menu')).toBeVisible();
	await shoot(page, 'action-list');
});

test('filter editor', async ({ page }) => {
	const editor = await openExample(page);
	await editor.clickNode('?speed');
	await page.locator('#node-action-menu').getByRole('button', { name: 'Edit filter' }).click();
	const dialog = page.locator('#filter-editor');
	await expect(dialog).toBeVisible();
	await expect(dialog.getByText(/12/).first()).toBeVisible();
	// Wait for the debounced text-suggestion request and its answer, not its loading line.
	await expect.poll(() => api.bodies('/api/query/stage').length).toBeGreaterThan(0);
	await expect(dialog.getByText('Looking for matching values…')).toHaveCount(0);
	await shoot(page, 'filter-editor');
});

test('run query', async ({ page }) => {
	const editor = await openExample(page);
	await editor.runQuery();
	await expect(editor.stageHeading).toContainText('?pokemon');
	await expect(editor.candidates.first()).toBeVisible();
	await shoot(page, 'run-query');
});

test('filter funnel', async ({ page }) => {
	await openExample(page);
	await page.locator('#filter-funnel-btn').click();
	await expect(page.locator('#filter-funnel-result')).toContainText('7');
	await shoot(page, 'filter-funnel');
});

test('view sparql', async ({ page }) => {
	await openExample(page);
	await page.locator('#view-sparql-btn').click();
	await expect(page.getByRole('dialog')).toContainText('FILTER');
	await shoot(page, 'view-sparql');
});

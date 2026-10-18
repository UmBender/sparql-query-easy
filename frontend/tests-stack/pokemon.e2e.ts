/**
 * QUAL-007 on the real stack: the built-in PokemonGen1 dataset answers the
 * new app like the captured legacy run (fixtures/legacy/fire-speed-at-least-90),
 * and Ktor's live /openapi.json is the snapshot the frontend types come from.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const SAVED = new URL(
	'../src/lib/domain/fixtures/fire-speed-at-least-90.query.json',
	import.meta.url
);
const captured = read('../../fixtures/legacy/fire-speed-at-least-90.response.json') as {
	body: { data: { candidates?: { term: { type: string; value: string } }[] } };
}[];

type Candidate = { label: string; selectable: boolean; term: { type: string; value: string } };
const keys = (items: Candidate[]) =>
	items
		.map((item) => `${item.term.type}|${item.term.value}|${item.label}|${item.selectable}`)
		.sort();

let unexpected: string[];

test.beforeEach(async ({ page, baseURL }) => {
	unexpected = [];
	await page.route('**/*', (route) => {
		const url = new URL(route.request().url());
		if (url.origin !== new URL(baseURL!).origin) {
			unexpected.push(url.href);
			return route.abort('blockedbyclient');
		}
		return route.fallback();
	});
	await page.addInitScript(() => window.localStorage.setItem('easyquery-tour-seen', 'true'));
});

test.afterEach(() => {
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});

test('the live /openapi.json equals the frontend snapshot', async ({ request }) => {
	const response = await request.get('/openapi.json');
	expect(response.ok()).toBe(true);
	expect(await response.json()).toEqual(read('../src/lib/api/openapi.json'));
});

test('PokemonGen1: a loaded query stages the captured fire pokémon with speed ≥ 90', async ({
	page
}) => {
	await page.goto('/');
	await expect(page.locator('#status-api')).toHaveText('API: online');
	await page.locator('#upload-json').setInputFiles(SAVED.pathname);
	await expect(page.locator('#status-nodes')).toHaveText('Nodes: 3');
	await expect(page.locator('#input-endpoint-sparql')).toHaveValue(/Pok/);

	const staged = page.waitForResponse((response) => response.url().endsWith('/api/query/stage'));
	await page.locator('#run-query-btn').click();
	const body = (await (await staged).json()) as { data: { candidates: Candidate[] } };
	const expected = captured.find((item) => item.body.data.candidates)!.body.data
		.candidates as Candidate[];
	expect(keys(body.data.candidates)).toEqual(keys(expected));
	await expect(page.locator('#stage-candidates .stage-candidate')).toHaveCount(expected.length);
});

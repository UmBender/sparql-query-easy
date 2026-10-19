/**
 * FE-053: the query editor started from a saved query on a locked endpoint,
 * with a page's own panel and toolbar action, and two editors that do not
 * share graph state. No API runs here: `fetch` answers 503, so health and
 * the endpoint list fail and the editor keeps its built-in endpoint list.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import fireSpeed from '#lib/domain/fixtures/fire-speed-at-least-90.query.json?raw';
import { loadQuery, nodesOf, type QueryDocument } from '#lib/domain/index.js';
import type { QueryStore } from '#lib/stores/query-store.svelte.js';
import { TOUR_KEY } from '#lib/features/utilities/seen.js';
import Harness from './query-editor-harness.svelte';

function fixture(): QueryDocument {
	const loaded = loadQuery(fireSpeed);
	if ('error' in loaded) throw new Error(loaded.error.message);
	return loaded.document;
}

async function mount(editors: object[]) {
	const stores: QueryStore[] = [];
	const screen = await render(Harness, {
		editors,
		onready: (index: number, store: QueryStore) => (stores[index] = store)
	});
	return { screen, stores };
}

beforeEach(() => {
	localStorage.setItem(TOUR_KEY, 'true');
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => Response.json({ error: 'No API in this test' }, { status: 503 }))
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('QueryEditor', () => {
	it('starts from a saved query on a locked endpoint and renders the page panel and action', async () => {
		const document = fixture();
		const { screen, stores } = await mount([
			{
				initial: document,
				endpoint: { kind: 'builtIn', id: 'PokemonGen1' },
				lockEndpoint: true
			}
		]);
		const [store] = stores;

		expect(store.document.graph).toEqual(document.graph);
		expect(store.endpoint).toEqual({ kind: 'builtIn', id: 'PokemonGen1' });
		await expect
			.element(screen.getByRole('combobox', { name: 'SPARQL endpoint' }))
			.toBeDisabled();
		await expect.element(screen.getByTestId('panel-0')).toHaveTextContent('Task statement 0');
		await expect.element(screen.getByTestId('action-0')).toBeVisible();
		expect(screen.container.querySelector('#upload-triples-btn')).toBeNull();

		store.setEndpoint('https://query.wikidata.org/sparql');
		store.load({ ...document, endpoint: { kind: 'builtIn', id: 'CampeonatoBrasileiro2023' } });
		expect(store.endpoint).toEqual({ kind: 'builtIn', id: 'PokemonGen1' });
	});

	it('starts empty and unlocked without props, as on /', async () => {
		const { screen, stores } = await mount([{}]);
		expect(nodesOf(stores[0].graph)).toHaveLength(0);
		await expect
			.element(screen.getByRole('combobox', { name: 'SPARQL endpoint' }))
			.toBeEnabled();
		expect(screen.container.querySelector('#upload-triples-btn')).not.toBeNull();
	});

	it('gives every editor its own graph', async () => {
		const { stores } = await mount([{ initial: fixture() }, {}]);
		const [first, second] = stores;
		expect(first).not.toBe(second);
		const before = nodesOf(first.graph).length;

		second.addVariable();
		expect(nodesOf(second.graph)).toHaveLength(1);
		expect(nodesOf(first.graph)).toHaveLength(before);
	});
});

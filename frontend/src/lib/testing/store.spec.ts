/** QUAL-012: the test store factory starts empty, from a document or from a graph, with fixed ids. */
import { describe, expect, it } from 'vitest';
import fireSpeed from '#lib/domain/fixtures/fire-speed-at-least-90.query.json?raw';
import { loadQuery, nodesOf } from '#lib/domain/index.js';
import { createTestStore, TEST_NOW } from './store.js';

function document() {
	const loaded = loadQuery(fireSpeed);
	if ('error' in loaded) throw new Error(loaded.error.message);
	return loaded.document;
}

describe('createTestStore', () => {
	it('stamps ids from the fixed test clock', () => {
		const store = createTestStore();
		expect(store.addVariable()).toBe(`?node_${TEST_NOW}`);
		expect(store.addVariable()).toBe(`?node_${TEST_NOW + 1}`);
	});

	it('starts from a saved query or a graph with an empty history', () => {
		const loaded = document();
		const fromDocument = createTestStore({ document: loaded });
		expect(fromDocument.graph).toEqual(loaded.graph);
		expect(fromDocument.endpoint).toEqual(loaded.endpoint);
		const fromGraph = createTestStore({ graph: loaded.graph });
		expect(nodesOf(fromGraph.graph)).toHaveLength(nodesOf(loaded.graph).length);
		expect([fromDocument.canUndo, fromGraph.canUndo]).toEqual([false, false]);
	});
});

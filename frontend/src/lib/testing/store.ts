/**
 * QUAL-012: a fresh QueryStore with a deterministic clock, so generated ids
 * (`?node_<now>`) are the same on every run; optionally started from a saved
 * query document or a graph.
 */
import type { QueryDocument, QueryGraph } from '#lib/domain/index.js';
import { QueryStore, type QueryStoreOptions } from '#lib/stores/query-store.svelte.js';

/** The first `now` of a test clock; the n-th id stamp is TEST_NOW + n. */
export const TEST_NOW = 1_760_000_000_000;

/** A clock that advances by 1 ms on every call. */
export function testClock(start = TEST_NOW): () => number {
	let time = start;
	return () => time++;
}

export type TestStoreOptions = QueryStoreOptions & { document?: QueryDocument; graph?: QueryGraph };

export function createTestStore({
	document,
	graph,
	...options
}: TestStoreOptions = {}): QueryStore {
	const store = new QueryStore({ now: testClock(), ...options });
	if (document) store.load(document);
	else if (graph) {
		store.commit(graph);
		store.clearHistory();
	}
	return store;
}

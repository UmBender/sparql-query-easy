import { describe, expect, it } from 'vitest';
import { QueryStore, HISTORY_LIMIT } from './query-store.svelte.js';
import { emptyGraph, loadQuery, saveQueryText } from '#lib/domain/index.js';

function clock(start = 1_760_000_000_000) {
	let time = start;
	return () => time++;
}

describe('undo and redo (FE-052)', () => {
	it('N undos restore the initial graph and N redos the final one, with canUndo/canRedo at each step', () => {
		const store = new QueryStore({ now: clock() });
		const snapshots = [store.graph];
		const a = store.addVariable();
		snapshots.push(store.graph);
		store.addEntity('<b>', 'B');
		snapshots.push(store.graph);
		store.connect(a, '<b>', '<p>', 'p');
		snapshots.push(store.graph);
		store.convertToVariable('<b>');
		snapshots.push(store.graph);
		const n = snapshots.length - 1;
		expect([store.canUndo, store.canRedo]).toEqual([true, false]);
		for (let step = n - 1; step >= 0; step--) {
			expect(store.undo()).toBe(true);
			expect(store.graph).toEqual(snapshots[step]);
			expect([store.canUndo, store.canRedo]).toEqual([step > 0, true]);
		}
		expect(store.undo()).toBe(false);
		for (let step = 1; step <= n; step++) {
			expect(store.redo()).toBe(true);
			expect(store.graph).toEqual(snapshots[step]);
			expect([store.canUndo, store.canRedo]).toEqual([true, step < n]);
		}
		expect(store.redo()).toBe(false);
	});

	it('selection, funnel toggles, node moves and the stage order add no history entries', () => {
		const store = new QueryStore({ now: clock() });
		const a = store.addVariable();
		const b = store.addVariable();
		store.connect(a, b, '<p>', 'p');
		const depth = store.past.length;
		store.select({ kind: 'node', id: a });
		store.setFunnelStep('x', false);
		store.setFunnelVariable(a);
		store.moveNode(a, { x: 3, y: 3 });
		store.moveStage(0, 1);
		store.setLimit(10);
		expect(store.past.length).toBe(depth);
	});

	it('an edit after undo empties redo, and history never exceeds the bound', () => {
		const store = new QueryStore({ now: clock(), historyLimit: 3 });
		for (let index = 0; index < 5; index++) store.addVariable();
		expect(store.past.length).toBe(3);
		store.undo();
		expect(store.canRedo).toBe(true);
		store.addVariable();
		expect(store.canRedo).toBe(false);
		expect(store.past.length).toBe(3);
		expect(HISTORY_LIMIT).toBe(100);
	});

	it('load, New Query and an endpoint change clear the history', () => {
		const store = new QueryStore({ now: clock() });
		store.addVariable();
		store.addVariable();
		store.undo();
		const text = saveQueryText(store.document);
		store.clear();
		expect([store.canUndo, store.canRedo, store.graph]).toEqual([false, false, emptyGraph]);
		store.addVariable();
		const loaded = loadQuery(text);
		if (!('document' in loaded)) throw new Error(loaded.error.message);
		store.load(loaded.document);
		expect([store.canUndo, store.canRedo]).toEqual([false, false]);
		store.addVariable();
		store.setEndpoint(store.endpoint);
		expect(store.canUndo).toBe(true);
		store.setEndpoint('PokemonGen1');
		expect([store.canUndo, store.canRedo]).toEqual([false, false]);
	});
});

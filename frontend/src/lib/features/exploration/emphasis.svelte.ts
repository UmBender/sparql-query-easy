/**
 * Variable emphasis between the graph and the stage order (FE-023): hovering
 * a variable's node or relation emphasizes its chip, hovering or focusing a
 * chip emphasizes every node and relation of that variable. Only variables
 * with a visible chip (two or more variables) are emphasized.
 */
import type { QueryStore } from '#lib/stores/query-store.svelte.js';
import { idSet } from '#lib/features/editor/graph-view.js';

export type EmphasisSource = 'graph' | 'block-hover' | 'block-focus';

export class Emphasis {
	readonly store: QueryStore;
	current = $state.raw<{ name: string; source: EmphasisSource } | null>(null);

	constructor(store: QueryStore) {
		this.store = store;
	}

	/** The emphasized variable while chips are shown and it still exists. */
	name: string | null = $derived.by(() => {
		const current = this.current;
		if (!current || this.store.order.length < 2) return null;
		return this.store.orderState.registry.some((entry) => entry.name === current.name)
			? current.name
			: null;
	});
	elementIds: ReadonlySet<string> = $derived.by(() => {
		const entry = this.store.orderState.registry.find((item) => item.name === this.name);
		return idSet(entry ? [...entry.nodeIds, ...entry.edgeIds] : []);
	});

	set(name: string, source: EmphasisSource) {
		this.current = { name, source };
	}
	clear(source: EmphasisSource) {
		if (this.current?.source === source) this.current = null;
	}
	/** Graph hover: the variable of the hovered node or relation, if any. */
	hover(id: string | null, kind: 'node' | 'edge') {
		if (id === null) {
			this.clear('graph');
			return;
		}
		const key = kind === 'edge' ? 'edgeIds' : 'nodeIds';
		const entry = this.store.orderState.registry.find((item) => item[key].includes(id));
		if (entry) this.set(entry.name, 'graph');
	}
}

/**
 * Badges over filtered nodes (FE-036, FE-039; port of filter-badges.js):
 * while the node's subject is a variable, its funnel step as "kept / total";
 * once the subject is a fixed entity, the actual values in a chip and a ✓/✗
 * for the filter. Badges never change the graph; they only add the
 * `rejected` canvas class.
 */
import { wantedFilterBadges, type BadgeWanted } from '#lib/domain/index.js';
import { filterAccepts, filterLabel } from '#lib/domain/legacy/query-calculations.js';
import type { CountBadgeState } from '#lib/components/ui/count-badge/index.js';
import type { QueryStore } from '#lib/stores/query-store.svelte.js';
import type { CountCache } from './count-cache.js';
import { idSet } from '#lib/features/editor/graph-view.js';

export const BADGE_DEBOUNCE_MS = 400;
export const ACTUAL_SHOWN = 3;

export type Overlay = {
	state: CountBadgeState | 'unknown' | 'ok-chip';
	text: string;
	description: string;
};
export type NodeBadges = { badge: Overlay | null; chip: Overlay | null };

export class FilterBadges {
	readonly store: QueryStore;
	readonly counts: CountCache;
	readonly actualValues: (
		request: Extract<BadgeWanted, { kind: 'actual' }>['request']
	) => Promise<string[]>;
	byNode = $state.raw<Readonly<Record<string, NodeBadges>>>({});
	#generation = 0;
	#timer: ReturnType<typeof setTimeout> | null = null;

	constructor(store: QueryStore, counts: CountCache, actualValues: FilterBadges['actualValues']) {
		this.store = store;
		this.counts = counts;
		this.actualValues = actualValues;
	}

	/** Filtered nodes whose filter keeps nothing or rejects the actual value. */
	rejected: ReadonlySet<string> = $derived(
		idSet(
			Object.entries(this.byNode)
				.filter(([, item]) => item.badge?.state === 'empty' || item.badge?.state === 'fail')
				.map(([id]) => id)
		)
	);

	schedule() {
		if (this.#timer !== null) clearTimeout(this.#timer);
		this.#timer = setTimeout(() => this.refresh(), BADGE_DEBOUNCE_MS);
	}

	dispose() {
		if (this.#timer !== null) clearTimeout(this.#timer);
		this.#generation++;
	}

	#set(nodeId: string, patch: Partial<NodeBadges>) {
		this.byNode = {
			...this.byNode,
			[nodeId]: { ...(this.byNode[nodeId] ?? { badge: null, chip: null }), ...patch }
		};
	}

	refresh() {
		const generation = ++this.#generation;
		const wanted = wantedFilterBadges(
			this.store.graph,
			this.store.order,
			this.store.funnelVariable,
			this.store.context
		);
		this.byNode = Object.fromEntries(
			Object.entries(this.byNode).filter(([nodeId]) => wanted.has(nodeId))
		);
		const current = (nodeId: string) =>
			generation === this.#generation &&
			this.store.graph.elements.some((element) => element.id === nodeId);
		wanted.forEach((item, nodeId) => {
			if (item.kind === 'actual') this.#showActual(nodeId, item, current);
			else
				this.#set(nodeId, {
					chip: null,
					badge: {
						state: 'loading',
						text: '…',
						description: 'Counting the results this filter keeps…'
					}
				});
		});
		// Counts go one at a time, like the funnel, so the endpoint load stays bounded.
		(async () => {
			for (const [nodeId, item] of wanted) {
				if (generation !== this.#generation) return;
				if (item.kind === 'count') await this.#showCount(nodeId, item, current);
			}
		})();
	}

	async #showCount(
		nodeId: string,
		{ variableName, before, after }: Extract<BadgeWanted, { kind: 'count' }>,
		current: (id: string) => boolean
	) {
		try {
			const total = await this.counts.load(before!);
			const kept = await this.counts.load(after!);
			if (!current(nodeId)) return;
			this.#set(nodeId, {
				badge: {
					state: kept === 0 ? 'empty' : 'kept',
					text: `${kept} / ${total}`,
					description: `This filter keeps ${kept} of the ${total} ${variableName} that reach it.`
				}
			});
		} catch (error) {
			if (!current(nodeId)) return;
			this.#set(nodeId, {
				badge: {
					state: 'error',
					text: '?',
					description: `Could not count results: ${error instanceof Error ? error.message : String(error)}`
				}
			});
		}
	}

	#showActual(
		nodeId: string,
		{ request, filterType, value }: Extract<BadgeWanted, { kind: 'actual' }>,
		current: (id: string) => boolean
	) {
		const filter = filterLabel(filterType, value);
		const unknown = (reason: string) =>
			this.#set(nodeId, {
				chip: { state: 'unknown', text: 'value unknown', description: reason },
				badge: {
					state: 'error',
					text: '?',
					description: `${reason} The filter ${filter} cannot be checked.`
				}
			});
		this.#set(nodeId, {
			chip: { state: 'loading', text: '…', description: 'Loading the actual value…' },
			badge: {
				state: 'loading',
				text: '…',
				description: 'Checking the actual value against this filter…'
			}
		});
		this.actualValues(request).then(
			(values) => {
				if (!current(nodeId)) return;
				if (!values.length) {
					unknown('This entity has no value for this relation.');
					return;
				}
				const shown =
					values.slice(0, ACTUAL_SHOWN).join(', ') +
					(values.length > ACTUAL_SHOWN ? ', …' : '');
				const all = values.join(', ');
				const chip: Overlay = {
					state: 'ok-chip',
					text: shown,
					description: `Actual value: ${all}`
				};
				const passes = filterAccepts(filterType, value, values);
				this.#set(nodeId, {
					chip,
					badge:
						passes === null
							? null
							: passes
								? {
										state: 'pass',
										text: '✓',
										description: `The actual value ${all} passes the filter ${filter}.`
									}
								: {
										state: 'fail',
										text: '✗',
										description: `The actual value ${all} does not pass the filter ${filter}.`
									}
				});
			},
			(error) => {
				if (!current(nodeId)) return;
				unknown(
					`Could not load the actual value: ${error instanceof Error ? error.message : String(error)}.`
				);
			}
		);
	}
}

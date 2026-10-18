/**
 * The filter funnel (FE-028, FE-039): remaining distinct results after each
 * filter step, counted one request at a time; a newer refresh aborts an older
 * one, graph and endpoint edits refresh an open funnel after 350 ms. Step
 * toggles are preview only (the store keeps them out of Run Query).
 */
import {
	funnelStepCounts,
	MAX_FUNNEL_STEPS,
	type FunnelPlan
} from '#lib/domain/legacy/query-calculations.js';
import type { QueryStore } from '#lib/stores/query-store.svelte.js';
import type { CountCache } from './count-cache.js';

export const FUNNEL_DEBOUNCE_MS = 350;

export type FunnelView =
	| { message: string }
	| {
			plan: FunnelPlan;
			variables: string[];
			labels: string[];
			counts: (number | undefined)[];
			status: 'loading' | 'loaded' | 'error';
			error: string | null;
	  };

export class Funnel {
	readonly store: QueryStore;
	readonly counts: CountCache;
	open = $state(false);
	view = $state.raw<FunnelView>({ message: '' });
	#generation = 0;
	#controller: AbortController | null = null;
	#timer: ReturnType<typeof setTimeout> | null = null;

	constructor(store: QueryStore, counts: CountCache) {
		this.store = store;
		this.counts = counts;
	}

	show() {
		this.open = true;
		this.refresh();
	}

	hide() {
		this.open = false;
		this.#stop();
	}

	#stop() {
		if (this.#timer !== null) clearTimeout(this.#timer);
		this.#timer = null;
		this.#controller?.abort();
		this.#controller = null;
		this.#generation++;
	}

	/** Graph and endpoint edits: one refresh after a short pause. */
	schedule() {
		if (!this.open) return;
		if (this.#timer !== null) clearTimeout(this.#timer);
		this.#timer = setTimeout(() => this.refresh(), FUNNEL_DEBOUNCE_MS);
	}

	refresh() {
		if (!this.open) return;
		this.#stop();
		const generation = this.#generation;
		const input = this.store.funnel;
		if (!input.plan) {
			this.view = { message: input.message };
			return;
		}
		const { plan, variables, labels } = input;
		const counts = plan.requests.map((request) =>
			request ? this.counts.cached(request) : undefined
		);
		const missing = plan.requests
			.map((request, index) => ({ request, index }))
			.filter(({ request, index }) => request && counts[index] === undefined);
		this.view = {
			plan,
			variables,
			labels,
			counts: counts.slice(),
			status: missing.length ? 'loading' : 'loaded',
			error: null
		};
		if (!missing.length) return;
		// One request at a time keeps the endpoint load bounded; a newer refresh aborts it.
		const controller = new AbortController();
		this.#controller = controller;
		(async () => {
			for (const { request, index } of missing) {
				const count = await this.counts.fetch(request!, controller.signal);
				if (generation !== this.#generation) return;
				counts[index] = count;
				this.view = {
					plan,
					variables,
					labels,
					counts: counts.slice(),
					status: 'loading',
					error: null
				};
			}
			if (generation !== this.#generation) return;
			this.#controller = null;
			this.view = {
				plan,
				variables,
				labels,
				counts: counts.slice(),
				status: 'loaded',
				error: null
			};
		})().catch((error) => {
			if (generation !== this.#generation || controller.signal.aborted) return;
			this.#controller = null;
			this.view = {
				plan,
				variables,
				labels,
				counts: counts.slice(),
				status: 'error',
				error: error instanceof Error ? error.message : String(error)
			};
		});
	}

	/** Rows, status and result text of the panel (`renderFilterFunnel`). */
	rows = $derived.by(() => {
		const view = this.view;
		if (!('plan' in view)) return null;
		const { plan, counts, labels } = view;
		const base = counts[0] ?? null;
		const stepCounts = funnelStepCounts(plan.requests, counts);
		const disabled = this.store.funnelDisabled;
		const off = plan.steps.filter((step) => disabled.has(step.key)).length;
		let previous = base;
		const steps = plan.steps.map((step, index) => {
			const enabled = !disabled.has(step.key);
			const count = step.counted ? stepCounts[index] : null;
			const row = { step, label: labels[index], enabled, count, previous };
			if (step.counted) previous = count;
			return row;
		});
		const last = stepCounts.length ? stepCounts[stepCounts.length - 1] : base;
		const parts: string[] = [];
		if (last != null)
			parts.push(`Result: ${last} ${plan.variableName}${base != null ? ` of ${base}` : ''}.`);
		if (off)
			parts.push(
				`Preview without ${off} filter${off === 1 ? '' : 's'}; Run Query still applies every filter.`
			);
		if (plan.steps.some((step) => !step.counted))
			parts.push(`Only the first ${MAX_FUNNEL_STEPS} filters are counted.`);
		if (plan.extremes)
			parts.push(
				'MAX/MIN keep every tied result and come after the other filters, as in the query.'
			);
		const status =
			view.status === 'loading'
				? 'Counting…'
				: view.status === 'error'
					? `Could not count results: ${view.error}`
					: plan.steps.length
						? ''
						: 'This query has no filters yet. Give a relation a fixed value or a comparison to add a step.';
		return {
			base,
			steps,
			result: parts.join(' '),
			status,
			variables: view.variables,
			variableName: plan.variableName
		};
	});
}

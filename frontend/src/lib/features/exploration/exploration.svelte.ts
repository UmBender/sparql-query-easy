/**
 * Staged Run Query (DEC-008, FE-005–FE-010, FE-025; port of
 * stage-exploration.js): one exploration per opened panel, stage pages cached
 * per request until the query signature changes, a response for a superseded
 * stage ignored, the hover/focus preview budgeted by the scheduler, and
 * Assume / Apply to graph through the store.
 */
import { stageRequestFor, type QueryContext } from '#lib/domain/index.js';
import {
	candidateText,
	createPreviewScheduler,
	stageCacheKey,
	type PreviewScheduler,
	type PreviewState,
	type StageBinding,
	type StageCandidate,
	type StagePage,
	type StageRequest
} from '#lib/domain/legacy/query-stages.js';
import type { QueryFilter, VariableFilter } from '#lib/domain/legacy/query-calculations.js';
import { isAbort, type ApiClient } from '#lib/api/client.js';
import type { QueryStore } from '#lib/stores/query-store.svelte.js';

export type ExplorationState = {
	signature: string | null;
	order: string[];
	where: QueryFilter[];
	variableFilters: VariableFilter[];
	stage: number;
	bindings: StageBinding[];
	labels: string[];
	pages: StagePage[];
	status: 'loading' | 'loaded' | 'error' | 'complete';
	error: string | null;
	retryOffset: number;
	preview: PreviewState;
	previewCandidate: StageCandidate | null;
	previewKey: string | null;
};

export class Exploration {
	readonly store: QueryStore;
	readonly api: ApiClient;
	readonly toast: (message: string, kind?: 'success' | 'error') => void;
	state = $state.raw<ExplorationState | null>(null);
	/** Bumped when the panel opens, so it can take focus. */
	opened = $state(0);
	// A private request cache, never rendered, so not reactive.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	readonly #cache = new Map<string, StagePage>();
	#cacheSignature: string | null = null;
	#controller: AbortController | null = null;
	#previews: PreviewScheduler | null = null;
	/** Generations: a response or preview from an older exploration or load is ignored. */
	#exploration = 0;
	#load = 0;

	constructor({
		store,
		api,
		toast
	}: {
		store: QueryStore;
		api: ApiClient;
		toast: Exploration['toast'];
	}) {
		this.store = store;
		this.api = api;
		this.toast = toast;
	}

	get context(): QueryContext {
		return this.store.context;
	}
	get open(): boolean {
		return this.state !== null;
	}
	get candidates(): StageCandidate[] {
		return this.state?.status === 'error'
			? []
			: (this.state?.pages.flatMap((page) => page.candidates) ?? []);
	}
	get complete(): boolean {
		return !!this.state && this.state.stage === this.state.order.length;
	}
	get lastStage(): boolean {
		return !!this.state && this.state.stage === this.state.order.length - 1;
	}

	#set(patch: Partial<ExplorationState>) {
		if (this.state) this.state = { ...this.state, ...patch };
	}

	start(order: string[], where: QueryFilter[], variableFilters: VariableFilter[]) {
		this.stop();
		const signature = this.store.orderState.signature;
		if (this.#cacheSignature !== signature) {
			this.#cache.clear();
			this.#cacheSignature = signature;
		}
		this.state = {
			signature,
			order: order.slice(),
			where,
			variableFilters,
			stage: 0,
			bindings: [],
			labels: [],
			pages: [],
			status: 'loading',
			error: null,
			retryOffset: 0,
			preview: { key: null, status: 'idle' },
			previewCandidate: null,
			previewKey: null
		};
		const exploration = ++this.#exploration;
		this.#previews = createPreviewScheduler({
			cache: this.#cache,
			fetchPage: (request, signal) =>
				this.api.stage(request, { signal }) as Promise<StagePage>,
			onUpdate: (preview) => {
				if (exploration === this.#exploration) this.#set({ preview });
			}
		});
		this.opened++;
		this.loadStagePage(0);
	}

	stop() {
		this.#controller?.abort();
		this.#controller = null;
		this.#previews?.cancel();
		this.#previews = null;
		this.#exploration++;
		this.state = null;
	}

	/** A signature change closes the panel and drops the cache; a new order restarts (`invalidateExploration`). */
	invalidate(signatureChanged: boolean) {
		const state = this.state;
		if (!state) return;
		if (signatureChanged) {
			this.#cache.clear();
			this.#cacheSignature = this.store.orderState.signature;
			this.stop();
			return;
		}
		if (this.store.order.join(' ') !== state.order.join(' '))
			this.start(this.store.order, state.where, state.variableFilters);
	}

	#request(stage: number, bindings: StageBinding[], offset: number): StageRequest {
		const state = this.state!;
		return stageRequestFor(state, stage, bindings, offset, this.context);
	}

	loadStagePage(offset: number) {
		const current = this.state;
		if (!current) return;
		const request = this.#request(current.stage, current.bindings, offset);
		const key = stageCacheKey(request);
		const load = ++this.#load;
		const accept = (page: StagePage) => {
			const state = this.state!;
			this.state = {
				...state,
				pages: offset === 0 ? [page] : [...state.pages, page],
				status: 'loaded',
				error: null
			};
		};
		const cached = this.#cache.get(key);
		if (cached) {
			accept(cached);
			return;
		}
		this.#controller?.abort();
		const controller = new AbortController();
		this.#controller = controller;
		this.#set({ status: 'loading', retryOffset: offset });
		const exploration = this.#exploration;
		const fresh = () =>
			load === this.#load && exploration === this.#exploration && !controller.signal.aborted;
		this.api.stage(request, { signal: controller.signal }).then(
			(page) => {
				this.#cache.set(key, page as StagePage);
				if (!fresh()) return;
				this.#controller = null;
				accept(page as StagePage);
			},
			(error) => {
				if (!fresh() || isAbort(error)) return;
				this.#controller = null;
				this.#set({
					status: 'error',
					error: error instanceof Error ? error.message : String(error)
				});
			}
		);
	}

	retry() {
		this.loadStagePage(this.state?.retryOffset ?? 0);
	}

	loadMore() {
		const last = this.state?.pages.at(-1);
		if (last) this.loadStagePage(last.offset + last.limit);
	}

	/** Click/Enter commits a candidate and advances; after the last stage the summary shows (FE-010). */
	select(candidate: StageCandidate) {
		const state = this.state;
		if (!state || !candidate.selectable) return;
		this.#previews?.cancel();
		const bindings = [
			...state.bindings,
			{ variableName: state.order[state.stage], term: candidate.term }
		];
		const labels = [...state.labels, candidateText(candidate)];
		if (state.stage === state.order.length - 1) {
			this.#controller?.abort();
			this.#controller = null;
			this.state = {
				...state,
				bindings,
				labels,
				previewCandidate: null,
				stage: state.stage + 1,
				pages: [],
				status: 'complete'
			};
			return;
		}
		this.state = { ...state, bindings, labels, previewCandidate: null };
		this.#enter(state.stage + 1);
	}

	/** Back clears the previous stage's commitment and every later one. */
	back() {
		const state = this.state;
		if (!state || state.stage === 0) return;
		this.#previews?.cancel();
		const stage = state.stage - 1;
		this.state = {
			...state,
			bindings: state.bindings.slice(0, stage),
			labels: state.labels.slice(0, stage),
			previewCandidate: null
		};
		this.#enter(stage);
	}

	#enter(stage: number) {
		this.#controller?.abort();
		this.#controller = null;
		this.#set({ stage, pages: [], status: 'loading' });
		this.loadStagePage(0);
	}

	/** Hover/focus assumes a candidate and previews the next variable. */
	preview(candidate: StageCandidate) {
		const state = this.state;
		if (!state || !candidate.selectable) return;
		if (state.stage === state.order.length - 1) {
			this.#previews?.cancel();
			this.state = { ...this.state!, previewCandidate: candidate, previewKey: null };
			return;
		}
		const bindings = [
			...state.bindings,
			{ variableName: state.order[state.stage], term: candidate.term }
		];
		const request = this.#request(state.stage + 1, bindings, 0);
		this.state = { ...state, previewCandidate: candidate, previewKey: stageCacheKey(request) };
		this.#previews?.schedule(request);
	}

	/** Leaving an option drops its assumption; a dispatched preview still completes into the cache. */
	settle() {
		if (!this.state) return;
		this.#previews?.settle();
		this.#set({ previewCandidate: null });
	}

	choices() {
		const state = this.state!;
		return state.bindings.map((binding, index) => ({ ...binding, label: state.labels[index] }));
	}

	/** Apply to graph (DEC-008): every committed value replaces its variable. */
	apply() {
		if (!this.state || !this.complete) return;
		this.#applyChoices(this.choices());
	}

	/**
	 * Assume (FE-025): earlier commitments and this value go into the graph now;
	 * returns the remaining variables, in their order, for the next Run Query.
	 */
	assume(candidate: StageCandidate): string[] {
		const state = this.state;
		if (!state || !candidate.selectable || this.complete) return [];
		const choices = [
			...this.choices(),
			{
				variableName: state.order[state.stage],
				term: candidate.term,
				label: candidateText(candidate)
			}
		];
		const remaining = state.order.slice(state.stage + 1);
		this.#applyChoices(choices);
		const available = this.store.order;
		this.store.setOrder([
			...remaining.filter((name) => available.includes(name)),
			...available.filter((name) => !remaining.includes(name))
		]);
		return remaining;
	}

	#applyChoices(choices: { variableName: string; term: StageBinding['term']; label: string }[]) {
		this.stop();
		this.store.applyChoices(choices);
		this.toast(`Applied ${choices.length} bindings to the graph.`, 'success');
	}
}

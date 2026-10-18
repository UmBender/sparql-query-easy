/**
 * Result counts shared by the filter funnel and the badges (FE-028, FE-039):
 * values live in the TanStack query cache (keyed by the request payload);
 * fetching is explicit so a superseded funnel refresh can abort its request
 * and badges wait for an in-flight count instead of asking again
 * (legacy `trackResultCount` / `loadResultCount`).
 */
import type { QueryClient } from '@tanstack/svelte-query';
import { isAbort, type ApiClient } from '#lib/api/client.js';
import { queryKeys } from '#lib/api/queries.js';
import type { CountRequest } from '#lib/domain/legacy/query-calculations.js';

export class CountCache {
	readonly #api: ApiClient;
	readonly #client: QueryClient;
	readonly #inFlight = new Map<string, Promise<number>>();

	constructor(api: ApiClient, client: QueryClient) {
		this.#api = api;
		this.#client = client;
	}

	#key(request: CountRequest) {
		return queryKeys.count(request);
	}

	cached(request: CountRequest): number | undefined {
		return this.#client.getQueryData<number>(this.#key(request));
	}

	/** A new request, shared while it runs; a successful count is cached. */
	fetch(request: CountRequest, signal?: AbortSignal): Promise<number> {
		const key = JSON.stringify(this.#key(request));
		const load = this.#api.count(request, { signal }).then((data) => {
			this.#client.setQueryData(this.#key(request), data.count);
			return data.count;
		});
		const tracked = load.finally(() => {
			if (this.#inFlight.get(key) === tracked) this.#inFlight.delete(key);
		});
		this.#inFlight.set(key, tracked);
		return tracked;
	}

	/** A cached count, the running request for it, or a new one; an aborted shared request is asked again. */
	load(request: CountRequest): Promise<number> {
		const cached = this.cached(request);
		if (cached !== undefined) return Promise.resolve(cached);
		const shared = this.#inFlight.get(JSON.stringify(this.#key(request)));
		if (shared)
			return shared.catch((error) =>
				isAbort(error) ? this.load(request) : Promise.reject(error)
			);
		return this.fetch(request);
	}
}

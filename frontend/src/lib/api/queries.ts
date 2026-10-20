/**
 * TanStack Query wrappers (FE-043). Count, numeric-profile and search results
 * are cached by a key derived from the request payload, so an identical
 * request is served from the cache within `staleTime`; typing-driven calls
 * (search, filter suggestions) are debounced.
 */
import { QueryClient } from '@tanstack/svelte-query';
import type { ApiClient } from './client.js';
import type {
	CountRequest,
	NumericProfileRequest,
	StageRequestBody
} from '#lib/domain/legacy/query-calculations.js';
import type { StageRequest } from '#lib/domain/legacy/query-stages.js';

/** Cached results stay fresh this long (the graph data behind them rarely changes). */
export const STALE_TIME_MS = 5 * 60_000;
/** Legacy delay of Search nodes and filter suggestions after the last keystroke. */
export const TYPING_DEBOUNCE_MS = 400;

export function createAppQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { staleTime: STALE_TIME_MS, retry: false, refetchOnWindowFocus: false }
		}
	});
}

/** The app's one cache (AUTH-004), provided by the root layout and cleared when the user logs out. */
export const appQueryClient = createAppQueryClient();

/** A stable key for a JSON request body: sorted object keys. */
export function payloadKey(body: unknown): string {
	const sort = (value: unknown): unknown => {
		if (Array.isArray(value)) return value.map(sort);
		if (value && typeof value === 'object') {
			return Object.fromEntries(
				Object.keys(value)
					.sort()
					.map((key) => [key, sort((value as Record<string, unknown>)[key])])
			);
		}
		return value;
	};
	return JSON.stringify(sort(body));
}

export const queryKeys = {
	count: (request: CountRequest) => ['count', payloadKey(request)] as const,
	numericProfile: (request: NumericProfileRequest) =>
		['numeric-profile', payloadKey(request)] as const,
	stage: (request: StageRequest | StageRequestBody) => ['stage', payloadKey(request)] as const,
	search: (endpointUrl: string, text: string, limit: number) =>
		['search', endpointUrl, text, limit] as const,
	relationshipValue: (request: object) => ['relationship-value', payloadKey(request)] as const,
	/** STUDY-006: the admin's task list and one task; saving invalidates `['admin', 'tasks']`. */
	adminTasks: ['admin', 'tasks'] as const,
	adminTask: (key: string) => ['admin', 'tasks', key] as const,
	/** STUDY-007: groups and participants; a change invalidates `['admin', 'groups']` and the participants. */
	adminGroups: ['admin', 'groups'] as const,
	adminGroup: (id: number) => ['admin', 'groups', id] as const,
	adminParticipants: ['admin', 'participants'] as const
};

/** Cached request helpers bound to one client and one query cache. */
export function createCachedApi(client: ApiClient, queryClient: QueryClient) {
	return {
		count: (request: CountRequest, signal?: AbortSignal) =>
			queryClient.fetchQuery({
				queryKey: queryKeys.count(request),
				queryFn: ({ signal: own }) =>
					client.count(request, { signal: signal ?? own }).then((data) => data.count)
			}),
		numericProfile: (request: NumericProfileRequest, signal?: AbortSignal) =>
			queryClient.fetchQuery({
				queryKey: queryKeys.numericProfile(request),
				queryFn: ({ signal: own }) =>
					client.numericProfile(request, { signal: signal ?? own })
			}),
		stage: (request: StageRequest | StageRequestBody, signal?: AbortSignal) =>
			queryClient.fetchQuery({
				queryKey: queryKeys.stage(request),
				queryFn: ({ signal: own }) => client.stage(request, { signal: signal ?? own })
			}),
		actualValues: (request: {
			endpointUrl: string;
			subjectId: string;
			predicateId: string;
			isLiteral: true;
		}) =>
			queryClient.fetchQuery({
				queryKey: queryKeys.relationshipValue(request),
				queryFn: ({ signal }) =>
					client
						.relationshipValue(request, { signal })
						.then((items) =>
							items.map((item) => String(item.propertyLabel ?? item.propertyId ?? ''))
						)
			}),
		search: (endpointUrl: string, text: string, limit: number, signal?: AbortSignal) =>
			queryClient.fetchQuery({
				queryKey: queryKeys.search(endpointUrl, text, limit),
				queryFn: ({ signal: own }) =>
					client.search({ endpointUrl, search: text, limit }, { signal: signal ?? own })
			})
	};
}

export type CachedApi = ReturnType<typeof createCachedApi>;

/**
 * Runs `task` once the input has been quiet for `delay`; a newer input cancels
 * the pending one and aborts an in-flight one, so only the settled text is
 * requested and a stale answer is never delivered.
 */
export function createDebouncedRequest<I, O>(
	task: (input: I, signal: AbortSignal) => Promise<O>,
	{
		delay = TYPING_DEBOUNCE_MS,
		onResult,
		onError
	}: {
		delay?: number;
		onResult: (output: O, input: I) => void;
		onError?: (error: unknown, input: I) => void;
	}
) {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let controller: AbortController | null = null;
	const cancel = () => {
		if (timer !== null) clearTimeout(timer);
		timer = null;
		controller?.abort();
		controller = null;
	};
	return {
		input(value: I) {
			cancel();
			timer = setTimeout(() => {
				timer = null;
				const current = new AbortController();
				controller = current;
				task(value, current.signal).then(
					(output) => {
						if (current.signal.aborted) return;
						controller = null;
						onResult(output, value);
					},
					(error) => {
						if (current.signal.aborted) return;
						controller = null;
						onError?.(error, value);
					}
				);
			}, delay);
		},
		cancel
	};
}

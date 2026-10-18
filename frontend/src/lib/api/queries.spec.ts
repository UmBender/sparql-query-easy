import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApiClient } from './client.js';
import {
	createAppQueryClient,
	createCachedApi,
	createDebouncedRequest,
	payloadKey,
	queryKeys,
	TYPING_DEBOUNCE_MS
} from './queries.js';

const BASE = 'http://api.test';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
	server.resetHandlers();
	vi.useRealTimers();
});
afterAll(() => server.close());

const client = createApiClient({ baseUrl: BASE });

describe('cached and debounced wrappers', () => {
	it('keys requests by payload regardless of key order', () => {
		expect(payloadKey({ b: 1, a: { d: 2, c: [{ y: 1, x: 2 }] } })).toBe(
			'{"a":{"c":[{"x":2,"y":1}],"d":2},"b":1}'
		);
		const request = { endpointUrl: 'x', variableName: '?p', where: [] };
		expect(queryKeys.count(request)).toEqual(
			queryKeys.count({ where: [], variableName: '?p', endpointUrl: 'x' })
		);
	});

	it('an identical count or profile request is served from the cache', async () => {
		let counts = 0;
		let profiles = 0;
		server.use(
			http.post(`${BASE}/api/query/count`, () => {
				counts++;
				return HttpResponse.json({ data: { variableName: '?p', count: 12 } });
			}),
			http.post(`${BASE}/api/query/numeric-profile`, () => {
				profiles++;
				return HttpResponse.json({
					data: {
						subject: '?p',
						predicate: '<p>',
						count: 0,
						truncated: false,
						values: []
					}
				});
			})
		);
		const cached = createCachedApi(client, createAppQueryClient());
		const request = {
			endpointUrl: 'PokemonGen1',
			variableName: '?p',
			where: [{ subject: '?p', predicate: '<p>', object: '?o', filterType: null }]
		};
		expect(await cached.count(request)).toBe(12);
		expect(await cached.count({ ...request })).toBe(12);
		expect(counts).toBe(1);
		await cached.count({ ...request, variableName: '?o' });
		expect(counts).toBe(2);
		const profile = {
			endpointUrl: 'x',
			where: [],
			subject: '?p',
			predicate: '<p>',
			limit: 500
		};
		await cached.numericProfile(profile);
		await cached.numericProfile({ ...profile });
		expect(profiles).toBe(1);
	});

	it('N keystrokes within the debounce window send one search request for the settled text', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		const seen: string[] = [];
		server.use(
			http.post(`${BASE}/api/query/search`, async ({ request }) => {
				const body = (await request.json()) as { search: string };
				seen.push(body.search);
				return HttpResponse.json({
					data: [{ propertyId: '<x>', propertyLabel: body.search }]
				});
			})
		);
		const cached = createCachedApi(client, createAppQueryClient());
		const results: string[][] = [];
		const search = createDebouncedRequest(
			(text: string, signal) => cached.search('PokemonGen1', text, 150, signal),
			{
				onResult: (items) => results.push(items.map((item) => item.propertyLabel))
			}
		);
		for (const text of ['P', 'Pi', 'Pik', 'Pika']) {
			search.input(text);
			await vi.advanceTimersByTimeAsync(TYPING_DEBOUNCE_MS - 50);
		}
		expect(seen).toEqual([]);
		await vi.advanceTimersByTimeAsync(60);
		vi.useRealTimers();
		await vi.waitFor(() => expect(results).toEqual([['Pika']]));
		expect(seen).toEqual(['Pika']);
	});

	it('a newer input aborts an in-flight request and its answer is dropped; errors are reported', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		const results: string[] = [];
		const errors: unknown[] = [];
		const resolvers: ((value: string) => void)[] = [];
		const search = createDebouncedRequest(
			(text: string, signal: AbortSignal) =>
				new Promise<string>((resolve, reject) => {
					if (text === 'boom') return reject(new Error('failed'));
					resolvers.push(resolve);
					signal.addEventListener('abort', () => resolve(`aborted ${text}`));
				}),
			{
				delay: 100,
				onResult: (value) => results.push(value),
				onError: (error) => errors.push(error)
			}
		);
		search.input('a');
		await vi.advanceTimersByTimeAsync(100);
		search.input('b');
		await vi.advanceTimersByTimeAsync(100);
		resolvers[1]('b done');
		await Promise.resolve();
		expect(results).toEqual(['b done']);
		search.input('boom');
		await vi.advanceTimersByTimeAsync(100);
		expect(errors).toHaveLength(1);
		search.input('c');
		search.cancel();
		await vi.advanceTimersByTimeAsync(200);
		expect(resolvers).toHaveLength(2);
	});
});

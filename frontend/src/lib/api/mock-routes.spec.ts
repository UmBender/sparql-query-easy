/**
 * QUAL-007: the OpenAPI-typed mock routes serve every route the client calls
 * through MSW, and each one is documented in the OpenAPI snapshot.
 */
import { readFileSync } from 'node:fs';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from './client.js';
import { mockRoutes, mswHandlers, UPLOADED_GRAPH_ID } from './mock-routes.js';

const BASE = 'http://api.test';
const server = setupServer(...mswHandlers(BASE));
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

const client = createApiClient({ baseUrl: BASE });
const snapshot = JSON.parse(readFileSync(new URL('./openapi.json', import.meta.url), 'utf8')) as {
	paths: Record<string, Record<string, unknown>>;
};

describe('OpenAPI-typed mock routes', () => {
	it('are documented in the OpenAPI snapshot', () => {
		for (const route of mockRoutes)
			expect(
				snapshot.paths[route.path]?.[route.method],
				`${route.method} ${route.path}`
			).toBeTruthy();
	});

	it('answer every client call through MSW', async () => {
		const context = { endpointUrl: 'PokemonGen1' };
		expect(await client.health()).toEqual({ status: 'ok' });
		expect((await client.endpoints()).map((item) => item.id)).toContain('PokemonGen1');
		expect(await client.upload(new Blob(['<a> <b> <c> .']), 'data.ttl')).toBe(
			UPLOADED_GRAPH_ID
		);
		expect(await client.search({ ...context, search: 'Team', limit: 150 })).toHaveLength(1);
		expect(
			await client.relationships({
				...context,
				elementId: '<https://example.test/team-a>'
			} as never)
		).toHaveLength(1);
		expect(await client.relationshipValue({ ...context } as never)).toHaveLength(1);
		const stage = await client.stage({
			...context,
			variableName: '?pokemon',
			where: [],
			bindings: [],
			limit: 50,
			offset: 0
		});
		expect(stage).toMatchObject({ variableName: '?pokemon', limit: 50, candidates: [] });
		expect(
			await client.numericProfile({
				...context,
				subject: '?p',
				predicate: '<speed>'
			} as never)
		).toMatchObject({ subject: '?p', predicate: '<speed>', count: 0 });
		expect(await client.count({ ...context, variableName: '?p' } as never)).toMatchObject({
			variableName: '?p',
			count: 0
		});
		expect(await client.query({ ...context } as never)).toEqual([]);
		expect(await client.sparql({ ...context } as never)).toContain('SELECT DISTINCT');
	});
});

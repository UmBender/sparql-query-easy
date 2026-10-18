/**
 * Deterministic API responses typed from the OpenAPI snapshot (QUAL-007):
 * the defaults of the retired legacy test server. Vitest serves them through
 * MSW (`mswHandlers`); the Playwright suites serve the same routes with
 * `page.route` (tests/support/mock-api.ts). A response that drifts from
 * schema.d.ts fails `npm run check`.
 */
import { http, HttpResponse } from 'msw';
import type { paths } from './schema.js';

type Method = 'get' | 'post';
type Operation<P extends keyof paths, M extends Method> = paths[P][M];
/** The JSON body of the 200 (or 201) response. */
type Ok<O> = O extends { responses: { 200: { content: { 'application/json': infer B } } } }
	? B
	: O extends { responses: { 201: { content: { 'application/json': infer C } } } }
		? C
		: never;
/** A non-200 answer: an `ErrorResponse`, or no body (204). */
export type MockStatus = { status: number; json?: { error: string } };
/** The JSON request body; null for GET and multipart routes. */
type In<O> = O extends { requestBody: { content: { 'application/json': infer B } } } ? B : null;

export type MockRoute = {
	method: Method;
	path: keyof paths;
	respond(body: unknown): unknown;
};

function route<P extends keyof paths, M extends Method>(
	method: M,
	path: P,
	respond: (body: In<Operation<P, M>>) => Ok<Operation<P, M>> | MockStatus
): MockRoute {
	return { method, path, respond: respond as (body: unknown) => unknown };
}

export const UPLOADED_GRAPH_ID = '00000000-0000-0000-0000-000000000001';

export const mockRoutes: MockRoute[] = [
	route('get', '/health', () => ({ status: 'ok', database: 'not-configured' })),
	route('get', '/api/endpoints', () => ({
		data: [
			{ id: 'CampeonatoBrasileiro2023', label: 'Campeonato Brasileiro 2023', kind: 'local' },
			{ id: 'PokemonGen1', label: 'Pokémon (generation 1)', kind: 'local' },
			{ id: 'https://query.wikidata.org/sparql', label: 'Wikidata', kind: 'remote' }
		]
	})),
	route('post', '/api/local-database', () => ({ data: UPLOADED_GRAPH_ID })),
	route('post', '/api/query/search', () => ({
		data: [
			{
				propertyId: '<https://example.test/team-a>',
				propertyLabel: 'Team A',
				propertyType: 'objetoClasse',
				propertyClass: null
			}
		]
	})),
	route('post', '/api/query/relationships', () => ({
		data: [
			{
				propertyId: '<https://example.test/hasName>',
				propertyLabel: 'name',
				propertyType: 'label',
				propertyClass: null
			}
		]
	})),
	route('post', '/api/query/relationship-value', () => ({
		data: [
			{
				propertyId: 'Team A',
				propertyLabel: 'Team A',
				propertyType: 'text',
				propertyClass: null
			}
		]
	})),
	route('post', '/api/query', () => ({ data: [] })),
	route('post', '/api/query/stage', (body) => ({
		data: {
			variableName: body.variableName ?? '',
			offset: body.offset ?? 0,
			limit: body.limit ?? 20,
			hasMore: false,
			candidates: []
		}
	})),
	route('post', '/api/query/numeric-profile', (body) => ({
		data: {
			subject: body.subject ?? '',
			predicate: body.predicate ?? '',
			count: 0,
			min: null,
			max: null,
			truncated: false,
			values: []
		}
	})),
	route('post', '/api/query/count', (body) => ({
		data: { variableName: body.variableName ?? '', count: 0 }
	})),
	route('post', '/api/query/sparql', () => ({
		data: 'SELECT DISTINCT ?item WHERE { ?item ?p ?o } LIMIT 20'
	})),
	// AUTH-001: anonymous by default; register and login accept anyone.
	route('get', '/api/auth/session', () => ({ status: 401, json: { error: 'Login required' } })),
	route('post', '/api/auth/register', (body) => ({ data: { username: body.username ?? '' } })),
	route('post', '/api/auth/login', (body) => ({ data: { username: body.username ?? '' } })),
	route('post', '/api/auth/logout', () => ({ status: 204 }))
];

export function isMockStatus(response: unknown): response is MockStatus {
	return (
		!!response &&
		typeof response === 'object' &&
		'status' in response &&
		typeof (response as MockStatus).status === 'number'
	);
}

export function mockRouteFor(path: string): MockRoute | undefined {
	return mockRoutes.find((item) => item.path === path);
}

/** MSW handlers for every route, under `base` (e.g. `http://api.test`). */
export function mswHandlers(base = '') {
	return mockRoutes.map((item) =>
		http[item.method](base + item.path, async ({ request }) => {
			const json = request.headers.get('content-type')?.includes('application/json');
			const response = item.respond(json ? await request.json() : null);
			if (!isMockStatus(response)) return HttpResponse.json(response as never);
			return response.json
				? HttpResponse.json(response.json, { status: response.status })
				: new HttpResponse(null, { status: response.status });
		})
	);
}

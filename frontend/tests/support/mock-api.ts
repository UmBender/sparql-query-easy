import type { Page, Route } from '@playwright/test';

/**
 * Deterministic API for the new app's browser tests, with the legacy
 * frontend-tests/server.mjs defaults. Tests override routes with `page.route`
 * after calling this; every request body is recorded.
 */
export type RecordedRequest = { method: string; path: string; body: unknown };

export type Override = (
	body: Record<string, unknown> | null
) => unknown | { status: number; json: unknown };
export type MockApi = {
	requests: RecordedRequest[];
	/** Replaces the response of one path; requests are still recorded. */
	override(path: string, respond: Override): void;
	bodies(path: string): unknown[];
};

export async function mockApi(page: Page): Promise<MockApi> {
	const requests: RecordedRequest[] = [];
	const overrides = new Map<string, Override>();
	await page.route(
		(url) => url.pathname.startsWith('/api/') || url.pathname === '/health',
		async (route: Route) => {
			const request = route.request();
			const url = new URL(request.url());
			const text = request.postData();
			let body: unknown;
			try {
				body = text ? JSON.parse(text) : null;
			} catch {
				body = text;
			}
			requests.push({ method: request.method(), path: url.pathname, body });
			const override = overrides.get(url.pathname);
			const response = override
				? await override(body as Record<string, unknown> | null)
				: defaultResponse(url.pathname, body as Record<string, unknown> | null);
			if (
				response &&
				typeof response === 'object' &&
				'status' in response &&
				'json' in response
			) {
				const { status, json } = response as { status: number; json: unknown };
				return route.fulfill({ status, json });
			}
			return route.fulfill({ json: response });
		}
	);
	return {
		requests,
		override: (path, respond) => void overrides.set(path, respond),
		bodies: (path) =>
			requests.filter((request) => request.path === path).map((request) => request.body)
	};
}

function defaultResponse(path: string, body: Record<string, unknown> | null): unknown {
	switch (path) {
		case '/health':
			return { status: 'ok' };
		case '/api/endpoints':
			return {
				data: [
					{
						id: 'CampeonatoBrasileiro2023',
						label: 'Campeonato Brasileiro 2023',
						kind: 'local'
					},
					{ id: 'PokemonGen1', label: 'Pokémon (generation 1)', kind: 'local' },
					{ id: 'https://query.wikidata.org/sparql', label: 'Wikidata', kind: 'remote' }
				]
			};
		case '/api/local-database':
			return { data: '00000000-0000-0000-0000-000000000001' };
		case '/api/query/search':
			return {
				data: [
					{
						propertyId: '<https://example.test/team-a>',
						propertyLabel: 'Team A',
						propertyType: 'objetoClasse',
						propertyClass: null
					}
				]
			};
		case '/api/query/relationships':
			return {
				data: [
					{
						propertyId: '<https://example.test/hasName>',
						propertyLabel: 'name',
						propertyType: 'label',
						propertyClass: null
					}
				]
			};
		case '/api/query/relationship-value':
			return {
				data: [
					{
						propertyId: 'Team A',
						propertyLabel: 'Team A',
						propertyType: 'text',
						propertyClass: null
					}
				]
			};
		case '/api/query/stage':
			return {
				data: {
					variableName: body?.variableName,
					offset: body?.offset ?? 0,
					limit: body?.limit ?? 20,
					hasMore: false,
					candidates: []
				}
			};
		case '/api/query/numeric-profile':
			return {
				data: {
					subject: body?.subject,
					predicate: body?.predicate,
					count: 0,
					min: null,
					max: null,
					truncated: false,
					values: []
				}
			};
		case '/api/query/count':
			return { data: { variableName: body?.variableName, count: 0 } };
		case '/api/query/sparql':
			return { data: 'SELECT DISTINCT ?item WHERE { ?item ?p ?o } LIMIT 20' };
		default:
			return { data: [] };
	}
}

import type { Page, Route } from '@playwright/test';
import { isMockStatus, mockRouteFor } from '../../src/lib/api/mock-routes';

/**
 * Deterministic API for the new app's browser tests: the OpenAPI-typed
 * routes of src/lib/api/mock-routes.ts (legacy frontend-tests/server.mjs defaults). Tests override routes with `page.route`
 * after calling this; every request body is recorded.
 */
export type RecordedRequest = { method: string; path: string; body: unknown };

export type Override = (
	body: Record<string, unknown> | null
) => unknown | { status: number; json?: unknown };
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
			if (isMockStatus(response))
				return response.json
					? route.fulfill({ status: response.status, json: response.json })
					: route.fulfill({ status: response.status });
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
	return mockRouteFor(path)?.respond(body) ?? { data: [] };
}

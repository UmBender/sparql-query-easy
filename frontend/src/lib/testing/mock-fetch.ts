/**
 * QUAL-012: answer `globalThis.fetch` from MSW handlers in either Vitest
 * project, without a service worker (browser mode) or `setupServer` (node).
 * A request no handler answers rejects, like MSW's `onUnhandledRequest: 'error'`.
 * Undo with `vi.unstubAllGlobals()`.
 */
import { getResponse, type RequestHandler } from 'msw';
import { vi } from 'vitest';

export function mockFetch(...handlers: RequestHandler[]) {
	const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const request =
			input instanceof Request
				? new Request(input, init)
				: new Request(
						new URL(String(input), globalThis.location?.href ?? 'http://localhost/'),
						init
					);
		const response = await getResponse(handlers, request);
		if (!response) throw new Error(`No mock for ${request.method} ${request.url}`);
		return response;
	});
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

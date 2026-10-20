/**
 * QUAL-012: MSW handlers that answer a legacy scenario's routes with its
 * captured responses, in captured order per method and path. A request beyond
 * the captured ones answers 500, so a test that calls a route more often than
 * the legacy page did fails visibly instead of reusing a stale answer.
 */
import { http, HttpResponse, type HttpHandler } from 'msw';
import { loadFixture } from './fixtures.js';

export function fixtureHandlers(name: string, base = ''): HttpHandler[] {
	const fixture = loadFixture(name);
	const queues = new Map<string, { method: string; path: string; answers: unknown[] }>();
	fixture.requests.forEach((request, index) => {
		const key = `${request.method} ${request.path}`;
		const queue = queues.get(key) ?? {
			method: request.method,
			path: request.path,
			answers: []
		};
		queue.answers.push(fixture.responses[index]);
		queues.set(key, queue);
	});
	return [...queues.values()].map((queue) => {
		const pending = [...queue.answers] as { status: number; body: unknown }[];
		const method = queue.method.toLowerCase() as 'get' | 'post';
		return http[method](base + queue.path, () => {
			const next = pending.shift();
			if (!next)
				return HttpResponse.json(
					{
						error: `${name}: no more captured responses for ${queue.method} ${queue.path}`
					},
					{ status: 500 }
				);
			return HttpResponse.json(next.body as never, { status: next.status });
		});
	});
}

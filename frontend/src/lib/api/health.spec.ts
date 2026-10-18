import { describe, expect, it } from 'vitest';
import { fetchHealth } from './health.js';

const respond = (body: unknown, status = 200) =>
	(async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

describe('fetchHealth', () => {
	it('returns the approved health body', async () => {
		expect(await fetchHealth(respond({ status: 'ok' }))).toEqual({
			ok: true,
			health: { status: 'ok' }
		});
	});

	it('reports an HTTP failure, an unexpected body and a network error', async () => {
		expect(await fetchHealth(respond({}, 502))).toEqual({ ok: false, error: 'HTTP 502' });
		expect(await fetchHealth(respond('ok'))).toEqual({
			ok: false,
			error: 'Unexpected /health body'
		});
		const offline = (async () => {
			throw new TypeError('Failed to fetch');
		}) as typeof fetch;
		expect(await fetchHealth(offline)).toEqual({ ok: false, error: 'Failed to fetch' });
	});
});

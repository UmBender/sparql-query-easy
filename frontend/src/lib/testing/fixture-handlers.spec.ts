/**
 * QUAL-012: the typed client against MSW answering with a scenario's
 * captured responses, in captured order.
 */
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '#lib/api/client.js';
import { fixtureHandlers } from './fixture-handlers.js';
import { loadFixture } from './fixtures.js';

const BASE = 'http://api.test';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const client = createApiClient({ baseUrl: BASE });
const body = (name: string, path: string, nth = 0) =>
	loadFixture(name).requests.filter((request) => request.path === path)[nth].body as never;

describe('fixtureHandlers', () => {
	it('answers each route with its captured responses in order', async () => {
		server.use(...fixtureHandlers('fire-speed-at-least-90', BASE));
		const path = '/api/query/count';
		expect(await client.count(body('fire-speed-at-least-90', path, 0))).toEqual({
			variableName: '?pokemon',
			count: 12
		});
		expect(await client.count(body('fire-speed-at-least-90', path, 1))).toEqual({
			variableName: '?pokemon',
			count: 7
		});
		const page = await client.stage(body('fire-speed-at-least-90', '/api/query/stage'));
		expect(page.candidates.map((candidate) => candidate.label).sort()).toEqual([
			'Arcanine',
			'Charizard',
			'Magmar',
			'Moltres',
			'Ninetales',
			'Ponyta',
			'Rapidash'
		]);
	});

	it('answers a captured error status and fails once the captured answers run out', async () => {
		server.use(...fixtureHandlers('filter-max-tie', BASE));
		const stage = body('filter-max-tie', '/api/query/stage');
		await expect(client.stage(stage)).rejects.toMatchObject({ status: 400 });
		await expect(client.stage(stage)).rejects.toMatchObject({
			status: 500,
			message: expect.stringContaining('no more captured responses for POST /api/query/stage')
		});
	});
});

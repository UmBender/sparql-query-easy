import { readFileSync } from 'node:fs';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
	ApiError,
	createApiClient,
	formResponsesCsvPath,
	isAbort,
	questionErrors
} from './client.js';

const BASE = 'http://api.test';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const client = createApiClient({ baseUrl: BASE });
const fixture = (name: string) =>
	JSON.parse(
		readFileSync(
			new URL(`../../../../fixtures/legacy/${name}.response.json`, import.meta.url),
			'utf8'
		)
	) as { status: number; body: unknown }[];

const stageBody = {
	endpointUrl: 'PokemonGen1',
	variableName: '?pokemon',
	where: [],
	bindings: [],
	limit: 50,
	offset: 0
};

describe('typed API client', () => {
	it('returns the data of a DataResponse, using captured backend responses', async () => {
		const [stage] = fixture('fire-speed-at-least-90').filter(
			(item) => (item.body as { data?: { candidates?: unknown } }).data?.candidates
		);
		let sent: unknown;
		server.use(
			http.post(`${BASE}/api/query/stage`, async ({ request }) => {
				sent = await request.json();
				return HttpResponse.json(stage.body as Record<string, unknown>);
			})
		);
		const page = await client.stage(stageBody);
		expect(sent).toEqual(stageBody);
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

	it('maps 400, 404, 502 and other statuses with the server message or a route fallback', async () => {
		const cases: [number, string, unknown][] = [
			[
				400,
				'bad-request',
				{ error: 'Maximum and Minimum filters are not supported in staged exploration' }
			],
			[404, 'not-found', { error: 'Local graph not found' }],
			[502, 'upstream', { error: 'Upstream SPARQL endpoint failed' }],
			[500, 'server', null]
		];
		for (const [status, kind, body] of cases) {
			server.use(
				http.post(`${BASE}/api/query/count`, () =>
					body
						? HttpResponse.json(body, { status })
						: new HttpResponse('oops', { status })
				)
			);
			const error = await client
				.count({ endpointUrl: 'x', variableName: '?p', where: [] })
				.catch((caught) => caught);
			expect(error).toBeInstanceOf(ApiError);
			expect(error).toMatchObject({
				kind,
				status,
				message: body ? (body as { error: string }).error : 'Count failed (500).'
			});
		}
	});

	it('reports a 200 with the wrong shape, a network failure and an abort distinctly', async () => {
		server.use(
			http.post(`${BASE}/api/query/count`, () =>
				HttpResponse.json({ data: { count: 'many' } })
			)
		);
		await expect(
			client.count({ endpointUrl: 'x', variableName: '?p', where: [] })
		).rejects.toMatchObject({ kind: 'unexpected', message: 'Unexpected count response.' });
		server.use(http.post(`${BASE}/api/query/stage`, () => HttpResponse.error()));
		await expect(client.stage(stageBody)).rejects.toMatchObject({ kind: 'network' });
		server.use(http.post(`${BASE}/api/query/stage`, () => new Promise(() => {})));
		const controller = new AbortController();
		const pending = client.stage(stageBody, { signal: controller.signal });
		controller.abort();
		const error = await pending.catch((caught) => caught);
		expect(isAbort(error)).toBe(true);
		expect(isAbort(new Error('x'))).toBe(false);
	});

	it('covers every route the app calls', async () => {
		server.use(
			http.get(`${BASE}/health`, () =>
				HttpResponse.json({ status: 'ok', database: 'ready' })
			),
			http.get(`${BASE}/api/endpoints`, () =>
				HttpResponse.json({
					data: [{ id: 'PokemonGen1', label: 'Pokémon', kind: 'local' }]
				})
			),
			http.post(`${BASE}/api/local-database`, async ({ request }) => {
				const form = await request.formData();
				const file = form.get('ttlFile') as File;
				return HttpResponse.json({ data: `uploaded:${file.name}:${await file.text()}` });
			}),
			http.post(`${BASE}/api/query/relationships`, () =>
				HttpResponse.json({
					data: [{ propertyId: '<p>', propertyLabel: 'Speed', propertyType: 'label' }]
				})
			),
			http.post(`${BASE}/api/query/relationship-value`, () =>
				HttpResponse.json({
					data: [{ propertyId: '90', propertyLabel: '90', propertyType: 'text' }]
				})
			),
			http.post(`${BASE}/api/query/search`, () =>
				HttpResponse.json({ data: [{ propertyId: '<a>', propertyLabel: 'A' }] })
			),
			http.post(`${BASE}/api/query`, () => HttpResponse.json({ data: [] })),
			http.post(`${BASE}/api/query/numeric-profile`, () =>
				HttpResponse.json({
					data: {
						subject: '?p',
						predicate: '<p>',
						count: 0,
						truncated: false,
						values: []
					}
				})
			),
			http.post(`${BASE}/api/query/sparql`, () =>
				HttpResponse.json({ data: 'SELECT * WHERE {}' })
			)
		);
		expect(await client.health()).toEqual({ status: 'ok', database: 'ready' });
		expect(await client.endpoints()).toHaveLength(1);
		expect(await client.upload(new Blob(['@prefix x: <x:> .']), 'g.ttl')).toBe(
			'uploaded:g.ttl:@prefix x: <x:> .'
		);
		expect((await client.relationships({ endpointUrl: 'x', id: '<a>' }))[0].propertyLabel).toBe(
			'Speed'
		);
		expect(
			await client.relationshipValue({
				endpointUrl: 'x',
				subjectId: '<a>',
				predicateId: '<p>',
				isLiteral: true
			})
		).toHaveLength(1);
		expect(await client.search({ endpointUrl: 'x', search: 'a', limit: 5 })).toHaveLength(1);
		expect(
			await client.query({ endpointUrl: 'x', where: [], variableName: '?x', limit: 1 })
		).toEqual([]);
		expect(
			(
				await client.numericProfile({
					endpointUrl: 'x',
					where: [],
					subject: '?p',
					predicate: '<p>',
					limit: 1
				})
			).count
		).toBe(0);
		expect(
			await client.sparql({ endpointUrl: 'x', where: [], variableName: '?x', limit: 1 })
		).toBe('SELECT * WHERE {}');
	});

	it('health and upload failures are typed too', async () => {
		server.use(
			http.get(`${BASE}/health`, () => new HttpResponse(null, { status: 503 })),
			http.post(`${BASE}/api/local-database`, () =>
				HttpResponse.json({ error: 'Invalid Turtle' }, { status: 400 })
			)
		);
		// AUTH-001 statuses have their own kinds; any other failure is `server`.
		await expect(client.health()).rejects.toMatchObject({ kind: 'unavailable', status: 503 });
		server.use(http.get(`${BASE}/health`, () => new HttpResponse(null, { status: 500 })));
		await expect(client.health()).rejects.toMatchObject({ kind: 'server', status: 500 });
		await expect(client.upload(new Blob(['x']), 'x.ttl')).rejects.toMatchObject({
			kind: 'bad-request',
			message: 'Invalid Turtle'
		});
		server.use(http.get(`${BASE}/health`, () => HttpResponse.json({ nope: true })));
		await expect(client.health()).rejects.toMatchObject({ kind: 'unexpected' });
		server.use(http.get(`${BASE}/health`, () => HttpResponse.error()));
		await expect(client.health()).rejects.toMatchObject({ kind: 'network' });
	});

	it('keeps the error per question of a questionnaire 400 (STUDY-010)', async () => {
		let sent: unknown;
		server.use(
			http.post(`${BASE}/api/study/forms/profile/responses`, async ({ request }) => {
				sent = await request.json();
				return HttpResponse.json(
					{
						error: 'Some answers are not valid',
						errors: { programming_years: 'Enter a number from 0 to 60.' }
					},
					{ status: 400 }
				);
			})
		);
		const failure = await client.study
			.submitForm('profile', 1, { programming_years: 99 })
			.catch((error: unknown) => error);
		expect(sent).toEqual({ version: 1, answers: { programming_years: 99 } });
		expect(failure).toBeInstanceOf(ApiError);
		expect((failure as ApiError).message).toBe('Some answers are not valid');
		expect(questionErrors(failure)).toEqual({
			programming_years: 'Enter a number from 0 to 60.'
		});
		expect(questionErrors(new ApiError('conflict', 'Already answered', 409))).toBeNull();
		expect(
			questionErrors(new ApiError('bad-request', 'Missing answers', 400, { error: 'x' }))
		).toBeNull();
	});

	it('links the CSV export to the documented admin route (STUDY-011)', () => {
		const spec = JSON.parse(
			readFileSync(new URL('./openapi.json', import.meta.url), 'utf8')
		) as {
			paths: Record<string, unknown>;
		};
		expect(spec.paths).toHaveProperty(['/api/admin/forms/{slug}/responses.csv']);
		expect(formResponsesCsvPath('profile')).toBe('/api/admin/forms/profile/responses.csv');
		expect(formResponsesCsvPath('a b')).toBe('/api/admin/forms/a%20b/responses.csv');
	});
});

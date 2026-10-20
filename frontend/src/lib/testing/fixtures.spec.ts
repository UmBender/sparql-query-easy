/**
 * QUAL-012: every legacy fixture loads by name and keeps the request and
 * response shapes the OpenAPI snapshot documents (the contract `schema.d.ts`
 * is generated from). A mismatch is an API or oracle difference to
 * investigate, never a reason to edit the fixture.
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_NAMES, loadFixture } from './fixtures.js';
import { fixtureShapeIssues } from './openapi-shapes.js';

describe('legacy fixtures by name', () => {
	it('lists the 24 captured scenarios', () => {
		expect(FIXTURE_NAMES).toHaveLength(24);
		expect(FIXTURE_NAMES).toContain('fire-speed-at-least-90');
	});

	it('loads the requests, responses, SPARQL and export of a scenario', () => {
		const fixture = loadFixture('fire-speed-at-least-90');
		expect(fixture.requests[0]).toMatchObject({ method: 'POST', path: '/api/query/count' });
		expect(fixture.responses).toHaveLength(fixture.requests.length);
		expect(fixture.sparql).toMatch(/^PREFIX rdf:/);
		expect(fixture.exported).toBeTruthy();
		expect(loadFixture('filter-contains').exported).toBeUndefined();
	});

	it('fails on an unknown name, listing the known ones', () => {
		expect(() => loadFixture('no-such-scenario')).toThrow(
			/Unknown legacy fixture "no-such-scenario"\. Known: .*fire-speed-at-least-90/
		);
	});
});

describe('legacy fixture shapes match the OpenAPI snapshot', () => {
	it.each(FIXTURE_NAMES)('%s', (name) => {
		expect(fixtureShapeIssues(loadFixture(name))).toEqual([]);
	});

	it('names the file and field of a changed field type', () => {
		const fixture = structuredClone(loadFixture('fire-speed-at-least-90'));
		const stage = fixture.responses.findIndex(
			(response) => (response.body as { data?: { candidates?: unknown } }).data?.candidates
		);
		(
			fixture.responses[stage].body as { data: { candidates: { selectable: unknown }[] } }
		).data.candidates[0].selectable = 'yes';
		expect(fixtureShapeIssues(fixture)).toEqual([
			`fire-speed-at-least-90.response.json[${stage}] data.candidates.0.selectable: Invalid input: expected boolean, received string`
		]);
	});

	it('reports an undocumented route and a request filter outside the enum', () => {
		const fixture = structuredClone(loadFixture('filter-contains'));
		fixture.requests[0].path = '/api/query/unknown';
		(fixture.requests[1].body as { where: { filterType: unknown }[] }).where[0].filterType = 9;
		expect(fixtureShapeIssues(fixture)).toEqual([
			'filter-contains.request.json[0] POST /api/query/unknown: not in the OpenAPI snapshot',
			'filter-contains.request.json[1] where.0.filterType: expected one of 0, 1, 2, 3, 4, 5, 6, null'
		]);
	});
});

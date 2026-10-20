/**
 * FE-043 contract: schema.d.ts is generated from openapi.json (its header
 * records the snapshot's hash), and the Kotlin test FrontendOpenApiSnapshotTest
 * keeps openapi.json equal to Ktor's /openapi.json. Either drift fails a test.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const snapshot = readFileSync(new URL('./openapi.json', import.meta.url));
const schema = readFileSync(new URL('./schema.d.ts', import.meta.url), 'utf8');
const document = JSON.parse(snapshot.toString('utf8')) as {
	paths: Record<string, Record<string, unknown>>;
};

describe('generated API types', () => {
	it('were generated from the current OpenAPI snapshot', () => {
		const hash = createHash('sha256').update(snapshot).digest('hex');
		expect(
			schema.split('\n')[0],
			'run `npm run api:types` after refreshing openapi.json'
		).toContain(`sha256:${hash}`);
	});

	it('the snapshot documents every route the client calls', () => {
		const called: [string, string][] = [
			['/health', 'get'],
			['/api/endpoints', 'get'],
			['/api/local-database', 'post'],
			['/api/query', 'post'],
			['/api/query/relationships', 'post'],
			['/api/query/relationship-value', 'post'],
			['/api/query/search', 'post'],
			['/api/query/stage', 'post'],
			['/api/query/numeric-profile', 'post'],
			['/api/query/count', 'post'],
			['/api/query/sparql', 'post'],
			['/api/admin/tasks', 'get'],
			['/api/admin/tasks', 'post'],
			['/api/admin/tasks/preview', 'post'],
			['/api/admin/tasks/{key}', 'get'],
			['/api/admin/tasks/{key}', 'put'],
			['/api/admin/tasks/{key}/deactivate', 'post'],
			['/api/admin/tasks/{key}/reactivate', 'post'],
			['/api/admin/participants', 'get'],
			['/api/admin/groups', 'get'],
			['/api/admin/groups', 'post'],
			['/api/admin/groups/{id}', 'get'],
			['/api/admin/groups/{id}', 'put'],
			['/api/admin/groups/{id}/tasks', 'put'],
			['/api/admin/groups/{id}/members', 'post'],
			['/api/admin/groups/{id}/members/remove', 'post'],
			['/api/admin/groups/{id}/delete', 'post'],
			['/api/study/tasks', 'get'],
			['/api/study/tasks/{key}', 'get'],
			['/api/study/tasks/{key}/submissions', 'post'],
			['/api/study/submissions', 'get']
		];
		for (const [path, method] of called)
			expect(document.paths[path]?.[method], `${method} ${path}`).toBeTruthy();
	});
});

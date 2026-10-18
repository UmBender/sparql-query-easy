import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = new URL('.', import.meta.url).pathname;

function* sources(dir: string): Generator<string> {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) yield* sources(path);
		else if (/\.ts$/.test(name) && !/\.spec\.ts$/.test(name)) yield path;
	}
}

describe('domain boundary (FE-042)', () => {
	it('no domain module imports svelte, cytoscape or @tanstack', () => {
		const offenders: string[] = [];
		for (const file of sources(root)) {
			const text = readFileSync(file, 'utf8');
			for (const match of text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
				if (/^(svelte|cytoscape|@tanstack)(\/|$)/.test(match[1]))
					offenders.push(`${file}: ${match[1]}`);
			}
		}
		expect(offenders).toEqual([]);
	});
});

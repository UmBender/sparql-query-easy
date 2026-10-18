import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = new URL('../../../scripts/check-raw-colors.mjs', import.meta.url).pathname;
const run = (dir?: string) =>
	spawnSync('node', dir ? [script, dir] : [script], { encoding: 'utf8' });

describe('raw color check', () => {
	it('fails on a planted hex color in a component', () => {
		const dir = mkdtempSync(join(tmpdir(), 'raw-colors-'));
		try {
			writeFileSync(
				join(dir, 'Planted.svelte'),
				'<p style="color: #ff0000">x</p>\n<a href="#lib/top">ok</a>\n'
			);
			const result = run(dir);
			expect(result.status).toBe(1);
			expect(result.stderr).toContain('Planted.svelte:1: #ff0000');
			expect(result.stderr).not.toContain('#lib');
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('passes on the source tree', () => {
		expect(run().status).toBe(0);
	});
});

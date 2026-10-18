import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tokenCss } from './css.js';

const GENERATED = new URL('./tokens.generated.css', import.meta.url);

describe('generated token stylesheet', () => {
	// `npm run tokens` sets UPDATE_TOKENS to rewrite the file after a token change.
	it('matches tokens.ts', () => {
		if (process.env.UPDATE_TOKENS) writeFileSync(GENERATED, tokenCss());
		expect(readFileSync(GENERATED, 'utf8')).toBe(tokenCss());
	});
});

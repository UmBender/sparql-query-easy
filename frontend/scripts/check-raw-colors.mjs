#!/usr/bin/env node
// FE-041: colors are defined only in src/lib/design/ (tokens.ts). Any raw hex
// color elsewhere in src/ fails `npm run lint`. The legacy sparql/ page is not
// checked. An optional argument checks another directory (used by its test).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const src = resolve(root, process.argv[2] ?? 'src');
// src/lib/domain/legacy/ holds verbatim ports of the legacy modules (FE-042);
// their color values are oracle data for tests, not UI styles.
const allowed = [join(root, 'src/lib/design'), join(root, 'src/lib/domain/legacy')];
const HEX = /(?<![\w&/-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;

function* files(dir) {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) {
			if (!allowed.includes(path)) yield* files(path);
		} else if (/\.(svelte|ts|js|css|html)$/.test(name)) yield path;
	}
}

const found = [];
for (const file of files(src)) {
	readFileSync(file, 'utf8')
		.split('\n')
		.forEach((line, index) => {
			for (const match of line.matchAll(HEX))
				found.push(`${relative(root, file)}:${index + 1}: ${match[0]}`);
		});
}
if (found.length) {
	console.error(
		`Raw colors outside src/lib/design/ (use a token):\n${found.map((item) => `  ${item}`).join('\n')}`
	);
	process.exit(1);
}
console.log('No raw colors outside src/lib/design/.');

#!/usr/bin/env node
// QUAL-010: every request field seen in fixtures/legacy/*.request.json must
// have a row in the matching section of tcc/04 - Frontend/Legacy Wire Format.md.
// Nested fields are written as `where[].subject`.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const fixtures = join(root, 'fixtures/legacy');
const note = readFileSync(join(root, 'tcc/04 - Frontend/Legacy Wire Format.md'), 'utf8');

const documented = new Map();
let section = null;
for (const line of note.split('\n')) {
  const heading = line.match(/^### `(\w+ \/\S+)`/);
  if (heading) { section = heading[1]; documented.set(section, new Set()); continue; }
  if (line.startsWith('## ')) section = null;
  if (!section || !line.startsWith('| `')) continue;
  const firstCell = line.split('|')[1];
  for (const [, field] of firstCell.matchAll(/`([^`]+)`/g)) documented.get(section).add(field);
}

function fields(value, prefix, found) {
  if (Array.isArray(value)) value.forEach(item => fields(item, `${prefix}[]`, found));
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      found.add(path);
      fields(item, path, found);
    }
  }
  return found;
}

const missing = [];
for (const name of readdirSync(fixtures).filter(file => file.endsWith('.request.json'))) {
  for (const request of JSON.parse(readFileSync(join(fixtures, name), 'utf8'))) {
    const key = `${request.method} ${request.path}`;
    for (const field of fields(request.body, '', new Set())) {
      if (!documented.get(key)?.has(field)) missing.push(`${key} ${field} (${name})`);
    }
  }
}
const unique = [...new Set(missing.map(item => item.replace(/ \(.*\)$/, '')))];
if (unique.length) {
  console.error(`Undocumented legacy request fields:\n${unique.map(item => `  ${item}`).join('\n')}`);
  process.exit(1);
}
console.log(`Every request field in ${fixtures} is documented in Legacy Wire Format.md.`);

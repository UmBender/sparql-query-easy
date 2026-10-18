#!/usr/bin/env node
// QUAL-008: regenerate fixtures/legacy/ from the legacy page and the real Ktor
// backend. Without arguments every fixture is deleted first, so a removed
// scenario leaves no stale file; with Playwright filters (for example
// `-- --grep fire`) only the matching scenarios are rewritten.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dir = join(root, 'fixtures/legacy');
const args = process.argv.slice(2);

if (!args.length) {
  for (const name of readdirSync(dir)) {
    if (/\.(request|response|export)\.json$|\.sparql$/.test(name)) rmSync(join(dir, name));
  }
}
const result = spawnSync('npx', ['playwright', 'test', '--config', 'playwright.fixtures.config.mjs', ...args], { cwd: root, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
// QUAL-010: every captured request field must be documented.
const fieldCheck = join(root, 'scripts/check-legacy-fixture-fields.mjs');
if (existsSync(fieldCheck)) {
  const check = spawnSync('node', [fieldCheck], { cwd: root, stdio: 'inherit' });
  process.exit(check.status ?? 1);
}

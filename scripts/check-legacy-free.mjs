#!/usr/bin/env node
// QUAL-018: the retired legacy page (FE-049) stays retired. Fails on a tracked
// sparql/ or frontend-tests/ path, an index2.html or login.html, tracked CSS
// outside frontend/src/, a jQuery, Materialize or Intro.js dependency in any
// package.json or lockfile, and `jquery` or `$.ajax` in tracked source.
// History and the legacy test oracles kept by DEC-018 Q2 are allowed.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RETIRED_DIRS = ['sparql/', 'frontend-tests/'];
const RETIRED_FILES = /(^|\/)(index2|login)\.html$/;
const LEGACY_PACKAGES = new Set(['jquery', 'materialize-css', 'materialize', 'intro.js', 'introjs']);
const SOURCE = /\.(m?js|cjs|ts|svelte|html|kts?|java|css)$/;
const LEGACY_CODE = /jquery|\$\.ajax\s*\(/i;
// History, the frozen request oracle, the kept legacy ports and vendored build, and this check.
const ALLOWED = [
  'tcc/',
  'MIGRATION.md',
  'MIGRATION_REPORT.md',
  'fixtures/legacy/',
  'frontend/src/lib/domain/legacy/',
  'scripts/check-legacy-free'
];

const allowed = file => ALLOWED.some(prefix => file.startsWith(prefix));

function legacyDependencies(file, text) {
  const json = JSON.parse(text);
  const names = file.endsWith('package-lock.json')
    ? Object.keys(json.packages ?? {}).map(path => path.slice(path.lastIndexOf('node_modules/') + 13))
    : ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].flatMap(
        group => Object.keys(json[group] ?? {})
      );
  return names.filter(name => LEGACY_PACKAGES.has(name.toLowerCase()));
}

/** Problems in the tracked `files`; `read(file)` returns a file's text. */
export function findLegacy(files, read) {
  const problems = [];
  for (const file of files) {
    if (RETIRED_DIRS.some(dir => file.startsWith(dir))) problems.push(`${file}: retired legacy path`);
    else if (RETIRED_FILES.test(file)) problems.push(`${file}: retired legacy page`);
    if (file.endsWith('.css') && !file.startsWith('frontend/src/'))
      problems.push(`${file}: CSS outside frontend/src/`);
    if (/(^|\/)package(-lock)?\.json$/.test(file))
      for (const name of legacyDependencies(file, read(file)))
        problems.push(`${file}: legacy dependency ${name}`);
    else if (SOURCE.test(file) && !allowed(file) && LEGACY_CODE.test(read(file)))
      problems.push(`${file}: jQuery code`);
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
  const problems = findLegacy(files, file => readFileSync(join(root, file), 'utf8'));
  if (problems.length) {
    console.error(`Legacy frontend code is back (QUAL-018):\n${problems.map(p => `- ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`Checked ${files.length} tracked files: no legacy page, jQuery or legacy CSS.`);
}

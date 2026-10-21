// QUAL-018: `node --test scripts/check-legacy-free.test.mjs`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findLegacy } from './check-legacy-free.mjs';

const tree = {
  'frontend/package.json': JSON.stringify({ dependencies: { cytoscape: '^3.33.1' } }),
  'frontend/package-lock.json': JSON.stringify({ packages: { 'node_modules/cytoscape': {} } }),
  'frontend/src/routes/layout.css': 'body {}',
  'frontend/src/lib/api/client.ts': 'fetch("/api/query")',
  'frontend/src/lib/domain/legacy/vendor/cytoscape-3.29.1.min.js': 'jQuery.fn.cytoscape',
  'tcc/04 - Frontend/Frontend Evolution Audit.md': 'jQuery 2.1.1 is loaded',
  'fixtures/legacy/README.md': 'captured from the jQuery page'
};
const check = files => findLegacy(Object.keys(files), file => files[file]);

test('the current kind of tree passes, history and oracles included', () => {
  assert.deepEqual(check(tree), []);
});

test('a jQuery dependency in a package.json or lockfile fails', () => {
  assert.deepEqual(
    check({ ...tree, 'frontend/package.json': JSON.stringify({ devDependencies: { jquery: '3' } }) }),
    ['frontend/package.json: legacy dependency jquery']
  );
  assert.deepEqual(
    check({
      ...tree,
      'package-lock.json': JSON.stringify({ packages: { 'node_modules/materialize-css': {} } })
    }),
    ['package-lock.json: legacy dependency materialize-css']
  );
});

test('a file under sparql/ or a legacy page fails', () => {
  assert.deepEqual(check({ ...tree, 'sparql/graph.js': 'const cy = 1;' }), [
    'sparql/graph.js: retired legacy path'
  ]);
  assert.deepEqual(check({ ...tree, 'frontend/static/index2.html': '<html>' }), [
    'frontend/static/index2.html: retired legacy page'
  ]);
});

test('CSS outside frontend/src and jQuery code in source fail', () => {
  assert.deepEqual(check({ ...tree, 'frontend/static/legacy.css': 'body {}' }), [
    'frontend/static/legacy.css: CSS outside frontend/src/'
  ]);
  assert.deepEqual(
    check({ ...tree, 'frontend/src/lib/old.ts': '$.ajax({ url: "/api/query" })' }),
    ['frontend/src/lib/old.ts: jQuery code']
  );
});

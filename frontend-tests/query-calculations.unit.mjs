import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFilters, getQueryVariables, hasParallelPredicateVariables } from '../sparql/query-calculations.js';

test('filters preserve edge order, fixed RDF terms, and numeric filterType zero', () => {
  assert.deepEqual(buildFilters([
    { source: '?node', target: 'target', sourceValue: '?node', targetValue: '<https://example.test/item>', nodeId: '<https://example.test/relation>', filterType: '0', fallbackPredicate: '<https://example.test/relation>' },
    { source: 'target', target: '?next', sourceValue: '<https://example.test/item>', targetValue: '?next', nodeId: '?predicate', filterType: null, fallbackPredicate: '?predicate' },
  ]), [
    { subject: '?node', predicate: '<https://example.test/relation>', object: '<https://example.test/item>', filterType: 0 },
    { subject: '<https://example.test/item>', predicate: '?predicate', object: '?next', filterType: null },
  ]);
});

test('missing predicate uses the adapter-provided fallback without inventing an ID', () => {
  assert.deepEqual(buildFilters([{ source: 'a', target: 'b', fallbackPredicate: '?empty_123' }]), [
    { subject: 'a', predicate: '?empty_123', object: 'b', filterType: null },
  ]);
});

test('query variables are distinct, sorted and require an entire valid variable token', () => {
  assert.deepEqual(getQueryVariables([
    { id: '?zeta', value: '?zeta' },
    { id: '?alpha', value: '?alpha' },
    { source: '?zeta', target: '?alpha', nodeId: '?predicate' },
    { source: '?zeta', target: '?alpha', nodeId: '<https://example.test/relation?ghost>' },
    { id: '?alpha-bad', value: '?alpha-bad' },
    { id: '?zeta', value: '?zeta' },
  ]), ['?alpha', '?predicate', '?zeta']);
});

test('parallel predicate alternatives differ from repeated bindings and a chain', () => {
  const first = { source: 'a', target: 'b', sourceValue: '<a>', targetValue: '<b>', nodeId: '?p1' };
  assert.equal(hasParallelPredicateVariables([first, { ...first, nodeId: '?p2' }]), true);
  assert.equal(hasParallelPredicateVariables([first, { ...first }]), false);
  assert.equal(hasParallelPredicateVariables([first, { ...first, source: 'b', target: 'c', sourceValue: '<b>', targetValue: '<c>', nodeId: '?p2' }]), false);
  assert.equal(hasParallelPredicateVariables([{ ...first, sourceValue: '?subject' }, { ...first, sourceValue: '?subject', nodeId: '?p2' }]), false);
});

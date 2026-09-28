import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildVariableRegistry, explorationSignature, moveItem } from '../sparql/query-stages.js';

test('registry has one sorted entry per variable name across node and predicate positions', () => {
  assert.deepEqual(buildVariableRegistry([
    { id: '?zeta', value: '?zeta' },
    { id: 'n1', value: '?alpha' },
    { id: 'e1', source: '?zeta', target: 'n1', nodeId: '?alpha' },
    { id: 'e2', source: '?zeta', target: 'n1', nodeId: '?p' },
    { id: 'e3', source: '?zeta', target: 'n1', nodeId: '<https://example.test/p?ghost>' },
    { id: 'bad', value: '?alpha-bad' },
    { id: 'fixed', value: '<https://example.test/item>' },
  ]), [
    { name: '?alpha', nodeIds: ['n1'], edgeIds: ['e1'] },
    { name: '?p', nodeIds: [], edgeIds: ['e2'] },
    { name: '?zeta', nodeIds: ['?zeta'], edgeIds: [] },
  ]);
});

test('signature ignores element order and labels but changes on values, predicates, filters and endpoint', () => {
  const items = [
    { id: '?a', value: '?a' },
    { id: 'e', source: '?a', target: 'b', nodeId: '<https://example.test/p>' },
  ];
  const base = explorationSignature('graph', items);
  assert.equal(explorationSignature('graph', [...items].reverse()), base);
  assert.equal(explorationSignature('graph', [{ ...items[0], label: 'renamed' }, items[1]]), base);
  assert.notEqual(explorationSignature('other', items), base);
  assert.notEqual(explorationSignature('graph', [items[0], { ...items[1], nodeId: '?p' }]), base);
  assert.notEqual(explorationSignature('graph', [{ ...items[0], filterType: 0 }, items[1]]), base);
});

test('moving a block reorders without mutating and ignores out-of-range moves', () => {
  const order = ['?a', '?b', '?c'];
  assert.deepEqual(moveItem(order, 0, 2), ['?b', '?c', '?a']);
  assert.deepEqual(moveItem(order, 2, 1), ['?a', '?c', '?b']);
  assert.deepEqual(moveItem(order, 0, 3), order);
  assert.deepEqual(order, ['?a', '?b', '?c']);
});

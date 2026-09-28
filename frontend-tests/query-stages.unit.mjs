import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildVariableRegistry,
  candidateText,
  explorationSignature,
  moveItem,
  stageCacheKey,
  stagePageSize,
  stageRequest,
  termGraphValue,
  termHint,
} from '../sparql/query-stages.js';

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

test('stage requests cap page size and cache keys include the binding path', () => {
  const where = [{ subject: '?a', predicate: '?b', object: '<https://example.test/o>', filterType: null }];
  const iri = { type: /** @type {const} */ ('iri'), value: 'https://example.test/x' };
  const first = stageRequest({ endpointUrl: 'graph', where, variableName: '?a', bindings: [], limit: 150 });
  const assumed = stageRequest({ endpointUrl: 'graph', where, variableName: '?a', bindings: [{ variableName: '?b', term: iri }], limit: 150 });
  assert.equal(first.limit, 50);
  assert.equal(first.offset, 0);
  assert.equal(stagePageSize(Number.NaN), 20);
  assert.equal(stagePageSize(0), 1);
  assert.notEqual(stageCacheKey(first), stageCacheKey(assumed));
});

test('terms keep their type in hints and graph values; labels are display only', () => {
  const integer = { type: /** @type {const} */ ('literal'), value: '1903', datatype: 'http://www.w3.org/2001/XMLSchema#integer', language: null };
  assert.equal(termHint(integer), 'literal integer');
  assert.equal(termHint({ type: 'literal', value: 'Grêmio', language: 'pt' }), 'literal @pt');
  assert.equal(termHint({ type: 'bnode', value: 'b0' }), 'blank node');
  assert.equal(termGraphValue({ type: 'iri', value: 'https://example.test/x' }), '<https://example.test/x>');
  assert.equal(termGraphValue(integer), '1903');
  assert.equal(candidateText({ term: integer, label: null, selectable: true }), '1903');
  assert.equal(candidateText({ term: integer, label: 'Founded', selectable: true }), 'Founded');
});

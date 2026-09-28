import assert from 'node:assert/strict';
import { test } from 'node:test';
import { edgeActions, nextPredicateVariableName, nodeActions } from '../sparql/graph-actions.js';

const ids = actions => actions.map(action => action.id);
const COMMON = ['connect-variable-predicate', 'connect-defined-predicate', 'convert-variable', 'remove'];

test('each node type offers its own first action before the common actions', () => {
  assert.deepEqual(ids(nodeActions({ type: 'node' }, false)), ['explore-relationships', ...COMMON]);
  assert.deepEqual(ids(nodeActions({ type: 'default' }, false)), ['explore-default', ...COMMON]);
  assert.deepEqual(ids(nodeActions({ type: 'variable' }, false)), ['run-query', ...COMMON]);
  assert.deepEqual(ids(nodeActions({ type: 'node', isLink: true }, false)), ['open-link', ...COMMON]);
  assert.deepEqual(ids(nodeActions({ type: 'label' }, false)), COMMON);
});

test('value edits appear only for nodes fed by a variable', () => {
  assert.deepEqual(ids(nodeActions({ type: 'label', label: 'true' }, true)),
    ['toggle-boolean', 'edit-value', ...COMMON]);
  assert.deepEqual(ids(nodeActions({ type: 'label', label: 'Rio' }, true)), ['edit-value', ...COMMON]);
  assert.deepEqual(ids(nodeActions({ type: 'default', label: 'false' }, true)),
    ['explore-default', 'toggle-boolean', ...COMMON]);
  assert.deepEqual(ids(nodeActions({ type: 'label', label: 'true' }, false)), COMMON);
});

test('only Remove is marked as destructive', () => {
  const actions = [...nodeActions({ type: 'node' }, false), ...edgeActions({ nodeId: 'wdt:P1' })];
  assert.deepEqual(actions.filter(action => action.danger).map(action => action.id), ['remove', 'remove-relation']);
});

test('a relation converts to a variable only while its predicate is defined', () => {
  assert.deepEqual(ids(edgeActions({ nodeId: 'wdt:P31' })), ['convert-predicate-variable', 'remove-relation']);
  assert.deepEqual(ids(edgeActions({ nodeId: '?predicate_1' })), ['remove-relation']);
  assert.deepEqual(ids(edgeActions({})), ['convert-predicate-variable', 'remove-relation']);
});

test('the next predicate variable skips names already used and advances the sequence', () => {
  const taken = new Set(['?predicate_1', '?predicate_2']);
  assert.deepEqual(nextPredicateVariableName(1, name => taken.has(name)), { name: '?predicate_3', sequence: 4 });
  assert.deepEqual(nextPredicateVariableName(4, () => false), { name: '?predicate_4', sequence: 5 });
});

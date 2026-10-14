import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { bindPredicateEdges, bindVariable } from '../sparql/graph-binding.js';
import { nodeDataForResult, nodeDataForTerm, nodeKind, valueVariableFilterData, valueVariableNodeData } from '../sparql/graph-model.js';

// The bundled Cytoscape, loaded as the page loads it (a global script).
vm.runInThisContext(fs.readFileSync(new URL('../sparql/cytoscape.min.js', import.meta.url), 'utf8'));
const cytoscape = /** @type {any} */ (globalThis).cytoscape;

const PIKACHU = '<https://e/Pikachu>';
const pikachu = nodeDataForTerm({ type: 'iri', value: 'https://e/Pikachu' }, 'Pikachu');

function graph(elements) {
  return cytoscape({ headless: true, elements, layout: { name: 'preset' } });
}

function edge(id, source, target, data = {}) {
  return { group: 'edges', data: { id, source, target, ...data } };
}

function node(id, data = {}) {
  return { group: 'nodes', data: { id, value: id, label: id, ...data }, position: { x: 10, y: 20 } };
}

function ends(cy, id) {
  const { source, target } = cy.getElementById(id).data();
  return [source, target];
}

/** Records the options' calls. */
function recorder() {
  const calls = { retarget: [], refetch: [] };
  return {
    calls,
    retarget: (oldId, newId) => calls.retarget.push([oldId, newId]),
    refetchRelation: (sourceId, relation) => calls.refetch.push([sourceId, relation]),
  };
}

test('a new value replaces the variable at its position, edges keep their IDs and data', () => {
  const cy = graph([
    node('?x', { type: 'variable' }), node('<https://e/Ash>', { type: 'node' }),
    edge('in', '<https://e/Ash>', '?x', { nodeId: '<https://e/owns>', label: 'owns', filterType: 2 }),
  ]);
  const { calls, retarget } = recorder();
  assert.equal(bindVariable(cy, '?x', pikachu, { retarget }), true);

  assert.equal(cy.getElementById('?x').length, 0);
  assert.deepEqual(cy.getElementById(PIKACHU).data(), { ...pikachu });
  assert.deepEqual(cy.getElementById(PIKACHU).position(), { x: 10, y: 20 });
  assert.deepEqual(ends(cy, 'in'), ['<https://e/Ash>', PIKACHU]);
  assert.equal(cy.getElementById('in').data('filterType'), 2);
  assert.deepEqual(calls.retarget, [['?x', PIKACHU]]);
});

test('a value already in the graph is reused (BUG-003, cycle)', () => {
  const cy = graph([
    node(PIKACHU, { type: 'node', label: 'Old label' }), node('?x', { type: 'variable' }),
    edge('evolves', PIKACHU, '?x', { nodeId: '<https://e/evolves>', label: 'evolves' }),
  ]);
  assert.equal(bindVariable(cy, '?x', pikachu), true);
  assert.equal(cy.nodes().length, 1);
  assert.equal(cy.getElementById(PIKACHU).data('label'), 'Old label');
  assert.deepEqual(ends(cy, 'evolves'), [PIKACHU, PIKACHU]);
});

test('a self-loop on the variable stays a self-loop on the value', () => {
  const cy = graph([node('?x', { type: 'variable' }), edge('loop', '?x', '?x', { nodeId: '?p', label: '?' })]);
  const { calls, refetchRelation } = recorder();
  bindVariable(cy, '?x', pikachu, { refetchRelation });
  assert.deepEqual(ends(cy, 'loop'), [PIKACHU, PIKACHU]);
  assert.deepEqual(calls.refetch, []);
});

test('a missing variable or the value itself changes nothing', () => {
  const cy = graph([node(PIKACHU, { type: 'node' })]);
  const { calls, retarget } = recorder();
  assert.equal(bindVariable(cy, '?gone', pikachu, { retarget }), false);
  assert.equal(bindVariable(cy, PIKACHU, pikachu, { retarget }), false);
  assert.equal(cy.getElementById(PIKACHU).length, 1);
  assert.deepEqual(calls.retarget, []);
});

function withNeighbours() {
  return graph([
    node('?x', { type: 'variable' }),
    node('<https://e/Kanto>', { type: 'node' }), node('Rio', { type: 'label' }), node('?y', { type: 'variable' }),
    node('<https://e/Ash>', { type: 'node' }),
    edge('region', '?x', '<https://e/Kanto>', { nodeId: '<https://e/region>', label: 'region' }),
    edge('name', '?x', 'Rio', { nodeId: '<https://e/name>', label: 'name' }),
    edge('friend', '?x', '?y', { nodeId: '<https://e/friend>', label: 'friend' }),
    edge('owns', '<https://e/Ash>', '?x', { nodeId: '<https://e/owns>', label: 'owns' }),
  ]);
}

test('Assume/Apply keep every neighbour', () => {
  const cy = withNeighbours();
  bindVariable(cy, '?x', pikachu);
  assert.equal(cy.nodes().length, 5);
  for (const id of ['region', 'name', 'friend']) assert.equal(ends(cy, id)[0], PIKACHU, id);
  assert.deepEqual(ends(cy, 'owns'), ['<https://e/Ash>', PIKACHU]);
});

test('the results table refetches each outgoing target, IRIs as IRIs (BUG-006)', () => {
  const cy = withNeighbours();
  const { calls, refetchRelation } = recorder();
  const chosen = nodeDataForResult({ id: PIKACHU, label: 'Pikachu', propertyType: 'object' });
  bindVariable(cy, '?x', chosen, { refetchRelation });

  for (const id of ['<https://e/Kanto>', 'Rio', '?y', 'region', 'name', 'friend']) {
    assert.equal(cy.getElementById(id).length, 0, id);
  }
  // The incoming relation's source is not an outgoing target.
  assert.deepEqual(ends(cy, 'owns'), ['<https://e/Ash>', PIKACHU]);
  assert.deepEqual(calls.refetch, [
    [PIKACHU, { targetId: '<https://e/Kanto>', predicateId: '<https://e/region>', predicateLabel: 'region', targetIsIri: true }],
    [PIKACHU, { targetId: 'Rio', predicateId: '<https://e/name>', predicateLabel: 'name', targetIsIri: false }],
    [PIKACHU, { targetId: '?y', predicateId: '<https://e/friend>', predicateLabel: 'friend', targetIsIri: false }],
  ]);
});

test('predicate-variable edges are bound in place and lose the variable mark', () => {
  const cy = graph([
    node('a'), node('b'),
    edge('e1', 'a', 'b', { nodeId: '?p', label: '?', type: 'variable', filterType: 1 }),
    edge('e2', 'b', 'a', { nodeId: '?q', label: '?', type: 'variable' }),
  ]);
  bindPredicateEdges(cy, ['e1', 'e2', 'a', 'missing'], '?p', '<https://e/owns>', 'owns');
  const { type, ...bound } = cy.getElementById('e1').data();
  assert.equal(type, undefined);
  assert.deepEqual(bound, { id: 'e1', source: 'a', target: 'b', nodeId: '<https://e/owns>', label: 'owns', filterType: 1 });
  assert.equal(cy.getElementById('e2').data('nodeId'), '?q');
  assert.equal(cy.getElementById('e2').data('type'), 'variable');
  assert.equal(cy.getElementById('a').data('nodeId'), undefined);
});

test('a settled value variable becomes a plain value node without its filter (FE-034)', () => {
  const cy = graph([
    node('?mon', { type: 'variable' }),
    { group: 'nodes', data: { ...valueVariableNodeData('?hp'), ...valueVariableFilterData(2, '90') }, position: { x: 10, y: 20 } },
    edge('hp', '?mon', '?hp', { nodeId: '<https://e/hp>', label: 'HP' }),
  ]);
  const value = nodeDataForTerm({ type: 'literal', value: '160', datatype: 'http://www.w3.org/2001/XMLSchema#integer' }, '160');
  assert.equal(bindVariable(cy, '?hp', value), true);
  assert.equal(cy.getElementById('?hp').length, 0);
  assert.deepEqual(cy.getElementById('160').data(), { id: '160', value: '160', label: '160', type: 'label' });
  assert.equal(nodeKind(cy.getElementById('160').data()).filterType, null);
  assert.deepEqual(ends(cy, 'hp'), ['?mon', '160']);
});

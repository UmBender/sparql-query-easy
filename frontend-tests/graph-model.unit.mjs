import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  convertedVariableData, emptyValueNodeData, hasVariableMark, iriNodeData, isEditableValue, isVariableEdge,
  isVariableName, isVariableNode, nodeColor, nodeDataForRelationValue, nodeDataForResult, nodeDataForTerm,
  nodeKind, nodeShape, termGraphValue, variableNodeData,
} from '../sparql/graph-model.js';

// Stored node data of every kind, as the app writes it.
const KINDS = [
  ['iri', { type: 'node' }, '#4472C4', 'ellipse'],
  ['literal', { type: 'label' }, '#F48FB1', 'rectangle'],
  ['class', { type: 'default' }, '#FDD835', 'ellipse'],
  ['variable', { type: 'variable' }, '#A9D18E', 'ellipse'],
  ['many', { type: 'variable', color: 'gray' }, '#999999', 'ellipse'],
  ['unknown', {}, '#4472C4', 'ellipse'],
];

test('every stored node type maps to one kind, color and shape', () => {
  for (const [kind, data, color, shape] of KINDS) {
    assert.equal(nodeKind(data).kind, kind, kind);
    assert.equal(nodeColor(data), color, kind);
    assert.equal(nodeShape(data).shape, shape, kind);
  }
  assert.equal(nodeKind(null).kind, 'unknown');
  assert.equal(nodeKind({ type: 'variable', color: '' }).kind, 'variable');
});

test('an imported label-filter node is a literal of the older filter format', () => {
  const data = { type: 'label-filter' };
  assert.deepEqual(nodeKind(data), { kind: 'literal', isLink: false, legacyFilter: true, filterType: null });
  assert.equal(nodeColor(data), '#7030A0');
  assert.deepEqual(nodeShape(data), { shape: 'rectangle', height: '50px' });
  assert.equal(isEditableValue(data), false);
});

test('link and filter are read beside the kind', () => {
  assert.deepEqual(nodeKind({ type: 'label', isLink: true }), { kind: 'literal', isLink: true, legacyFilter: false, filterType: null });
  assert.equal(nodeKind({ type: 'label', filterType: '2' }).filterType, 2);
  assert.equal(nodeKind({ type: 'label', filterType: '' }).filterType, null);
  // Any color means "N results" gray, as before.
  assert.equal(nodeColor({ type: 'node', color: 'gray' }), '#999999');
});

test('variable, editable-value and edge predicates', () => {
  assert.equal(isVariableNode({ type: 'variable' }), true);
  assert.equal(isVariableNode({ type: 'variable', color: 'gray' }), true);
  assert.equal(isVariableNode({ type: 'node' }), false);
  assert.equal(isEditableValue({ type: 'label' }), true);
  assert.equal(isEditableValue({ type: 'node' }), false);
  assert.equal(isVariableEdge({ type: 'variable' }), true);
  assert.equal(isVariableEdge({}), false);
  assert.equal(isVariableName('?p'), true);
  assert.equal(isVariableName('<https://e/p>'), false);
  assert.equal(isVariableName(undefined), false);
  assert.equal(hasVariableMark('?node_1'), true);
  assert.equal(hasVariableMark('Who?'), true);
  assert.equal(hasVariableMark('Pikachu'), false);
  assert.equal(hasVariableMark(undefined), false);
});

test('a bound term becomes an IRI or a literal node whose ID is its value', () => {
  const iri = { type: 'iri', value: 'https://e/Pikachu', datatype: null, language: null };
  const literal = { type: 'literal', value: '90', datatype: 'http://www.w3.org/2001/XMLSchema#integer', language: null };
  assert.equal(termGraphValue(iri), '<https://e/Pikachu>');
  assert.deepEqual(nodeDataForTerm(iri, 'Pikachu'), { id: '<https://e/Pikachu>', value: '<https://e/Pikachu>', label: 'Pikachu', type: 'node' });
  assert.deepEqual(nodeDataForTerm(literal, '90'), { id: '90', value: '90', label: '90', type: 'label' });
  assert.equal(nodeKind(nodeDataForTerm(iri, 'Pikachu')).kind, 'iri');
  assert.equal(nodeKind(nodeDataForTerm(literal, '90')).kind, 'literal');
});

test('legacy result rows and relationship values keep their stored fields', () => {
  assert.deepEqual(nodeDataForResult({ id: '<https://e/a>', label: 'A', propertyType: 'object' }),
    { id: '<https://e/a>', value: '<https://e/a>', label: 'A', type: 'node' });
  assert.deepEqual(nodeDataForResult({ id: 'Rio', label: 'Rio', propertyType: null }),
    { id: 'Rio', value: 'Rio', label: 'Rio', type: 'label' });
  assert.deepEqual(nodeDataForResult({ id: 'x', label: 'X', propertyType: 'text' }),
    { id: 'x', value: 'x', label: 'X', type: 'label' });
  assert.deepEqual(nodeDataForResult({ id: 'Pokemon', label: 'Pokémon', propertyType: 'default', propertyClass: '<https://e/Pokemon>' }),
    { id: 'Pokemon', value: '<https://e/Pokemon>', label: 'Pokémon', type: 'default' });

  assert.deepEqual(nodeDataForRelationValue({ id: '<https://e/a>', text: 'A', valueType: 'node', predicateLabel: 'team' }),
    { id: '<https://e/a>', value: '<https://e/a>', label: 'A', type: 'node', isLink: false, href: 'A', color: '' });
  assert.deepEqual(nodeDataForRelationValue({ id: 'Rio', text: 'Rio', valueType: 'text', predicateLabel: 'name' }),
    { id: 'Rio', value: 'Rio', label: 'Rio', type: 'label', isLink: false, href: 'Rio', color: '' });
  assert.deepEqual(nodeDataForRelationValue({ id: '?node_1', text: '3 results', valueType: 'many-results', predicateLabel: 'member' }),
    { id: '?node_1', value: '?node_1', label: '3 results', type: 'variable', isLink: false, href: '3 results', color: 'gray' });
  assert.deepEqual(nodeDataForRelationValue({ id: 'https://e/a.png', text: 'https://e/a.png', valueType: 'text', predicateLabel: 'image' }),
    { id: 'https://e/a.png', value: 'https://e/a.png', label: 'View image', type: 'label', isLink: true, href: 'https://e/a.png', color: '' });
  assert.equal(nodeKind(nodeDataForRelationValue({ id: '?n', text: '2 results', valueType: 'many-results' })).kind, 'many');
});

test('new variables, search results and empty value nodes', () => {
  assert.deepEqual(variableNodeData('?x'), { id: '?x', value: '?x', label: '?', type: 'variable' });
  assert.deepEqual(iriNodeData('<https://e/a>', 'A'), { id: '<https://e/a>', value: '<https://e/a>', label: 'A', type: 'node' });
  assert.deepEqual(emptyValueNodeData('value_1'), { id: 'value_1', value: '', label: '', type: 'label' });
});

test('a converted node keeps its own fields but not the old value filter, link or color', () => {
  const old = { id: 'n', value: '90', label: '≥ 90', type: 'label', filterType: 2, isLink: true, href: 'h', color: 'gray', custom: 'kept' };
  assert.deepEqual(convertedVariableData(old, '?node_1'), { id: '?node_1', value: '?node_1', label: '?', type: 'variable', custom: 'kept' });
});

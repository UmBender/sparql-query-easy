/**
 * Pure decisions for the graph action menus: which actions a node or an edge
 * offers, and the next free predicate-variable name. The browser adapter owns
 * Cytoscape, the DOM and the action handlers.
 * @typedef {{id: string, label: string, danger?: boolean}} MenuAction
 * @typedef {{type?: string, label?: string, isLink?: boolean, color?: string}} MenuNodeData
 * @typedef {{nodeId?: string}} MenuEdgeData
 */

import { isEditableValue, isVariableName, nodeKind } from './graph-model.js';

/**
 * Type-specific action first, then value edits for nodes fed by a variable,
 * then connection, conversion and removal actions offered for every node.
 * @param {MenuNodeData} data
 * @param {boolean} hasVariableSource a variable node has an edge into this node
 * @returns {MenuAction[]}
 */
export function nodeActions(data, hasVariableSource) {
  /** @type {MenuAction[]} */
  const actions = [];
  const { kind, isLink } = nodeKind(data);

  if (isLink) {
    actions.push({ id: 'open-link', label: 'Open link' });
  } else if (kind === 'iri') {
    actions.push({ id: 'explore-relationships', label: 'Explore relationships' });
  } else if (kind === 'class') {
    actions.push({ id: 'explore-default', label: 'Explore values' });
  } else if (kind === 'variable' || kind === 'many') {
    actions.push({ id: 'run-query', label: 'Run query' });
    actions.push({ id: 'add-value-filter', label: 'Add value filter' });
  } else if (kind === 'value-variable') {
    // FE-034: its values are literals, settled through staged Run Query.
    actions.push({ id: 'edit-filter', label: 'Edit filter' });
  }

  if (hasVariableSource && (data.label === 'true' || data.label === 'false')) {
    actions.push({ id: 'toggle-boolean', label: 'Toggle Boolean value' });
  }
  if (hasVariableSource && isEditableValue(data)) {
    actions.push({ id: 'edit-value', label: 'Edit value' });
  }

  actions.push({ id: 'connect-variable-predicate', label: 'Connect with variable predicate' });
  actions.push({ id: 'connect-defined-predicate', label: 'Connect with defined predicate' });

  actions.push({ id: 'convert-variable', label: 'Convert to variable' });
  actions.push({ id: 'remove', label: 'Remove', danger: true });
  return actions;
}

/**
 * A relation whose predicate is already a variable cannot be converted again.
 * @param {MenuEdgeData} data
 * @returns {MenuAction[]}
 */
export function edgeActions(data) {
  const actions = isVariableName(data.nodeId)
    ? []
    : [{ id: 'convert-predicate-variable', label: 'Convert relation to variable' }];
  return [...actions, { id: 'remove-relation', label: 'Remove relation', danger: true }];
}

/**
 * First `?predicate_<n>` from `sequence` upward that no graph element uses.
 * @param {number} sequence
 * @param {(name: string) => boolean} isTaken
 * @returns {{name: string, sequence: number}} the name and the next number to try
 */
export function nextPredicateVariableName(sequence, isTaken) {
  let name;
  do {
    name = `?predicate_${sequence++}`;
  } while (isTaken(name));
  return { name, sequence };
}

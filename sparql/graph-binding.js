/**
 * Binding a variable to a chosen value in the main graph (FE-033): the one
 * path used by the results table (Run query node action) and by staged
 * exploration (Assume, Apply to graph). BUG-003 and BUG-006 came from two
 * copies of this code drifting apart.
 *
 * The functions take the Cytoscape instance; tests use a headless one.
 *
 * @typedef {Record<string, any>} ElementData
 * @typedef {{
 *   length: number,
 *   id(): string,
 *   data(arg?: string | ElementData): any,
 *   removeData(key: string): unknown,
 *   position(): {x: number, y: number},
 *   connectedEdges(): {forEach(fn: (edge: GraphElement) => void): void},
 *   move(ends: {source?: string, target?: string}): unknown,
 *   target(): GraphElement,
 *   isEdge(): boolean,
 *   remove(): unknown,
 * }} GraphElement
 * @typedef {{
 *   getElementById(id: string): GraphElement,
 *   add(element: {group: 'nodes' | 'edges', data: ElementData, position?: {x: number, y: number}}): unknown,
 * }} GraphCy
 * @typedef {{targetId: string, predicateId: string, predicateLabel: string, targetIsIri: boolean}} OutgoingRelation
 * @typedef {{
 *   retarget?: (oldId: string, newId: string) => void,
 *   refetchRelation?: (sourceId: string, relation: OutgoingRelation) => void,
 * }} BindOptions
 */

import { isVariableEdge, nodeKind } from './graph-model.js';

/**
 * Replace a variable node by the value node `nodeData` (its ID is the value).
 * A node already holding that value is reused (BUG-003, cycles). Edges keep
 * their IDs and data and move to the value; a self-loop stays a self-loop.
 * The open action menu follows the value through `retarget`.
 *
 * With `refetchRelation` (results table) each outgoing target other than the
 * value itself is removed and fetched again from the value; a fixed IRI
 * target is marked so it is fetched as an IRI (BUG-006). Without it
 * (Assume/Apply) the targets stay.
 *
 * @param {GraphCy} cy
 * @param {string} variableId
 * @param {ElementData & {id: string}} nodeData
 * @param {BindOptions} [options]
 * @returns {boolean} false when the variable is missing or already the value
 */
export function bindVariable(cy, variableId, nodeData, { retarget, refetchRelation } = {}) {
  const variable = cy.getElementById(variableId);
  const valueId = nodeData.id;
  if (!variable.length || variableId === valueId) return false;
  if (!cy.getElementById(valueId).length) {
    cy.add({ group: 'nodes', data: nodeData, position: { ...variable.position() } });
  }

  /** @type {OutgoingRelation[]} */
  const outgoing = [];
  variable.connectedEdges().forEach(edge => {
    /** @type {{source?: string, target?: string}} */
    const ends = {};
    if (edge.data('source') === variableId) ends.source = valueId;
    if (edge.data('target') === variableId) ends.target = valueId;
    edge.move(ends);
    if (ends.source && edge.data('target') !== valueId) {
      outgoing.push({
        targetId: edge.data('target'),
        predicateId: edge.data('nodeId'),
        predicateLabel: edge.data('label'),
        targetIsIri: nodeKind(edge.target().data()).kind === 'iri',
      });
    }
  });
  retarget?.(variableId, valueId);
  variable.remove();

  if (refetchRelation) {
    outgoing.forEach(relation => {
      cy.getElementById(relation.targetId).remove();
      refetchRelation(valueId, relation);
    });
  }
  return true;
}

/**
 * Bind the predicate-variable edges among `edgeIds` that still use
 * `variableName` to a fixed predicate; IDs and other data are kept and the
 * green variable-relation mark is dropped.
 * @param {GraphCy} cy
 * @param {string[]} edgeIds
 * @param {string} variableName
 * @param {string} predicateId
 * @param {string} label
 */
export function bindPredicateEdges(cy, edgeIds, variableName, predicateId, label) {
  edgeIds.forEach(id => {
    const edge = cy.getElementById(id);
    if (!edge.length || !edge.isEdge() || edge.data('nodeId') !== variableName) return;
    edge.data({ nodeId: predicateId, label });
    if (isVariableEdge(edge.data())) edge.removeData('type');
  });
}

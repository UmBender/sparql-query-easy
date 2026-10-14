/**
 * What a graph node is (FE-032): the one place that reads the stored kind
 * fields (`type`, `color`, `isLink`, `filterType`, `?` marks) and the one place
 * that writes them for new nodes. The stored values are unchanged, so imported
 * graphs, tests and request payloads stay the same. Edge kinds stay in
 * `relationLabelKind` (query-calculations.js).
 *
 * Stored `type` values: `node` (IRI), `label` (literal value), `label-filter`
 * (literal of an older filter format, only in imported graphs), `default`
 * (class) and `variable`; a variable with a `color` is an "N results" node.
 *
 * @typedef {'iri' | 'literal' | 'class' | 'variable' | 'many' | 'unknown'} NodeKindName
 * @typedef {{type?: string, color?: string, isLink?: boolean, filterType?: number | string | null}} KindData
 * @typedef {{kind: NodeKindName, isLink: boolean, legacyFilter: boolean, filterType: number | null}} NodeKind
 * @typedef {{type: string, value: string, datatype?: string | null, language?: string | null}} GraphTerm
 * @typedef {{id: string, value: string, label: string, type: string, isLink?: boolean, href?: string, color?: string}} NodeData
 */

import { filterTypeOf } from './query-calculations.js';

/**
 * @param {KindData | null | undefined} data node data
 * @returns {NodeKind}
 */
export function nodeKind(data) {
  const type = data?.type;
  /** @type {NodeKindName} */
  let kind = 'unknown';
  if (type === 'variable') kind = data?.color ? 'many' : 'variable';
  else if (type === 'label' || type === 'label-filter') kind = 'literal';
  else if (type === 'default') kind = 'class';
  else if (type === 'node') kind = 'iri';
  return {
    kind,
    isLink: Boolean(data?.isLink),
    legacyFilter: type === 'label-filter',
    filterType: filterTypeOf(data?.filterType),
  };
}

/**
 * A variable node, including an "N results" node.
 * @param {KindData | null | undefined} data
 */
export function isVariableNode(data) {
  const { kind } = nodeKind(data);
  return kind === 'variable' || kind === 'many';
}

/**
 * A literal value the editor can change (not the older `label-filter` format).
 * @param {KindData | null | undefined} data
 */
export function isEditableValue(data) {
  const { kind, legacyFilter } = nodeKind(data);
  return kind === 'literal' && !legacyFilter;
}

/**
 * Fill color of a main-graph node.
 * @param {KindData} data
 */
export function nodeColor(data) {
  if (data.color) return '#999999';
  const { kind, legacyFilter } = nodeKind(data);
  if (kind === 'variable' || kind === 'many') return '#A9D18E';
  if (kind === 'literal') return legacyFilter ? '#7030A0' : '#F48FB1';
  if (kind === 'class') return '#FDD835';
  return '#4472C4';
}

/**
 * Literal values are drawn as boxes, every other node as a circle.
 * @param {KindData} data
 */
export function nodeShape(data) {
  return nodeKind(data).kind === 'literal'
    ? { shape: 'rectangle', height: '50px' }
    : { shape: 'ellipse', height: '120px' };
}

/**
 * Legacy variable test on element IDs: any `?` in the ID counts (a literal
 * with `?` in its text too; recorded in QUAL-005).
 * @param {string | null | undefined} id
 */
export function hasVariableMark(id) {
  return typeof id === 'string' && id.includes('?');
}

/**
 * A predicate or variable name written as `?name`.
 * @param {string | null | undefined} name
 */
export function isVariableName(name) {
  return typeof name === 'string' && name.startsWith('?');
}

/**
 * An edge stored as a variable relation (green label until bound).
 * @param {{type?: string} | null | undefined} data edge data
 */
export function isVariableEdge(data) {
  return data?.type === 'variable';
}

/**
 * Value used by the graph/query model for a term: IRIs keep angle brackets;
 * literals use their lexical form like other literal nodes.
 * @param {GraphTerm} term
 * @returns {string}
 */
export function termGraphValue(term) {
  return term.type === 'iri' ? `<${term.value}>` : term.value;
}

/**
 * Node for a bound RDF term (Assume, Apply to graph); its ID is its value.
 * @param {GraphTerm} term
 * @param {string} label
 * @returns {NodeData}
 */
export function nodeDataForTerm(term, label) {
  const value = termGraphValue(term);
  return { id: value, value, label, type: term.type === 'iri' ? 'node' : 'label' };
}

/**
 * @param {string} id
 * @returns {NodeData}
 */
export function variableNodeData(id) {
  return { id, value: id, label: '?', type: 'variable' };
}

/**
 * An IRI node, such as a search result.
 * @param {string} id
 * @param {string} label
 * @returns {NodeData}
 */
export function iriNodeData(id, label) {
  return { id, value: id, label, type: 'node' };
}

/**
 * The value node Add value filter creates before its value is known.
 * @param {string} id
 * @returns {NodeData}
 */
export function emptyValueNodeData(id) {
  return { id, value: '', label: '', type: 'label' };
}

/**
 * Node for a chosen legacy query result row (results table): text results
 * and results whose ID is their label are literals; a class result keeps
 * its class IRI as value.
 * @param {{id: string, label: string, propertyType?: string | null, propertyClass?: string | null}} result
 * @returns {NodeData}
 */
export function nodeDataForResult({ id, label, propertyType, propertyClass }) {
  if (propertyType === 'default') return { id, value: /** @type {string} */ (propertyClass), label, type: 'default' };
  return { id, value: id, label, type: propertyType === 'text' || id === label ? 'label' : 'node' };
}

/**
 * Node for a relationship value: `text` is a literal, `many-results` an
 * "N results" variable, anything else an IRI. An `image` relation makes a link.
 * @param {{id: string, text: string, valueType?: string | null, predicateLabel?: string | null}} value
 * @returns {NodeData}
 */
export function nodeDataForRelationValue({ id, text, valueType, predicateLabel }) {
  const isLink = predicateLabel === 'image';
  const type = valueType === 'text' ? 'label' : valueType === 'many-results' ? 'variable' : 'node';
  return {
    id, value: id, label: isLink ? 'View image' : text, type, isLink, href: text,
    color: valueType === 'many-results' ? 'gray' : '',
  };
}

/**
 * Data a node keeps when it becomes a variable: its own extra fields, but not
 * the old value's filter, link or "N results" color (QUAL-005).
 * @param {Record<string, unknown>} data
 * @param {string} id
 */
export function convertedVariableData(data, id) {
  const { filterType, isLink, href, color, ...rest } = data;
  return { ...rest, ...variableNodeData(id) };
}

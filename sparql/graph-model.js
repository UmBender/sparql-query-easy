/**
 * What a graph node is (FE-032): the one place that reads the stored kind
 * fields (`type`, `color`, `isLink`, `filterType`, `?` marks) and the one place
 * that writes them for new nodes. The stored values are unchanged, so imported
 * graphs, tests and request payloads stay the same. Edge kinds stay in
 * `relationLabelKind` (query-calculations.js).
 *
 * Stored `type` values: `node` (IRI), `label` (literal value), `label-filter`
 * (literal of an older filter format, only in imported graphs), `default`
 * (class), `variable` and `value-variable` (FE-034: a variable restricted to
 * literal values, whose optional filter is `filterType` + `filterValue`); a
 * variable with a `color` is an "N results" node.
 *
 * @typedef {'iri' | 'literal' | 'class' | 'variable' | 'many' | 'value-variable' | 'unknown'} NodeKindName
 * @typedef {{type?: string, color?: string, isLink?: boolean, filterType?: number | string | null, filterValue?: string, value?: string}} KindData
 * @typedef {{variableName: string, filterType: number | null, value: string | null}} VariableFilter
 * @typedef {{kind: NodeKindName, isLink: boolean, legacyFilter: boolean, filterType: number | null}} NodeKind
 * @typedef {{type: string, value: string, datatype?: string | null, language?: string | null}} GraphTerm
 * @typedef {{id: string, value: string, label: string, type: string, isLink?: boolean, href?: string, color?: string}} NodeData
 */

import { filterLabel, filterTypeOf } from './query-calculations.js';

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
  else if (type === 'value-variable') kind = 'value-variable';
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
  return kind === 'variable' || kind === 'many' || kind === 'value-variable';
}

/**
 * A variable restricted to literal values (FE-034).
 * @param {KindData | null | undefined} data
 */
export function isValueVariable(data) {
  return nodeKind(data).kind === 'value-variable';
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
  if (kind === 'variable' || kind === 'many' || kind === 'value-variable') return '#A9D18E';
  if (kind === 'literal') return legacyFilter ? '#7030A0' : '#F48FB1';
  if (kind === 'class') return '#FDD835';
  return '#4472C4';
}

/**
 * Literal values and value variables are drawn as boxes, every other node as a circle.
 * @param {KindData} data
 */
export function nodeShape(data) {
  const { kind } = nodeKind(data);
  return kind === 'literal' || kind === 'value-variable'
    ? { shape: 'rectangle', height: '50px' }
    : { shape: 'ellipse', height: '120px' };
}

/**
 * A value variable keeps the value box with the value's pink as its border (FE-034).
 * @param {KindData} data
 */
export function nodeBorder(data) {
  return isValueVariable(data) ? { width: 4, color: '#F48FB1' } : { width: 0, color: '#000000' };
}

/**
 * The filter a node holds, for display (badges, editor): a filtered literal
 * keeps its filter text in `value`, a value variable in `filterValue`.
 * Null when the node has no filter (an exact literal, any value).
 * @param {KindData | null | undefined} data
 * @returns {{filterType: number | null, value: string} | null}
 */
export function nodeFilter(data) {
  const { kind, filterType } = nodeKind(data);
  if (kind === 'value-variable') {
    const value = String(data?.filterValue ?? '');
    return filterType === null && value === '' ? null : { filterType, value };
  }
  return filterType === null ? null : { filterType, value: String(data?.value ?? '') };
}

/**
 * Request filter of a value variable (FE-034): `filterType` with its value, an
 * exact value (no filterType), or neither for any literal. Null for other nodes.
 * @param {KindData | null | undefined} data
 * @returns {VariableFilter | null}
 */
export function variableFilterOf(data) {
  if (!isValueVariable(data)) return null;
  const filter = nodeFilter(data);
  return { variableName: String(data?.value ?? ''), filterType: filter?.filterType ?? null, value: filter ? filter.value : null };
}

/**
 * Label of a value variable: `?` for any value, otherwise `?` and the filter.
 * @param {number | string | null | undefined} filterType
 * @param {string} value
 */
export function valueVariableLabel(filterType, value) {
  const type = filterTypeOf(filterType);
  if (type === null) return value === '' ? '?' : `? = ${value}`;
  return type === 6 ? `? in ${filterLabel(type, value)}` : `? ${filterLabel(type, value)}`;
}

/**
 * Stored fields of a value variable's filter; an empty value means any value.
 * @param {number | string | null | undefined} filterType
 * @param {string} value
 */
export function valueVariableFilterData(filterType, value) {
  const filterValue = String(value ?? '').trim();
  const type = filterValue === '' ? null : filterTypeOf(filterType);
  return { filterType: type, filterValue, label: valueVariableLabel(type, filterValue) };
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
 * A value variable without a filter (any literal value).
 * @param {string} id
 * @returns {NodeData & {filterType: null, filterValue: string}}
 */
export function valueVariableNodeData(id) {
  return { id, value: id, label: '?', type: 'value-variable', filterType: null, filterValue: '' };
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
 * the old value's filter, link or "N results" color (QUAL-005). A literal
 * value becomes a value variable without a filter (FE-034); every other node,
 * a value variable included, becomes a plain variable.
 * @param {Record<string, unknown>} data
 * @param {string} id
 */
export function convertedVariableData(data, id) {
  const { filterType, filterValue, isLink, href, color, ...rest } = data;
  const literal = nodeKind(/** @type {KindData} */ (data)).kind === 'literal';
  return { ...rest, ...(literal ? valueVariableNodeData(id) : variableNodeData(id)) };
}

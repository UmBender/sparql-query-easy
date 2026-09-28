/**
 * Plain graph data used by query calculations. The browser adapter owns Cytoscape;
 * this module neither reads the DOM nor performs network requests.
 * @typedef {{
 *   id?: string,
 *   value?: string,
 *   source?: string,
 *   target?: string,
 *   nodeId?: string,
 *   sourceValue?: string,
 *   targetValue?: string,
 *   filterType?: number | string | null,
 * }} QueryItem
 */

/** @typedef {QueryItem & {source: string, target: string, fallbackPredicate: string}} FilterEdge */
/** @typedef {{subject: string, predicate: string, object: string, filterType: number | null}} QueryFilter */

const variablePattern = /^[?$][A-Za-z_][A-Za-z0-9_]*$/;

/**
 * @param {FilterEdge[]} edges
 * @returns {QueryFilter[]}
 */
export function buildFilters(edges) {
  return edges.map(edge => ({
    subject: edge.sourceValue || edge.source,
    predicate: edge.nodeId || edge.fallbackPredicate,
    object: edge.targetValue || edge.target,
    filterType: edge.filterType != null ? +edge.filterType : null,
  }));
}

/**
 * @param {QueryItem[]} items
 * @returns {string[]}
 */
export function getQueryVariables(items) {
  const variables = new Set();
  for (const item of items) {
    const values = item.source && item.target
      ? [item.nodeId]
      : [item.value || item.id];
    for (const value of values) {
      if (typeof value === 'string' && variablePattern.test(value)) variables.add(value);
    }
  }
  return [...variables].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

/**
 * @param {QueryItem[]} edges
 * @returns {boolean}
 */
export function hasParallelPredicateVariables(edges) {
  /** @type {Map<string, Set<string>>} */
  const predicatesByEndpoints = new Map();
  for (const edge of edges) {
    const predicate = edge.nodeId;
    if (!predicate || !variablePattern.test(predicate)) continue;
    const subject = edge.sourceValue || edge.source;
    const object = edge.targetValue || edge.target;
    if (!subject || !object || variablePattern.test(subject) || variablePattern.test(object)) continue;

    const key = JSON.stringify([subject, object]);
    const predicates = predicatesByEndpoints.get(key) || new Set();
    predicates.add(predicate);
    if (predicates.size > 1) return true;
    predicatesByEndpoints.set(key, predicates);
  }
  return false;
}

/**
 * Visual kind of a relation label, derived from the predicate rather than a
 * stored flag so rebuilt edges render the same way. A missing predicate is
 * queried through a fallback variable, so it is a variable relation too.
 * @param {{nodeId?: string | null, type?: string | null}} edge
 * @returns {'filter' | 'variable' | 'fixed'}
 */
export function relationLabelKind(edge) {
  if (edge.type === 'filter') return 'filter';
  if (!edge.nodeId || variablePattern.test(edge.nodeId)) return 'variable';
  return 'fixed';
}

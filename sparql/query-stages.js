/**
 * Pure state for ordered multi-variable exploration (DEC-008). The browser
 * adapter owns Cytoscape, the DOM and transport; this module only derives the
 * variable registry, the query signature and block order.
 * @typedef {{
 *   id?: string,
 *   value?: string,
 *   source?: string,
 *   target?: string,
 *   nodeId?: string,
 *   filterType?: number | string | null,
 * }} GraphItem
 * @typedef {{name: string, nodeIds: string[], edgeIds: string[]}} QueryVariableEntry
 */

const variablePattern = /^[?$][A-Za-z_][A-Za-z0-9_]*$/;

/**
 * One entry per distinct variable name, sorted; repeated node/predicate
 * occurrences share an entry and keep their element identities.
 * @param {GraphItem[]} items
 * @returns {QueryVariableEntry[]}
 */
export function buildVariableRegistry(items) {
  /** @type {Map<string, QueryVariableEntry>} */
  const entries = new Map();
  for (const item of items) {
    const isEdge = Boolean(item.source && item.target);
    const name = isEdge ? item.nodeId : (item.value || item.id);
    if (typeof name !== 'string' || !variablePattern.test(name) || !item.id) continue;
    const entry = entries.get(name) || { name, nodeIds: [], edgeIds: [] };
    (isEdge ? entry.edgeIds : entry.nodeIds).push(item.id);
    entries.set(name, entry);
  }
  return [...entries.values()].sort((left, right) => compare(left.name, right.name));
}

/**
 * Stable description of everything a staged query depends on. Labels and
 * positions are excluded so cosmetic edits do not reset the user's order.
 * @param {string} endpointUrl
 * @param {GraphItem[]} items
 * @returns {string}
 */
export function explorationSignature(endpointUrl, items) {
  const parts = items
    .map(item => [item.id ?? '', item.value ?? '', item.source ?? '', item.target ?? '', item.nodeId ?? '', item.filterType ?? ''])
    .map(part => JSON.stringify(part))
    .sort(compare);
  return JSON.stringify([endpointUrl, parts]);
}

/**
 * @param {string[]} order
 * @param {number} from
 * @param {number} to
 * @returns {string[]}
 */
export function moveItem(order, from, to) {
  if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return order.slice();
  const next = order.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * @param {string} left
 * @param {string} right
 */
function compare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

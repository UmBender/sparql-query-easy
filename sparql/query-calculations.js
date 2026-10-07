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
    filterType: filterTypeOf(edge.filterType),
  }));
}

/**
 * The editor stores "" for an exact match; that is no filter, not 0 (Starts with).
 * @param {number | string | null | undefined} filterType
 * @returns {number | null}
 */
export function filterTypeOf(filterType) {
  return filterType == null || filterType === '' ? null : +filterType;
}

const numberPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * Parses a Between value `min..max` (filterType 6, BE-003); both bounds inclusive.
 * @param {string | null | undefined} text
 * @returns {{min: number, max: number} | null}
 */
export function parseBetween(text) {
  const bounds = String(text ?? '').split('..').map(bound => bound.trim());
  if (bounds.length !== 2 || !bounds.every(bound => numberPattern.test(bound))) return null;
  const [min, max] = bounds.map(Number);
  return min <= max ? { min, max } : null;
}

/**
 * Readable label of a filtered literal node: `≥ 100`, `≤ 80`, `40–80`, MAX, MIN.
 * @param {number | string | null | undefined} filterType
 * @param {string} value
 * @returns {string}
 */
export function filterLabel(filterType, value) {
  switch (filterTypeOf(filterType)) {
  case 0: return `starts with ${value}`;
  case 1: return `contains ${value}`;
  case 2: return `\u2265 ${value}`;
  case 3: return `\u2264 ${value}`;
  case 4: return 'MAX';
  case 5: return 'MIN';
  case 6: {
    const range = parseBetween(value);
    return range ? `${range.min}\u2013${range.max}` : value;
  }
  default: return value;
  }
}

/**
 * Request for POST /api/query/numeric-profile (BE-003): the distribution of the
 * relation that points at the literal node [literalId], under the rest of the query.
 * Returns null unless exactly one fixed-IRI relation points at that node.
 * @param {{endpointUrl: string, edges: FilterEdge[], literalId: string, limit?: number}} input
 * @returns {{endpointUrl: string, where: QueryFilter[], subject: string, predicate: string, limit: number} | null}
 */
export function numericProfileRequest({ endpointUrl, edges, literalId, limit = 500 }) {
  const profiled = edges.filter(edge => edge.target === literalId);
  if (profiled.length !== 1) return null;
  const [edge] = profiled;
  const predicate = edge.nodeId;
  if (!predicate || !predicate.startsWith('<') || predicate.includes('>/<')) return null;
  return {
    endpointUrl,
    where: buildFilters(edges.filter(item => item !== edge)),
    subject: edge.sourceValue || edge.source,
    predicate,
    limit,
  };
}

/** At most this many filter steps are counted by the funnel (FE-028). */
export const MAX_FUNNEL_STEPS = 8;

/** Variables standing in for a relaxed step value; the count route never sees user names with it. */
const funnelVariablePrefix = '?__funnel';

/**
 * @typedef {{
 *   key: string,
 *   index: number,
 *   counted: boolean,
 * }} FunnelStep
 */

/**
 * @typedef {{
 *   variableName: string,
 *   steps: FunnelStep[],
 *   orderingOnly: number,
 *   requests: ({endpointUrl: string, variableName: string, where: QueryFilter[]} | null)[],
 * }} FunnelPlan
 */

/**
 * A filter step is a fixed-predicate relation whose object is a fixed value (an IRI or
 * a literal, with or without a comparison). MAX/MIN only order the result, so they
 * are not steps.
 * @param {FilterEdge} edge
 * @returns {'step' | 'ordering' | null}
 */
export function funnelStepKind(edge) {
  const predicate = edge.nodeId;
  const object = edge.targetValue || edge.target;
  if (!predicate || !predicate.startsWith('<') || /^[?$]/.test(object)) return null;
  const filterType = filterTypeOf(edge.filterType);
  return filterType === 4 || filterType === 5 ? 'ordering' : 'step';
}

/**
 * Count requests of the filter funnel (POST /api/query/count). `requests[0]` is the
 * base: every step relaxed to "has this relation with any value". `requests[i]`
 * applies the enabled steps among the first i; it is null when step i is disabled,
 * because its count is the previous one. Steps beyond [maxSteps] stay relaxed and
 * are not counted. Disabling a step therefore only changes later counts.
 * @param {{endpointUrl: string, edges: FilterEdge[], variableName: string, disabled?: Iterable<string>, maxSteps?: number}} input
 * @returns {FunnelPlan}
 */
export function filterFunnelPlan({ endpointUrl, edges, variableName, disabled = [], maxSteps = MAX_FUNNEL_STEPS }) {
  const off = new Set(disabled);
  /** @type {FunnelStep[]} */
  const steps = [];
  let orderingOnly = 0;
  /** @type {Map<FilterEdge, number>} */
  const stepIndex = new Map();
  edges.forEach(edge => {
    const kind = funnelStepKind(edge);
    if (kind === 'ordering') orderingOnly += 1;
    if (kind !== 'step') return;
    stepIndex.set(edge, steps.length);
    steps.push({ key: funnelStepKey(edge), index: steps.length, counted: steps.length < maxSteps });
  });
  /** @param {number} applied */
  const where = applied => buildFilters(edges.map((edge, position) => {
    const kind = funnelStepKind(edge);
    const index = stepIndex.get(edge);
    const keep = kind === 'step' && index !== undefined && index < applied && !off.has(steps[index].key);
    if (kind === null || keep) return edge;
    return { ...edge, target: `${funnelVariablePrefix}${position}`, targetValue: `${funnelVariablePrefix}${position}`, filterType: null };
  }));
  const counted = steps.filter(step => step.counted);
  const requests = [
    { endpointUrl, variableName, where: where(0) },
    ...counted.map(step => off.has(step.key) ? null : { endpointUrl, variableName, where: where(step.index + 1) }),
  ];
  return { variableName, steps, orderingOnly, requests };
}

/**
 * Stable identity of a step: the relation id when the graph gives one.
 * @param {FilterEdge} edge
 * @returns {string}
 */
export function funnelStepKey(edge) {
  return edge.id || JSON.stringify([edge.source, edge.nodeId, edge.target]);
}

/**
 * Remaining count after each counted step; a disabled step (null request) repeats
 * the previous count.
 * @param {FunnelPlan['requests']} requests
 * @param {(number | undefined)[]} counts aligned with requests; undefined while unknown
 * @returns {(number | null)[]} one entry per counted step, null while unknown
 */
export function funnelStepCounts(requests, counts) {
  /** @type {(number | null)[]} */
  const result = [];
  let previous = counts[0] ?? null;
  for (let index = 1; index < requests.length; index++) {
    const current = requests[index] === null ? previous : (counts[index] ?? null);
    result.push(current);
    previous = current;
  }
  return result;
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

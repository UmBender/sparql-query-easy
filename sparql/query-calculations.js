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

/** @typedef {{min: number, max: number, step: number, decimals: number}} RangeScale */

/**
 * Slider scale for a numeric profile (FE-026): whole numbers step by 1, other
 * data by a power of ten near 1/100 of the span. The slider ends are aligned
 * to the step and enclose the data.
 * @param {number[]} numbers
 * @returns {RangeScale | null}
 */
export function rangeScale(numbers) {
  if (!numbers.length || !numbers.every(Number.isFinite)) return null;
  const dataMin = Math.min(...numbers);
  const dataMax = Math.max(...numbers);
  const exponent = numbers.every(Number.isInteger) ? 0
    : Math.min(0, Math.floor(Math.log10((dataMax - dataMin) / 100 || 1)));
  const step = 10 ** exponent;
  const decimals = exponent === 0 ? 0 : -exponent;
  const align = (/** @type {number} */ value, /** @type {(n: number) => number} */ round) =>
    Number((round(Number((value / step).toFixed(6))) * step).toFixed(decimals));
  return { min: align(dataMin, Math.floor), max: align(dataMax, Math.ceil), step, decimals };
}

/**
 * Equal-width bins over [min, max] (last bin inclusive), with how many values
 * of each bin lie inside the kept range [lo, hi].
 * @param {number[]} numbers
 * @param {{min: number, max: number, lo: number, hi: number, binCount: number}} options
 * @returns {{from: number, to: number, count: number, kept: number}[]}
 */
export function histogramBins(numbers, { min, max, lo, hi, binCount }) {
  const count = max > min ? Math.max(1, Math.floor(binCount)) : 1;
  const width = (max - min) / count;
  const bins = Array.from({ length: count }, (_, index) => ({
    from: min + index * width,
    to: index === count - 1 ? max : min + (index + 1) * width,
    count: 0,
    kept: 0,
  }));
  for (const value of numbers) {
    if (value < min || value > max) continue;
    const bin = bins[width > 0 ? Math.min(count - 1, Math.floor((value - min) / width)) : 0];
    bin.count++;
    if (value >= lo && value <= hi) bin.kept++;
  }
  return bins;
}

/**
 * How many values lie inside the inclusive range [lo, hi].
 * @param {number[]} numbers
 * @param {number} lo
 * @param {number} hi
 */
export function countInRange(numbers, lo, hi) {
  return numbers.filter(value => value >= lo && value <= hi).length;
}

/**
 * Filter written by the range slider (FE-026). A handle at its slider end
 * means "no bound on that side": only the low handle moved gives At least (2),
 * only the high handle gives At most (3), otherwise Between (6) `lo..hi`.
 * @param {RangeScale} scale
 * @param {number} lo
 * @param {number} hi
 * @returns {{filterType: number, value: string}}
 */
export function rangeFilter(scale, lo, hi) {
  const format = (/** @type {number} */ value) => String(Number(value.toFixed(scale.decimals)));
  const lowOpen = lo <= scale.min;
  const highOpen = hi >= scale.max;
  if (!lowOpen && highOpen) return { filterType: 2, value: format(lo) };
  if (lowOpen && !highOpen) return { filterType: 3, value: format(hi) };
  return { filterType: 6, value: `${format(lo)}..${format(hi)}` };
}

/**
 * Slider handles for an editor value: Between, At least and At most set the
 * matching bounds (clamped to the scale); anything else selects the whole range.
 * @param {RangeScale} scale
 * @param {number | string | null | undefined} filterType
 * @param {string} value
 * @returns {{lo: number, hi: number}}
 */
export function rangeFromFilter(scale, filterType, value) {
  const clamp = (/** @type {number} */ number) => Math.min(scale.max, Math.max(scale.min, number));
  const number = numberPattern.test(String(value ?? '').trim()) ? Number(value) : NaN;
  switch (filterTypeOf(filterType)) {
  case 2: return Number.isFinite(number) ? { lo: clamp(number), hi: scale.max } : { lo: scale.min, hi: scale.max };
  case 3: return Number.isFinite(number) ? { lo: scale.min, hi: clamp(number) } : { lo: scale.min, hi: scale.max };
  case 6: {
    const range = parseBetween(value);
    return range ? { lo: clamp(range.min), hi: clamp(range.max) } : { lo: scale.min, hi: scale.max };
  }
  default: return { lo: scale.min, hi: scale.max };
  }
}

/** @typedef {'exact' | 'atLeast' | 'atMost' | 'between'} CycleMode */

/**
 * Which kind of fixed range a numeric filter type keeps (FE-035); null for
 * MAX, MIN and text filters, whose kept entities are not known in advance.
 * @param {number | string | null | undefined} filterType
 * @returns {CycleMode | null}
 */
export function cycleMode(filterType) {
  switch (filterTypeOf(filterType)) {
  case null: return 'exact';
  case 2: return 'atLeast';
  case 3: return 'atMost';
  case 6: return 'between';
  default: return null;
  }
}

/**
 * @typedef {{entity: unknown, label?: string | null, value: string, number: number}} ProfileValue
 * @typedef {{key: string, label: string, values: {value: string, number: number}[]}} KeptEntity
 * @typedef {{group: 'nodes' | 'edges', data: Record<string, string>, position?: {x: number, y: number}}} PreviewElement
 */

/**
 * Distinct entities of the profile rows kept by [lo, hi] (FE-035), each with
 * all of its kept values (duplicates removed), ordered by its lowest kept
 * value, then label. These are the possible bindings the editor cycles over.
 * @param {ProfileValue[]} values
 * @param {number} lo
 * @param {number} hi
 * @returns {KeptEntity[]}
 */
export function keptEntities(values, lo, hi) {
  /** @type {Map<string, KeptEntity>} */
  const entities = new Map();
  for (const item of values) {
    if (!Number.isFinite(item.number) || item.number < lo || item.number > hi) continue;
    const raw = item.entity && typeof item.entity === 'object' && 'value' in item.entity ? item.entity.value : item.entity;
    const key = String(raw ?? '').replace(/^<|>$/g, '');
    const entity = entities.get(key)
      ?? { key, label: item.label || key.slice(Math.max(key.lastIndexOf('#'), key.lastIndexOf('/')) + 1) || key, values: [] };
    if (!entity.values.some(value => value.number === item.number && value.value === item.value)) {
      entity.values.push({ value: item.value, number: item.number });
    }
    entities.set(key, entity);
  }
  const list = [...entities.values()];
  list.forEach(entity => entity.values.sort((a, b) => a.number - b.number));
  return list.sort((a, b) => a.values[0].number - b.values[0].number || a.label.localeCompare(b.label));
}

/**
 * Mini result graph for the entities shown in one cycle step (FE-035): each
 * entity above its value nodes, linked by the relation label, side by side.
 * @param {KeptEntity[]} entities
 * @param {string} relation
 * @returns {PreviewElement[]}
 */
export function possibilityGraph(entities, relation) {
  /** @type {PreviewElement[]} */
  const elements = [];
  let x = 0;
  entities.forEach((entity, index) => {
    const width = Math.max(1, entity.values.length) * 110;
    const entityId = `e${index}`;
    elements.push({ group: 'nodes', data: { id: entityId, kind: 'entity', label: entity.label }, position: { x: x + (width - 110) / 2, y: 0 } });
    entity.values.forEach((value, valueIndex) => {
      const valueId = `${entityId}v${valueIndex}`;
      elements.push({ group: 'nodes', data: { id: valueId, kind: 'value', label: value.value }, position: { x: x + valueIndex * 110, y: 120 } });
      elements.push({ group: 'edges', data: { id: `${entityId}-${valueId}`, source: entityId, target: valueId, label: relation } });
    });
    x += width + 40;
  });
  return elements;
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

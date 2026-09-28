/**
 * Pure state for ordered multi-variable exploration (DEC-008). The browser
 * adapter owns Cytoscape, the DOM and transport; this module only derives the
 * variable registry, the query signature, block order and stage requests, and
 * budgets preview requests through injected timer/fetch functions.
 * @typedef {{
 *   id?: string,
 *   value?: string,
 *   source?: string,
 *   target?: string,
 *   nodeId?: string,
 *   filterType?: number | string | null,
 * }} GraphItem
 * @typedef {{name: string, nodeIds: string[], edgeIds: string[]}} QueryVariableEntry
 * @typedef {{type: 'iri' | 'literal' | 'bnode', value: string, datatype?: string | null, language?: string | null}} RdfTerm
 * @typedef {{term: RdfTerm, label: string | null, selectable: boolean}} StageCandidate
 * @typedef {{variableName: string, offset: number, limit: number, hasMore: boolean, candidates: StageCandidate[]}} StagePage
 * @typedef {{variableName: string, term: RdfTerm}} StageBinding
 * @typedef {{subject: string, predicate: string, object: string, filterType: number | null}} WhereItem
 * @typedef {{endpointUrl: string, variableName: string, where: WhereItem[], bindings: StageBinding[], limit: number, offset: number}} StageRequest
 * @typedef {{key: string | null, status: 'idle' | 'loading' | 'loaded' | 'error', page?: StagePage, error?: string}} PreviewState
 */

export const MAX_STAGE_PAGE_SIZE = 50;
export const PREVIEW_DELAY_MS = 300;

const variablePattern = /^[?$][A-Za-z_][A-Za-z0-9_]*$/;
const XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string';
const RDF_LANG_STRING = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';

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
 * @param {number} limit
 * @returns {number}
 */
export function stagePageSize(limit) {
  return Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), MAX_STAGE_PAGE_SIZE) : 20;
}

/**
 * @param {{endpointUrl: string, where: WhereItem[], variableName: string, bindings: StageBinding[], limit: number, offset?: number}} input
 * @returns {StageRequest}
 */
export function stageRequest({ endpointUrl, where, variableName, bindings, limit, offset = 0 }) {
  return {
    endpointUrl,
    variableName,
    where,
    bindings: bindings.map(binding => ({ variableName: binding.variableName, term: binding.term })),
    limit: stagePageSize(limit),
    offset,
  };
}

/**
 * The cache key covers the signature and binding path because the request
 * contains the endpoint, patterns, bindings, variable and page.
 * @param {StageRequest} request
 * @returns {string}
 */
export function stageCacheKey(request) {
  return JSON.stringify(request);
}

/**
 * @param {RdfTerm} term
 * @returns {string}
 */
export function termKey(term) {
  return JSON.stringify([term.type, term.value, term.datatype ?? null, term.language ?? null]);
}

/**
 * @param {StageCandidate} candidate
 * @returns {string}
 */
export function candidateText(candidate) {
  return candidate.label || candidate.term.value;
}

/**
 * Short type hint shown beside a candidate; never used as a binding.
 * @param {RdfTerm} term
 * @returns {string}
 */
export function termHint(term) {
  if (term.type === 'iri') return 'IRI';
  if (term.type === 'bnode') return 'blank node';
  if (term.language) return `literal @${term.language}`;
  if (term.datatype && term.datatype !== XSD_STRING && term.datatype !== RDF_LANG_STRING) {
    return `literal ${term.datatype.slice(Math.max(term.datatype.lastIndexOf('#'), term.datatype.lastIndexOf('/')) + 1)}`;
  }
  return 'literal';
}

/**
 * Value used by the legacy graph/query model when a binding is applied.
 * IRIs keep angle brackets; literals use their lexical form like other literal nodes.
 * @param {RdfTerm} term
 * @returns {string}
 */
export function termGraphValue(term) {
  return term.type === 'iri' ? `<${term.value}>` : term.value;
}

/**
 * Budgeted hover/focus preview: one delayed request at a time, superseded
 * requests are aborted and their responses ignored, and results are cached.
 * @param {{
 *   fetchPage: (request: StageRequest, signal: AbortSignal) => Promise<StagePage>,
 *   onUpdate: (state: PreviewState) => void,
 *   cache: Map<string, StagePage>,
 *   delay?: number,
 *   setTimer?: (callback: () => void, delay: number) => unknown,
 *   clearTimer?: (handle: any) => void,
 * }} options
 */
export function createPreviewScheduler({ fetchPage, onUpdate, cache, delay = PREVIEW_DELAY_MS, setTimer = setTimeout, clearTimer = clearTimeout }) {
  /** @type {string | null} */
  let currentKey = null;
  /** @type {unknown} */
  let timer = null;
  /** @type {AbortController | null} */
  let inFlight = null;

  function stopPending() {
    if (timer !== null) clearTimer(timer);
    timer = null;
    inFlight?.abort();
    inFlight = null;
  }

  /** @param {StageRequest} request */
  function dispatch(request) {
    const key = stageCacheKey(request);
    const controller = new AbortController();
    inFlight = controller;
    onUpdate({ key, status: 'loading' });
    fetchPage(request, controller.signal).then(
      page => {
        if (controller.signal.aborted) return;
        cache.set(key, page);
        if (inFlight === controller) inFlight = null;
        if (currentKey === key) onUpdate({ key, status: 'loaded', page });
      },
      error => {
        if (controller.signal.aborted) return;
        if (inFlight === controller) inFlight = null;
        if (currentKey !== key) return;
        // Forget the failed key so hovering the same value again can retry after the delay.
        currentKey = null;
        onUpdate({ key, status: 'error', error: error instanceof Error ? error.message : String(error) });
      },
    );
  }

  return {
    /** @param {StageRequest} request */
    schedule(request) {
      const key = stageCacheKey(request);
      if (key === currentKey) return;
      stopPending();
      currentKey = key;
      const cached = cache.get(key);
      if (cached) {
        onUpdate({ key, status: 'loaded', page: cached });
        return;
      }
      timer = setTimer(() => {
        timer = null;
        dispatch(request);
      }, delay);
    },
    /** Drop an undispatched preview (pointer left before the delay); a dispatched one completes. */
    settle() {
      if (timer === null) return;
      clearTimer(timer);
      timer = null;
      currentKey = null;
    },
    /** Cancel an undispatched or in-flight preview and forget the current assumption. */
    cancel() {
      stopPending();
      currentKey = null;
      onUpdate({ key: null, status: 'idle' });
    },
    get currentKey() {
      return currentKey;
    },
  };
}

/**
 * @param {string} left
 * @param {string} right
 */
function compare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

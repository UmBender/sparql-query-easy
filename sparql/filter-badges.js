// FE-036: badges over filtered value nodes in the main graph (badge ported from FE-027).
// - While the node's subject is a variable: a live "kept / total" count from the
//   BE-003 numeric profile, for At least, At most, Between, MAX and MIN.
// - Once the subject is a fixed entity (Assume/Apply, or built that way): the
//   entity's actual values in a chip under the node, and a ✓/✗ badge saying
//   whether they pass the filter the node keeps.
// Badges are an overlay plus one node class; they never change element data,
// so they cannot change a query. Classic script loaded by index2.html before
// its DOMContentLoaded script.
'use strict';

const FILTER_BADGE_DEBOUNCE_MS = 400;
const FILTER_BADGE_CACHE_SIZE = 60;
const FILTER_ACTUAL_SHOWN = 3;
// Lookups are keyed by their whole request, so a new filter value on the same
// relation reuses the loaded distribution or values. Failures are not kept.
const filterBadgeCache = new Map();

function cachedBadgeLookup(kind, request, load) {
    const key = `${kind} ${JSON.stringify(request)}`;
    let entry = filterBadgeCache.get(key);
    if (!entry) {
        entry = load(request);
        entry.catch(() => { if (filterBadgeCache.get(key) === entry) filterBadgeCache.delete(key); });
        filterBadgeCache.set(key, entry);
        if (filterBadgeCache.size > FILTER_BADGE_CACHE_SIZE) filterBadgeCache.delete(filterBadgeCache.keys().next().value);
    }
    return entry;
}

function loadBadgeProfile(request) {
    return cachedBadgeLookup('profile', request, async item => {
        const profile = await postNumericProfile(item);
        if (!profile || !Array.isArray(profile.values) || !Number.isFinite(profile.count)) {
            throw new Error('Unexpected numeric profile response.');
        }
        return profile;
    });
}

function loadActualValues(request) {
    return cachedBadgeLookup('values', request, postActualValues);
}

const filterBadges = { layer: null, timer: null, generation: 0, byNode: new Map(), frame: null };

function initFilterBadges() {
    const layer = document.createElement('div');
    layer.id = 'filter-badge-layer';
    layer.setAttribute('aria-label', 'Filter results');
    cy.container().appendChild(layer);
    filterBadges.layer = layer;

    cy.on('add remove data', scheduleFilterBadgeRefresh);
    const endpoint = document.getElementById('input-endpoint-sparql');
    endpoint.addEventListener('input', scheduleFilterBadgeRefresh);
    endpoint.addEventListener('change', scheduleFilterBadgeRefresh);
    cy.on('pan zoom resize', scheduleFilterBadgePosition);
    cy.on('position', 'node', scheduleFilterBadgePosition);
    scheduleFilterBadgeRefresh();
}

function scheduleFilterBadgeRefresh() {
    clearTimeout(filterBadges.timer);
    filterBadges.timer = setTimeout(refreshFilterBadges, FILTER_BADGE_DEBOUNCE_MS);
}

/** What each filtered node shows: an actual-value check or a profile count. */
function wantedFilterBadges() {
    const qc = window.queryCalculations;
    const endpointUrl = getEndpoint();
    const wanted = new Map();
    cy.nodes().forEach(node => {
        const filterType = qc.filterTypeOf(node.data('filterType'));
        if (filterType === null) return;
        const edges = filterEdgeItems(node.component());
        const literalId = node.id();
        const filter = { filterType, value: String(node.data('value') ?? '') };
        const actual = qc.actualValueRequest({ endpointUrl, edges, literalId });
        if (actual) {
            wanted.set(literalId, { kind: 'actual', request: actual, ...filter });
            return;
        }
        const profile = filterType >= 2 && qc.numericProfileRequest({ endpointUrl, edges, literalId });
        if (profile) wanted.set(literalId, { kind: 'count', request: profile, ...filter });
    });
    return wanted;
}

function refreshFilterBadges() {
    if (!filterBadges.layer) return;
    const generation = ++filterBadges.generation;
    const wanted = wantedFilterBadges();
    for (const nodeId of [...filterBadges.byNode.keys()]) {
        if (!wanted.has(nodeId)) removeFilterBadge(nodeId);
    }
    const current = nodeId => generation === filterBadges.generation && cy.getElementById(nodeId).length > 0;
    wanted.forEach((item, nodeId) => {
        if (item.kind === 'count') showFilterCount(nodeId, item, current);
        else showActualValue(nodeId, item, current);
    });
}

function showFilterCount(nodeId, { request, filterType, value }, current) {
    setFilterChip(nodeId, null);
    setFilterBadge(nodeId, { state: 'loading', text: '…', description: 'Counting values kept by this filter…' });
    loadBadgeProfile(request).then(profile => {
        if (!current(nodeId)) return;
        const count = window.queryCalculations.filterBadgeCount(profile, filterType, value);
        if (!count) {
            setFilterBadge(nodeId, null);
            return;
        }
        const { kept, total, exact, truncated } = count;
        const note = truncated ? ` (only the lowest ${profile.values.length} values were loaded)` : '';
        setFilterBadge(nodeId, {
            state: kept === 0 && exact ? 'none' : truncated ? 'truncated' : 'ok',
            text: `${kept}${exact ? '' : '+'} / ${total}`,
            description: `This filter keeps ${exact ? '' : 'at least '}${kept} of ${total} values${note}.`,
        });
    }, error => {
        if (!current(nodeId)) return;
        setFilterBadge(nodeId, { state: 'error', text: '?', description: `Could not count values: ${error.message}` });
    });
}

function showActualValue(nodeId, { request, filterType, value }, current) {
    const qc = window.queryCalculations;
    const filter = qc.filterLabel(filterType, value);
    const unknown = reason => {
        setFilterChip(nodeId, { state: 'unknown', text: 'value unknown', description: reason });
        setFilterBadge(nodeId, { state: 'error', text: '?', description: `${reason} The filter ${filter} cannot be checked.` });
    };
    setFilterChip(nodeId, { state: 'loading', text: '…', description: 'Loading the actual value…' });
    setFilterBadge(nodeId, { state: 'loading', text: '…', description: 'Checking the actual value against this filter…' });
    loadActualValues(request).then(values => {
        if (!current(nodeId)) return;
        if (!values.length) {
            unknown('This entity has no value for this relation.');
            return;
        }
        const shown = values.slice(0, FILTER_ACTUAL_SHOWN).join(', ') + (values.length > FILTER_ACTUAL_SHOWN ? ', …' : '');
        const all = values.join(', ');
        setFilterChip(nodeId, { state: 'ok', text: shown, description: `Actual value: ${all}` });
        const passes = qc.filterAccepts(filterType, value, values);
        if (passes === null) {
            setFilterBadge(nodeId, null);
            return;
        }
        setFilterBadge(nodeId, passes
            ? { state: 'ok', text: '✓', description: `The actual value ${all} passes the filter ${filter}.` }
            : { state: 'none', text: '✗', description: `The actual value ${all} does not pass the filter ${filter}.` });
    }, error => {
        if (!current(nodeId)) return;
        unknown(`Could not load the actual value: ${error.message}.`);
    });
}

function filterBadgeEntry(nodeId) {
    let entry = filterBadges.byNode.get(nodeId);
    if (!entry) {
        entry = { badge: null, chip: null };
        filterBadges.byNode.set(nodeId, entry);
    }
    return entry;
}

function overlayElement(className, nodeId) {
    const element = document.createElement('span');
    element.className = className;
    element.tabIndex = 0;
    element.setAttribute('role', 'note');
    element.dataset.nodeId = nodeId;
    filterBadges.layer.appendChild(element);
    return element;
}

function describeOverlay(element, { state, text, description }) {
    element.dataset.state = state;
    element.textContent = text;
    element.title = description;
    element.setAttribute('aria-label', description);
    element.setAttribute('aria-busy', String(state === 'loading'));
}

/** Count or pass/fail badge above the node; null removes it. */
function setFilterBadge(nodeId, content) {
    const entry = filterBadgeEntry(nodeId);
    const node = cy.getElementById(nodeId);
    if (!content) {
        entry.badge?.remove();
        entry.badge = null;
        node.removeClass('filter-keeps-none');
        return;
    }
    entry.badge ??= overlayElement('filter-badge', nodeId);
    describeOverlay(entry.badge, content);
    if (content.state === 'none') node.addClass('filter-keeps-none');
    else node.removeClass('filter-keeps-none');
    positionFilterOverlay(nodeId, entry);
}

/** Actual-value chip under the node; null removes it. */
function setFilterChip(nodeId, content) {
    const entry = filterBadgeEntry(nodeId);
    if (!content) {
        entry.chip?.remove();
        entry.chip = null;
        return;
    }
    entry.chip ??= overlayElement('filter-actual-value', nodeId);
    describeOverlay(entry.chip, content);
    positionFilterOverlay(nodeId, entry);
}

function removeFilterBadge(nodeId) {
    const entry = filterBadges.byNode.get(nodeId);
    entry?.badge?.remove();
    entry?.chip?.remove();
    filterBadges.byNode.delete(nodeId);
    cy.getElementById(nodeId).removeClass('filter-keeps-none');
}

function scheduleFilterBadgePosition() {
    if (filterBadges.frame !== null) return;
    filterBadges.frame = requestAnimationFrame(() => {
        filterBadges.frame = null;
        filterBadges.byNode.forEach((entry, nodeId) => positionFilterOverlay(nodeId, entry));
    });
}

function positionFilterOverlay(nodeId, { badge, chip }) {
    const node = cy.getElementById(nodeId);
    if (!node.length) return;
    const box = node.renderedBoundingBox({ includeLabels: false, includeOverlays: false });
    const x = `${(box.x1 + box.x2) / 2}px`;
    if (badge) Object.assign(badge.style, { left: x, top: `${box.y1 - 4}px` });
    if (chip) Object.assign(chip.style, { left: x, top: `${box.y2 + 4}px` });
}

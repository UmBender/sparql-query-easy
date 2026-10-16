// Filter funnel panel (FE-028): remaining distinct results after each filter step.
// Classic script loaded by index2.html after stage-order.js; top-level functions stay
// global for inline handlers and tests. Toggles are preview-only: Run Query and View
// SPARQL always send every filter.
'use strict';

const FUNNEL_DEBOUNCE_MS = 350;
const FUNNEL_CACHE_LIMIT = 200;
const funnelCountCache = new Map();

let funnelState = {
    open: false,
    disabled: new Set(),
    variable: null,
    controller: null,
    timer: null,
    returnFocus: null,
    generation: 0,
};

function toggleFilterFunnel() {
    if (funnelState.open) closeFilterFunnel();
    else openFilterFunnel();
}

function openFilterFunnel() {
    funnelState.open = true;
    funnelState.returnFocus = document.activeElement;
    document.getElementById('filter-funnel-panel').hidden = false;
    document.getElementById('filter-funnel-btn').setAttribute('aria-expanded', 'true');
    document.getElementById('filter-funnel-close').focus();
    refreshFilterFunnel();
}

function closeFilterFunnel() {
    const panel = document.getElementById('filter-funnel-panel');
    const restoreFocus = panel.contains(document.activeElement);
    funnelState.open = false;
    clearTimeout(funnelState.timer);
    funnelState.controller?.abort();
    funnelState.controller = null;
    panel.hidden = true;
    document.getElementById('filter-funnel-btn').setAttribute('aria-expanded', 'false');
    if (restoreFocus) (funnelState.returnFocus?.isConnected ? funnelState.returnFocus : document.getElementById('filter-funnel-btn')).focus();
}

/** Graph and endpoint edits refresh an open funnel after a short pause. */
function scheduleFilterFunnelRefresh() {
    if (!funnelState.open) return;
    clearTimeout(funnelState.timer);
    funnelState.timer = setTimeout(refreshFilterFunnel, FUNNEL_DEBOUNCE_MS);
}

function setFunnelStepEnabled(key, enabled) {
    if (enabled) funnelState.disabled.delete(key);
    else funnelState.disabled.add(key);
    refreshFilterFunnel();
}

function setFunnelVariable(name) {
    funnelState.variable = name;
    refreshFilterFunnel();
    scheduleFilterBadgeRefresh(); // FE-039: badges count the same variable
}

async function fetchResultCount(request, signal) {
    const response = await fetch(apiUrl('/api/query/count'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
        signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || `Count failed (${response.status}).`);
    if (!Number.isFinite(body?.data?.count)) throw new Error('Unexpected count response.');
    return body.data.count;
}

// FE-039: badges share the funnel's counts; one in-flight request per count.
const funnelCountLoads = new Map();

function rememberFunnelCount(request, count) {
    if (funnelCountCache.size >= FUNNEL_CACHE_LIMIT) funnelCountCache.clear();
    funnelCountCache.set(funnelCacheKey(request), count);
}

/** Share an in-flight count so badges wait for it instead of asking again. */
function trackResultCount(request, load) {
    const key = funnelCacheKey(request);
    const tracked = load.then(count => {
        rememberFunnelCount(request, count);
        return count;
    }).finally(() => { if (funnelCountLoads.get(key) === tracked) funnelCountLoads.delete(key); });
    funnelCountLoads.set(key, tracked);
    return tracked;
}

/** A cached count, or the one request for it; an aborted funnel request is asked again. */
function loadResultCount(request) {
    const key = funnelCacheKey(request);
    if (funnelCountCache.has(key)) return Promise.resolve(funnelCountCache.get(key));
    const shared = funnelCountLoads.get(key);
    if (shared) return shared.catch(error => (error?.name === 'AbortError' ? loadResultCount(request) : Promise.reject(error)));
    return trackResultCount(request, fetchResultCount(request));
}

/** Variable counted by default: the first entity variable, not a value variable (FE-039). */
function defaultFunnelVariable(variables) {
    const isValueVariable = name => cy.nodes().some(node => node.data('value') === name && window.graphModel.isValueVariable(node.data()));
    return variables.find(name => !isValueVariable(name)) ?? variables[0];
}

/**
 * The funnel plan for the current graph, or a message saying why it cannot count.
 * Badges (FE-039) ask for it without preview toggles: the query as it runs.
 */
function currentFunnelPlan(disabled = funnelState.disabled) {
    const { component, ambiguous } = selectQueryComponent();
    if (ambiguous) return { message: SEPARATE_VARIABLE_GROUPS_MESSAGE };
    if (!component || !component.edges().length) return { message: 'Add a relation with a variable to see how its filters narrow the result.' };
    const variables = getVariableOrder();
    if (!variables.length) {
        const name = extractVariableName(component);
        if (name) variables.push(name);
    }
    if (!variables.length) return { message: 'Add at least one variable (?) node to count results.' };
    const variableName = variables.includes(funnelState.variable) ? funnelState.variable : defaultFunnelVariable(variables);
    const edges = filterEdgeItems(component);
    const plan = window.queryCalculations.filterFunnelPlan({
        endpointUrl: getEndpoint(),
        edges,
        variableName,
        disabled,
        variableFilters: variableFilterItems(component),
    });
    return { plan, variables, edges };
}

/** What the funnel can count right now, or a message saying why it cannot. */
function funnelInput() {
    const input = currentFunnelPlan();
    if (!input.plan) return input;
    const { plan, variables, edges } = input;
    const present = new Set(plan.steps.map(step => step.key));
    funnelState.disabled.forEach(key => { if (!present.has(key)) funnelState.disabled.delete(key); });
    return { plan, variables, labels: plan.steps.map(step => funnelStepLabel(step.key, edges)) };
}

function funnelStepLabel(key, edges) {
    const edge = edges.find(item => window.queryCalculations.funnelStepKey(item) === key);
    const relation = cy.getElementById(edge.id || '').data('label') || edge.nodeId;
    const target = cy.getElementById(edge.target);
    if (window.graphModel.isValueVariable(target.data())) {
        // FE-039: a value variable's step reads like a filtered value.
        const { filterType, value } = window.graphModel.nodeFilter(target.data());
        return filterType === null ? `${relation} = ${value}` : `${relation} ${window.queryCalculations.filterLabel(filterType, value)}`;
    }
    const value = target.data('label') || edge.targetValue;
    const exact = window.queryCalculations.filterTypeOf(target.data('filterType')) === null;
    return `${relation} ${exact ? '= ' : ''}${value}`;
}

function funnelCacheKey(request) {
    return JSON.stringify(request);
}

function refreshFilterFunnel() {
    if (!funnelState.open) return;
    clearTimeout(funnelState.timer);
    funnelState.controller?.abort();
    funnelState.controller = null;
    const generation = ++funnelState.generation;
    const input = funnelInput();
    if (!input.plan) {
        renderFilterFunnel({ message: input.message });
        return;
    }
    const { plan } = input;
    const counts = plan.requests.map(request => request ? funnelCountCache.get(funnelCacheKey(request)) : undefined);
    const missing = plan.requests
        .map((request, index) => ({ request, index }))
        .filter(({ request, index }) => request && counts[index] === undefined);
    const view = { ...input, counts, status: missing.length ? 'loading' : 'loaded', error: null };
    renderFilterFunnel(view);
    if (!missing.length) return;

    // One request at a time keeps the endpoint load bounded; a newer refresh aborts it.
    const controller = new AbortController();
    funnelState.controller = controller;
    (async () => {
        for (const { request, index } of missing) {
            const count = await trackResultCount(request, fetchResultCount(request, controller.signal));
            if (generation !== funnelState.generation) return;
            counts[index] = count;
            renderFilterFunnel(view);
        }
        if (generation !== funnelState.generation) return;
        funnelState.controller = null;
        renderFilterFunnel({ ...view, status: 'loaded' });
    })().catch(error => {
        if (generation !== funnelState.generation || controller.signal.aborted) return;
        funnelState.controller = null;
        renderFilterFunnel({ ...view, status: 'error', error: error instanceof Error ? error.message : String(error) });
    });
}

function renderFilterFunnel(view) {
    const focusedKey = document.activeElement?.closest?.('#filter-funnel-panel')
        ? document.activeElement.getAttribute('data-step-key') : null;
    const status = document.getElementById('filter-funnel-status');
    const list = document.getElementById('filter-funnel-steps');
    const variablePicker = document.getElementById('filter-funnel-variable');
    const result = document.getElementById('filter-funnel-result');
    const retry = document.getElementById('filter-funnel-retry');
    status.classList.toggle('error', view.status === 'error');
    retry.hidden = view.status !== 'error';

    if (!view.plan) {
        status.textContent = view.message;
        list.replaceChildren();
        variablePicker.replaceChildren();
        result.textContent = '';
        return;
    }
    const { plan, counts, labels } = view;
    const base = counts[0];
    const stepCounts = window.queryCalculations.funnelStepCounts(plan.requests, counts);
    const off = plan.steps.filter(step => funnelState.disabled.has(step.key)).length;

    renderFunnelVariablePicker(variablePicker, view.variables, plan.variableName);
    status.textContent = view.status === 'loading' ? 'Counting…'
        : view.status === 'error' ? `Could not count results: ${view.error}`
            : plan.steps.length ? '' : 'This query has no filters yet. Give a relation a fixed value or a comparison to add a step.';

    const rows = [funnelRow({ label: 'With these relations, any value', count: base, base })];
    let previous = base;
    plan.steps.forEach((step, index) => {
        const enabled = !funnelState.disabled.has(step.key);
        const count = step.counted ? stepCounts[index] : null;
        rows.push(funnelRow({ step, label: labels[index], enabled, count, base, previous }));
        if (step.counted) previous = count;
    });
    list.replaceChildren(...rows);

    const last = stepCounts.length ? stepCounts[stepCounts.length - 1] : base;
    const parts = [];
    if (last != null) parts.push(`Result: ${last} ${plan.variableName}${base != null ? ` of ${base}` : ''}.`);
    if (off) parts.push(`Preview without ${off} filter${off === 1 ? '' : 's'}; Run Query still applies every filter.`);
    if (plan.steps.some(step => !step.counted)) parts.push(`Only the first ${window.queryCalculations.MAX_FUNNEL_STEPS} filters are counted.`);
    if (plan.extremes) parts.push('MAX/MIN keep every tied result and come after the other filters, as in the query.');
    result.textContent = parts.join(' ');

    if (focusedKey) list.querySelector(`[data-step-key="${CSS.escape(focusedKey)}"]`)?.focus();
}

function renderFunnelVariablePicker(container, variables, selected) {
    if (variables.length < 2) {
        container.textContent = `Counting distinct ${selected}`;
        return;
    }
    const label = document.createElement('label');
    label.htmlFor = 'filter-funnel-variable-select';
    label.textContent = 'Counting distinct ';
    const select = document.createElement('select');
    select.id = 'filter-funnel-variable-select';
    select.className = 'browser-default';
    variables.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        option.selected = name === selected;
        select.append(option);
    });
    select.addEventListener('change', () => setFunnelVariable(select.value));
    container.replaceChildren(label, select);
}

function funnelRow({ step, label, enabled = true, count, base, previous }) {
    const item = document.createElement('li');
    item.className = 'funnel-row';
    const head = document.createElement('div');
    head.className = 'funnel-row-head';
    if (step) {
        item.classList.toggle('funnel-off', !enabled);
        item.classList.toggle('funnel-uncounted', !step.counted);
        const toggle = document.createElement('label');
        toggle.className = 'funnel-toggle';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'filled-in';
        checkbox.checked = enabled;
        checkbox.disabled = !step.counted;
        checkbox.setAttribute('data-step-key', step.key);
        checkbox.addEventListener('change', () => setFunnelStepEnabled(step.key, checkbox.checked));
        const text = document.createElement('span');
        text.textContent = label;
        toggle.append(checkbox, text);
        head.append(toggle);
    } else {
        const text = document.createElement('span');
        text.className = 'funnel-base-label';
        text.textContent = label;
        head.append(text);
    }
    const value = document.createElement('span');
    value.className = 'funnel-count';
    if (step && !step.counted) value.textContent = 'not counted';
    else if (count == null) value.textContent = '…';
    else if (step && !enabled) value.textContent = `${count} (off)`;
    else value.textContent = String(count);
    if (step && step.counted && enabled && count != null && previous != null && previous > count) {
        const delta = document.createElement('span');
        delta.className = 'funnel-delta';
        delta.textContent = `−${previous - count}`;
        value.append(' ', delta);
    }
    head.append(value);
    const bar = document.createElement('div');
    bar.className = 'funnel-bar';
    bar.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('span');
    fill.style.width = `${count != null && base ? Math.round((count / base) * 100) : 0}%`;
    bar.append(fill);
    item.append(head, bar);
    return item;
}

function initFilterFunnel() {
    document.getElementById('filter-funnel-btn').addEventListener('click', toggleFilterFunnel);
    document.getElementById('filter-funnel-close').addEventListener('click', closeFilterFunnel);
    document.getElementById('filter-funnel-retry').addEventListener('click', refreshFilterFunnel);
    cy.on('add remove data', scheduleFilterFunnelRefresh);
    const endpoint = document.getElementById('input-endpoint-sparql');
    endpoint.addEventListener('input', scheduleFilterFunnelRefresh);
    endpoint.addEventListener('change', scheduleFilterFunnelRefresh);
}

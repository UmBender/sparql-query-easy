// Staged exploration of the ordered variables and the possible-graph window.
// Classic script loaded by index2.html before its DOMContentLoaded script;
// top-level functions stay global for inline handlers and tests.
'use strict';

// ── Staged exploration (DEC-008, FE-005) ──────────────────────────
// One exploration per opened panel. Stage pages are cached per request
// (endpoint, patterns, bindings, variable, offset) until the query
// signature changes; a response for a superseded stage is ignored.
const stageCache = new Map();
let stageCacheSignature = null;
let exploration = null;

function startExploration(order, component) {
    stopExploration();
    if (stageCacheSignature !== variableOrderState.signature) {
        stageCache.clear();
        stageCacheSignature = variableOrderState.signature;
    }
    exploration = {
        signature: variableOrderState.signature,
        order: order.slice(),
        where: buildFilters(component),
        stage: 0,
        bindings: [],
        labels: [],
        pages: [],
        preview: { key: null, status: 'idle' },
        previewCandidate: null,
        status: 'loading',
        error: null,
        controller: null,
    };
    const current = exploration;
    current.previews = window.queryStages.createPreviewScheduler({
        cache: stageCache,
        fetchPage: fetchStagePage,
        onUpdate: state => {
            if (exploration !== current) return;
            current.preview = state;
            renderStagePreview();
        },
    });
    loadStagePage(0);
}

function stopExploration() {
    exploration?.controller?.abort();
    exploration?.previews.cancel();
    exploration = null;
    renderPossibleGraph();
}

// ── Possible-graph window (FE-017) ────────────────────────────────
// A separate read-only Cytoscape copy of the query: committed values,
// the option under the cursor and, cycling every 3 s, up to three
// possible values of the next variable. The main graph is never touched.
const POSSIBLE_VALUE_CYCLE_MS = 3000;
let possibleCy = null;
let possibleCycle = { key: null, index: 0, timer: null };

function stopPossibleCycle() {
    clearInterval(possibleCycle.timer);
    possibleCycle = { key: null, index: 0, timer: null };
}

function possibleGraphStyle() {
    return [
        { selector: 'node', style: {
            'label': 'data(label)', 'width': 60, 'height': 60, 'font-size': 11,
            'text-valign': 'center', 'text-halign': 'center', 'text-wrap': 'ellipsis', 'text-max-width': 70,
            'color': '#fff', 'background-color': '#4472C4', 'border-width': 0,
        } },
        { selector: 'node.literal', style: { 'shape': 'rectangle', 'height': 26, 'background-color': '#F48FB1', 'color': '#212121' } },
        { selector: 'node.open', style: { 'background-color': '#A9D18E', 'color': '#1b5e20' } },
        { selector: 'node.assumed', style: { 'border-width': 4, 'border-color': '#FF6F00', 'border-style': 'dashed' } },
        { selector: 'node.possible', style: { 'background-color': '#8E24AA', 'color': '#fff', 'border-width': 3, 'border-color': '#4A148C', 'border-style': 'dashed' } },
        { selector: 'edge', style: {
            'label': 'data(label)', 'font-size': 10, 'width': 2, 'curve-style': 'bezier',
            'target-arrow-shape': 'triangle', 'line-color': '#4472C4', 'target-arrow-color': '#4472C4',
            'text-background-color': '#fff', 'text-background-opacity': 1, 'text-background-padding': 2, 'color': '#4472C4',
        } },
        { selector: 'edge.open', style: { 'color': '#1b5e20', 'text-background-color': '#A9D18E' } },
        { selector: 'edge.assumed', style: { 'line-style': 'dashed', 'line-color': '#FF6F00', 'target-arrow-color': '#FF6F00' } },
        { selector: 'edge.possible', style: { 'line-color': '#8E24AA', 'target-arrow-color': '#8E24AA', 'color': '#fff', 'text-background-color': '#8E24AA' } },
    ];
}

// Committed values, the assumed option and the current possible value of the next variable.
// The cycle restarts at the first value whenever the hovered option changes.
function possibleGraphState() {
    const input = { ...exploration, complete: isExplorationComplete() };
    let view = window.queryStages.possibleGraphView(input, possibleCycle.index);
    if (!view.valueCount) {
        stopPossibleCycle();
        return view;
    }
    if (possibleCycle.key !== exploration.previewKey) {
        stopPossibleCycle();
        possibleCycle.key = exploration.previewKey;
        if (view.valueCount > 1) {
            possibleCycle.timer = setInterval(() => {
                possibleCycle.index += 1;
                renderPossibleGraph();
            }, POSSIBLE_VALUE_CYCLE_MS);
        }
        view = window.queryStages.possibleGraphView(input, possibleCycle.index);
    }
    return view;
}

function renderPossibleGraph() {
    const windowElement = document.getElementById('possible-graph-window');
    if (!exploration) {
        stopPossibleCycle();
        windowElement.hidden = true;
        possibleCy?.elements().remove();
        return;
    }
    const wasHidden = windowElement.hidden;
    windowElement.hidden = false;
    if (!possibleCy) {
        possibleCy = cytoscape({
            container: document.getElementById('possible-graph-canvas'),
            style: possibleGraphStyle(),
            userZoomingEnabled: false,
            userPanningEnabled: false,
            boxSelectionEnabled: false,
            autoungrabify: true,
            autounselectify: true,
        });
    } else if (wasHidden) {
        possibleCy.resize();
    }
    const { assignments, caption } = possibleGraphState();
    const component = queryComponent();
    const items = component ? component.map(item => ({
        ...item.data(),
        ...(item.isNode() ? { position: { ...item.position() } } : {}),
    })) : [];
    possibleCy.batch(() => {
        possibleCy.elements().remove();
        possibleCy.add(window.queryStages.consolidatedGraphElements(items, assignments));
    });
    possibleCy.fit(undefined, 16);
    document.getElementById('possible-graph-caption').textContent = caption;
}

function currentStageRequest(offset) {
    return stageRequestFor(exploration.stage, exploration.bindings, offset);
}

function stageRequestFor(stage, bindings, offset) {
    return window.queryStages.stageRequest({
        endpointUrl: getEndpoint(),
        where: exploration.where,
        variableName: exploration.order[stage],
        bindings,
        limit: getLimit(),
        offset,
    });
}

async function fetchStagePage(request, signal) {
    const response = await fetch(apiUrl('/api/query/stage'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
        signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || `Stage request failed (${response.status}).`);
    if (!body?.data || !Array.isArray(body.data.candidates)) throw new Error('Unexpected stage response.');
    return body.data;
}

function loadStagePage(offset) {
    const current = exploration;
    const request = currentStageRequest(offset);
    const key = window.queryStages.stageCacheKey(request);
    const accept = page => {
        current.pages = offset === 0 ? [page] : [...current.pages, page];
        current.status = 'loaded';
        current.error = null;
        renderStage();
    };
    const cached = stageCache.get(key);
    if (cached) {
        accept(cached);
        return;
    }
    current.controller?.abort();
    const controller = new AbortController();
    current.controller = controller;
    current.status = 'loading';
    current.retryOffset = offset;
    renderStage();
    fetchStagePage(request, controller.signal).then(page => {
        stageCache.set(key, page);
        if (exploration !== current || controller.signal.aborted) return;
        current.controller = null;
        accept(page);
    }, error => {
        if (exploration !== current || controller.signal.aborted) return;
        current.controller = null;
        current.status = 'error';
        current.error = error instanceof Error ? error.message : String(error);
        renderStage();
    });
}

function stageCandidates() {
    return exploration.pages.flatMap(page => page.candidates);
}

function isLastStage() {
    return exploration.stage === exploration.order.length - 1;
}

function isExplorationComplete() {
    return exploration.stage === exploration.order.length;
}

// Click/Enter commits the candidate and advances; after the last stage
// the panel shows the complete binding summary (FE-010).
function selectStageCandidate(candidate) {
    if (!candidate.selectable) return;
    exploration.previews.cancel();
    exploration.previewCandidate = null;
    exploration.bindings = [...exploration.bindings, { variableName: exploration.order[exploration.stage], term: candidate.term }];
    exploration.labels = [...exploration.labels, window.queryStages.candidateText(candidate)];
    if (isLastStage()) {
        exploration.controller?.abort();
        exploration.controller = null;
        exploration.stage += 1;
        exploration.pages = [];
        exploration.status = 'complete';
        document.getElementById('stage-heading').focus();
        renderStage();
        return;
    }
    enterStage(exploration.stage + 1);
}

// Back clears the previous stage's commitment and every later one.
function backToPreviousStage() {
    if (!exploration || exploration.stage === 0) return;
    exploration.previews.cancel();
    exploration.previewCandidate = null;
    const stage = exploration.stage - 1;
    exploration.bindings = exploration.bindings.slice(0, stage);
    exploration.labels = exploration.labels.slice(0, stage);
    enterStage(stage);
}

function enterStage(stage) {
    exploration.controller?.abort();
    exploration.controller = null;
    exploration.stage = stage;
    exploration.pages = [];
    document.getElementById('stage-heading').focus();
    loadStagePage(0);
}

// Hover/focus temporarily assumes a candidate and previews the next variable.
function previewStageCandidate(candidate) {
    if (!exploration || !candidate.selectable) return;
    exploration.previewCandidate = candidate;
    if (isLastStage()) {
        // No next variable to request; the assumption only updates the possible graph.
        exploration.previews.cancel();
        exploration.previewCandidate = candidate;
        exploration.previewKey = null;
        renderStagePreview();
        return;
    }
    const bindings = [...exploration.bindings, { variableName: exploration.order[exploration.stage], term: candidate.term }];
    const request = stageRequestFor(exploration.stage + 1, bindings, 0);
    exploration.previewKey = window.queryStages.stageCacheKey(request);
    exploration.previews.schedule(request);
    renderStagePreview();
}

// Leaving an option drops its assumption (and the possible-value cycle);
// an already dispatched preview still completes into the cache.
function settleStagePreview() {
    if (!exploration) return;
    exploration.previews.settle();
    exploration.previewCandidate = null;
    renderStagePreview();
}

function renderStagePreview() {
    renderPossibleGraph();
    const section = document.getElementById('stage-preview');
    const candidate = exploration?.previewCandidate;
    if (!exploration || !candidate) {
        section.hidden = true;
        return;
    }
    const { order, stage, preview } = exploration;
    const nextName = order[stage + 1];
    if (!nextName) {
        section.hidden = true;
        return;
    }
    const status = document.getElementById('stage-preview-status');
    const list = document.getElementById('stage-preview-list');
    section.hidden = false;
    document.getElementById('stage-preview-heading').textContent =
        `If ${order[stage]} = ${window.queryStages.candidateText(candidate)}, ${nextName} could be:`;
    const current = preview.key === exploration.previewKey ? preview : { status: 'loading' };
    const candidates = current.status === 'loaded' ? current.page.candidates : [];
    status.classList.toggle('error', current.status === 'error');
    if (current.status === 'error') status.textContent = current.error;
    else if (current.status !== 'loaded') status.textContent = `Loading values for ${nextName}\u2026`;
    else if (!candidates.length) status.textContent = `No values for ${nextName} under this assumption.`;
    else status.textContent = current.page.hasMore ? `First ${candidates.length} values:` : `${candidates.length} value${candidates.length === 1 ? '' : 's'}:`;
    list.replaceChildren(...candidates.map(item => {
        const entry = document.createElement('li');
        entry.textContent = `${window.queryStages.candidateText(item)} (${window.queryStages.termHint(item.term)})`;
        return entry;
    }));
}

function renderStage() {
    if (!exploration) return;
    const { order, stage, status } = exploration;
    const variableName = order[stage];
    const statusLine = document.getElementById('stage-status');
    const list = document.getElementById('stage-candidates');
    const focusedKey = list.contains(document.activeElement) ? document.activeElement.dataset.term : null;
    const complete = isExplorationComplete();
    document.getElementById('stage-heading').textContent = complete
        ? 'All variables chosen'
        : `Stage ${stage + 1} of ${order.length}: ${variableName}`;
    document.getElementById('stage-apply').hidden = !complete;
    document.getElementById('stage-commitments').replaceChildren(...exploration.bindings.map((binding, index) => {
        const item = document.createElement('li');
        item.textContent = `${binding.variableName} = ${exploration.labels[index]}`;
        item.title = binding.term.value;
        return item;
    }));
    document.getElementById('stage-back').hidden = stage === 0;
    const candidates = status === 'error' ? [] : stageCandidates();
    statusLine.classList.toggle('error', status === 'error');
    if (status === 'loading' && !candidates.length) statusLine.textContent = `Loading values for ${variableName}\u2026`;
    else if (status === 'loading') statusLine.textContent = 'Loading more values\u2026';
    else if (status === 'error') statusLine.textContent = exploration.error;
    else if (complete) statusLine.textContent = 'Apply to graph replaces the variables with these values. Close or Back leaves the graph unchanged.';
    else if (!candidates.length) statusLine.textContent = `No values for ${variableName} under the chosen bindings.`;
    else statusLine.textContent = `${candidates.length} value${candidates.length === 1 ? '' : 's'} for ${variableName}.`;
    document.getElementById('stage-retry').hidden = status !== 'error';
    const lastPage = exploration.pages[exploration.pages.length - 1];
    document.getElementById('stage-load-more').hidden = !(status === 'loaded' && lastPage?.hasMore);
    list.replaceChildren(...candidates.map(candidate => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        const key = window.queryStages.termKey(candidate.term);
        button.type = 'button';
        button.className = 'stage-candidate';
        button.dataset.term = key;
        button.disabled = !candidate.selectable;
        const text = document.createElement('span');
        text.textContent = window.queryStages.candidateText(candidate);
        const hint = document.createElement('span');
        hint.className = 'stage-candidate-hint';
        hint.textContent = window.queryStages.termHint(candidate.term) + (candidate.selectable ? '' : ' (not selectable)');
        button.append(text, hint);
        button.title = candidate.term.value;
        button.addEventListener('click', () => selectStageCandidate(candidate));
        button.addEventListener('mouseenter', () => previewStageCandidate(candidate));
        button.addEventListener('focus', () => previewStageCandidate(candidate));
        button.addEventListener('mouseleave', settleStagePreview);
        button.addEventListener('blur', settleStagePreview);
        item.append(button);
        return item;
    }));
    if (focusedKey) list.querySelector(`[data-term="${CSS.escape(focusedKey)}"]`)?.focus();
    renderStagePreview();
}

// The only exploration action that changes the graph (DEC-008 final action):
// variable nodes become the chosen IRI/literal nodes with their edges rewired,
// and predicate-variable edges are bound in place, keeping edge IDs.
function applyExplorationToGraph() {
    if (!exploration || !isExplorationComplete()) return;
    const registry = variableOrderState.registry;
    const choices = exploration.bindings.map((binding, index) => ({ ...binding, label: exploration.labels[index] }));
    closeTwoVariablePanel();
    cy.batch(() => {
        for (const { variableName, term, label } of choices) {
            const entry = registry.find(item => item.name === variableName);
            if (!entry) continue;
            const value = window.queryStages.termGraphValue(term);
            if (term.type === 'iri') {
                entry.edgeIds.forEach(id => {
                    const edge = cy.getElementById(id);
                    if (!edge.length || edge.data('nodeId') !== variableName) return;
                    edge.data({ nodeId: value, label });
                    if (edge.data('type') === 'variable') edge.removeData('type');
                });
            }
            entry.nodeIds.forEach(id => replaceVariableNodeWithTerm(id, term, value, label));
        }
    });
    updateStatusBar();
    toast(`Applied ${choices.length} bindings to the graph.`, 'success');
}

function replaceVariableNodeWithTerm(oldId, term, value, label) {
    const oldNode = cy.getElementById(oldId);
    if (!oldNode.length || oldNode.id() === value) return;
    if (!cy.getElementById(value).length) {
        cy.add({
            group: 'nodes',
            data: { id: value, value, label, type: term.type === 'iri' ? 'node' : 'label' },
            position: { ...oldNode.position() },
        });
    }
    oldNode.connectedEdges().forEach(edge => {
        const ends = {};
        if (edge.data('source') === oldId) ends.source = value;
        if (edge.data('target') === oldId) ends.target = value;
        edge.move(ends);
    });
    nodeActionMenuController?.retarget(oldId, value);
    oldNode.remove();
}

function invalidateExploration(state, signatureChanged) {
    if (!exploration) return;
    if (signatureChanged) {
        stageCache.clear();
        stageCacheSignature = state.signature;
        closeTwoVariablePanel();
        return;
    }
    if (state.order.join(' ') !== exploration.order.join(' ')) {
        // Reordering restarts at stage 1 and drops every commitment and preview.
        renderExplorationOrder(state.order);
        startExploration(state.order, queryComponent());
    }
}

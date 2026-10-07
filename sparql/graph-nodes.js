// Node creation, connection discovery, intro hint and the change-value modal.
// Classic script loaded by index2.html before its DOMContentLoaded script;
// top-level functions stay global for inline handlers and tests.
'use strict';

// ── Node/edge factory helpers ─────────────────────────────────────
function getNodeColor(node) {
    const colors = {
        variable:      '#A9D18E',
        'label-filter':'#7030A0',
        label:         '#F48FB1',
        default:       '#FDD835'
    };
    if (node.data('color')) return '#999999';
    return colors[node.data('type')] || '#4472C4';
}

function addNode(theCy, id, text) {
    theCy.add({
        group: 'nodes',
        data:  { id, value: id, label: text, type: 'node' },
        position: { x: 200, y: 200 }
    });
    if (document.getElementById('auto-layout').checked) theCy.layout({ name: 'cose' }).run();
    updateStatusBar();
    showIntroAlert('newNode', 'Click a node to open its action list.');
}

function replaceWithNewNode(theCy, varName, nodeId, nodeLabel, propertyType, propertyClass) {
    const oldElement = theCy.getElementById(varName);
    const oldId      = varName;

    let nodeType  = (propertyType === 'text' || nodeId === nodeLabel) ? 'label' : 'node';
    let nodeValue = nodeId;
    if (propertyType === 'default') { nodeType = 'default'; nodeValue = propertyClass; }

    if (!oldElement.length) return;
    // BUG-003: a value already in the graph (common in cycles) is reused, as
    // Apply to graph does; adding a second element with its ID would throw.
    if (!cy.getElementById(nodeId).length) {
        cy.add({
            group: 'nodes',
            data:  { id: nodeId, value: nodeValue, label: nodeLabel, type: nodeType },
            position: oldElement.position()
        });
    }
    nodeActionMenuController?.retarget(oldId, nodeId);

    // Edges keep their IDs and data. Each outgoing target is then replaced by
    // the chosen value's own relationship value, except the replacement node
    // itself (a loop after the merge), which stays with its edge.
    const outgoing = [];
    oldElement.connectedEdges().forEach(edge => {
        const ends = {};
        if (edge.data('source') === oldId) ends.source = nodeId;
        if (edge.data('target') === oldId) ends.target = nodeId;
        edge.move(ends);
        if (ends.source && edge.data('target') !== nodeId) {
            outgoing.push({ ...edge.data(), targetType: edge.target().data('type') });
        }
    });
    oldElement.remove();

    // BUG-006: a fixed IRI target is fetched again as an IRI with its label;
    // only other targets (values, variables) keep the literal request.
    outgoing.forEach(({ target, label: eLabel, nodeId: eNodeId, targetType }) => {
        cy.getElementById(target).remove();
        getRelationshipValueChange(nodeId, eNodeId, eLabel, targetType !== 'node');
    });
    updateStatusBar();
}

function addNodeWithRelationship(theCy, id, text, type, sourceNodeId, predicateId, predicateLabel, theSubject, predicateIndex = 0) {
    const typeMap  = { text: 'label', 'many-results': 'variable' };
    const nodeType = typeMap[type] || 'node';
    const isLink   = predicateLabel === 'image';
    const newText  = isLink ? 'View image' : text;
    const theSource = theSubject || sourceNodeId;
    const theTarget = theSource === sourceNodeId ? id : sourceNodeId;

    // BUG-003: a value already in the graph reuses its node, and the edge takes
    // the first free ID instead of throwing on a duplicate.
    if (!theCy.getElementById(id).length) {
        theCy.add({
            group: 'nodes',
            data:  { id, value: id, label: newText, type: nodeType, isLink, href: text,
                     color: type === 'many-results' ? 'gray' : '' },
            position: { x: 200, y: 200 }
        });
    }
    const baseEdgeId = predicateId + predicateIndex;
    let edgeId = baseEdgeId;
    for (let suffix = 1; theCy.getElementById(edgeId).length; suffix++) edgeId = `${baseEdgeId}_${suffix}`;
    theCy.add({
        group: 'edges',
        data:  { nodeId: predicateId, id: edgeId,
                 label: predicateLabel, source: theSource, target: theTarget }
    });

    if (document.getElementById('auto-layout').checked) theCy.layout({ name: 'cose' }).run();
    updateStatusBar();
}

// ── Connection discovery ──────────────────────────────────────────
function verifyAlreadyExistsNodeAndAdd(newNodeId, newNodeText, existingNode, invert) {
    return new Promise(resolve => {
        $.ajax({
            url:         apiUrl('/api/query'),
            type:        'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                endpointUrl:   getEndpoint(),
                where: [{
                    subject:   invert ? existingNode : newNodeId,
                    predicate: '?predicate',
                    object:    invert ? newNodeId    : existingNode
                }],
                variableName:  '?predicate',
                limit:         1,
                ignoreWikidata: false
            }),
            success(data) {
                if (!data.data.length) { resolve(false); return; }
                const predicate = data.data[0];
                addNodeWithRelationship(
                    cy, newNodeId, newNodeText, 'node', existingNode,
                    predicate.propertyId, predicate.propertyLabel,
                    invert ? existingNode : newNodeId
                );
                resolve(true);
            },
            error(err) { console.error(err); resolve(false); }
        });
    });
}

// ── One-time intro hint ───────────────────────────────────────────
function showIntroAlert(name, text) {
    if (localStorage.getItem(name)) return;
    introJs().setOptions({
        steps: [{ intro: text }],
        showBullets: false,
        exitOnOverlayClick: true
    }).start();
    localStorage.setItem(name, 'true');
}

// ── Change-value modal content ────────────────────────────────────
function getModalReplaceContent(theId, theValue) {
    const safeVal = escapeHTML(theValue);
    const isNumericOrSpecial = (theValue !== '' && !isNaN(theValue)) || theValue === 'MAX' || theValue === 'MIN'
        || window.queryCalculations.parseBetween(theValue) !== null;

    const textFilters = `
                <label><input type="radio" name="filter-type" value="" checked><span>Exact match</span></label>
                <label><input type="radio" name="filter-type" value="0"><span>Starts with</span></label>
                <label><input type="radio" name="filter-type" value="1"><span>Contains</span></label>`;

    const numFilters = `
                <label><input type="radio" name="filter-type" value="" checked><span>Exactly Equal</span></label>
                <label><input type="radio" name="filter-type" value="2"><span>At least (&ge;)</span></label>
                <label><input type="radio" name="filter-type" value="3"><span>At most (&le;)</span></label>
                <label><input type="radio" name="filter-type" value="6"><span>Between (min..max, e.g. 40..80)</span></label>
                <label><input type="radio" name="filter-type" value="4"><span>MAX</span></label>
                <label><input type="radio" name="filter-type" value="5"><span>MIN</span></label>`;

    return `
                <p class="grey-text text-darken-1">Current value: <strong>${safeVal}</strong></p>
                <div class="input-field">
                    <input type="text" id="modal-new-value" value="${safeVal}" placeholder="Enter new value" autocomplete="off">
                    <label for="modal-new-value" class="active">New Value</label>
                </div>
                ${isNumericOrSpecial ? '<div id="filter-histogram" class="filter-histogram" hidden></div>' : ''}
                <div class="filter-options" style="margin-top:10px;">
                    <p style="margin:0 0 4px; font-weight:600;">Filter Type:</p>
                    ${isNumericOrSpecial ? numFilters : textFilters}
                </div>
                <div style="text-align:right; margin-top:16px;">
                    <a href="#!" class="modal-close btn-flat waves-effect grey-text">Cancel</a>
                    <button class="btn waves-effect waves-light blue" id="apply-filter-btn" style="margin-left:8px;">Apply</button>
                </div>`;
}

function changeElementStringValue(elementId, newValue, filterType) {
    filterType = window.queryCalculations.filterTypeOf(filterType);
    if (filterType === 6 && !window.queryCalculations.parseBetween(newValue)) {
        toast('Between needs two numbers as min..max, with min not above max (e.g. 40..80).', 'error');
        return;
    }
    const ele       = cy.getElementById(elementId);
    const newNodeId = `node_${Date.now()}`;
    const oldId     = ele.id();
    const oldData   = ele.data();
    const oldPos    = ele.position();

    const label = window.queryCalculations.filterLabel(filterType, newValue);

    cy.add({
        group: 'nodes',
        data:  Object.assign({}, oldData, { id: newNodeId, label, value: newValue, filterType }),
        position: oldPos
    });

    rewireEdges(oldId, newNodeId);
    nodeActionMenuController?.retarget(oldId, newNodeId);
    ele.remove();
    $('#modal-change-value').modal('close');
    updateStatusBar();
}

// ── FE-026: value histogram with a range slider in the filter editor ──
let filterHistogramRequest = null;

/**
 * Profiles the relation of a numeric filter node (BE-003) and draws its
 * histogram in #filter-histogram. A newer editor aborts an older request;
 * a response for a closed or reopened editor is ignored.
 */
function loadFilterHistogram(nodeId) {
    filterHistogramRequest?.abort();
    filterHistogramRequest = null;
    const box = document.getElementById('filter-histogram');
    if (!box) return;
    const controller = new AbortController();
    filterHistogramRequest = controller;
    const stale = () => controller.signal.aborted || !box.isConnected;
    box.hidden = false;
    box.innerHTML = '<p class="filter-histogram-status" role="status">Loading the value distribution…</p>';
    fetchNumericProfile(nodeId, { signal: controller.signal }).then(profile => {
        if (stale()) return;
        if (!profile) {
            box.innerHTML = '<p class="filter-histogram-status" role="status">No value distribution: this value needs exactly one fixed relation pointing at it.</p>';
            return;
        }
        renderFilterHistogram(box, profile);
    }, error => {
        if (stale()) return;
        box.innerHTML = `<p class="filter-histogram-status filter-histogram-error" role="alert">Could not load the value distribution: ${escapeHTML(error.message)}</p>`;
    });
}

function renderFilterHistogram(box, profile) {
    const qc = window.queryCalculations;
    const numbers = (profile.values || []).map(item => Number(item.number)).filter(Number.isFinite);
    const scale = qc.rangeScale(numbers);
    if (!scale) {
        box.innerHTML = '<p class="filter-histogram-status" role="status">No numeric values for this relation under the rest of the query.</p>';
        return;
    }
    const total = Math.max(profile.count || 0, numbers.length);
    const omitted = profile.truncated ? total - numbers.length : 0;
    const format = value => String(Number(value.toFixed(scale.decimals)));
    const binCount = Math.min(24, new Set(numbers).size);
    const sampleMax = Math.max(...numbers);
    const note = profile.truncated
        ? `<p class="filter-histogram-note">The histogram covers the lowest ${numbers.length} of ${total} values (up to ${format(sampleMax)}${profile.max != null ? `; the largest is ${escapeHTML(String(profile.max))}` : ''}).</p>`
        : '';
    const single = scale.min === scale.max;
    const slider = (cls, label, value) => `<input type="range" class="${cls}" aria-label="${label}" min="${scale.min}" max="${scale.max}" step="${scale.step}" value="${value}"${single ? ' disabled' : ''}>`;
    box.innerHTML = `
                <p class="filter-histogram-count" aria-live="polite"></p>
                <svg class="filter-histogram-chart" viewBox="0 0 300 72" preserveAspectRatio="none" role="img"
                     aria-label="Histogram of ${numbers.length} values from ${format(scale.min)} to ${format(scale.max)}"></svg>
                <div class="filter-histogram-slider">
                    <div class="filter-histogram-track"><div class="filter-histogram-fill"></div></div>
                    ${slider('filter-histogram-lo', 'Lowest kept value', scale.min)}
                    ${slider('filter-histogram-hi', 'Highest kept value', scale.max)}
                </div>
                <div class="filter-histogram-axis">
                    <span>${format(scale.min)}</span><span class="filter-histogram-range"></span><span>${format(scale.max)}</span>
                </div>
                ${single ? `<p class="filter-histogram-note">All ${total} values are ${format(scale.min)}.</p>` : ''}
                ${note}`;

    const lo = box.querySelector('.filter-histogram-lo');
    const hi = box.querySelector('.filter-histogram-hi');
    const chart = box.querySelector('.filter-histogram-chart');
    const editorInput = document.getElementById('modal-new-value');
    const filterRadios = [...document.querySelectorAll('#modal-change-value-content input[name=filter-type]')];

    function paint() {
        const a = +lo.value;
        const b = +hi.value;
        const bins = qc.histogramBins(numbers, { min: scale.min, max: scale.max, lo: a, hi: b, binCount });
        const tallest = Math.max(...bins.map(bin => bin.count));
        const width = 300 / bins.length;
        chart.innerHTML = bins.map((bin, index) => {
            const x = index * width + 0.5;
            const w = Math.max(width - 1, 0.5);
            const h = bin.count / tallest * 70;
            const k = bin.kept / tallest * 70;
            return `<g><title>${format(bin.from)}–${format(bin.to)}: ${bin.count} values, ${bin.kept} kept</title>`
                + `<rect class="filter-histogram-bar" x="${x}" y="${72 - h}" width="${w}" height="${h}"></rect>`
                + `<rect class="filter-histogram-bar kept" x="${x}" y="${72 - k}" width="${w}" height="${k}"></rect></g>`;
        }).join('');
        const highOpen = b >= scale.max;
        let kept = qc.countInRange(numbers, a, b);
        if (highOpen) kept += omitted;
        const atLeast = profile.truncated && !highOpen && b >= sampleMax ? 'at least ' : '';
        box.querySelector('.filter-histogram-count').textContent = `Keeps ${atLeast}${kept} of ${total} values`;
        box.querySelector('.filter-histogram-range').textContent = `${format(a)} – ${format(b)}`;
        const span = scale.max - scale.min || 1;
        const fill = box.querySelector('.filter-histogram-fill');
        fill.style.left = `${(a - scale.min) / span * 100}%`;
        fill.style.right = `${(scale.max - b) / span * 100}%`;
        // Both handles at the top end: keep the low one draggable.
        lo.classList.toggle('on-top', a >= scale.max);
    }

    function moved(handle) {
        if (+lo.value > +hi.value) {
            if (handle === lo) lo.value = hi.value; else hi.value = lo.value;
        }
        paint();
        const filter = qc.rangeFilter(scale, +lo.value, +hi.value);
        editorInput.value = filter.value;
        const radio = filterRadios.find(input => input.value === String(filter.filterType));
        if (radio) radio.checked = true;
    }

    function readEditor() {
        const checked = filterRadios.find(input => input.checked);
        const range = qc.rangeFromFilter(scale, checked ? checked.value : null, editorInput.value);
        lo.value = range.lo;
        hi.value = range.hi;
        paint();
    }

    lo.addEventListener('input', () => moved(lo));
    hi.addEventListener('input', () => moved(hi));
    editorInput.addEventListener('input', readEditor);
    filterRadios.forEach(input => input.addEventListener('change', readEditor));
    readEditor();
}

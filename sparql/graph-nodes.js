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

    const oldPos = oldElement.position();
    cy.add({
        group: 'nodes',
        data:  { id: nodeId, value: nodeValue, label: nodeLabel, type: nodeType },
        position: oldPos
    });
    nodeActionMenuController?.retarget(oldId, nodeId);

    cy.edges().forEach(edge => {
        if (edge.data('source') === oldId) {
            const data = edge.data();
            const { target, label: eLabel, nodeId: eNodeId } = data;
            edge.remove();
            cy.add({ group: 'edges', data: { ...data, source: nodeId } });
            cy.getElementById(target).remove();
            getRelationshipValueChange(nodeId, eNodeId, eLabel);
        }
        if (edge.data('target') === oldId) {
            const data = edge.data();
            edge.remove();
            cy.add({ group: 'edges', data: { ...data, target: nodeId } });
        }
    });

    oldElement.remove();
    updateStatusBar();
}

function addNodeWithRelationship(theCy, id, text, type, sourceNodeId, predicateId, predicateLabel, theSubject, predicateIndex = 0) {
    const typeMap  = { text: 'label', 'many-results': 'variable' };
    const nodeType = typeMap[type] || 'node';
    const isLink   = predicateLabel === 'image';
    const newText  = isLink ? 'View image' : text;
    const theSource = theSubject || sourceNodeId;
    const theTarget = theSource === sourceNodeId ? id : sourceNodeId;

    theCy.add([
        {
            group: 'nodes',
            data:  { id, value: id, label: newText, type: nodeType, isLink, href: text,
                     color: type === 'many-results' ? 'gray' : '' },
            position: { x: 200, y: 200 }
        },
        {
            group: 'edges',
            data:  { nodeId: predicateId, id: predicateId + predicateIndex,
                     label: predicateLabel, source: theSource, target: theTarget }
        }
    ]);

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
    const isNumericOrSpecial = !isNaN(theValue) || theValue === 'MAX' || theValue === 'MIN';

    const textFilters = `
                <label><input type="radio" name="filter-type" value="" checked><span>Exact match</span></label>
                <label><input type="radio" name="filter-type" value="0"><span>Starts with</span></label>
                <label><input type="radio" name="filter-type" value="1"><span>Contains</span></label>`;

    const numFilters = `
                <label><input type="radio" name="filter-type" value="" checked><span>Exactly Equal</span></label>
                <label><input type="radio" name="filter-type" value="2"><span>Greater Than (&gt;)</span></label>
                <label><input type="radio" name="filter-type" value="3"><span>Less Than (&lt;)</span></label>
                <label><input type="radio" name="filter-type" value="4"><span>MAX</span></label>
                <label><input type="radio" name="filter-type" value="5"><span>MIN</span></label>`;

    return `
                <p class="grey-text text-darken-1">Current value: <strong>${safeVal}</strong></p>
                <div class="input-field">
                    <input type="text" id="modal-new-value" value="${safeVal}" placeholder="Enter new value" autocomplete="off">
                    <label for="modal-new-value" class="active">New Value</label>
                </div>
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
    const ele       = cy.getElementById(elementId);
    const newNodeId = `node_${Date.now()}`;
    const oldId     = ele.id();
    const oldData   = ele.data();
    const oldPos    = ele.position();

    let label = newValue;
    if (filterType == 4) label = 'MAX';
    else if (filterType == 5) label = 'MIN';

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

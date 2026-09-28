// Page configuration, shared state, utilities, modals, API calls and graph operations.
// Classic script loaded by index2.html before its DOMContentLoaded script;
// top-level functions stay global for inline handlers and tests.
'use strict';

// ── Config ────────────────────────────────────────────────────────
// The Ktor server serves this page and the API from localhost:8080.
// Keep API calls relative so development is same-origin and needs no CORS.
const API_BASE = '';

function apiUrl(path) {
    return API_BASE + path;
}

// ── Module-level state ────────────────────────────────────────────
let searches = {};
let trData   = {};
let cy       = null;
let nodeActionMenuController = null;

// ── Utility ───────────────────────────────────────────────────────
function escapeHTML(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#039;');
}

function showLoading() {
    document.getElementById('loading-overlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.remove('active');
}

function toast(msg, type) {
    const classes = type ? `toast-${type}` : '';
    M.toast({ html: escapeHTML(msg), classes, displayLength: 3500 });
}

function getLimit() {
    const val = parseInt(document.getElementById('input-max-results').value, 10);
    return (Number.isFinite(val) && val > 0) ? val : 20;
}

function getEndpoint() {
    return document.getElementById('input-endpoint-sparql').value.trim();
}

function updateStatusBar() {
    if (!cy) return;
    document.getElementById('status-nodes').textContent = `Nodes: ${cy.nodes().length}`;
    document.getElementById('status-edges').textContent = `Edges: ${cy.edges().length}`;
}

// ── Modals ────────────────────────────────────────────────────────
function openResultsModal()     { $('#grid-resultado-consulta').modal('open'); }
function openSparqlModal()      { $('#modal-sparql').modal('open'); }
function openChangeValueModal() { $('#modal-change-value').modal('open'); }

function copySparqlQuery() {
    const text = document.getElementById('modal-sparql-content').textContent;
    if (!navigator.clipboard) { toast('Clipboard not available.', 'error'); return; }
    navigator.clipboard.writeText(text)
        .then(() => toast('Copied to clipboard!', 'success'))
        .catch(() => toast('Could not copy.', 'error'));
}

// ── Graph helpers ─────────────────────────────────────────────────
function getAllNodes() {
    const nodes = [];
    cy.elements().components().forEach(component => {
        component.forEach(item => {
            if (!item.data('id').includes('?')) nodes.push(item.data('id'));
        });
    });
    return nodes;
}

/**
 * Build a SPARQL filter list from a cytoscape component (connected set).
 */
function buildFilters(component) {
    const items = [];
    for (let i = 0; i < component.length; i++) {
        const item = component[i];
        if (!item.data('source') || !item.data('target')) continue;

        const sourceNode   = cy.getElementById(item.data('source'));
        const targetNode   = cy.getElementById(item.data('target'));
        const sourceValue  = sourceNode.data('value')  || item.data('source');
        const targetValue  = targetNode.data('value')  || item.data('target');
        items.push({
            source: item.data('source'),
            target: item.data('target'),
            sourceValue,
            targetValue,
            nodeId: item.data('nodeId'),
            filterType: targetNode.data('filterType'),
            fallbackPredicate: item.data('nodeId') || `?empty_${Date.now()}`
        });
    }
    return window.queryCalculations.buildFilters(items);
}

/**
 * Scan a component for the first variable node name (?…).
 */
function extractVariableName(component) {
    let variableName = '';
    for (let i = 0; i < component.length; i++) {
        const item = component[i];
        if (item.data('source') && item.data('source').includes('?')) variableName = item.data('source');
        if (item.data('target') && item.data('target').includes('?')) variableName = item.data('target');
        if (item.data('id')     && item.data('id').includes('?'))     variableName = item.data('id');
        if (item.data('nodeId') && item.data('nodeId').startsWith('?')) variableName = item.data('nodeId');
    }
    return variableName;
}

/**
 * Relation label markup. The variable style follows the predicate
 * (FE-013), so rebuilt or imported edges always look the same.
 */
function edgeLabelHtml(data) {
    const kind = window.queryCalculations.relationLabelKind(data);
    if (kind === 'filter') {
        return `<div class="edge-label-filter">
                    <span>${escapeHTML(data.label)}</span><br><br>
                    <span style="font-weight:bold;color:white">${escapeHTML(String(data.filterType))}</span>
                </div>`;
    }
    const cls = kind === 'variable' ? 'edge-label-variable' : 'edge-label';
    return `<div class="${cls}">${escapeHTML(data.label)}</div>`;
}

/**
 * Re-wire all edges that reference oldId to instead reference newId,
 * keeping every edge data field (type, filterType, …).
 */
function rewireEdges(oldId, newId) {
    cy.edges().forEach(edge => {
        if (edge.data('source') === oldId) {
            const data = edge.data();
            edge.remove();
            cy.add({ group: 'edges', data: { ...data, source: newId } });
        }
        if (edge.data('target') === oldId) {
            const data = edge.data();
            edge.remove();
            cy.add({ group: 'edges', data: { ...data, target: newId } });
        }
    });
}

// ── API: view SPARQL ──────────────────────────────────────────────
function seeSparqlQuery() {
    const conjuntos = cy.elements().components();
    if (!conjuntos.length || !conjuntos[0].length) {
        toast('Add at least one node to preview the query.', 'error');
        return;
    }
    const component    = conjuntos[0];
    const variableName = extractVariableName(component);
    const filters      = buildFilters(component);

    showLoading();
    $.ajax({
        url:         apiUrl('/api/query/sparql'),
        type:        'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            endpointUrl:  getEndpoint(),
            where:        filters,
            variableName: variableName,
            limit:        getLimit()
        }),
        success(data) {
            hideLoading();
            // Use .text() to avoid XSS — jQuery escapes the content automatically
            $('#modal-sparql-content').text(data.data);
            openSparqlModal();
        },
        error(err) {
            hideLoading();
            $('#modal-sparql-content').text('Could not generate query. Please try again.');
            console.error(err);
            openSparqlModal();
        }
    });
}

// ── API: element relationships ────────────────────────────────────
function getElementInfo(elementId) {
    showLoading();
    $.ajax({
        url:         apiUrl('/api/query/relationships'),
        type:        'POST',
        contentType: 'application/json',
        data: JSON.stringify({ endpointUrl: getEndpoint(), id: elementId }),
        success(data) {
            hideLoading();
            trData = {};

            if (!data.data.length) {
                $('#table-results-body').html(
                    `<tr><td colspan="2" class="grey-text center-align" style="padding:20px;">No relationships found.</td></tr>`
                );
                openResultsModal();
                return;
            }

            let rows = '';
            data.data.forEach((item, i) => {
                trData[i] = {
                    subjectId:      elementId,
                    predicateId:    item.propertyId,
                    predicateLabel: item.propertyLabel,
                    isLiteral:      item.propertyType === 'label' || item.propertyLabel === 'image'
                };
                rows += `<tr data-index="${i}" class="relationship-row">
                            <td>${escapeHTML(item.propertyId)}</td>
                            <td>${escapeHTML(item.propertyLabel)}</td>
                        </tr>`;
            });

            $('#table-results-body').html(rows);
            openResultsModal();
        },
        error(err) {
            hideLoading();
            toast('Failed to load relationships. Please try again.', 'error');
            console.error(err);
        }
    });
}

// ── API: run query ────────────────────────────────────────────────
function getQuery(variableName, filters, showDefault, anotherAction) {
    const predicateEdgeIds = cy.edges()
        .filter(edge => edge.data('nodeId') === variableName)
        .map(edge => edge.id());
    const method = anotherAction || (predicateEdgeIds.length
        ? 'replacePredicateVariable'
        : 'replaceNodeVariable');
    showLoading();
    $.ajax({
        url:         apiUrl('/api/query'),
        type:        'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            endpointUrl:  getEndpoint(),
            where:        filters,
            variableName: variableName,
            limit:        getLimit()
        }),
        success(data) {
            hideLoading();
            trData = {};

            if (!data.data.length) {
                $('#table-results-body').html(
                    `<tr><td colspan="2" class="grey-text center-align" style="padding:20px;">No results found.</td></tr>`
                );
                openResultsModal();
                return;
            }

            let rows = '';
            data.data.forEach((item, i) => {
                trData[i] = {
                    variableName:  variableName,
                    nodeId:        item.propertyId,
                    nodeLabel:     item.propertyLabel,
                    propertyType:  item.propertyType,
                    propertyClass: item.propertyClass
                };
                if (method === 'replacePredicateVariable') {
                    trData[i].predicateEdgeIds = predicateEdgeIds;
                }
                if (anotherAction) {
                    trData[i].subjectId      = variableName;
                    trData[i].predicateId    = item.propertyId;
                    trData[i].predicateLabel = item.propertyLabel;
                    trData[i].isLiteral      = item.propertyType === 'label' || item.propertyLabel === 'image';
                }
                rows += `<tr data-index="${i}" data-method="${escapeHTML(method)}" class="query-row">
                            <td>${escapeHTML(item.propertyId)}</td>
                            <td>${escapeHTML(item.propertyLabel)}</td>
                        </tr>`;
            });

            $('#table-results-body').html(rows);
            openResultsModal();
        },
        error(err) {
            hideLoading();
            toast('Query failed. Please try again.', 'error');
            console.error(err);
        }
    });
}

// ── API: relationship value ───────────────────────────────────────
function getRelationshipValue(nodeLine) {
    const parameters = trData[nodeLine];
    if (!parameters) return;

    showLoading();
    $.ajax({
        url:         apiUrl('/api/query/relationship-value'),
        type:        'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            endpointUrl: getEndpoint(),
            subjectId:   parameters.subjectId,
            predicateId: parameters.predicateId,
            isLiteral:   parameters.isLiteral
        }),
        success(data) {
            hideLoading();
            if (data.data.length === 1) {
                data.data.forEach((item, index) => {
                    addNodeWithRelationship(
                        cy, item.propertyId, item.propertyLabel, item.propertyType,
                        parameters.subjectId, parameters.predicateId, parameters.predicateLabel,
                        null, index
                    );
                });
            } else {
                addNodeWithRelationship(
                    cy, `?node_${Date.now()}`, `${data.data.length} results`, 'many-results',
                    parameters.subjectId, parameters.predicateId, parameters.predicateLabel
                );
            }
            $('#grid-resultado-consulta').modal('close');
        },
        error(err) {
            hideLoading();
            toast('Failed to load value. Please try again.', 'error');
            console.error(err);
        }
    });
}

function getRelationshipValueChange(subject, predicate, predicateLabel) {
    $.ajax({
        url:         apiUrl('/api/query/relationship-value'),
        type:        'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            endpointUrl: getEndpoint(),
            subjectId:   subject,
            predicateId: predicate,
            isLiteral:   true
        }),
        success(data) {
            if (data.data.length === 1) {
                data.data.forEach((item, index) => {
                    addNodeWithRelationship(
                        cy, item.propertyId, item.propertyLabel, item.propertyType,
                        subject, predicate, predicateLabel, null, index
                    );
                });
            } else {
                addNodeWithRelationship(
                    cy, `?node_${Date.now()}`, `${data.data.length} results`, 'many-results',
                    subject, predicate, predicateLabel
                );
            }
            $('#grid-resultado-consulta').modal('close');
        },
        error(err) { console.error(err); }
    });
}

// ── Graph operations ──────────────────────────────────────────────
function replacePredicateVariable(nodeLine) {
    const p = trData[nodeLine];
    if (!p) return;
    p.predicateEdgeIds.forEach(id => {
        const edge = cy.getElementById(id);
        if (!edge.length || !edge.isEdge() || edge.data('nodeId') !== p.variableName) return;
        edge.data({ nodeId: p.nodeId, label: p.nodeLabel });
        if (edge.data('type') === 'variable') edge.removeData('type');
    });
    $('#grid-resultado-consulta').modal('close');
}

function replaceNodeVariable(nodeLine) {
    const p = trData[nodeLine];
    if (!p) return;
    replaceWithNewNode(cy, p.variableName, p.nodeId, p.nodeLabel, p.propertyType, p.propertyClass);
    $('#grid-resultado-consulta').modal('close');
}

function newQuery() {
    cy.elements().remove();
    updateStatusBar();
}

function addNewVariable() {
    const newId = `?node_${Date.now()}`;
    cy.add({ group: 'nodes', data: { id: newId, value: newId, label: '?', type: 'variable' } });
    if (document.getElementById('auto-layout').checked) cy.layout({ name: 'cose' }).run();
    updateStatusBar();
}

function saveQuery() {
    const blob   = new Blob([JSON.stringify(cy.json())], { type: 'application/json' });
    const blobUrl = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href     = blobUrl;
    a.download = 'query_exported.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    toast('Query exported.', 'success');
}

function loadQuery()    { document.getElementById('upload-json').click(); }
function uploadTriples(){ document.getElementById('upload-triple').click(); }

function runQuery() {
    const conjuntos = cy.elements().components();
    if (!conjuntos.length || !conjuntos[0].length) {
        toast('Add at least one node before running the query.', 'error');
        return;
    }

    const component    = conjuntos[0];
    if (hasParallelPredicateVariables(component)) {
        closeTwoVariablePanel();
        toast('Parallel predicate variables between the same fixed subject and object do not form a chain. Keep one predicate variable for this pair.', 'error');
        return;
    }
    const orderedVariables = refreshVariableOrder();
    if (orderedVariables.length >= 2) {
        openTwoVariablePanel(orderedVariables, component);
        return;
    }
    const variableName = extractVariableName(component);
    const filters      = buildFilters(component);

    if (!variableName) {
        toast('Add at least one variable (?) node before running.', 'error');
        return;
    }

    getQuery(variableName, filters, true);
}

function hasParallelPredicateVariables(component) {
    return window.queryCalculations.hasParallelPredicateVariables(component.edges().map(edge => ({
        nodeId: edge.data('nodeId'),
        source: edge.data('source'),
        target: edge.data('target'),
        sourceValue: edge.source().data('value') || edge.data('source'),
        targetValue: edge.target().data('value') || edge.data('target')
    })));
}

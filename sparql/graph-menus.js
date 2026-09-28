// Node and edge action menus, the predicate connection preview and Alt+drag on
// the main graph. Classic script loaded by index2.html; its DOMContentLoaded
// bootstrap calls initGraphMenus once after creating cy. The function owns the
// menu, connection and drag state and registers its listeners exactly once.
'use strict';

function initGraphMenus() {
    // ── Persistent node action menu ──────────────────────────────
    const nodeActionMenu      = document.getElementById('node-action-menu');
    const nodeActionMenuTitle = document.getElementById('node-action-menu-title');
    const nodeActionMenuList  = document.getElementById('node-action-menu-list');
    const edgeActionMenu      = document.getElementById('edge-action-menu');
    const edgeActionMenuTitle = document.getElementById('edge-action-menu-title');
    const edgeActionMenuList  = document.getElementById('edge-action-menu-list');
    const cyContainer         = document.getElementById('cy');
    const cyWrapper           = document.getElementById('cy-wrapper');
    let selectedMenuNodeId    = null;
    let selectedMenuEdgeId    = null;
    let predicateVariableSequence = 1;
    let predicateChoiceRequestId = 0;
    let pendingConnection = null;
    let predicateChoices = null;
    const connectionPreview = document.getElementById('connection-preview');
    const connectionPreviewLine = document.getElementById('connection-preview-line');

    function updateConnectionPreview(endPoint) {
        if (!pendingConnection) return;
        const source = cy.getElementById(pendingConnection.sourceId);
        if (!source.length) {
            cancelConnection();
            return;
        }
        const wrapper = cyWrapper.getBoundingClientRect();
        const canvas = cyContainer.getBoundingClientRect();
        const rendered = source.renderedPosition();
        const start = { x: canvas.left - wrapper.left + rendered.x, y: canvas.top - wrapper.top + rendered.y };
        pendingConnection.endPoint = endPoint || pendingConnection.endPoint || { x: start.x + 80, y: start.y };
        connectionPreviewLine.setAttribute('x1', start.x);
        connectionPreviewLine.setAttribute('y1', start.y);
        connectionPreviewLine.setAttribute('x2', pendingConnection.endPoint.x);
        connectionPreviewLine.setAttribute('y2', pendingConnection.endPoint.y);
    }

    function cancelConnection() {
        if (pendingConnection) {
            const source = cy.getElementById(pendingConnection.sourceId);
            if (source.length) source.removeClass('connector-source');
        }
        pendingConnection = null;
        connectionPreview.setAttribute('hidden', '');
    }

    function beginConnection(source, predicateId, predicateLabel) {
        cancelConnection();
        pendingConnection = { sourceId: source.id(), predicateId, predicateLabel };
        closeNodeActionMenu();
        source.addClass('connector-source');
        connectionPreview.removeAttribute('hidden');
        updateConnectionPreview();
        toast('Click a destination node to connect it. Click the background or press Escape to cancel.');
    }

    function completeConnection(target) {
        const connection = pendingConnection;
        if (!connection) return;
        const source = cy.getElementById(connection.sourceId);
        cancelConnection();
        if (!source.length || !target.length) return;
        cy.add({ group: 'edges', data: {
            source: source.id(), target: target.id(), nodeId: connection.predicateId,
            label: connection.predicateLabel,
            ...(connection.predicateId.startsWith('?') ? { type: 'variable' } : {})
        } });
        updateStatusBar();
    }

    function selectedMenuNode() {
        if (!selectedMenuNodeId) return null;
        const node = cy.getElementById(selectedMenuNodeId);
        return node.length && node.isNode() ? node : null;
    }

    function closeNodeActionMenu() {
        const selected = selectedMenuNode();
        if (selected) selected.removeClass('node-menu-target');
        selectedMenuNodeId = null;
        nodeActionMenu.removeAttribute('data-node-id');
        nodeActionMenu.hidden = true;
        predicateChoices = null;
    }

    function selectedMenuEdge() {
        if (!selectedMenuEdgeId) return null;
        const edge = cy.getElementById(selectedMenuEdgeId);
        return edge.length && edge.isEdge() ? edge : null;
    }

    function closeEdgeActionMenu() {
        const selected = selectedMenuEdge();
        if (selected) selected.removeClass('edge-menu-target');
        selectedMenuEdgeId = null;
        edgeActionMenu.removeAttribute('data-edge-id');
        edgeActionMenu.hidden = true;
    }

    function hasVariableSource(node) {
        return cy.edges().some(edge =>
            edge.data('target') === node.id() &&
            cy.getElementById(edge.data('source')).data('type') === 'variable'
        );
    }

    function nodeActions(node) {
        return window.graphActions.nodeActions(node.data(), hasVariableSource(node));
    }

    function positionNodeActionMenu() {
        const node = selectedMenuNode();
        if (!node || nodeActionMenu.hidden) return;

        const wrapperRect = cyWrapper.getBoundingClientRect();
        const canvasRect  = cyContainer.getBoundingClientRect();
        const position    = node.renderedPosition();
        const nodeRadius  = node.renderedOuterWidth() / 2;
        const gap         = 12;
        const canvasLeft  = canvasRect.left - wrapperRect.left;
        const canvasTop   = canvasRect.top - wrapperRect.top;
        const canvasRight = canvasLeft + canvasRect.width;
        const canvasBottom = canvasTop + canvasRect.height;
        const menuWidth   = nodeActionMenu.offsetWidth;
        const menuHeight  = nodeActionMenu.offsetHeight;
        const nodeX       = canvasLeft + position.x;
        const nodeY       = canvasTop + position.y;

        if (
            position.x + nodeRadius < 0 || position.y + nodeRadius < 0 ||
            position.x - nodeRadius > canvasRect.width ||
            position.y - nodeRadius > canvasRect.height
        ) {
            nodeActionMenu.style.visibility = 'hidden';
            return;
        }

        let left = nodeX + nodeRadius + gap;
        if (left + menuWidth > canvasRight - 8) {
            left = nodeX - nodeRadius - gap - menuWidth;
        }
        left = Math.max(canvasLeft + 8, Math.min(left, canvasRight - menuWidth - 8));
        const top = Math.max(
            canvasTop + 8,
            Math.min(nodeY - menuHeight / 2, canvasBottom - menuHeight - 8)
        );

        nodeActionMenu.style.left = `${left}px`;
        nodeActionMenu.style.top = `${top}px`;
        nodeActionMenu.style.visibility = 'visible';
    }

    function positionNodeActionMenuAfterLayout() {
        requestAnimationFrame(() => requestAnimationFrame(positionNodeActionMenu));
    }

    function renderNodeActionMenu() {
        const node = selectedMenuNode();
        if (!node) {
            closeNodeActionMenu();
            return;
        }

        nodeActionMenuTitle.textContent = `Actions for ${node.data('label') || node.id()}`;
        nodeActionMenuList.replaceChildren();
        nodeActions(node).forEach(action => {
            const item = document.createElement('li');
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `node-action-menu-button${action.danger ? ' danger' : ''}`;
            button.dataset.action = action.id;
            button.textContent = action.label;
            item.appendChild(button);
            nodeActionMenuList.appendChild(item);
        });
        if (predicateChoices?.sourceId === node.id()) {
            if (predicateChoices.message) {
                const message = document.createElement('li');
                message.className = 'node-action-menu-message';
                message.textContent = predicateChoices.message;
                nodeActionMenuList.appendChild(message);
            }
            predicateChoices.items.forEach((predicate, index) => {
                const item = document.createElement('li');
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'node-action-menu-button';
                button.dataset.action = 'choose-predicate';
                button.dataset.predicateIndex = index;
                button.textContent = predicate.propertyLabel || predicate.propertyId;
                item.appendChild(button);
                nodeActionMenuList.appendChild(item);
            });
        }
        nodeActionMenu.hidden = false;
        nodeActionMenu.style.visibility = 'hidden';
        positionNodeActionMenu();
    }

    function openNodeActionMenu(node) {
        closeEdgeActionMenu();
        const previous = selectedMenuNode();
        if (previous && previous.id() !== node.id()) previous.removeClass('node-menu-target');
        selectedMenuNodeId = node.id();
        node.addClass('node-menu-target');
        nodeActionMenu.dataset.nodeId = node.id();
        renderNodeActionMenu();
    }

    function retargetNodeActionMenu(oldId, newId) {
        if (selectedMenuNodeId !== oldId) return;
        const replacement = cy.getElementById(newId);
        if (!replacement.length) {
            closeNodeActionMenu();
            return;
        }
        selectedMenuNodeId = newId;
        replacement.addClass('node-menu-target');
        nodeActionMenu.dataset.nodeId = newId;
        renderNodeActionMenu();
    }

    function removeMenuNode(node) {
        cy.edges()
          .filter(edge => [edge.data('source'), edge.data('target')].includes(node.id()))
          .remove();
        node.remove();
        closeNodeActionMenu();
        updateStatusBar();
    }

    function convertMenuNodeToVariable(node) {
        const oldId    = node.id();
        const newVarId = `?node_${Date.now()}`;
        const oldData  = node.data();
        const oldPos   = node.position();

        cy.add({
            group: 'nodes',
            data:  Object.assign({}, oldData, { id: newVarId, value: newVarId, label: '?', type: 'variable' }),
            position: oldPos
        });
        rewireEdges(oldId, newVarId);
        retargetNodeActionMenu(oldId, newVarId);
        node.remove();
        updateStatusBar();
    }

    function loadPredicateChoices(node) {
        const sourceId = node.id();
        const requestId = ++predicateChoiceRequestId;
        predicateChoices = { sourceId, message: 'Loading predicates…', items: [] };
        renderNodeActionMenu();
        $.ajax({
            url: apiUrl('/api/query/relationships'),
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ endpointUrl: getEndpoint(), id: node.data('value') || sourceId, limit: getLimit() }),
            success(response) {
                if (requestId !== predicateChoiceRequestId || selectedMenuNodeId !== sourceId || predicateChoices?.sourceId !== sourceId) return;
                const items = (response.data || []).filter(item => typeof item.propertyId === 'string' && item.propertyId);
                predicateChoices = { sourceId, message: items.length ? 'Choose a predicate:' : 'No predicates found.', items };
                renderNodeActionMenu();
            },
            error() {
                if (requestId !== predicateChoiceRequestId || selectedMenuNodeId !== sourceId || predicateChoices?.sourceId !== sourceId) return;
                predicateChoices = { sourceId, message: 'Could not load predicates. Try again.', items: [] };
                renderNodeActionMenu();
            }
        });
    }

    function runNodeAction(node, action, button) {
        const data = node.data();
        if (action === 'open-link') {
            window.open(data.href, '_blank', 'noopener,noreferrer');
        } else if (action === 'explore-relationships') {
            getElementInfo(data.value);
        } else if (action === 'explore-default') {
            const varName = `?default_${Date.now()}`;
            getQuery(varName, [{
                subject: varName,
                predicate: 'rdfs:domain',
                object: data.value
            }], false, 'getRelationshipValue');
        } else if (action === 'run-query') {
            const component = cy.elements().components()
                .find(items => items.some(item => item.id() === data.id));
            if (component) getQuery(data.value, buildFilters(component), true);
        } else if (action === 'toggle-boolean') {
            changeElementBooleanValue(node);
        } else if (action === 'edit-value') {
            changeElementStringValueModal(node);
        } else if (action === 'connect-variable-predicate') {
            beginConnection(node, nextPredicateVariableName(), '?');
        } else if (action === 'connect-defined-predicate') {
            loadPredicateChoices(node);
        } else if (action === 'choose-predicate') {
            const predicate = predicateChoices?.sourceId === node.id()
                ? predicateChoices.items[Number(button.dataset.predicateIndex)] : null;
            if (predicate) beginConnection(node, predicate.propertyId, predicate.propertyLabel || predicate.propertyId);
        } else if (action === 'convert-variable') {
            convertMenuNodeToVariable(node);
        } else if (action === 'remove') {
            removeMenuNode(node);
        }
    }

    nodeActionMenu.addEventListener('click', event => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        event.stopPropagation();
        const node = selectedMenuNode();
        if (node) runNodeAction(node, button.dataset.action, button);
    });

    nodeActionMenuController = {
        close: closeNodeActionMenu,
        retarget: retargetNodeActionMenu
    };

    // ── Persistent edge action menu ──────────────────────────────
    function edgeActions(edge) {
        return window.graphActions.edgeActions(edge.data());
    }

    function positionEdgeActionMenu() {
        const edge = selectedMenuEdge();
        if (!edge || edgeActionMenu.hidden) return;

        const wrapperRect = cyWrapper.getBoundingClientRect();
        const canvasRect = cyContainer.getBoundingClientRect();
        const midpoint = edge.midpoint();
        const zoom = cy.zoom();
        const pan = cy.pan();
        const renderedMidpoint = {
            x: midpoint.x * zoom + pan.x,
            y: midpoint.y * zoom + pan.y
        };
        const canvasLeft = canvasRect.left - wrapperRect.left;
        const canvasTop = canvasRect.top - wrapperRect.top;
        const canvasRight = canvasLeft + canvasRect.width;
        const canvasBottom = canvasTop + canvasRect.height;
        const menuWidth = edgeActionMenu.offsetWidth;
        const menuHeight = edgeActionMenu.offsetHeight;

        if (
            renderedMidpoint.x < 0 || renderedMidpoint.y < 0 ||
            renderedMidpoint.x > canvasRect.width || renderedMidpoint.y > canvasRect.height
        ) {
            edgeActionMenu.style.visibility = 'hidden';
            return;
        }

        const gap = 12;
        let left = canvasLeft + renderedMidpoint.x + gap;
        if (left + menuWidth > canvasRight - 8) left = canvasLeft + renderedMidpoint.x - gap - menuWidth;
        left = Math.max(canvasLeft + 8, Math.min(left, canvasRight - menuWidth - 8));
        const top = Math.max(
            canvasTop + 8,
            Math.min(canvasTop + renderedMidpoint.y - menuHeight / 2, canvasBottom - menuHeight - 8)
        );

        edgeActionMenu.style.left = `${left}px`;
        edgeActionMenu.style.top = `${top}px`;
        edgeActionMenu.style.visibility = 'visible';
    }

    function renderEdgeActionMenu() {
        const edge = selectedMenuEdge();
        if (!edge) {
            closeEdgeActionMenu();
            return;
        }

        edgeActionMenuTitle.textContent = `Actions for relation ${edge.data('label') || edge.data('nodeId') || edge.id()}`;
        edgeActionMenuList.replaceChildren();
        edgeActions(edge).forEach(action => {
            const item = document.createElement('li');
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `edge-action-menu-button${action.danger ? ' danger' : ''}`;
            button.dataset.action = action.id;
            button.textContent = action.label;
            item.appendChild(button);
            edgeActionMenuList.appendChild(item);
        });
        edgeActionMenu.hidden = false;
        edgeActionMenu.style.visibility = 'hidden';
        positionEdgeActionMenu();
    }

    function openEdgeActionMenu(edge) {
        closeNodeActionMenu();
        const previous = selectedMenuEdge();
        if (previous && previous.id() !== edge.id()) previous.removeClass('edge-menu-target');
        selectedMenuEdgeId = edge.id();
        edge.addClass('edge-menu-target');
        edgeActionMenu.dataset.edgeId = edge.id();
        renderEdgeActionMenu();
    }

    function nextPredicateVariableName() {
        const { name, sequence } = window.graphActions.nextPredicateVariableName(
            predicateVariableSequence,
            candidate => cy.elements().some(element =>
                ['id', 'nodeId', 'value'].some(key => element.data(key) === candidate)
            )
        );
        predicateVariableSequence = sequence;
        return name;
    }

    function convertMenuEdgeToPredicateVariable(edge) {
        const variableName = nextPredicateVariableName();
        edge.data('nodeId', variableName);
        edge.data('label', '?');
        edge.data('type', 'variable');
        closeEdgeActionMenu();
    }

    edgeActionMenu.addEventListener('click', event => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        event.stopPropagation();
        const edge = selectedMenuEdge();
        if (edge && button.dataset.action === 'convert-predicate-variable') {
            convertMenuEdgeToPredicateVariable(edge);
        }
        if (edge && button.dataset.action === 'remove-relation') {
            // Only this edge; both nodes and parallel edges stay.
            closeEdgeActionMenu();
            edge.remove();
            updateStatusBar();
        }
    });

    // ── Alt+drag: create variable edge / node ────────────────────
    let isDragging        = false;
    let dragOriginPrivate = null;
    let dragOriginPos     = null;

    cy.on('mousedown', 'node', event => {
        dragOriginPrivate = event.target._private;
        if (event.originalEvent.altKey) {
            isDragging     = true;
            dragOriginPos  = { x: dragOriginPrivate.position.x, y: dragOriginPrivate.position.y };
        }
    });

    cy.on('drag', 'node', () => {
        if (isDragging && dragOriginPrivate) {
            dragOriginPrivate.position.x = dragOriginPos.x;
            dragOriginPrivate.position.y = dragOriginPos.y;
        }
    });

    cy.on('mouseup', event => {
        if (!isDragging || !event.originalEvent.altKey) {
            isDragging = false; dragOriginPrivate = null; dragOriginPos = null;
            return;
        }
        const released = event.position;
        const nearby   = cy.nodes().filter(node => {
            const p = node._private.position;
            return Math.hypot(p.x - released.x, p.y - released.y) < 30;
        }).first();

        if (nearby.length) {
            cy.add({ group: 'edges', data: { source: dragOriginPrivate.data.id, target: nearby.id(), label: '?', type: 'variable' } });
        } else {
            const newId = `?node_${Date.now()}`;
            cy.add([
                { group: 'nodes', data: { id: newId, value: newId, label: '?', type: 'variable' }, position: released },
                { group: 'edges', data: { id: `?edge-${cy.edges().length + 1}`, label: '?', source: dragOriginPrivate.data.id, target: newId, type: 'variable' } }
            ]);
        }
        isDragging = false; dragOriginPrivate = null; dragOriginPos = null;
        updateStatusBar();
    });

    cy.on('mouseout', 'node', () => {
        if (isDragging) { isDragging = false; dragOriginPrivate = null; dragOriginPos = null; }
    });

    // ── Node selection and explicit background dismissal ─────────
    cyContainer.addEventListener('pointermove', event => {
        if (!pendingConnection) return;
        const wrapper = cyWrapper.getBoundingClientRect();
        updateConnectionPreview({ x: event.clientX - wrapper.left, y: event.clientY - wrapper.top });
    });
    cy.on('tap', 'node', event => {
        if (pendingConnection) completeConnection(event.target);
        else openNodeActionMenu(event.target);
    });
    cy.on('tap', 'edge', event => openEdgeActionMenu(event.target));
    cy.on('tap', event => {
        if (event.target === cy) {
            cancelConnection();
            closeNodeActionMenu();
            closeEdgeActionMenu();
            closeTwoVariablePanel();
        }
    });

    cy.on('pan zoom resize layoutstop', () => {
        positionNodeActionMenu();
        positionEdgeActionMenu();
        updateConnectionPreview();
    });
    cy.on('position', 'node', event => {
        if (pendingConnection?.sourceId === event.target.id()) updateConnectionPreview();
        if (event.target.id() === selectedMenuNodeId) positionNodeActionMenu();
        if (selectedMenuEdge() && [selectedMenuEdge().data('source'), selectedMenuEdge().data('target')].includes(event.target.id())) {
            positionEdgeActionMenu();
        }
    });
    cy.on('remove', 'node', event => {
        if (pendingConnection?.sourceId === event.target.id()) cancelConnection();
        if (event.target.id() === selectedMenuNodeId) closeNodeActionMenu();
    });
    cy.on('remove', 'edge', event => {
        if (event.target.id() === selectedMenuEdgeId) closeEdgeActionMenu();
    });

    // ── Value edits offered by the node menu ─────────────────────
    function changeElementBooleanValue(ele) {
        const lbl = ele.data('label');
        if (lbl !== 'true' && lbl !== 'false') return;

        const srcEdges = cy.edges().filter(
            e => e.data('target') === ele.id() &&
                 cy.getElementById(e.data('source')).data('type') === 'variable'
        );
        if (!srcEdges.length) return;

        const newNodeId = `node_${Date.now()}`;
        const newValue  = lbl === 'true' ? 'false' : 'true';

        cy.add({
            group: 'nodes',
            data:  Object.assign({}, ele.data(), { id: newNodeId, label: newValue, value: newValue }),
            position: ele.position()
        });
        rewireEdges(ele.id(), newNodeId);
        retargetNodeActionMenu(ele.id(), newNodeId);
        ele.remove();
    }

    function changeElementStringValueModal(ele) {
        if (ele.data('type') !== 'label') return;

        const srcEdges = cy.edges().filter(
            e => e.data('target') === ele.id() &&
                 cy.getElementById(e.data('source')).data('type') === 'variable'
        );
        if (!srcEdges.length) return;

        const contentEl = document.getElementById('modal-change-value-content');
        contentEl.setAttribute('data-node-id', ele.id());
        contentEl.innerHTML = getModalReplaceContent(ele.id(), ele.data('label'));
        M.updateTextFields();
        openChangeValueModal();
    }

    function positionMenusAfterLayout() {
        positionNodeActionMenuAfterLayout();
        requestAnimationFrame(() => requestAnimationFrame(positionEdgeActionMenu));
    }

    return {
        cancelConnection,
        hasPendingConnection: () => pendingConnection !== null,
        positionMenusAfterLayout,
    };
}

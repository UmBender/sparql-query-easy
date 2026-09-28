// Ordered variable registry, numbered stage-order blocks and the exploration panel.
// Classic script loaded by index2.html before its DOMContentLoaded script;
// top-level functions stay global for inline handlers and tests.
'use strict';

// ── Ordered variable registry (DEC-008) ───────────────────────────
// Session-only order of distinct query variables in the first graph component.
// It resets to sorted names whenever the query signature changes.
let variableOrderState = { signature: null, order: [], registry: [] };
const variableOrderListeners = [];

function queryComponent() {
    const components = cy ? cy.elements().components() : [];
    return components.length ? components[0] : null;
}

function refreshVariableOrder() {
    const component = queryComponent();
    const items = component ? component.map(item => item.data()) : [];
    const registry = window.queryStages.buildVariableRegistry(items);
    const signature = window.queryStages.explorationSignature(getEndpoint(), items);
    const changed = signature !== variableOrderState.signature;
    variableOrderState = {
        signature,
        registry,
        order: changed ? registry.map(entry => entry.name) : variableOrderState.order,
    };
    variableOrderListeners.forEach(listener => listener(variableOrderState, changed));
    return variableOrderState.order.slice();
}

function setVariableOrder(order) {
    variableOrderState = { ...variableOrderState, order: order.slice() };
    variableOrderListeners.forEach(listener => listener(variableOrderState, false));
}

function getVariableOrder() {
    return variableOrderState.order.slice();
}

// ── Stage-order blocks (FE-009) ───────────────────────────────────
// Pointer drag and Move earlier/later buttons both go through moveVariableBlock.
function moveVariableBlock(from, to) {
    const order = getVariableOrder();
    const next = window.queryStages.moveItem(order, from, to);
    if (next.every((name, index) => name === order[index])) return;
    setVariableOrder(next);
    document.getElementById('variable-order-status').textContent =
        `${next[to]} moved to stage ${to + 1} of ${next.length}.`;
}

function renderVariableOrder(state) {
    const container = document.getElementById('variable-order');
    const list = document.getElementById('variable-order-list');
    const focusedButton = list.contains(document.activeElement) ? document.activeElement.dataset.action : null;
    const focusedName = focusedButton ? document.activeElement.closest('.variable-block')?.dataset.variable : null;
    container.hidden = state.order.length < 2;
    list.replaceChildren(...state.order.map((name, index) => {
        const block = document.createElement('li');
        block.className = 'variable-block';
        block.dataset.variable = name;
        block.dataset.index = String(index);
        block.setAttribute('aria-label', `Stage ${index + 1}: ${name}`);
        const number = document.createElement('span');
        number.className = 'variable-block-number';
        number.textContent = String(index + 1);
        number.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.className = 'variable-block-name';
        label.textContent = name;
        label.setAttribute('aria-hidden', 'true');
        const earlier = variableBlockButton('earlier', `Move ${name} earlier`, '\u25C0', index === 0, () => moveVariableBlock(index, index - 1));
        const later = variableBlockButton('later', `Move ${name} later`, '\u25B6', index === state.order.length - 1, () => moveVariableBlock(index, index + 1));
        block.append(number, label, earlier, later);
        return block;
    }));
    if (focusedName) {
        const block = list.querySelector(`[data-variable="${CSS.escape(focusedName)}"]`);
        const button = block?.querySelector(`[data-action="${focusedButton}"]`);
        const target = button && !button.disabled ? button : block?.querySelector('button:not(:disabled)');
        target?.focus();
    }
}

function variableBlockButton(action, label, text, disabled, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = action;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.textContent = text;
    button.disabled = disabled;
    button.addEventListener('click', onClick);
    return button;
}

function initVariableOrderDrag() {
    const list = document.getElementById('variable-order-list');
    let drag = null;
    const clearTarget = () => list.querySelectorAll('.drop-target').forEach(item => item.classList.remove('drop-target'));
    list.addEventListener('pointerdown', event => {
        const block = event.target.closest('.variable-block');
        if (!block || event.target.closest('button') || event.button !== 0) return;
        event.preventDefault();
        block.setPointerCapture?.(event.pointerId);
        block.classList.add('dragging');
        drag = { from: Number(block.dataset.index), to: Number(block.dataset.index), block };
    });
    list.addEventListener('pointermove', event => {
        if (!drag) return;
        const over = document.elementFromPoint(event.clientX, event.clientY)?.closest('.variable-block');
        if (!over || !list.contains(over)) return;
        clearTarget();
        drag.to = Number(over.dataset.index);
        if (over !== drag.block) over.classList.add('drop-target');
    });
    const finish = event => {
        if (!drag) return;
        const { from, to, block } = drag;
        drag = null;
        block.classList.remove('dragging');
        clearTarget();
        if (event.type === 'pointerup') moveVariableBlock(from, to);
    };
    list.addEventListener('pointerup', finish);
    list.addEventListener('pointercancel', finish);
}

let twoVariablePanelReturnFocus = null;

function openTwoVariablePanel(variables, component) {
    const panel = document.getElementById('two-variable-panel');
    twoVariablePanelReturnFocus = document.activeElement;
    renderExplorationOrder(variables);
    panel.hidden = false;
    document.getElementById('two-variable-panel-close').focus();
    startExploration(variables, component);
}

function renderExplorationOrder(variables) {
    document.getElementById('two-variable-list').replaceChildren(...variables.map(variable => {
        const item = document.createElement('li');
        item.textContent = variable;
        return item;
    }));
}

function closeTwoVariablePanel() {
    const panel = document.getElementById('two-variable-panel');
    const shouldRestoreFocus = panel.contains(document.activeElement);
    panel.hidden = true;
    stopExploration();
    if (shouldRestoreFocus && twoVariablePanelReturnFocus?.isConnected) twoVariablePanelReturnFocus.focus();
}

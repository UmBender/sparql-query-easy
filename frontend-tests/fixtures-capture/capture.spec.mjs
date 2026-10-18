// QUAL-008: records every /api/* request and response the legacy page makes
// for each scenario in scenarios.mjs, against the real Ktor backend, and
// writes fixtures/legacy/<name>.{request.json,response.json,sparql}. Each
// scenario also checks its result against an independent oracle read from
// pokemon_gen1.ttl. Legacy page decision D-T2a = A: no test hooks are added;
// the page's global `cy` and its existing ids are used, like the browser suite.
import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { guardExternalTraffic } from '../external-assets.mjs';
import { createNormalizer, stableJson } from './normalize.mjs';
import { scenarios } from './scenarios.mjs';

const OUT = new URL('../../fixtures/legacy/', import.meta.url);
// Quiet period after the last API activity: longer than the badge (400 ms) and
// funnel (350 ms) debounces, so background requests land in a fixed order.
const QUIET_MS = 1200;

function recordApi(page) {
  const exchanges = [];
  let pending = 0;
  let lastActivity = Date.now();
  const byRequest = new Map();
  page.on('request', request => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) return;
    const entry = { request: { method: request.method(), path: url.pathname, body: requestBody(request) }, response: null };
    exchanges.push(entry);
    byRequest.set(request, entry);
    pending++;
    lastActivity = Date.now();
  });
  page.on('requestfinished', async request => {
    const entry = byRequest.get(request);
    if (!entry) return;
    const response = await request.response();
    const text = await response.text().catch(() => '');
    let body;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    entry.response = { status: response.status(), body };
    pending--;
    lastActivity = Date.now();
  });
  page.on('requestfailed', request => {
    const entry = byRequest.get(request);
    if (!entry) return;
    entry.response = { status: null, error: 'aborted by the page' };
    pending--;
    lastActivity = Date.now();
  });
  return {
    exchanges,
    // The quiet period also counts from the call, so a debounced request that
    // the last action scheduled is still awaited.
    async settle() {
      const start = Date.now();
      await expect.poll(() => pending === 0 && Date.now() - Math.max(lastActivity, start) >= QUIET_MS, { timeout: 60_000, intervals: [200] }).toBe(true);
    },
  };
}

function requestBody(request) {
  const type = request.headers()['content-type'] ?? '';
  if (type.startsWith('multipart/form-data')) {
    const text = request.postDataBuffer()?.toString('utf8') ?? '';
    const fields = [...text.matchAll(/name="([^"]+)"(?:; filename="([^"]+)")?/g)].map(([, name, filename]) => ({ name, filename: filename ?? null }));
    return { multipart: fields };
  }
  const data = request.postData();
  if (data == null) return null;
  try { return JSON.parse(data); } catch { return data; }
}

function context(page, recorder) {
  const candidates = page.locator('#stage-candidates .stage-candidate');
  const ctx = {
    page,
    settle: () => recorder.settle(),
    /** Adds nodes and edges described by kind; the page's own graph model builds their data. */
    async addGraph(elements) {
      await page.evaluate(items => {
        const gm = window.graphModel;
        const qc = window.queryCalculations;
        let column = 0;
        cy.add(items.map(item => {
          if (item.edge) {
            const { source, target, nodeId, label, id } = item.edge;
            return { group: 'edges', data: { ...(id ? { id } : {}), source, target, nodeId, label: label ?? '?',
              ...(gm.isVariableName(nodeId) ? { type: 'variable' } : {}) } };
          }
          const position = { x: 150 + (column % 4) * 260, y: 150 + Math.floor(column / 4) * 200 };
          column++;
          const { kind, id, label, filterType = null, value } = item;
          let data;
          if (kind === 'variable') data = gm.variableNodeData(id);
          else if (kind === 'value-variable') data = { ...gm.valueVariableNodeData(id), ...gm.valueVariableFilterData(filterType, value ?? '') };
          else if (kind === 'iri') data = gm.iriNodeData(id, label);
          else if (kind === 'literal') data = { id, value, label: qc.filterLabel(filterType, value), type: 'label', filterType: qc.filterTypeOf(filterType) };
          else if (kind === 'class') data = { id, value: item.classIri, label, type: 'default' };
          else throw new Error(`Unknown node kind ${kind}`);
          return { group: 'nodes', data, position };
        }));
      }, elements);
      await recorder.settle();
    },
    async runQuery() {
      await page.locator('#run-query-btn').click();
      await recorder.settle();
    },
    async candidateTexts() {
      return candidates.locator('span:first-child').allTextContents();
    },
    async choose(text) {
      await candidates.filter({ has: page.locator('span:first-child', { hasText: new RegExp(`^${escapeRegExp(text)}$`) }) }).first().click();
      await recorder.settle();
    },
    async assume(variable, text) {
      await page.getByRole('button', { name: `Assume ${variable} = ${text} in the graph now` }).click();
      await recorder.settle();
    },
    async apply() {
      await page.locator('#stage-apply').click();
      await recorder.settle();
    },
    async viewSparql() {
      await page.evaluate(() => { document.getElementById('modal-sparql-content').textContent = ''; });
      await page.locator('nav a[title="Preview generated SPARQL"]').click();
      await expect(page.locator('#modal-sparql-content')).not.toHaveText('');
      await recorder.settle();
      return page.locator('#modal-sparql-content').textContent();
    },
    /** Opens a node's action list (a left click) and runs the action with this label. */
    async nodeAction(nodeId, actionLabel) {
      await page.evaluate(id => { cy.getElementById(id).emit('tap'); }, nodeId);
      await page.locator('#node-action-menu-list button', { hasText: exactly(actionLabel) }).first().click();
      await recorder.settle();
    },
    async edgeAction(edgeId, actionLabel) {
      await page.evaluate(id => { cy.getElementById(id).emit('tap'); }, edgeId);
      await page.locator('#edge-action-menu-list button', { hasText: exactly(actionLabel) }).first().click();
      await recorder.settle();
    },
    /** Clicks the results-table row whose label cell is `text` (the Materialize stub keeps the modal hidden). */
    async clickRow(text) {
      const clicked = await page.evaluate(value => {
        const row = [...document.querySelectorAll('#table-results-body tr')].find(item => item.cells[1]?.textContent.trim() === value);
        row?.click();
        return Boolean(row);
      }, text);
      expect(clicked, `results row ${text}`).toBe(true);
      await recorder.settle();
    },
    async rowLabels() {
      return page.locator('#table-results-body tr td:nth-child(2)').allTextContents();
    },
    /** Types into the (hidden) filter editor and picks a filter type radio ('' exact, 'any', '0'…'6'). */
    async editor({ value, filterType }) {
      await page.evaluate(({ value, filterType }) => {
        const content = document.getElementById('modal-change-value-content');
        if (filterType !== undefined) {
          const radio = content.querySelector(`input[name=filter-type][value="${filterType}"]`);
          radio.checked = true;
          radio.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (value !== undefined) {
          const input = document.getElementById('modal-new-value');
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, { value, filterType });
      await recorder.settle();
    },
    async chooseSuggestion(text) {
      await page.evaluate(value => [...document.querySelectorAll('#filter-suggestions button.filter-suggestion')]
        .find(button => button.dataset.value === value).click(), text);
      await recorder.settle();
    },
    async suggestions() {
      return page.evaluate(() => [...document.querySelectorAll('#filter-suggestions button.filter-suggestion')].map(button => button.dataset.value));
    },
    async editorApply() {
      await page.evaluate(() => document.getElementById('apply-filter-btn').click());
      await recorder.settle();
    },
    async moveEarlier(variable) {
      await page.getByRole('button', { name: `Move ${variable} earlier` }).click();
      await recorder.settle();
    },
    async openFunnel() {
      await page.locator('#filter-funnel-btn').click();
      await recorder.settle();
    },
    async funnelRows() {
      return page.locator('#filter-funnel-steps .funnel-row').evaluateAll(rows => rows.map(row => ({
        label: row.querySelector('.funnel-toggle span, .funnel-base-label').textContent.trim(),
        count: row.querySelector('.funnel-count').firstChild.textContent.trim(),
      })));
    },
    async toggleFunnelStep(labelText) {
      // Materialize draws the checkbox on its label text.
      await page.locator('#filter-funnel-steps .funnel-toggle span', { hasText: labelText }).click();
      await recorder.settle();
    },
    async badges() {
      return page.locator('#filter-badge-layer > span').evaluateAll(items => items.map(item => ({ node: item.dataset.nodeId, kind: item.className, text: item.textContent })));
    },
    async upload(file) {
      await page.locator('#upload-triple').setInputFiles(file);
      await recorder.settle();
    },
    /** The main graph as sorted [id, type, label] nodes and [source, nodeId, target] edges. */
    async graph() {
      return page.evaluate(() => ({
        nodes: cy.nodes().map(node => [node.id(), node.data('type'), node.data('label')]).sort(),
        edges: cy.edges().map(edge => [edge.data('source'), edge.data('nodeId'), edge.data('target')]).sort(),
      }));
    },
    /** Calls a legacy page function by name, as an inline handler would. */
    async call(name, ...args) {
      await page.evaluate(({ name, args }) => window[name](...args), { name, args });
      await recorder.settle();
    },
  };
  return ctx;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function exactly(text) {
  return new RegExp(`^${escapeRegExp(text)}$`);
}

for (const scenario of scenarios) {
  test(scenario.name, async ({ page, baseURL }) => {
    const unexpected = await guardExternalTraffic(page, baseURL);
    const recorder = recordApi(page);
    await page.goto('/index2.html');
    await page.evaluate(endpoint => {
      const checkbox = document.getElementById('auto-layout');
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      const input = document.getElementById('input-endpoint-sparql');
      input.value = endpoint;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, 'PokemonGen1');
    await recorder.settle();

    const ctx = context(page, recorder);
    const notes = (await scenario.run(ctx)) ?? {};
    const sparql = await ctx.viewSparql();

    const normalize = createNormalizer();
    recorder.exchanges
      .filter(({ request }) => request.path === '/api/local-database')
      .forEach(({ response }) => normalize.rememberUpload(response?.body?.data));
    const exchanges = normalize.value(recorder.exchanges);
    writeFileSync(new URL(`${scenario.name}.request.json`, OUT), stableJson(exchanges.map(({ request }) => request)));
    writeFileSync(new URL(`${scenario.name}.response.json`, OUT), stableJson(exchanges.map(({ response }) => response)));
    writeFileSync(new URL(`${scenario.name}.sparql`, OUT), `${normalize.text(sparql.trim())}\n`);

    // A scenario lists the error statuses it characterizes as { path: status }.
    const statuses = exchanges.map(({ request, response }) => [request.path, response?.status ?? null]);
    const unexpectedStatus = statuses.filter(([path, status]) => status !== 200 && scenario.expectedErrors?.[path] !== status);
    expect(unexpectedStatus, 'every captured request succeeded or is an expected error').toEqual([]);
    scenario.check({ exchanges, sparql, notes }, expect);
    expect(unexpected, 'Unexpected external browser requests').toEqual([]);
  });
}

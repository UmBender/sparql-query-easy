import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { guardExternalTraffic } from '../external-assets.mjs';

const FIXTURE = fileURLToPath(new URL('../fixtures/ordered-exploration.ttl', import.meta.url));

let unexpected;
let stageRequests;
let legacyQueryRequests;

test.beforeEach(async ({ page, baseURL }) => {
  unexpected = await guardExternalTraffic(page, baseURL);
  stageRequests = [];
  legacyQueryRequests = 0;
  page.on('request', request => {
    const { pathname } = new URL(request.url());
    if (pathname === '/api/query/stage') stageRequests.push(JSON.parse(request.postData()));
    if (pathname === '/api/query') legacyQueryRequests += 1;
  });
  await page.goto('/index2.html');
  await page.evaluate(() => {
    const checkbox = document.getElementById('auto-layout');
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.locator('#upload-triple').setInputFiles(FIXTURE);
  await expect(page.locator('#input-endpoint-sparql')).not.toHaveValue('CampeonatoBrasileiro2023');
});

test.afterEach(() => {
  expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});

const candidates = page => page.locator('#stage-candidates .stage-candidate');

function expectOnlyNextStageRequests(order) {
  for (const request of stageRequests) {
    expect(request.variableName).toBe(order[request.bindings.length]);
    expect(request.bindings.map(({ variableName }) => variableName)).toEqual(order.slice(0, request.bindings.length));
    expect(request.limit).toBeLessThanOrEqual(50);
  }
}

test('a reordered three-variable exploration binds a predicate, a typed literal and an IRI through Ktor', async ({ page }) => {
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: '?team', value: '?team', label: '?', type: 'variable' }, position: { x: 150, y: 250 } },
      { group: 'nodes', data: { id: '?value', value: '?value', label: '?', type: 'variable' }, position: { x: 450, y: 250 } },
      { group: 'edges', data: { id: 'attribute', source: '?team', target: '?value', nodeId: '?attr', label: '?' } },
    ]);
  });
  await expect(page.locator('#variable-order-list .variable-block-name')).toHaveText(['?attr', '?team', '?value']);
  await page.getByRole('button', { name: 'Move ?value earlier' }).click();
  const order = ['?attr', '?value', '?team'];
  await expect(page.locator('#variable-order-list .variable-block-name')).toHaveText(order);

  await page.locator('#run-query-btn').click();
  await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 3: ?attr');
  // The server orders candidates by term: http://… sorts before https://….
  await expect(candidates(page)).toHaveText([
    /http:\/\/www\.w3\.org\/2000\/01\/rdf-schema#label\s*IRI/,
    /https:\/\/example\.test\/city\s*IRI/,
    /https:\/\/example\.test\/founded\s*IRI/,
  ]);

  // Duplicate ?value terms (two teams in Porto Alegre) collapse to one candidate.
  await candidates(page).nth(1).hover();
  await expect(page.locator('#stage-preview-list li')).toHaveText(['Porto Alegre (IRI)', 'Rio de Janeiro (IRI)']);

  await candidates(page).nth(2).click();
  await expect(page.locator('#stage-heading')).toHaveText('Stage 2 of 3: ?value');
  await expect(candidates(page)).toHaveText([/1895\s*literal integer/, /1903\s*literal integer/, /1909\s*literal integer/]);
  await candidates(page).nth(1).click();
  await expect(page.locator('#stage-heading')).toHaveText('Stage 3 of 3: ?team');
  await expect(candidates(page)).toHaveText([/Grêmio\s*IRI/]);
  await candidates(page).first().click();
  await expect(page.locator('#stage-commitments li')).toHaveText([
    '?attr = https://example.test/founded',
    '?value = 1903',
    '?team = Grêmio',
  ]);

  await page.getByRole('button', { name: 'Apply to graph' }).click();
  const graph = await page.evaluate(() => ({
    nodes: cy.nodes().map(node => [node.id(), node.data('label'), node.data('type')]).sort(),
    edges: cy.edges().map(edge => [edge.id(), edge.data('source'), edge.data('target'), edge.data('nodeId')]),
  }));
  expect(graph).toEqual({
    nodes: [['1903', '1903', 'label'], ['<https://example.test/gremio>', 'Grêmio', 'node']],
    edges: [['attribute', '<https://example.test/gremio>', '1903', '<https://example.test/founded>']],
  });
  expectOnlyNextStageRequests(order);
  expect(legacyQueryRequests).toBe(0);
});

test('the typed literal binding returned by Ktor constrains the next stage exactly', async ({ page }) => {
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: '?team', value: '?team', label: '?', type: 'variable' }, position: { x: 150, y: 250 } },
      { group: 'nodes', data: { id: '?year', value: '?year', label: '?', type: 'variable' }, position: { x: 450, y: 250 } },
      { group: 'nodes', data: { id: '?city', value: '?city', label: '?', type: 'variable' }, position: { x: 300, y: 450 } },
      { group: 'edges', data: { id: 'founded', source: '?team', target: '?year', nodeId: '<https://example.test/founded>', label: 'founded' } },
      { group: 'edges', data: { id: 'city', source: '?team', target: '?city', nodeId: '<https://example.test/city>', label: 'city' } },
    ]);
  });
  await page.getByRole('button', { name: 'Move ?team later' }).click();
  const order = ['?city', '?year', '?team'];
  await expect(page.locator('#variable-order-list .variable-block-name')).toHaveText(order);
  await page.locator('#run-query-btn').click();
  await expect(candidates(page)).toHaveText([/Porto Alegre/, /Rio de Janeiro/]);
  await candidates(page).first().focus();
  await expect(page.locator('#stage-preview-list li')).toHaveText(['1903 (literal integer)', '1909 (literal integer)']);
  await page.keyboard.press('Enter');
  await expect(candidates(page)).toHaveText([/1903/, /1909/]);
  await candidates(page).nth(1).click();
  await expect(candidates(page)).toHaveText([/Internacional\s*IRI/]);
  expectOnlyNextStageRequests(order);
});

test('one-variable Run Query still uses the legacy results table', async ({ page }) => {
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: '?team', value: '?team', label: '?', type: 'variable' }, position: { x: 150, y: 250 } },
      { group: 'nodes', data: { id: '<https://example.test/poa>', value: '<https://example.test/poa>', label: 'Porto Alegre', type: 'node' }, position: { x: 450, y: 250 } },
      { group: 'edges', data: { id: 'city', source: '?team', target: '<https://example.test/poa>', nodeId: '<https://example.test/city>', label: 'city' } },
    ]);
  });
  await page.locator('#run-query-btn').click();
  await expect(page.locator('#table-results-body tr')).not.toHaveCount(0);
  await expect(page.locator('#two-variable-panel')).toBeHidden();
  expect(stageRequests).toEqual([]);
  expect(legacyQueryRequests).toBe(1);
});

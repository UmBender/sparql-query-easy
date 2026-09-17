import { expect, test } from '@playwright/test';
import { INTRO_STUB, JQUERY_STUB, MATERIALIZE_STUB } from './cdn-stubs.mjs';
import { startFrontendTestServer } from './server.mjs';

let server;

test.beforeAll(async () => {
  server = await startFrontendTestServer();
});

test.afterAll(async () => {
  await server.close();
});

test.beforeEach(async ({ page }) => {
  await page.route('**/jquery.min.js', (route) => route.fulfill({ contentType: 'text/javascript', body: JQUERY_STUB }));
  await page.route('**/materialize.min.js', (route) => route.fulfill({ contentType: 'text/javascript', body: MATERIALIZE_STUB }));
  await page.route('**/intro.min.js', (route) => route.fulfill({ contentType: 'text/javascript', body: INTRO_STUB }));
  await page.route('**/cytoscape-html-label*', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }));
  await page.goto(server.baseUrl);
});

test('autocomplete callback adds the selected search result as a graph node through relative API URLs', async ({ page }) => {
  await page.locator('#input-busca-elementos').fill('Team');
  await page.locator('#input-busca-elementos').dispatchEvent('input');
  await expect.poll(() => page.locator('#input-busca-elementos').getAttribute('data-autocomplete')).toContain('Team A');

  await page.evaluate(() => window.__autocompleteCallbacks.get('input-busca-elementos')('Team A'));

  await expect(page.locator('#status-nodes')).toHaveText('Nodes: 1');
  expect(server.requests.some(({ path }) => path === '/api/query/search')).toBe(true);
  expect(server.requests.every(({ path }) => path.startsWith('/'))).toBe(true);
});

test('Turtle upload replaces the endpoint and relationship expansion consumes local API data', async ({ page }) => {
  await page.locator('#upload-triple').setInputFiles({ name: 'graph.ttl', mimeType: 'text/turtle', buffer: Buffer.from('@prefix ex: <https://example.test/> .') });
  await expect(page.locator('#input-endpoint-sparql')).toHaveValue('uploaded-test-graph');

  await page.evaluate(() => addNode(cy, '<https://example.test/team-a>', 'Team A'));
  await expect(page.locator('#status-nodes')).toHaveText('Nodes: 1');
  await page.evaluate(() => window.getElementInfo('<https://example.test/team-a>'));
  await expect(page.locator('#table-results-body')).toContainText('name');
  await page.evaluate(() => window.getRelationshipValue(0));

  await expect(page.locator('#status-nodes')).toHaveText('Nodes: 2');
  expect(server.requests.some(({ path }) => path === '/api/local-database')).toBe(true);
  expect(server.requests.some(({ path }) => path === '/api/query/relationships')).toBe(true);
  expect(server.requests.some(({ path }) => path === '/api/query/relationship-value')).toBe(true);
});

test('SPARQL preview and query execution use their documented relative endpoints', async ({ page }) => {
  await page.evaluate(() => window.addNewVariable());
  await page.evaluate(() => window.seeSparqlQuery());
  await expect(page.locator('#modal-sparql-content')).toContainText('SELECT DISTINCT');

  await page.evaluate(() => window.getQuery('?item', [], true));
  await expect(page.locator('#table-results-body')).toContainText('No results found.');
  expect(server.requests.some(({ path }) => path === '/api/query/sparql')).toBe(true);
  expect(server.requests.some(({ path }) => path === '/api/query')).toBe(true);
});

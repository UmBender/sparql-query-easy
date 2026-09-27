import { expect, test } from '@playwright/test';
import { CYTOSCAPE_HTML_LABEL_STUB, INTRO_STUB, JQUERY_STUB, MATERIALIZE_STUB } from './cdn-stubs.mjs';
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
  await page.route('**/cytoscape-html-label*', (route) => route.fulfill({ contentType: 'text/javascript', body: CYTOSCAPE_HTML_LABEL_STUB }));
  await page.goto(server.baseUrl);
});

async function disableAutoLayout(page) {
  await page.evaluate(() => {
    const checkbox = document.getElementById('auto-layout');
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function clickGraphNode(page, nodeId) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  const position = await page.evaluate((id) => {
    const rendered = cy.getElementById(id).renderedPosition();
    return { x: rendered.x + 30, y: rendered.y };
  }, nodeId);
  await page.locator('#cy').click({ position });
}

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

test('running a query with exactly two valid variables opens the staged exploration panel without an API request', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: '?zeta', value: '?zeta', label: '?', type: 'variable' }, position: { x: 220, y: 200 } },
      { group: 'nodes', data: { id: '?alpha', value: '?alpha', label: '?', type: 'variable' }, position: { x: 440, y: 200 } },
      { group: 'edges', data: { id: 'predicate-variable', source: '?zeta', target: '?alpha', nodeId: '?relation', label: '?' } },
    ]);
  });
  const queryRequestsBefore = server.requests.filter(({ path }) => path === '/api/query').length;

  await page.locator('#run-query-btn').click();

  const panel = page.getByRole('complementary', { name: 'Explore two variables' });
  await expect(panel).toBeVisible();
  await expect(page.locator('#two-variable-list')).toHaveText('?alpha?relation?zeta');
  await expect(panel).toContainText('Staged exploration');
  await expect(page.getByRole('button', { name: 'Close two-variable exploration' })).toBeFocused();
  expect(server.requests.filter(({ path }) => path === '/api/query').length).toBe(queryRequestsBefore);

  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(page.locator('#run-query-btn')).toBeFocused();

  await page.locator('#run-query-btn').click();
  await expect(panel).toBeVisible();
  await page.getByRole('button', { name: 'Close two-variable exploration' }).click();
  await expect(panel).toBeHidden();

  await page.locator('#run-query-btn').click();
  await expect(panel).toBeVisible();
  await page.locator('#cy').click({ position: { x: 16, y: 16 } });
  await expect(panel).toBeHidden();
});

test('left click opens a persistent node action list and only the graph background dismisses it', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => addNode(cy, '<https://example.test/team-a>', 'Team A'));
  const relationshipRequestsBefore = server.requests.filter(({ path }) => path === '/api/query/relationships').length;

  await clickGraphNode(page, '<https://example.test/team-a>');

  const menu = page.locator('#node-action-menu');
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute('data-node-id', '<https://example.test/team-a>');
  await expect(menu.getByRole('button', { name: 'Explore relationships' })).toBeVisible();
  expect(server.requests.filter(({ path }) => path === '/api/query/relationships').length).toBe(relationshipRequestsBefore);

  await menu.getByRole('button', { name: 'Explore relationships' }).focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => server.requests.filter(({ path }) => path === '/api/query/relationships').length)
    .toBe(relationshipRequestsBefore + 1);
  await expect(menu).toBeVisible();

  await page.evaluate(() => {
    cy.add({ group: 'nodes', data: { id: '?other', value: '?other', label: '?', type: 'variable' }, position: { x: 500, y: 250 } });
  });
  await clickGraphNode(page, '?other');
  await expect(menu).toHaveAttribute('data-node-id', '?other');
  await expect(menu.getByRole('button', { name: 'Run query' })).toBeVisible();

  await menu.locator('#node-action-menu-title').click();
  await expect(menu).toBeVisible();

  await page.locator('#cy').click({ position: { x: 16, y: 16 } });
  await expect(menu).toBeHidden();
});

test('the list exposes existing node-type actions without executing them during selection', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: 'entity', value: '<https://example.test/entity>', label: 'Entity', type: 'node' }, position: { x: 180, y: 180 } },
      { group: 'nodes', data: { id: '?variable', value: '?variable', label: '?', type: 'variable' }, position: { x: 380, y: 180 } },
      { group: 'nodes', data: { id: 'default', value: '<https://example.test/Class>', label: 'Default', type: 'default' }, position: { x: 580, y: 180 } },
      { group: 'nodes', data: { id: 'literal', value: 'text', label: 'text', type: 'label' }, position: { x: 280, y: 390 } },
      { group: 'nodes', data: { id: 'boolean', value: 'true', label: 'true', type: 'label' }, position: { x: 480, y: 390 } },
      { group: 'nodes', data: { id: 'link', value: 'link', label: 'View image', type: 'node', isLink: true, href: 'https://example.test/image' }, position: { x: 680, y: 390 } },
      { group: 'edges', data: { id: 'literal-edge', source: '?variable', target: 'literal', label: 'value' } },
      { group: 'edges', data: { id: 'boolean-edge', source: '?variable', target: 'boolean', label: 'enabled' } },
    ]);
  });

  const expectedActions = [
    ['entity', 'Explore relationships'],
    ['?variable', 'Run query'],
    ['default', 'Explore values'],
    ['literal', 'Edit value'],
    ['boolean', 'Toggle Boolean value'],
    ['link', 'Open link'],
  ];
  const menu = page.locator('#node-action-menu');
  for (const [index, [nodeId, action]] of expectedActions.entries()) {
    if (index > 0) await page.locator('#cy').click({ position: { x: 16, y: 16 } });
    const requestCountBefore = server.requests.length;
    await clickGraphNode(page, nodeId);
    await expect(menu).toHaveAttribute('data-node-id', nodeId);
    const actionButton = menu.getByRole('button', { name: action, exact: true });
    await expect(actionButton).toBeVisible();
    expect(server.requests.length).toBe(requestCountBefore);

    if (action === 'Run query' || action === 'Explore values') {
      await actionButton.click();
      await expect.poll(() => server.requests.length).toBe(requestCountBefore + 1);
      await expect(menu).toBeVisible();
    } else if (action === 'Edit value') {
      await actionButton.click();
      await expect(page.locator('#modal-change-value-content')).toHaveAttribute('data-node-id', 'literal');
      await expect(page.locator('#modal-new-value')).toHaveValue('text');
    } else if (action === 'Toggle Boolean value') {
      await actionButton.click();
      await expect(menu).toHaveAttribute('data-node-id', /node_\d+/);
      const toggledLabel = await page.evaluate(() => {
        const selectedId = document.getElementById('node-action-menu').dataset.nodeId;
        return cy.getElementById(selectedId).data('label');
      });
      expect(toggledLabel).toBe('false');
    } else if (action === 'Open link') {
      await page.evaluate(() => {
        window.open = (...args) => { window.__openedLink = args; };
      });
      await actionButton.click();
      expect(await page.evaluate(() => window.__openedLink)).toEqual([
        'https://example.test/image', '_blank', 'noopener,noreferrer',
      ]);
    }
  }
});

test('API-backed node actions retain the selected menu through loading empty and error responses', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => addNode(cy, 'async-node', 'Async Node'));
  await clickGraphNode(page, 'async-node');

  const menu = page.locator('#node-action-menu');
  const action = menu.getByRole('button', { name: 'Explore relationships' });
  await page.route('**/api/query/relationships', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
  });
  await action.click();
  await expect(page.locator('#loading-overlay')).toHaveClass(/active/);
  await expect(page.locator('#table-results-body')).toContainText('No relationships found.');
  await expect(menu).toBeVisible();

  await page.unroute('**/api/query/relationships');
  await page.route('**/api/query/relationships', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'test upstream failure' }),
    });
  });
  await action.click();
  await expect(page.locator('#loading-overlay')).toHaveClass(/active/);
  await expect(page.locator('#loading-overlay')).not.toHaveClass(/active/);
  await expect(menu).toBeVisible();
});

test('convert retargets the menu and rewires edges while remove closes the unanchored menu', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: 'source', value: 'source', label: 'Source', type: 'node', custom: 'kept' }, position: { x: 260, y: 260 } },
      { group: 'nodes', data: { id: 'target', value: 'target', label: 'Target', type: 'node' }, position: { x: 520, y: 260 } },
      { group: 'edges', data: { id: 'edge', source: 'source', target: 'target', label: 'relation' } },
    ]);
  });
  await clickGraphNode(page, 'source');

  const menu = page.locator('#node-action-menu');
  await menu.getByRole('button', { name: 'Convert to variable' }).click();
  const replacementId = await menu.getAttribute('data-node-id');
  expect(replacementId).toMatch(/^\?node_/);
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Run query' })).toBeVisible();

  const converted = await page.evaluate((id) => ({
    oldNodeCount: cy.getElementById('source').length,
    replacementType: cy.getElementById(id).data('type'),
    replacementValue: cy.getElementById(id).data('value'),
    replacementLabel: cy.getElementById(id).data('label'),
    custom: cy.getElementById(id).data('custom'),
    position: cy.getElementById(id).position(),
    edgeSource: cy.getElementById('edge').data('source'),
  }), replacementId);
  expect(converted).toEqual({
    oldNodeCount: 0,
    replacementType: 'variable',
    replacementValue: replacementId,
    replacementLabel: '?',
    custom: 'kept',
    position: { x: 260, y: 260 },
    edgeSource: replacementId,
  });

  await menu.getByRole('button', { name: 'Remove' }).click();
  await expect(menu).toBeHidden();
  await expect(page.locator('#status-nodes')).toHaveText('Nodes: 1');
  await expect(page.locator('#status-edges')).toHaveText('Edges: 0');
});

test('the node action list remains inside the graph viewport after movement pan and zoom', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    cy.add({ group: 'nodes', data: { id: 'edge-node', value: 'edge-node', label: 'Edge Node', type: 'node' }, position: { x: 900, y: 500 } });
    cy.center();
  });
  await clickGraphNode(page, 'edge-node');
  await page.evaluate(() => {
    const node = cy.getElementById('edge-node');
    cy.zoom(1.4);
    node.position({ x: 1200, y: 700 });
    cy.center(node);
  });

  await expect.poll(async () => page.evaluate(() => {
    const menu = document.getElementById('node-action-menu').getBoundingClientRect();
    const canvas = document.getElementById('cy').getBoundingClientRect();
    return menu.left >= canvas.left && menu.top >= canvas.top &&
      menu.right <= canvas.right && menu.bottom <= canvas.bottom;
  })).toBe(true);

  await page.evaluate(() => {
    cy.panBy({ x: 5000, y: 0 });
  });
  await expect(page.locator('#node-action-menu')).toBeHidden();

  await page.evaluate(() => {
    cy.center(cy.getElementById('edge-node'));
  });
  await expect(page.locator('#node-action-menu')).toBeVisible();

  for (const viewport of [{ width: 420, height: 720 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        cy.resize();
        cy.center(cy.getElementById('edge-node'));
        resolve();
      }));
    }));
    await page.evaluate(() => {
      cy.emit('pan');
    });
    await expect(page.locator('#node-action-menu')).toBeVisible();
    await expect.poll(async () => page.evaluate(() => {
      const menu = document.getElementById('node-action-menu').getBoundingClientRect();
      const canvas = document.getElementById('cy').getBoundingClientRect();
      return menu.left >= canvas.left && menu.top >= canvas.top &&
        menu.right <= canvas.right && menu.bottom <= canvas.bottom;
    })).toBe(true);
  }
});

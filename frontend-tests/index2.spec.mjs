import { expect, test } from '@playwright/test';
import { guardExternalTraffic } from './external-assets.mjs';
import { startFrontendTestServer } from './server.mjs';

let server;

test.beforeAll(async () => {
  server = await startFrontendTestServer();
});

test.afterAll(async () => {
  await server.close();
});

test.beforeEach(async ({ page }) => {
  page.__unexpectedExternalRequests = await guardExternalTraffic(page, server.baseUrl);
  await page.addInitScript(() => {
    // The animated startup cose layout fits the whole graph when it stops, which
    // can happen after page load. Its stop callback marks the point after which a
    // test may set the viewport.
    let startupLayoutStopped;
    window.__startupLayoutDone = new Promise(resolve => { startupLayoutStopped = resolve; });
    let factory;
    Object.defineProperty(window, 'cytoscape', {
      configurable: true,
      get: () => factory,
      set(value) {
        factory = new Proxy(value, {
          apply(target, self, [options, ...rest]) {
            if (options?.layout) {
              const stop = options.layout.stop;
              options = { ...options, layout: { ...options.layout, stop(...args) {
                stop?.apply(this, args);
                startupLayoutStopped();
              } } };
            }
            return Reflect.apply(target, self, [options, ...rest]);
          },
        });
      },
    });
  });
  await page.goto(server.baseUrl);
});

test.afterEach(async ({ page }) => {
  expect(page.__unexpectedExternalRequests, 'Unexpected external browser requests').toEqual([]);
});


test('unexpected external browser traffic is rejected', async ({ page }) => {
  await page.evaluate(() => fetch('https://unexpected.example.test/asset.js').catch(() => {}));
  expect(page.__unexpectedExternalRequests).toEqual(['https://unexpected.example.test/asset.js']);
  page.__unexpectedExternalRequests.length = 0;
});

async function disableAutoLayout(page) {
  await page.evaluate(() => window.__startupLayoutDone);
  await page.evaluate(() => {
    const checkbox = document.getElementById('auto-layout');
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    // The stopped startup layout may have fit an empty graph at either zoom extreme.
    cy.zoom(1);
    cy.pan({ x: 0, y: 0 });
  });
}

async function clickGraphNode(page, nodeId) {
  const pendingBeforeClick = await page.locator('#connection-preview').isVisible();
  for (const fraction of [0, 0.2, -0.2]) {
    const position = await page.evaluate(async ({ id, fraction }) => {
      const node = cy.getElementById(id);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      let rendered = node.renderedPosition();
      if (rendered.x < 40 || rendered.x > cy.width() - 40 || rendered.y < 40 || rendered.y > cy.height() - 40) {
        cy.center(node);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        rendered = node.renderedPosition();
      }
      if (window.__testGraphTapHandler) cy.off('tap', window.__testGraphTapHandler);
      window.__testGraphTap = null;
      window.__testGraphTapHandler = event => {
        window.__testGraphTap = event.target === cy ? 'background' : event.target.id();
      };
      cy.on('tap', window.__testGraphTapHandler);
      return { x: rendered.x + node.renderedWidth() * fraction, y: rendered.y };
    }, { id: nodeId, fraction });
    await page.locator('#cy').click({ position });
    const target = await page.evaluate(() => {
      cy.off('tap', window.__testGraphTapHandler);
      return window.__testGraphTap;
    });
    if (target === nodeId) return;
    if (pendingBeforeClick) throw new Error(`Graph click hit ${target ?? 'nothing'} instead of ${nodeId} while connecting`);
  }
  throw new Error(`Graph click did not reach node ${nodeId} after three pointer positions`);
}

async function clickGraphEdge(page, edgeId) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  const position = await page.evaluate((id) => {
    const midpoint = cy.getElementById(id).midpoint();
    const zoom = cy.zoom();
    const pan = cy.pan();
    return { x: midpoint.x * zoom + pan.x, y: midpoint.y * zoom + pan.y };
  }, edgeId);
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

test('running a query with exactly two valid variables opens the staged exploration panel without a legacy query request', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: '?zeta', value: '?zeta', label: '?', type: 'variable' }, position: { x: 220, y: 200 } },
      { group: 'nodes', data: { id: '?alpha', value: '?alpha', label: '?', type: 'variable' }, position: { x: 440, y: 200 } },
      { group: 'edges', data: { id: 'fixed-predicate', source: '?zeta', target: '?alpha', nodeId: '<https://example.test/relation>', label: 'relation' } },
    ]);
  });
  const queryRequestsBefore = server.requests.filter(({ path }) => path === '/api/query').length;

  await page.locator('#run-query-btn').click();

  const panel = page.getByRole('complementary', { name: 'Explore query variables' });
  await expect(panel).toBeVisible();
  await expect(page.locator('#two-variable-list')).toHaveText('?alpha?zeta');
  await expect(panel).toContainText('Staged exploration');
  await expect(page.getByRole('button', { name: 'Close query variable exploration' })).toBeFocused();
  expect(server.requests.filter(({ path }) => path === '/api/query').length).toBe(queryRequestsBefore);

  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(page.locator('#run-query-btn')).toBeFocused();

  await page.locator('#run-query-btn').click();
  await expect(panel).toBeVisible();
  await page.getByRole('button', { name: 'Close query variable exploration' }).click();
  await expect(panel).toBeHidden();

  await page.locator('#run-query-btn').click();
  await expect(panel).toBeVisible();
  await page.locator('#cy').click({ position: { x: 16, y: 16 } });
  await expect(panel).toBeHidden();
});

async function addFixedGroupFirst(page) {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    M.toast = options => { window.__lastToast = options.html; };
    cy.add([
      { group: 'nodes', data: { id: 'pikachu', value: '<https://example.test/pikachu>', label: 'Pikachu', type: 'node' } },
      { group: 'nodes', data: { id: 'electric', value: '<https://example.test/electric>', label: 'Electric', type: 'node' } },
      { group: 'edges', data: { id: 'resists', source: 'pikachu', target: 'electric', nodeId: '<https://example.test/resistantTo>', label: 'resistant to' } },
    ]);
  });
}

test('Run Query and the stage order use the variable group even when a group without variables came first', async ({ page }) => {
  await addFixedGroupFirst(page);
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: 'fire', value: '<https://example.test/fire>', label: 'Fire', type: 'node' } },
      { group: 'nodes', data: { id: '?node_1', value: '?node_1', label: '?', type: 'variable' } },
      { group: 'edges', data: { id: 'fire-relation', source: 'fire', target: '?node_1', nodeId: '?predicate_1', label: '?', type: 'variable' } },
    ]);
  });
  await expect(page.locator('#variable-order')).toBeVisible();
  await expect(blockNames(page)).toHaveText(['?node_1', '?predicate_1']);
  const requestsBefore = server.requests.filter(({ path }) => path === '/api/query').length;

  await page.locator('#run-query-btn').click();

  await expect(page.locator('#two-variable-panel')).toBeVisible();
  await expect(page.locator('#two-variable-list')).toHaveText('?node_1?predicate_1');
  expect(server.requests.filter(({ path }) => path === '/api/query').length).toBe(requestsBefore);
  expect(await page.evaluate(() => window.__lastToast)).toBeUndefined();
});

test('a single variable in a later group is staged for that group', async ({ page }) => {
  await addFixedGroupFirst(page);
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: 'fire', value: '<https://example.test/fire>', label: 'Fire', type: 'node' } },
      { group: 'nodes', data: { id: '?node_1', value: '?node_1', label: '?', type: 'variable' } },
      { group: 'edges', data: { id: 'fire-relation', source: 'fire', target: '?node_1', nodeId: '<https://example.test/superEffectiveAgainst>', label: 'super effective against' } },
    ]);
  });
  const stageRequests = () => server.requests.filter(({ path }) => path === '/api/query/stage');
  const stagesBefore = stageRequests().length;

  await page.locator('#run-query-btn').click();

  await expect.poll(() => stageRequests().length).toBe(stagesBefore + 1);
  const body = JSON.parse(stageRequests().at(-1).body);
  expect(body.variableName).toBe('?node_1');
  expect(body.where).toHaveLength(1);
  expect(body.where[0]).toMatchObject({ subject: '<https://example.test/fire>', object: '?node_1' });
});

test('variables in two unconnected groups are rejected with a clear message', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    M.toast = options => { window.__lastToast = options.html; };
    cy.add([
      { group: 'nodes', data: { id: '?first', value: '?first', label: '?', type: 'variable' } },
      { group: 'nodes', data: { id: 'pikachu', value: '<https://example.test/pikachu>', type: 'node' } },
      { group: 'edges', data: { id: 'first-edge', source: '?first', target: 'pikachu', nodeId: '<https://example.test/p>', label: 'p' } },
      { group: 'nodes', data: { id: '?second', value: '?second', label: '?', type: 'variable' } },
      { group: 'nodes', data: { id: 'fire', value: '<https://example.test/fire>', type: 'node' } },
      { group: 'edges', data: { id: 'second-edge', source: 'fire', target: '?second', nodeId: '<https://example.test/q>', label: 'q' } },
    ]);
  });
  await expect.poll(() => page.evaluate(() => getVariableOrder())).toEqual([]);
  await expect(page.locator('#variable-order')).toBeHidden();
  const requestsBefore = server.requests.length;

  await page.locator('#run-query-btn').click();

  await expect.poll(() => page.evaluate(() => window.__lastToast)).toContain('separate, unconnected parts');
  await expect(page.locator('#two-variable-panel')).toBeHidden();
  expect(server.requests.length).toBe(requestsBefore);
});

for (const fixedValue of ['<https://example.test/relation?ghost>', '?alpha-bad']) {
  test(`query variable detection ignores the non-variable value ${fixedValue}`, async ({ page }) => {
    await disableAutoLayout(page);
    await page.evaluate(value => {
      cy.add([
        { group: 'nodes', data: { id: 'fixed-node', value, label: value, type: 'node' } },
        { group: 'nodes', data: { id: '?real', value: '?real', label: '?', type: 'variable' } },
        { group: 'edges', data: { id: 'fixed-predicate', source: 'fixed-node', target: '?real', nodeId: '<https://example.test/relation>', label: 'relation' } },
      ]);
    }, fixedValue);
    const stagesBefore = server.requests.filter(({ path }) => path === '/api/query/stage').length;

    await page.locator('#run-query-btn').click();

    await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 1: ?real');
    await expect.poll(() => server.requests.filter(({ path }) => path === '/api/query/stage').length).toBe(stagesBefore + 1);
    const body = JSON.parse(server.requests.filter(({ path }) => path === '/api/query/stage').at(-1).body);
    expect(body.variableName).toBe('?real');
  });
}

for (const predicateCount of [2, 3]) {
  test(`${predicateCount} parallel predicate variables between fixed endpoints are not a traversal chain`, async ({ page }) => {
    await disableAutoLayout(page);
    await page.evaluate(count => {
      M.toast = options => { window.__lastToast = options.html; };
      cy.add([
        { group: 'nodes', data: { id: 'source', value: '<https://example.test/source>', type: 'node' } },
        { group: 'nodes', data: { id: 'target', value: '<https://example.test/target>', type: 'node' } },
        ...Array.from({ length: count }, (_, index) => ({
          group: 'edges', data: { id: `relation-${index}`, source: 'source', target: 'target', nodeId: `?predicate_${index}`, label: '?', type: 'variable' },
        })),
      ]);
    }, predicateCount);
    const graphBefore = await page.evaluate(() => cy.elements().map(element => element.json()));
    const requestsBefore = server.requests.filter(({ path }) => path === '/api/query').length;
    await page.locator('#run-query-btn').click();
    await expect.poll(() => page.evaluate(() => window.__lastToast)).toContain('Parallel predicate variables');
    await expect(page.locator('#two-variable-panel')).toBeHidden();
    expect(server.requests.filter(({ path }) => path === '/api/query').length).toBe(requestsBefore);
    expect(await page.evaluate(() => cy.elements().map(element => element.json()))).toEqual(graphBefore);
  });
}

test('two predicate variables on successive edges retain the staged chain flow', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: 'source', value: '<https://example.test/source>', type: 'node' } },
      { group: 'nodes', data: { id: 'middle', value: '<https://example.test/middle>', type: 'node' } },
      { group: 'nodes', data: { id: 'target', value: '<https://example.test/target>', type: 'node' } },
      { group: 'edges', data: { id: 'first', source: 'source', target: 'middle', nodeId: '?predicate_1', label: '?' } },
      { group: 'edges', data: { id: 'second', source: 'middle', target: 'target', nodeId: '?predicate_2', label: '?' } },
    ]);
  });
  const requestsBefore = server.requests.filter(({ path }) => path === '/api/query').length;
  await page.locator('#run-query-btn').click();
  await expect(page.locator('#two-variable-panel')).toBeVisible();
  await expect(page.locator('#two-variable-list')).toHaveText('?predicate_1?predicate_2');
  expect(server.requests.filter(({ path }) => path === '/api/query').length).toBe(requestsBefore);
});

test('three or more variables use the ordered staged flow instead of legacy projection', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: '?team', value: '?team', label: '?', type: 'variable' } },
      { group: 'nodes', data: { id: '?city', value: '?city', label: '?', type: 'variable' } },
      { group: 'edges', data: { id: 'located', source: '?team', target: '?city', nodeId: '?relation', label: '?' } },
    ]);
  });
  const requestsBefore = server.requests.filter(({ path }) => path === '/api/query').length;
  await page.locator('#run-query-btn').click();
  await expect(page.locator('#two-variable-panel')).toBeVisible();
  await expect(page.locator('#two-variable-list')).toHaveText('?city?relation?team');
  expect(server.requests.filter(({ path }) => path === '/api/query').length).toBe(requestsBefore);
});

test('variable order is session state that resets only when the query signature changes', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: '?b', value: '?b', label: '?', type: 'variable' } },
      { group: 'nodes', data: { id: '?a', value: '?a', label: '?', type: 'variable' } },
      { group: 'edges', data: { id: 'rel', source: '?b', target: '?a', nodeId: '<https://example.test/p>', label: 'p' } },
    ]);
  });
  await expect.poll(() => page.evaluate(() => getVariableOrder())).toEqual(['?a', '?b']);
  await page.evaluate(() => setVariableOrder(['?b', '?a']));

  await page.evaluate(() => { cy.getElementById('?a').data('label', 'renamed only'); });
  await page.evaluate(() => { cy.getElementById('?a').position({ x: 400, y: 300 }); });
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
  expect(await page.evaluate(() => getVariableOrder())).toEqual(['?b', '?a']);

  await page.evaluate(() => { cy.getElementById('rel').data('nodeId', '<https://example.test/q>'); });
  await expect.poll(() => page.evaluate(() => getVariableOrder())).toEqual(['?a', '?b']);

  await page.evaluate(() => setVariableOrder(['?b', '?a']));
  await page.locator('#input-endpoint-sparql').fill('https://example.test/sparql');
  await expect.poll(() => page.evaluate(() => getVariableOrder())).toEqual(['?a', '?b']);

  await page.evaluate(() => setVariableOrder(['?b', '?a']));
  await page.evaluate(() => newQuery());
  await expect.poll(() => page.evaluate(() => getVariableOrder())).toEqual([]);
});

async function addThreeVariableChain(page) {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: '?a', value: '?a', label: '?', type: 'variable' }, position: { x: 150, y: 200 } },
      { group: 'nodes', data: { id: '?c', value: '?c', label: '?', type: 'variable' }, position: { x: 450, y: 200 } },
      { group: 'edges', data: { id: 'rel', source: '?a', target: '?c', nodeId: '?b', label: '?' } },
    ]);
  });
  await expect(page.locator('#variable-order')).toBeVisible();
}

const blockNames = page => page.locator('#variable-order-list .variable-block-name');

test('stage-order blocks appear next to Run Query only for two or more variables', async ({ page }) => {
  await disableAutoLayout(page);
  const blocks = page.locator('#variable-order');
  await expect(blocks).toBeHidden();
  await page.evaluate(() => cy.add({ group: 'nodes', data: { id: '?solo', value: '?solo', label: '?', type: 'variable' } }) && undefined);
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
  await expect(blocks).toBeHidden();
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: '?other', value: '?other', label: '?', type: 'variable' } },
      { group: 'edges', data: { id: 'solo-other', source: '?solo', target: '?other', nodeId: '<https://example.test/p>', label: 'p' } },
    ]);
  });
  await expect(blocks).toBeVisible();
  await expect(page.getByRole('group', { name: 'Stage order' })).toBeVisible();
  await expect(page.locator('#variable-order-list .variable-block-number')).toHaveText(['1', '2']);
  await expect(blockNames(page)).toHaveText(['?other', '?solo']);
  expect(await page.evaluate(() => document.getElementById('variable-order').parentElement
    === document.getElementById('run-query-btn').parentElement)).toBe(true);

  await page.evaluate(() => { cy.getElementById('?other').remove(); });
  await expect(blocks).toBeHidden();
});

test('a variable repeated as node and predicate is one block', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: '?x', value: '?x', label: '?', type: 'variable' } },
      { group: 'nodes', data: { id: '?y', value: '?y', label: '?', type: 'variable' } },
      { group: 'edges', data: { id: 'x-y', source: '?x', target: '?y', nodeId: '?x', label: '?' } },
    ]);
  });
  await expect(blockNames(page)).toHaveText(['?x', '?y']);
});

const emphasizedBlocks = page => page.locator('#variable-order-list .variable-block.variable-emphasis .variable-block-name');
const emphasizedElements = page => page.evaluate(() => cy.elements('.variable-emphasis').map(element => element.id()).sort());

async function hoverGraphElement(page, id) {
  const position = await page.evaluate(id => {
    const element = cy.getElementById(id);
    return element.isEdge() ? element.renderedMidpoint() : element.renderedPosition();
  }, id);
  await page.locator('#cy').hover({ position });
}

test('hovering a variable node or relation emphasizes its stage-order block', async ({ page }) => {
  await addThreeVariableChain(page);
  await page.evaluate(() => { cy.add([
    { group: 'nodes', data: { id: 'fixed', value: '<https://example.test/f>', label: 'F', type: 'node' }, position: { x: 450, y: 450 } },
    { group: 'edges', data: { id: 'c-fixed', source: '?c', target: 'fixed', nodeId: '<https://example.test/p>', label: 'p' } },
  ]); });
  await expect(blockNames(page)).toHaveText(['?a', '?b', '?c']);

  await hoverGraphElement(page, '?a');
  await expect(emphasizedBlocks(page)).toHaveText(['?a']);
  expect(await emphasizedElements(page)).toEqual(['?a']);

  await hoverGraphElement(page, 'rel');
  await expect(emphasizedBlocks(page)).toHaveText(['?b']);
  expect(await emphasizedElements(page)).toEqual(['rel']);

  await page.locator('#cy').hover({ position: { x: 300, y: 40 } });
  await expect(emphasizedBlocks(page)).toHaveCount(0);
  expect(await emphasizedElements(page)).toEqual([]);

  await hoverGraphElement(page, 'fixed');
  await expect(page.locator('#cy')).toBeVisible();
  await expect(emphasizedBlocks(page)).toHaveCount(0);
  expect(await emphasizedElements(page)).toEqual([]);
});

test('hovering or focusing a stage-order block emphasizes every node and relation of that variable', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => { cy.add([
    { group: 'nodes', data: { id: '?x', value: '?x', label: '?', type: 'variable' }, position: { x: 150, y: 200 } },
    { group: 'nodes', data: { id: '?y', value: '?y', label: '?', type: 'variable' }, position: { x: 450, y: 200 } },
    { group: 'edges', data: { id: 'x-y', source: '?x', target: '?y', nodeId: '?x', label: '?' } },
  ]); });
  const block = name => page.locator(`#variable-order-list .variable-block[data-variable="${name}"]`);
  const before = await page.evaluate(() => JSON.stringify(cy.json().elements));

  await block('?x').hover();
  expect(await emphasizedElements(page)).toEqual(['?x', 'x-y']);
  await expect(emphasizedBlocks(page)).toHaveText(['?x']);
  expect(await page.evaluate(() => cy.getElementById('x-y').style('underlay-opacity'))).not.toBe('0');
  await expect(block('?x')).toHaveCSS('outline-color', 'rgb(0, 184, 212)');

  await block('?y').hover();
  expect(await emphasizedElements(page)).toEqual(['?y']);
  await page.locator('#cy').hover({ position: { x: 300, y: 40 } });
  await expect(emphasizedBlocks(page)).toHaveCount(0);
  expect(await emphasizedElements(page)).toEqual([]);

  // Keyboard focus follows the block through a reorder.
  await page.getByRole('button', { name: 'Move ?x later' }).focus();
  expect(await emphasizedElements(page)).toEqual(['?x', 'x-y']);
  await page.keyboard.press('Enter');
  await expect(blockNames(page)).toHaveText(['?y', '?x']);
  await expect(emphasizedBlocks(page)).toHaveText(['?x']);
  expect(await emphasizedElements(page)).toEqual(['?x', 'x-y']);
  await page.locator('#run-query-btn').focus();
  await expect(emphasizedBlocks(page)).toHaveCount(0);
  expect(await emphasizedElements(page)).toEqual([]);

  // Emphasis is visual only: once cleared, the graph is exactly as before.
  expect(await page.evaluate(() => JSON.stringify(cy.json().elements))).toBe(before);
});

test('a single-variable query emphasizes nothing', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => { cy.add({ group: 'nodes', data: { id: '?solo', value: '?solo', label: '?', type: 'variable' }, position: { x: 300, y: 200 } }); });
  await expect(page.locator('#variable-order')).toBeHidden();
  await hoverGraphElement(page, '?solo');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  expect(await emphasizedElements(page)).toEqual([]);
});

test('keyboard reordering updates the stage order read by Run Query', async ({ page }) => {
  await addThreeVariableChain(page);
  await expect(blockNames(page)).toHaveText(['?a', '?b', '?c']);
  await expect(page.getByRole('button', { name: 'Move ?a earlier' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Move ?c later' })).toBeDisabled();
  const requestsBefore = server.requests.length;

  await page.getByRole('button', { name: 'Move ?c earlier' }).focus();
  await page.keyboard.press('Enter');
  await expect(blockNames(page)).toHaveText(['?a', '?c', '?b']);
  await expect(page.getByRole('button', { name: 'Move ?c earlier' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(blockNames(page)).toHaveText(['?c', '?a', '?b']);
  await expect(page.getByRole('button', { name: 'Move ?c later' })).toBeFocused();
  await expect(page.locator('#variable-order-status')).toHaveText('?c moved to stage 1 of 3.');
  await expect(page.getByRole('listitem', { name: 'Stage 1: ?c' })).toBeVisible();

  const nodesBefore = await page.evaluate(() => cy.elements().map(item => JSON.stringify(item.data())).sort());
  await page.locator('#run-query-btn').click();
  await expect(page.locator('#two-variable-list')).toHaveText('?c?a?b');
  expect(await page.evaluate(() => cy.elements().map(item => JSON.stringify(item.data())).sort())).toEqual(nodesBefore);
  const newRequests = server.requests.slice(requestsBefore);
  expect(newRequests.map(({ path }) => path)).toEqual(['/api/query/stage']);
  expect(JSON.parse(newRequests[0].body).variableName).toBe('?c');
});

test('pointer dragging a block produces the same order as the keyboard controls', async ({ page }) => {
  await addThreeVariableChain(page);
  const source = page.getByRole('listitem', { name: 'Stage 3: ?c' });
  const target = page.getByRole('listitem', { name: 'Stage 1: ?a' });
  const from = await source.locator('.variable-block-name').boundingBox();
  const to = await target.locator('.variable-block-name').boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(blockNames(page)).toHaveText(['?c', '?a', '?b']);
  expect(await page.evaluate(() => getVariableOrder())).toEqual(['?c', '?a', '?b']);
  await expect(page.locator('#variable-order-list .dragging, #variable-order-list .drop-target')).toHaveCount(0);
});

test('stage-order controls stay reachable at a narrow viewport width', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await addThreeVariableChain(page);
  const button = page.getByRole('button', { name: 'Move ?b later' });
  await button.focus();
  await expect(button).toBeFocused();
  const box = await button.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
  await page.keyboard.press('Enter');
  await expect(blockNames(page)).toHaveText(['?a', '?c', '?b']);
  await expect(page.locator('#variable-order-status')).toHaveText('?b moved to stage 3 of 3.');
});

const XSD_INTEGER = 'http://www.w3.org/2001/XMLSchema#integer';
const RDF_LANG_STRING = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';
const iri = (value, label = null) => ({ term: { type: 'iri', value, datatype: null, language: null }, label, selectable: true });

function stagePage(request, candidates, hasMore = false) {
  return { data: { variableName: request.variableName, offset: request.offset, limit: request.limit, hasMore, candidates } };
}

// Routes POST /api/query/stage through `respond(request, index)`, which returns
// {status?, body} or a promise of it; every request body is recorded.
async function routeStages(page, respond) {
  const requests = [];
  await page.route('**/api/query/stage', async route => {
    const request = JSON.parse(route.request().postData());
    requests.push(request);
    const { status = 200, body } = await respond(request, requests.length - 1);
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }).catch(() => {});
  });
  return requests;
}

async function addTeamCityGraph(page) {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: '?team', value: '?team', label: '?', type: 'variable' }, position: { x: 150, y: 200 } },
      { group: 'nodes', data: { id: '?city', value: '?city', label: '?', type: 'variable' }, position: { x: 450, y: 200 } },
      { group: 'edges', data: { id: 'located', source: '?team', target: '?city', nodeId: '<https://example.test/city>', label: 'city' } },
    ]);
  });
  await expect(page.locator('#variable-order')).toBeVisible();
}

const graphSnapshot = page => page.evaluate(() => cy.elements().map(item => JSON.stringify(item.data())).sort());
const candidateButtons = page => page.locator('#stage-candidates .stage-candidate');

test('the first stage requests typed candidates for the reordered first variable only', async ({ page }) => {
  await addTeamCityGraph(page);
  const requests = await routeStages(page, request => ({ body: stagePage(request, [
    iri('https://example.test/gremio', 'Grêmio'),
    { term: { type: 'literal', value: '1903', datatype: XSD_INTEGER, language: null }, label: null, selectable: true },
    { term: { type: 'literal', value: 'Grêmio', datatype: RDF_LANG_STRING, language: 'pt' }, label: null, selectable: true },
    { term: { type: 'bnode', value: 'b0', datatype: null, language: null }, label: null, selectable: false },
  ]) }));
  await page.getByRole('button', { name: 'Move ?team earlier' }).click();
  const before = await graphSnapshot(page);

  await page.locator('#run-query-btn').click();
  await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 2: ?team');
  await expect(candidateButtons(page)).toHaveText([/Grêmio\s*IRI/, /1903\s*literal integer/, /Grêmio\s*literal @pt/, /b0\s*blank node \(not selectable\)/]);
  await expect(candidateButtons(page).nth(3)).toBeDisabled();
  await expect(page.locator('#stage-candidates li').nth(3).locator('.stage-assume')).toHaveCount(0);
  await expect(page.locator('#stage-candidates .stage-assume')).toHaveCount(3);
  await expect(page.locator('#stage-status')).toHaveText('4 values for ?team.');
  expect(requests).toEqual([{
    endpointUrl: 'CampeonatoBrasileiro2023',
    variableName: '?team',
    where: [{ subject: '?team', predicate: '<https://example.test/city>', object: '?city', filterType: null }],
    bindings: [],
    limit: 50,
    offset: 0,
  }]);

  await candidateButtons(page).nth(3).click({ force: true });
  await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 2: ?team');
  expect(requests.map(({ variableName }) => variableName)).not.toContain('?city');
  expect(await graphSnapshot(page)).toEqual(before);
});

test('a stage shows loading then empty states and reuses cached pages for the same query', async ({ page }) => {
  await addTeamCityGraph(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const requests = await routeStages(page, async request => {
    await gate;
    return { body: stagePage(request, []) };
  });
  await page.locator('#input-max-results').fill('7');
  await page.locator('#run-query-btn').click();
  await expect(page.locator('#stage-status')).toHaveText('Loading values for ?city…');
  release();
  await expect(page.locator('#stage-status')).toHaveText('No values for ?city under the chosen bindings.');
  expect(requests.map(({ limit }) => limit)).toEqual([7]);

  await page.keyboard.press('Escape');
  await page.locator('#run-query-btn').click();
  await expect(page.locator('#stage-status')).toHaveText('No values for ?city under the chosen bindings.');
  expect(requests).toHaveLength(1);
});

test('a stage error shows the server message and Retry requests the page again', async ({ page }) => {
  await addTeamCityGraph(page);
  const requests = await routeStages(page, (request, index) => index === 0
    ? { status: 502, body: { error: 'Upstream SPARQL endpoint failed' } }
    : { body: stagePage(request, [iri('https://example.test/porto-alegre', 'Porto Alegre')]) });
  await page.locator('#run-query-btn').click();
  await expect(page.locator('#stage-status')).toHaveText('Upstream SPARQL endpoint failed');
  await expect(page.locator('#stage-candidates li')).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(candidateButtons(page)).toHaveText([/Porto Alegre/]);
  await expect(page.getByRole('button', { name: 'Retry' })).toBeHidden();
  expect(requests).toHaveLength(2);
});

test('Load more requests the next offset page and appends its candidates', async ({ page }) => {
  await addTeamCityGraph(page);
  await page.locator('#input-max-results').fill('2');
  const requests = await routeStages(page, request => ({
    body: request.offset === 0
      ? stagePage(request, [iri('https://example.test/c1', 'City 1'), iri('https://example.test/c2', 'City 2')], true)
      : stagePage(request, [iri('https://example.test/c3', 'City 3')], false),
  }));
  await page.locator('#run-query-btn').click();
  await expect(candidateButtons(page)).toHaveCount(2);
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(candidateButtons(page)).toHaveText([/City 1/, /City 2/, /City 3/]);
  await expect(page.getByRole('button', { name: 'Load more' })).toBeHidden();
  expect(requests.map(({ offset, limit }) => [offset, limit])).toEqual([[0, 2], [2, 2]]);
});

test('reordering while a stage loads discards the stale response', async ({ page }) => {
  await addTeamCityGraph(page);
  const releases = [];
  const requests = await routeStages(page, request => new Promise(resolve => {
    releases.push(() => resolve({ body: stagePage(request, [iri(`https://example.test/${request.variableName.slice(1)}`, `${request.variableName} value`)]) }));
  }));
  await page.locator('#run-query-btn').click();
  await expect.poll(() => requests.length).toBe(1);
  await page.getByRole('button', { name: 'Move ?team earlier' }).click();
  await expect.poll(() => requests.length).toBe(2);
  await expect(page.locator('#two-variable-list')).toHaveText('?team?city');
  releases[0]();
  releases[1]();
  await expect(candidateButtons(page)).toHaveText([/\?team value/]);
  await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 2: ?team');
  expect(requests.map(({ variableName }) => variableName)).toEqual(['?city', '?team']);
});

test('editing the graph closes the exploration panel', async ({ page }) => {
  await addTeamCityGraph(page);
  await routeStages(page, request => ({ body: stagePage(request, [iri('https://example.test/c1', 'City 1')]) }));
  await page.locator('#run-query-btn').click();
  await expect(candidateButtons(page)).toHaveCount(1);
  await page.evaluate(() => { cy.getElementById('located').data('nodeId', '<https://example.test/stadiumCity>'); });
  await expect(page.locator('#two-variable-panel')).toBeHidden();
});

// ?city is stage 1 (sorted order); ?team candidates depend on the assumed city.
function cityTeamResponder({ hold } = {}) {
  return async request => {
    if (hold) await hold(request);
    if (request.variableName === '?city') {
      return { body: stagePage(request, [iri('https://example.test/poa', 'Porto Alegre'), iri('https://example.test/rio', 'Rio')]) };
    }
    const city = request.bindings.find(binding => binding.variableName === '?city')?.term.value ?? 'none';
    const team = city.endsWith('/poa') ? 'Grêmio' : 'Flamengo';
    return { body: stagePage(request, [iri(`https://example.test/${team}`, team)]) };
  };
}

const previewRequests = requests => requests.filter(({ variableName }) => variableName === '?team');

test('hovering a candidate previews the next variable under that typed assumption', async ({ page }) => {
  await addTeamCityGraph(page);
  const requests = await routeStages(page, cityTeamResponder());
  await page.locator('#run-query-btn').click();
  await expect(candidateButtons(page)).toHaveCount(2);
  const before = await graphSnapshot(page);

  await candidateButtons(page).first().hover();
  await expect(page.locator('#stage-preview-heading')).toHaveText('If ?city = Porto Alegre, ?team could be:');
  await expect(page.locator('#stage-preview-list')).toHaveText('Grêmio (IRI)');
  expect(previewRequests(requests)).toEqual([{
    endpointUrl: 'CampeonatoBrasileiro2023',
    variableName: '?team',
    where: [{ subject: '?team', predicate: '<https://example.test/city>', object: '?city', filterType: null }],
    bindings: [{ variableName: '?city', term: { type: 'iri', value: 'https://example.test/poa', datatype: null, language: null } }],
    limit: 50,
    offset: 0,
  }]);
  expect(await graphSnapshot(page)).toEqual(before);
});

test('keyboard focus produces the same preview and Enter commits and advances', async ({ page }) => {
  await addTeamCityGraph(page);
  const requests = await routeStages(page, cityTeamResponder());
  await page.locator('#run-query-btn').click();
  await expect(candidateButtons(page)).toHaveCount(2);
  await candidateButtons(page).nth(1).focus();
  await expect(page.locator('#stage-preview-heading')).toHaveText('If ?city = Rio, ?team could be:');
  await expect(page.locator('#stage-preview-list')).toHaveText('Flamengo (IRI)');
  const requestsBeforeCommit = requests.length;

  await page.keyboard.press('Enter');
  await expect(page.locator('#stage-heading')).toHaveText('Stage 2 of 2: ?team');
  await expect(page.locator('#stage-heading')).toBeFocused();
  await expect(page.locator('#stage-commitments')).toHaveText('?city = Rio');
  await expect(candidateButtons(page)).toHaveText([/Flamengo/]);
  await expect(page.locator('#stage-preview')).toBeHidden();
  expect(requests.length).toBe(requestsBeforeCommit);
});

test('rapid pointer movement sends only the settled preview request', async ({ page }) => {
  await addTeamCityGraph(page);
  const requests = await routeStages(page, cityTeamResponder());
  await page.locator('#run-query-btn').click();
  await expect(candidateButtons(page)).toHaveCount(2);
  // One synchronous burst: Playwright hover() itself can take longer than the delay.
  await page.evaluate(() => {
    const [first, second] = document.querySelectorAll('#stage-candidates .stage-candidate');
    for (let i = 0; i < 3; i += 1) {
      for (const button of [first, second]) {
        button.dispatchEvent(new MouseEvent('mouseenter'));
        button.dispatchEvent(new MouseEvent('mouseleave'));
      }
    }
    second.dispatchEvent(new MouseEvent('mouseenter'));
  });
  await expect(page.locator('#stage-preview-list')).toHaveText('Flamengo (IRI)');
  await page.waitForTimeout(500);
  expect(previewRequests(requests).map(({ bindings }) => bindings[0].term.value)).toEqual(['https://example.test/rio']);
});

test('a superseded preview response is never displayed', async ({ page }) => {
  await addTeamCityGraph(page);
  const releases = new Map();
  const requests = await routeStages(page, cityTeamResponder({
    hold: request => request.variableName === '?team'
      ? new Promise(resolve => releases.set(request.bindings[0].term.value, resolve))
      : undefined,
  }));
  await page.locator('#run-query-btn').click();
  await expect(candidateButtons(page)).toHaveCount(2);
  await candidateButtons(page).first().hover();
  await expect.poll(() => previewRequests(requests).length).toBe(1);
  await candidateButtons(page).nth(1).hover();
  await expect.poll(() => previewRequests(requests).length).toBe(2);
  releases.get('https://example.test/rio')();
  await expect(page.locator('#stage-preview-list')).toHaveText('Flamengo (IRI)');
  releases.get('https://example.test/poa')();
  await page.waitForTimeout(200);
  await expect(page.locator('#stage-preview-heading')).toHaveText('If ?city = Rio, ?team could be:');
  await expect(page.locator('#stage-preview-list')).toHaveText('Flamengo (IRI)');
});

test('a failed preview shows its error without changing the stage', async ({ page }) => {
  await addTeamCityGraph(page);
  const ok = cityTeamResponder();
  await routeStages(page, request => request.variableName === '?team'
    ? { status: 502, body: { error: 'Preview endpoint failed' } }
    : ok(request));
  await page.locator('#run-query-btn').click();
  await candidateButtons(page).first().hover();
  await expect(page.locator('#stage-preview-status')).toHaveText('Preview endpoint failed');
  await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 2: ?city');
});

test('Back clears the commitment and reordering restarts without stale state', async ({ page }) => {
  await addTeamCityGraph(page);
  const requests = await routeStages(page, cityTeamResponder());
  await page.locator('#run-query-btn').click();
  await candidateButtons(page).first().click();
  await expect(page.locator('#stage-commitments')).toHaveText('?city = Porto Alegre');
  await expect(candidateButtons(page)).toHaveText([/Grêmio/]);

  await page.getByRole('button', { name: 'Back to previous stage' }).click();
  await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 2: ?city');
  await expect(page.locator('#stage-commitments li')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Back to previous stage' })).toBeHidden();
  await expect(page.locator('#stage-preview')).toBeHidden();

  await candidateButtons(page).nth(1).click();
  await expect(page.locator('#stage-commitments')).toHaveText('?city = Rio');
  await page.getByRole('button', { name: 'Move ?team earlier' }).click();
  await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 2: ?team');
  await expect(page.locator('#stage-commitments li')).toHaveCount(0);
  expect(requests.at(-1)).toMatchObject({ variableName: '?team', bindings: [] });
});

// Stage order ?a, ?b (edge predicate), ?c. Choosing a2 leaves no ?b values.
function threeStageResponder({ failStageThreeOnce = false } = {}) {
  let failed = false;
  return request => {
    const bound = Object.fromEntries(request.bindings.map(({ variableName, term }) => [variableName, term.value]));
    if (request.variableName === '?a') {
      return { body: stagePage(request, [iri('https://example.test/a1', 'Alpha'), iri('https://example.test/a2', 'Beta')]) };
    }
    if (request.variableName === '?b') {
      return { body: stagePage(request, bound['?a'] === 'https://example.test/a1' ? [iri('https://example.test/p1', 'founded')] : []) };
    }
    if (failStageThreeOnce && !failed) {
      failed = true;
      return { status: 502, body: { error: 'Stage three failed' } };
    }
    return { body: stagePage(request, [{ term: { type: 'literal', value: '1903', datatype: XSD_INTEGER, language: null }, label: null, selectable: true }]) };
  };
}

function expectOnlyNextStageRequests(requests, order) {
  for (const request of requests) {
    expect(request.variableName).toBe(order[request.bindings.length]);
    expect(request.bindings.map(({ variableName }) => variableName)).toEqual(order.slice(0, request.bindings.length));
  }
}

test('three ordered stages end in a summary and only Apply to graph changes the graph', async ({ page }) => {
  await addThreeVariableChain(page);
  const requests = await routeStages(page, threeStageResponder());
  const before = await graphSnapshot(page);
  await page.locator('#run-query-btn').click();
  await expect(candidateButtons(page)).toHaveCount(2);
  await candidateButtons(page).first().click();
  await expect(page.locator('#stage-heading')).toHaveText('Stage 2 of 3: ?b');
  await candidateButtons(page).first().click();
  await expect(page.locator('#stage-heading')).toHaveText('Stage 3 of 3: ?c');
  await expect(page.locator('#stage-commitments li')).toHaveText(['?a = Alpha', '?b = founded']);
  await candidateButtons(page).first().click();

  await expect(page.locator('#stage-heading')).toHaveText('All variables chosen');
  await expect(page.locator('#stage-commitments li')).toHaveText(['?a = Alpha', '?b = founded', '?c = 1903']);
  await expect(candidateButtons(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Apply to graph' })).toBeVisible();
  expect(await graphSnapshot(page)).toEqual(before);
  expectOnlyNextStageRequests(requests, ['?a', '?b', '?c']);
  expect(requests.map(({ variableName }) => variableName)).toContain('?c');

  await page.getByRole('button', { name: 'Apply to graph' }).click();
  await expect(page.locator('#two-variable-panel')).toBeHidden();
  const graph = await page.evaluate(() => ({
    nodes: cy.nodes().map(node => ({ id: node.id(), value: node.data('value'), label: node.data('label'), type: node.data('type') })).sort((a, b) => a.id.localeCompare(b.id)),
    edges: cy.edges().map(edge => ({ id: edge.id(), source: edge.data('source'), target: edge.data('target'), nodeId: edge.data('nodeId'), label: edge.data('label'), type: edge.data('type') })),
  }));
  expect(graph).toEqual({
    nodes: [
      { id: '<https://example.test/a1>', value: '<https://example.test/a1>', label: 'Alpha', type: 'node' },
      { id: '1903', value: '1903', label: '1903', type: 'label' },
    ],
    edges: [{ id: 'rel', source: '<https://example.test/a1>', target: '1903', nodeId: '<https://example.test/p1>', label: 'founded', type: undefined }],
  });
  await expect(page.locator('#variable-order')).toBeHidden();
});

const assumeButtons = page => page.locator('#stage-candidates .stage-assume');
const graphNodesAndEdges = page => page.evaluate(() => ({
  nodes: cy.nodes().map(node => node.id()).sort(),
  edges: cy.edges().map(edge => `${edge.id()}|${edge.data('source')}|${edge.data('nodeId')}|${edge.data('target')}`),
}));

test('Assume on the first stage applies that value now and reopens the remaining variables in their order', async ({ page }) => {
  await addThreeVariableChain(page);
  const requests = await routeStages(page, threeStageResponder());
  await page.getByRole('button', { name: 'Move ?c earlier' }).click();
  await expect(blockNames(page)).toHaveText(['?a', '?c', '?b']);
  await page.locator('#run-query-btn').click();
  await expect(candidateButtons(page)).toHaveCount(2);

  await page.getByRole('button', { name: 'Assume ?a = Alpha in the graph now' }).click();

  expect(await graphNodesAndEdges(page)).toEqual({
    nodes: ['<https://example.test/a1>', '?c'],
    edges: ['rel|<https://example.test/a1>|?b|?c'],
  });
  await expect(page.locator('#two-variable-panel')).toBeVisible();
  await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 2: ?c');
  await expect(page.locator('#stage-commitments li')).toHaveCount(0);
  await expect(blockNames(page)).toHaveText(['?c', '?b']);
  const last = requests.at(-1);
  expect(last.variableName).toBe('?c');
  expect(last.bindings).toEqual([]);
  expect(last.where).toEqual([{ subject: '<https://example.test/a1>', predicate: '?b', object: '?c', filterType: null }]);
});

test('Assume on a later stage applies the committed path and stages the last variable', async ({ page }) => {
  await addThreeVariableChain(page);
  const requests = await routeStages(page, threeStageResponder());
  await page.locator('#run-query-btn').click();
  await candidateButtons(page).first().click();
  await expect(page.locator('#stage-heading')).toHaveText('Stage 2 of 3: ?b');
  const queriesBefore = server.requests.filter(({ path }) => path === '/api/query').length;

  await assumeButtons(page).first().click();

  expect(await graphNodesAndEdges(page)).toEqual({
    nodes: ['<https://example.test/a1>', '?c'],
    edges: ['rel|<https://example.test/a1>|<https://example.test/p1>|?c'],
  });
  // BUG-005: the last variable stays staged, so a literal value is offered
  // instead of the legacy projection that drops untyped values.
  await expect(page.locator('#two-variable-panel')).toBeVisible();
  await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 1: ?c');
  await expect(candidateButtons(page)).toHaveText([/1903\s*literal integer/]);
  expect(server.requests.filter(({ path }) => path === '/api/query').length).toBe(queriesBefore);
  const last = requests.at(-1);
  expect(last.variableName).toBe('?c');
  expect(last.bindings).toEqual([]);
  expect(last.where).toEqual([{ subject: '<https://example.test/a1>', predicate: '<https://example.test/p1>', object: '?c', filterType: null }]);

  await candidateButtons(page).first().click();
  await page.getByRole('button', { name: 'Apply to graph' }).click();
  expect(await graphNodesAndEdges(page)).toEqual({
    nodes: ['1903', '<https://example.test/a1>'],
    edges: ['rel|<https://example.test/a1>|<https://example.test/p1>|1903'],
  });
});

test('Back and Close from the summary leave the graph unchanged', async ({ page }) => {
  await addThreeVariableChain(page);
  await routeStages(page, threeStageResponder());
  const before = await graphSnapshot(page);
  await page.locator('#run-query-btn').click();
  for (const heading of ['Stage 2 of 3: ?b', 'Stage 3 of 3: ?c', 'All variables chosen']) {
    await candidateButtons(page).first().click();
    await expect(page.locator('#stage-heading')).toHaveText(heading);
  }
  await page.getByRole('button', { name: 'Back to previous stage' }).click();
  await expect(page.locator('#stage-heading')).toHaveText('Stage 3 of 3: ?c');
  await expect(page.locator('#stage-commitments li')).toHaveText(['?a = Alpha', '?b = founded']);
  await expect(page.getByRole('button', { name: 'Apply to graph' })).toBeHidden();
  await candidateButtons(page).first().click();
  await expect(page.locator('#stage-heading')).toHaveText('All variables chosen');
  await page.getByRole('button', { name: 'Close query variable exploration' }).click();
  await expect(page.locator('#two-variable-panel')).toBeHidden();
  expect(await graphSnapshot(page)).toEqual(before);
});

test('empty and failed later stages keep the committed path and recover', async ({ page }) => {
  await addThreeVariableChain(page);
  const requests = await routeStages(page, threeStageResponder({ failStageThreeOnce: true }));
  await page.locator('#run-query-btn').click();
  await candidateButtons(page).nth(1).click();
  await expect(page.locator('#stage-status')).toHaveText('No values for ?b under the chosen bindings.');
  await page.getByRole('button', { name: 'Back to previous stage' }).click();
  await candidateButtons(page).first().click();
  await candidateButtons(page).first().click();
  await expect(page.locator('#stage-status')).toHaveText('Stage three failed');
  await expect(page.locator('#stage-commitments li')).toHaveText(['?a = Alpha', '?b = founded']);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(candidateButtons(page)).toHaveText([/1903\s*literal integer/]);
  expectOnlyNextStageRequests(requests, ['?a', '?b', '?c']);
});

const possibleGraph = page => page.evaluate(() => possibleCy.elements()
  .map(element => `${element.id()}|${element.classes().join(' ')}|${element.data('label')}`).sort());
const possibleCaption = page => page.locator('#possible-graph-caption');

// ?b under ?a = Alpha has four candidates, so the window cycles through three.
function cyclingResponder() {
  const base = threeStageResponder();
  return request => request.variableName === '?b' && request.bindings[0]?.term.value === 'https://example.test/a1'
    ? { body: stagePage(request, ['founded', 'named', 'located', 'owned'].map(name => iri(`https://example.test/${name}`, name))) }
    : base(request);
}

test('the possible graph renders in its own window with the assumed option and a next value in another color', async ({ page }) => {
  await addThreeVariableChain(page);
  await routeStages(page, threeStageResponder());
  const before = await graphSnapshot(page);
  const viewport = await page.evaluate(() => ({ zoom: cy.zoom(), pan: cy.pan() }));
  await page.locator('#run-query-btn').click();
  await expect(candidateButtons(page)).toHaveCount(2);
  const window = page.getByRole('region', { name: 'Possible graph' });
  await expect(window).toBeVisible();
  await expect(possibleCaption(page)).toHaveText('Hover or focus an option to preview it.');
  expect(await possibleGraph(page)).toEqual(['edge:rel|open|?b', 'node:?a|open|?a', 'node:?c|open|?c']);

  await candidateButtons(page).first().hover();
  await expect(possibleCaption(page)).toHaveText('If ?a = Alpha, ?b could be founded (1 of 1).');
  expect(await possibleGraph(page)).toEqual(['edge:rel|possible|founded', 'node:?a|assumed iri|Alpha', 'node:?c|open|?c']);
  expect(await page.evaluate(() => possibleCy.getElementById('edge:rel').style('line-color')))
    .not.toBe(await page.evaluate(() => possibleCy.getElementById('node:?a').style('background-color')));

  // The window does not overlap the exploration panel, and the main graph is untouched.
  const [windowBox, panelBox] = await Promise.all([window.boundingBox(), page.locator('#two-variable-panel').boundingBox()]);
  expect(windowBox.x + windowBox.width).toBeLessThanOrEqual(panelBox.x);
  expect(await graphSnapshot(page)).toEqual(before);
  expect(await page.evaluate(() => ({ zoom: cy.zoom(), pan: cy.pan() }))).toEqual(viewport);

  await candidateButtons(page).nth(1).hover();
  await expect(possibleCaption(page)).toHaveText('If ?a = Beta, ?b has no values.');
  expect(await possibleGraph(page)).toEqual(['edge:rel|open|?b', 'node:?a|assumed iri|Beta', 'node:?c|open|?c']);
});

test('long possible-graph values are wrapped under their node or relation in a larger window', async ({ page }) => {
  const longName = 'International Business Machines Corporation of New York';
  const longPredicate = 'was founded in the place and on the date recorded by the historical registry of companies';
  await addThreeVariableChain(page);
  await routeStages(page, request => request.variableName === '?a'
    ? { body: stagePage(request, [iri('https://example.test/a1', longName), iri('https://example.test/a2', 'Beta')]) }
    : { body: stagePage(request, [iri('https://example.test/p1', longPredicate)]) });
  await page.locator('#run-query-btn').click();
  const window = page.getByRole('region', { name: 'Possible graph' });
  await expect(window).toBeVisible();
  expect((await window.boundingBox()).width).toBeGreaterThan(380);
  expect((await page.locator('#possible-graph-canvas').boundingBox()).height).toBeGreaterThan(240);
  // Short open labels stay inside their elements.
  expect(await possibleGraph(page)).toEqual(['edge:rel|open|?b', 'node:?a|open|?a', 'node:?c|open|?c']);

  await candidateButtons(page).first().hover();
  await expect(possibleCaption(page)).toHaveText(`If ?a = ${longName}, ?b could be ${longPredicate} (1 of 1).`);
  expect(await possibleGraph(page)).toEqual([
    `edge:rel|possible label-below|${longPredicate}`,
    `node:?a|assumed iri label-below|${longName}`,
    'node:?c|open|?c',
  ]);
  const style = await page.evaluate(() => ['node:?a', 'edge:rel', 'node:?c'].map(id => {
    const element = possibleCy.getElementById(id);
    return [element.style('text-wrap'), element.isNode() ? element.style('text-valign') : 'edge', element.numericStyle('text-margin-y') > 0];
  }));
  expect(style).toEqual([['wrap', 'bottom', true], ['wrap', 'edge', true], ['ellipsis', 'center', false]]);

  await candidateButtons(page).nth(1).hover();
  expect(await possibleGraph(page)).toEqual(['edge:rel|open|?b', 'node:?a|assumed iri|Beta', 'node:?c|open|?c']);
});

test('holding the cursor on an option cycles up to three possible next values every three seconds', async ({ page }) => {
  await addThreeVariableChain(page);
  await routeStages(page, cyclingResponder());
  await page.locator('#run-query-btn').click();
  await expect(candidateButtons(page)).toHaveCount(2);
  await candidateButtons(page).first().hover();
  await expect(possibleCaption(page)).toHaveText('If ?a = Alpha, ?b could be founded (1 of 3).');
  const started = Date.now();
  await expect(possibleCaption(page)).toHaveText('If ?a = Alpha, ?b could be named (2 of 3).', { timeout: 4000 });
  expect(Date.now() - started).toBeGreaterThan(2000);
  expect(await possibleGraph(page)).toContain('edge:rel|possible|named');
  await expect(possibleCaption(page)).toHaveText('If ?a = Alpha, ?b could be located (3 of 3).', { timeout: 4000 });
  await expect(possibleCaption(page)).toHaveText('If ?a = Alpha, ?b could be founded (1 of 3).', { timeout: 4000 });

  await page.locator('#two-variable-panel h2').hover();
  await expect(possibleCaption(page)).toHaveText('Hover or focus an option to preview it.');
  await page.waitForTimeout(3500);
  await expect(possibleCaption(page)).toHaveText('Hover or focus an option to preview it.');
  expect(await possibleGraph(page)).toEqual(['edge:rel|open|?b', 'node:?a|open|?a', 'node:?c|open|?c']);
});

test('the possible graph keeps committed values and hides with the panel', async ({ page }) => {
  await addThreeVariableChain(page);
  await routeStages(page, threeStageResponder());
  const before = await graphSnapshot(page);
  await page.locator('#run-query-btn').click();
  await candidateButtons(page).first().click();
  await expect(page.locator('#stage-heading')).toHaveText('Stage 2 of 3: ?b');
  expect(await possibleGraph(page)).toEqual(['edge:rel|open|?b', 'node:?a|committed iri|Alpha', 'node:?c|open|?c']);

  await candidateButtons(page).first().focus();
  await expect(possibleCaption(page)).toHaveText('If ?b = founded, ?c could be 1903 (1 of 1).');
  expect(await possibleGraph(page)).toEqual(['edge:rel|assumed|founded', 'node:?a|committed iri|Alpha', 'node:?c|possible literal|1903']);

  await page.keyboard.press('Enter');
  await expect(page.locator('#stage-heading')).toHaveText('Stage 3 of 3: ?c');
  await candidateButtons(page).first().hover();
  await expect(possibleCaption(page)).toHaveText('If ?c = 1903.');
  expect(await possibleGraph(page)).toEqual(['edge:rel|committed|founded', 'node:?a|committed iri|Alpha', 'node:?c|assumed literal|1903']);
  await candidateButtons(page).first().click();
  await expect(possibleCaption(page)).toHaveText('All variables chosen.');
  expect(await possibleGraph(page)).toEqual(['edge:rel|committed|founded', 'node:?a|committed iri|Alpha', 'node:?c|committed literal|1903']);

  await page.getByRole('button', { name: 'Close query variable exploration' }).click();
  await expect(page.getByRole('region', { name: 'Possible graph' })).toBeHidden();
  expect(await graphSnapshot(page)).toEqual(before);
});

test('an endpoint change during exploration closes the panel without graph changes', async ({ page }) => {
  await addThreeVariableChain(page);
  await routeStages(page, threeStageResponder());
  const before = await graphSnapshot(page);
  await page.locator('#run-query-btn').click();
  await candidateButtons(page).first().click();
  await expect(page.locator('#stage-heading')).toHaveText('Stage 2 of 3: ?b');
  await page.locator('#input-endpoint-sparql').fill('https://example.test/sparql');
  await expect(page.locator('#two-variable-panel')).toBeHidden();
  expect(await graphSnapshot(page)).toEqual(before);
});

test('parallel edges sharing one predicate variable are one stage and bind together', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: 'source', value: '<https://example.test/source>', type: 'node' } },
      { group: 'nodes', data: { id: 'target', value: '<https://example.test/target>', type: 'node' } },
      ...['first', 'second'].map(id => ({
        group: 'edges', data: { id, source: 'source', target: 'target', nodeId: '?predicate_1', label: '?', type: 'variable', custom: id },
      })),
    ]);
  });
  await routeStages(page, request => ({ body: stagePage(request, [iri('https://example.test/relation', 'relation')]) }));
  await page.locator('#run-query-btn').click();
  await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 1: ?predicate_1');
  await candidateButtons(page).first().click();
  await page.getByRole('button', { name: 'Apply to graph' }).click();
  await expect(page.locator('#two-variable-panel')).toBeHidden();
  expect(await page.evaluate(() => cy.edges().map(edge => edge.data()))).toEqual(['first', 'second'].map(id => ({
    id, source: 'source', target: 'target', nodeId: '<https://example.test/relation>', label: 'relation', custom: id,
  })));
  await expect(page.locator('#status-nodes')).toHaveText('Nodes: 2');
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

test('edge action menu converts only a relation predicate into a queryable variable', async ({ page }) => {
  await disableAutoLayout(page);
  await page.locator('#input-endpoint-sparql').fill('uploaded-test-graph');
  await page.locator('#input-max-results').fill('7');
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: '<https://example.test/team-a>', value: '<https://example.test/team-a>', label: 'Team A', type: 'node' }, position: { x: 220, y: 180 } },
      { group: 'nodes', data: { id: '<https://example.test/team-b>', value: '<https://example.test/team-b>', label: 'Team B', type: 'node' }, position: { x: 580, y: 480 } },
      {
        group: 'edges',
        data: {
          id: 'has-rival-edge',
          source: '<https://example.test/team-a>',
          target: '<https://example.test/team-b>',
          nodeId: '<https://example.test/hasRival>',
          label: 'has rival',
          customMetadata: 'must-survive'
        }
      },
    ]);
  });

  await clickGraphNode(page, '<https://example.test/team-a>');
  await expect(page.locator('#node-action-menu')).toBeVisible();
  await clickGraphEdge(page, 'has-rival-edge');

  const edgeMenu = page.locator('#edge-action-menu');
  await expect(page.locator('#node-action-menu')).toBeHidden();
  await expect(edgeMenu).toBeVisible();
  await expect(edgeMenu).toHaveAttribute('data-edge-id', 'has-rival-edge');
  await expect(edgeMenu.getByRole('button', { name: 'Convert relation to variable' })).toBeVisible();

  await edgeMenu.getByRole('button', { name: 'Convert relation to variable' }).click();
  await expect(edgeMenu).toBeHidden();

  const convertedEdge = await page.evaluate(() => cy.getElementById('has-rival-edge').data());
  expect(convertedEdge).toMatchObject({
    id: 'has-rival-edge',
    source: '<https://example.test/team-a>',
    target: '<https://example.test/team-b>',
    nodeId: expect.stringMatching(/^\?predicate_[A-Za-z0-9_]+$/),
    label: '?',
    type: 'variable',
    customMetadata: 'must-survive',
  });
  expect(await page.evaluate(() => cy.getElementById('has-rival-edge').length)).toBe(1);

  const nodesBefore = await page.evaluate(() => cy.nodes().map(node => node.json()));
  const stageRequests = await routeStages(page, request => ({
    body: stagePage(request, [iri('https://example.test/playsAgainst', 'plays against')]),
  }));
  await page.evaluate(() => window.runQuery());
  await expect(page.locator('#stage-heading')).toHaveText(`Stage 1 of 1: ${convertedEdge.nodeId}`);
  expect(stageRequests[0]).toMatchObject({
    endpointUrl: 'uploaded-test-graph',
    variableName: convertedEdge.nodeId,
    bindings: [],
    where: [{
      subject: '<https://example.test/team-a>',
      predicate: convertedEdge.nodeId,
      object: '<https://example.test/team-b>',
      filterType: null,
    }],
  });

  await candidateButtons(page).first().click();
  await page.getByRole('button', { name: 'Apply to graph' }).click();
  await expect(page.locator('#two-variable-panel')).toBeHidden();

  expect(await page.evaluate(() => cy.nodes().map(node => node.json()))).toEqual(nodesBefore);
  await expect(page.locator('#status-nodes')).toHaveText('Nodes: 2');
  await expect(page.locator('#status-edges')).toHaveText('Edges: 1');
  const boundEdge = await page.evaluate(() => cy.getElementById('has-rival-edge').data());
  expect(boundEdge).toEqual({
    id: 'has-rival-edge',
    source: '<https://example.test/team-a>',
    target: '<https://example.test/team-b>',
    nodeId: '<https://example.test/playsAgainst>',
    label: 'plays against',
    customMetadata: 'must-survive',
  });
  expect(await page.evaluate(() => buildFilters(cy.elements().components()[0])[0].predicate))
    .toBe('<https://example.test/playsAgainst>');
  await clickGraphEdge(page, 'has-rival-edge');
  await expect(edgeMenu.getByRole('button', { name: 'Convert relation to variable' })).toBeVisible();
});

const relationLabelClass = (page, id) => page.evaluate(edgeId => {
  const html = edgeLabelHtml(cy.getElementById(edgeId).data());
  return new DOMParser().parseFromString(html, 'text/html').body.firstElementChild.className;
}, id);

test('variable relations render the green label however they were created', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: 'a', value: '<https://example.test/a>', label: 'A', type: 'node' }, position: { x: 200, y: 200 } },
      { group: 'nodes', data: { id: 'b', value: '<https://example.test/b>', label: 'B', type: 'node' }, position: { x: 500, y: 200 } },
      { group: 'edges', data: { id: 'flagged', source: 'a', target: 'b', nodeId: '?p1', label: '?', type: 'variable' } },
      { group: 'edges', data: { id: 'unflagged', source: 'b', target: 'a', nodeId: '?p2', label: '?' } },
      { group: 'edges', data: { id: 'fixed', source: 'a', target: 'b', nodeId: '<https://example.test/p>', label: 'p' } },
      { group: 'edges', data: { id: 'stale-flag', source: 'b', target: 'a', nodeId: '<https://example.test/q>', label: 'q', type: 'variable' } },
    ]);
  });
  expect(await relationLabelClass(page, 'flagged')).toBe('edge-label-variable');
  expect(await relationLabelClass(page, 'unflagged')).toBe('edge-label-variable');
  expect(await relationLabelClass(page, 'fixed')).toBe('edge-label');
  expect(await relationLabelClass(page, 'stale-flag')).toBe('edge-label');

  // Converting an endpoint node rebuilds its edges; they must keep all data.
  await page.evaluate(() => { cy.getElementById('flagged').data('filterType', 0); });
  await clickGraphNode(page, 'a');
  await page.locator('#node-action-menu').getByRole('button', { name: 'Convert to variable' }).click();
  const rebuilt = await page.evaluate(() => cy.getElementById('flagged').data());
  expect(rebuilt).toMatchObject({ nodeId: '?p1', label: '?', type: 'variable', filterType: 0, target: 'b' });
  expect(rebuilt.source).toMatch(/^\?node_/);
  expect(await relationLabelClass(page, 'flagged')).toBe('edge-label-variable');
  expect(await relationLabelClass(page, 'unflagged')).toBe('edge-label-variable');
});

test('Remove relation deletes only the chosen edge', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: '?team', value: '?team', label: '?', type: 'variable' }, position: { x: 200, y: 200 } },
      { group: 'nodes', data: { id: 'city', value: '<https://example.test/city>', label: 'City', type: 'node' }, position: { x: 560, y: 200 } },
      { group: 'nodes', data: { id: 'league', value: '<https://example.test/league>', label: 'League', type: 'node' }, position: { x: 200, y: 480 } },
      { group: 'edges', data: { id: 'located', source: '?team', target: 'city', nodeId: '?where', label: '?', type: 'variable' } },
      { group: 'edges', data: { id: 'plays', source: '?team', target: 'league', nodeId: '<https://example.test/playsIn>', label: 'plays in' } },
    ]);
  });
  await expect(page.locator('#variable-order')).toBeVisible();

  await clickGraphEdge(page, 'located');
  const edgeMenu = page.locator('#edge-action-menu');
  await expect(edgeMenu.getByRole('button', { name: 'Convert relation to variable' })).toHaveCount(0);
  await expect(edgeMenu.getByRole('button', { name: 'Remove relation' })).toHaveCSS('color', 'rgb(198, 40, 40)');
  await expect(page.locator('#node-action-menu .danger')).toHaveCount(0);
  await edgeMenu.getByRole('button', { name: 'Remove relation' }).click();

  await expect(edgeMenu).toBeHidden();
  expect(await page.evaluate(() => ({
    nodes: cy.nodes().map(node => node.id()).sort(),
    edges: cy.edges().map(edge => edge.id()),
  }))).toEqual({ nodes: ['?team', 'city', 'league'], edges: ['plays'] });
  await expect(page.locator('#status-edges')).toHaveText('Edges: 1');
  await expect(page.locator('#variable-order')).toBeHidden();

  await clickGraphEdge(page, 'plays');
  await expect(edgeMenu.getByRole('button', { name: 'Convert relation to variable' })).toBeVisible();
  await expect(edgeMenu.getByRole('button', { name: 'Convert relation to variable' })).not.toHaveCSS('color', 'rgb(198, 40, 40)');
  await expect(edgeMenu.getByRole('button', { name: 'Remove relation' })).toBeVisible();
});

test('one mouse-wheel notch zooms gently in both directions and wheel modes', async ({ page }) => {
  await disableAutoLayout(page);
  // A Chromium-style pixel notch and a Firefox-style line notch.
  for (const { deltaY, deltaMode } of [{ deltaY: 100, deltaMode: 0 }, { deltaY: 3, deltaMode: 1 }]) {
    for (const direction of [-1, 1]) {
      const ratio = await page.evaluate(({ deltaY, deltaMode }) => {
        cy.zoom(1);
        const canvas = document.querySelector('#cy canvas');
        const box = canvas.getBoundingClientRect();
        const before = cy.zoom();
        canvas.dispatchEvent(new WheelEvent('wheel', {
          deltaY, deltaMode, bubbles: true, cancelable: true,
          clientX: box.left + box.width / 2, clientY: box.top + box.height / 2,
        }));
        return cy.zoom() / before;
      }, { deltaY: deltaY * direction, deltaMode });
      const factor = direction < 0 ? ratio : 1 / ratio;
      expect(factor, `zoom factor for deltaY=${deltaY * direction}, deltaMode=${deltaMode}`).toBeGreaterThan(1.1);
      expect(factor, `zoom factor for deltaY=${deltaY * direction}, deltaMode=${deltaMode}`).toBeLessThanOrEqual(1.25);
    }
  }
  expect(await page.evaluate(() => [cy.minZoom(), cy.maxZoom()])).toEqual([0.15, 3]);
});

test('node action connects an existing subject variable to an existing object with a variable predicate', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => { cy.add([
    { group: 'nodes', data: { id: '?subject', value: '?subject', label: '?', type: 'variable' }, position: { x: 180, y: 180 } },
    { group: 'nodes', data: { id: 'object', value: '<https://example.test/object>', label: 'Object', type: 'node' }, position: { x: 560, y: 420 } },
  ]); });

  await clickGraphNode(page, '?subject');
  await page.locator('#node-action-menu').getByRole('button', { name: 'Connect with variable predicate' }).click();
  await expect(page.locator('#connection-preview')).toBeVisible();
  await expect(page.locator('#status-edges')).toHaveText('Edges: 0');
  await clickGraphNode(page, 'object');

  await expect(page.locator('#connection-preview')).toBeHidden();
  await expect(page.locator('#status-nodes')).toHaveText('Nodes: 2');
  await expect(page.locator('#status-edges')).toHaveText('Edges: 1');
  const edge = await page.evaluate(() => cy.edges().first().data());
  expect(edge).toMatchObject({ source: '?subject', target: 'object', nodeId: expect.stringMatching(/^\?predicate_\d+$/), label: '?', type: 'variable' });
  expect(await page.evaluate(() => buildFilters(cy.elements().components()[0])[0])).toMatchObject({
    subject: '?subject', predicate: edge.nodeId, object: '<https://example.test/object>',
  });
});

test('node action loads defined predicates and connects the chosen one to an existing node', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => { cy.add([
    { group: 'nodes', data: { id: 'source', value: '<https://example.test/source>', label: 'Source', type: 'node' }, position: { x: 180, y: 180 } },
    { group: 'nodes', data: { id: '?object', value: '?object', label: '?', type: 'variable' }, position: { x: 560, y: 420 } },
  ]); });

  await clickGraphNode(page, 'source');
  await page.locator('#node-action-menu').getByRole('button', { name: 'Connect with defined predicate' }).click();
  await expect(page.locator('#node-action-menu').getByRole('button', { name: 'name', exact: true })).toBeVisible();
  const requests = server.requests.filter(({ path }) => path === '/api/query/relationships');
  expect(JSON.parse(requests.at(-1).body)).toMatchObject({ id: '<https://example.test/source>' });
  await page.locator('#node-action-menu').getByRole('button', { name: 'name', exact: true }).click();
  await expect(page.locator('#connection-preview')).toBeVisible();
  await clickGraphNode(page, '?object');

  await expect(page.locator('#status-nodes')).toHaveText('Nodes: 2');
  await expect(page.locator('#status-edges')).toHaveText('Edges: 1');
  expect(await page.evaluate(() => cy.edges().first().data())).toMatchObject({
    source: 'source', target: '?object', nodeId: '<https://example.test/hasName>', label: 'name',
  });
  expect(await page.evaluate(() => buildFilters(cy.elements().components()[0])[0])).toMatchObject({
    subject: '<https://example.test/source>', predicate: '<https://example.test/hasName>', object: '?object',
  });
});

test('connection preview cancels on Escape and graph background without adding an edge', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => { cy.add([
    { group: 'nodes', data: { id: 'source', value: '<https://example.test/source>', label: 'Source', type: 'node' }, position: { x: 220, y: 200 } },
    { group: 'nodes', data: { id: 'target', value: '<https://example.test/target>', label: 'Target', type: 'node' }, position: { x: 560, y: 420 } },
  ]); });
  const start = async () => {
    await clickGraphNode(page, 'source');
    await page.locator('#node-action-menu').getByRole('button', { name: 'Connect with variable predicate' }).click();
    await expect(page.locator('#connection-preview')).toBeVisible();
  };

  await start();
  await page.keyboard.press('Escape');
  await expect(page.locator('#connection-preview')).toBeHidden();
  await start();
  await page.locator('#cy').click({ position: { x: 16, y: 16 } });
  await expect(page.locator('#connection-preview')).toBeHidden();
  await expect(page.locator('#status-edges')).toHaveText('Edges: 0');
});

async function runLegacyQueryFromNode(page, nodeId) {
  await page.evaluate(id => { cy.getElementById(id).emit('tap'); }, nodeId);
  await page.getByRole('button', { name: 'Run query', exact: true }).click();
}

test('selecting a node-variable result still replaces the variable node', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    cy.add({ group: 'nodes', data: { id: '?item', value: '?item', label: '?', type: 'variable' }, position: { x: 220, y: 200 } });
  });
  await page.route('**/api/query', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ data: [{ propertyId: '<https://example.test/team-a>', propertyLabel: 'Team A', propertyType: 'object', propertyClass: null }] }),
  }));
  // Run Query stages one variable (BUG-005); the node action keeps the legacy table.
  await runLegacyQueryFromNode(page, '?item');
  await expect(page.locator('#table-results-body')).toContainText('Team A');
  await page.locator('#table-results-body tr.query-row').dispatchEvent('click');
  expect(await page.evaluate(() => cy.nodes().map(node => node.data()))).toEqual([{
    id: '<https://example.test/team-a>', value: '<https://example.test/team-a>', label: 'Team A', type: 'node',
  }]);
});

// BUG-003: a triangle A→B→C→A whose B was converted to a variable.
async function runQueryOnConvertedCycleNode(page, choice, relationshipValue) {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await disableAutoLayout(page);
  await page.evaluate(() => {
    const node = (id, x, y) => ({ group: 'nodes', data: { id, value: id, label: id.slice(-2, -1), type: 'node' }, position: { x, y } });
    const edge = (id, source, target) => ({ group: 'edges', data: { id, source, target, nodeId: `<https://example.test/${id}>`, label: id } });
    cy.add([node('<https://e/A>', 150, 150), node('<https://e/B>', 400, 150), node('<https://e/C>', 275, 350),
      edge('ab', '<https://e/A>', '<https://e/B>'), edge('bc', '<https://e/B>', '<https://e/C>'), edge('ca', '<https://e/C>', '<https://e/A>')]);
  });
  await page.route('**/api/query', route => route.fulfill({ contentType: 'application/json',
    body: JSON.stringify({ data: [{ propertyId: choice, propertyLabel: 'Choice', propertyType: 'object', propertyClass: null }] }) }));
  const valueRequests = [];
  await page.route('**/api/query/relationship-value', route => {
    valueRequests.push(route.request().postDataJSON());
    return route.fulfill({ contentType: 'application/json',
      body: JSON.stringify({ data: [{ propertyId: relationshipValue, propertyLabel: 'Value', propertyType: 'object' }] }) });
  });
  await page.evaluate(() => { cy.getElementById('<https://e/B>').emit('tap'); });
  await page.getByRole('button', { name: 'Convert to variable' }).click();
  await page.getByRole('button', { name: 'Run query', exact: true }).click();
  await expect(page.locator('#table-results-body')).toContainText('Choice');
  await page.locator('#table-results-body tr.query-row').dispatchEvent('click');
  return { errors, valueRequests };
}

const graphEdges = page => page.evaluate(() => cy.edges()
  .map(edge => `${edge.id()}:${edge.source().id()}->${edge.target().id()}`).sort());

test('choosing a result already in a cyclic graph merges the variable into that node', async ({ page }) => {
  const { errors, valueRequests } = await runQueryOnConvertedCycleNode(page, '<https://e/A>', '<https://e/C>');
  await expect(page.locator('#grid-resultado-consulta')).toBeHidden();
  // ?B→C is replaced through the value request, whose answer C is added back;
  // A→?B becomes a loop on A and is kept.
  await expect.poll(() => graphEdges(page)).toEqual([
    '<https://example.test/bc>0:<https://e/A>-><https://e/C>',
    'ab:<https://e/A>-><https://e/A>',
  ]);
  expect(await page.evaluate(() => cy.nodes().map(node => node.id()).sort())).toEqual(['<https://e/A>', '<https://e/C>']);
  expect(await page.evaluate(() => cy.getElementById('<https://e/A>').data())).toEqual({
    id: '<https://e/A>', value: '<https://e/A>', label: 'A', type: 'node',
  });
  expect(valueRequests.map(({ subjectId, predicateId }) => [subjectId, predicateId]))
    .toEqual([['<https://e/A>', '<https://example.test/bc>']]);
  expect(errors).toEqual([]);
});

test('a relationship value already in the graph reuses its node and a free edge ID', async ({ page }) => {
  const { errors } = await runQueryOnConvertedCycleNode(page, '<https://e/X>', '<https://e/A>');
  await expect(page.locator('#grid-resultado-consulta')).toBeHidden();
  await expect.poll(() => graphEdges(page)).toEqual([
    '<https://example.test/bc>0:<https://e/X>-><https://e/A>',
    'ab:<https://e/A>-><https://e/X>',
  ]);
  await page.evaluate(() => addNodeWithRelationship(cy, '<https://e/A>', 'A', 'object', '<https://e/X>', '<https://example.test/bc>', 'bc'));
  expect(await graphEdges(page)).toContain('<https://example.test/bc>0_1:<https://e/X>-><https://e/A>');
  expect(await page.evaluate(() => cy.nodes().map(node => node.id()).sort())).toEqual(['<https://e/A>', '<https://e/X>']);
  expect(errors).toEqual([]);
});

test('a self-loop on the variable survives result selection', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: '?loop', value: '?loop', label: '?', type: 'variable' }, position: { x: 220, y: 200 } },
      { group: 'edges', data: { id: 'self', source: '?loop', target: '?loop', nodeId: '<https://example.test/p>', label: 'p' } },
    ]);
  });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  let valueRequests = 0;
  await page.route('**/api/query/relationship-value', route => { valueRequests += 1; return route.abort(); });
  await page.route('**/api/query', route => route.fulfill({ contentType: 'application/json',
    body: JSON.stringify({ data: [{ propertyId: '<https://e/L>', propertyLabel: 'L', propertyType: 'object', propertyClass: null }] }) }));
  await runLegacyQueryFromNode(page, '?loop');
  await expect(page.locator('#table-results-body')).toContainText('L');
  await page.locator('#table-results-body tr.query-row').dispatchEvent('click');
  expect(await graphEdges(page)).toEqual(['self:<https://e/L>-><https://e/L>']);
  expect(await page.evaluate(() => cy.getElementById('self').data())).toEqual({
    id: 'self', source: '<https://e/L>', target: '<https://e/L>', nodeId: '<https://example.test/p>', label: 'p',
  });
  expect(valueRequests).toBe(0);
  expect(errors).toEqual([]);
});

for (const change of ['removed', 'rebound']) {
  test(`a stale predicate result does not recreate a ${change} edge or add a node`, async ({ page }) => {
    await disableAutoLayout(page);
    await page.evaluate(() => {
      cy.add([
        { group: 'nodes', data: { id: 'source', value: '<https://example.test/source>' } },
        { group: 'nodes', data: { id: 'target', value: '<https://example.test/target>' } },
        { group: 'edges', data: { id: 'relation', source: 'source', target: 'target', nodeId: '?predicate_1', label: '?', type: 'variable' } },
      ]);
    });
    await page.route('**/api/query', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: [{ propertyId: '<https://example.test/relation>', propertyLabel: 'relation', propertyType: 'object', propertyClass: null }] }),
    }));
    // Run Query stages a single predicate variable (BUG-005); the legacy result
    // table's stale-edge guard is exercised through getQuery directly.
    await page.evaluate(() => getQuery('?predicate_1', buildFilters(cy.elements()), true));
    await expect(page.locator('#table-results-body')).toContainText('relation');
    await page.evaluate(change => {
      const edge = cy.getElementById('relation');
      if (change === 'removed') edge.remove();
      else edge.data('nodeId', '?predicate_2');
    }, change);
    const graphBefore = await page.evaluate(() => cy.elements().map(element => element.json()));
    await page.locator('#table-results-body tr.query-row').dispatchEvent('click');
    expect(await page.evaluate(() => cy.elements().map(element => element.json()))).toEqual(graphBefore);
  });
}

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

test('on a narrow screen the possible graph is a bottom sheet below the exploration panel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await addThreeVariableChain(page);
  await routeStages(page, threeStageResponder());
  await page.locator('#run-query-btn').click();
  const window = page.getByRole('region', { name: 'Possible graph' });
  await expect(window).toBeVisible();
  const [windowBox, panelBox] = await Promise.all([window.boundingBox(), page.locator('#two-variable-panel').boundingBox()]);
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(windowBox.y);
  expect(await possibleGraph(page)).toEqual(['edge:rel|open|?b', 'node:?a|open|?a', 'node:?c|open|?c']);
});

// BE-003: numeric filter editor, readable labels and the numeric profile client.
async function addSpeedFilterGraph(page) {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: '?p', value: '?p', label: '?', type: 'variable' }, position: { x: 150, y: 200 } },
      { group: 'nodes', data: { id: 'speed-value', value: '45', label: '45', type: 'label' }, position: { x: 450, y: 200 } },
      { group: 'edges', data: { id: 'speed', source: '?p', target: 'speed-value', nodeId: '<https://example.test/speed>', label: 'speed' } },
    ]);
  });
}

// Materialize is stubbed offline, so the modal is driven through its DOM.
async function openFilterEditor(page) {
  await page.locator('#cy').click({ position: { x: 16, y: 16 } });
  await clickGraphNode(page, await page.evaluate(() => cy.nodes('[type = "label"]')[0].id()));
  await page.locator('#node-action-menu').getByRole('button', { name: 'Edit value', exact: true }).click();
}

async function editSpeedFilter(page, filterName, value) {
  await openFilterEditor(page);
  await page.evaluate(([name, text]) => {
    const option = [...document.querySelectorAll('#modal-change-value input[name=filter-type]')]
      .find(input => input.nextElementSibling.textContent.startsWith(name));
    option.checked = true;
    document.getElementById('modal-new-value').value = text;
    document.getElementById('apply-filter-btn').click();
  }, [filterName, value]);
}

const filterNode = page => page.evaluate(() => {
  const node = cy.nodes('[type = "label"]')[0];
  return { label: node.data('label'), value: node.data('value'), filterType: node.data('filterType') };
});

test('the numeric filter editor offers at least, at most and between with readable labels', async ({ page }) => {
  await addSpeedFilterGraph(page);
  await editSpeedFilter(page, 'Between', '40..80');
  expect(await filterNode(page)).toEqual({ label: '40\u201380', value: '40..80', filterType: 6 });

  await page.evaluate(() => { window.toastMessages = []; window.toast = message => window.toastMessages.push(message); });
  await editSpeedFilter(page, 'Between', '80..40');
  expect(await page.evaluate(() => window.toastMessages)).toEqual([expect.stringContaining('Between needs two numbers')]);
  expect(await filterNode(page)).toEqual({ label: '40\u201380', value: '40..80', filterType: 6 });

  await openFilterEditor(page);
  await expect(page.locator('#modal-new-value')).toHaveValue('40..80');
  await expect(page.locator('#modal-change-value')).toContainText('At least (\u2265)');
  await editSpeedFilter(page, 'At least', '100');
  expect(await filterNode(page)).toEqual({ label: '\u2265 100', value: '100', filterType: 2 });
});

test('an exact numeric match runs without a starts-with filter', async ({ page }) => {
  await addSpeedFilterGraph(page);
  await editSpeedFilter(page, 'Exactly Equal', '45');
  const stageRequests = () => server.requests.filter(({ path }) => path === '/api/query/stage');
  const before = stageRequests().length;
  await page.locator('#run-query-btn').click();
  await expect.poll(() => stageRequests().length).toBe(before + 1);
  const body = JSON.parse(stageRequests().at(-1).body);
  expect(body.where).toEqual([{ subject: '?p', predicate: '<https://example.test/speed>', object: '45', filterType: null }]);
});

test('fetchNumericProfile profiles the relation of a filter node under the rest of its query', async ({ page }) => {
  await addSpeedFilterGraph(page);
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: 'fire', value: '<https://example.test/Fire>', label: 'Fire', type: 'node' }, position: { x: 150, y: 400 } },
      { group: 'edges', data: { id: 'type', source: '?p', target: 'fire', nodeId: '<https://example.test/type>', label: 'type' } },
    ]);
  });
  const requests = [];
  await page.route('**/api/query/numeric-profile', async route => {
    requests.push(JSON.parse(route.request().postData()));
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { subject: '?p', predicate: '<https://example.test/speed>', count: 1, min: 60, max: 60, truncated: false, values: [] } }) });
  });
  const profile = await page.evaluate(() => fetchNumericProfile('speed-value'));
  expect(profile).toMatchObject({ count: 1, min: 60 });
  expect(requests).toEqual([{
    endpointUrl: 'CampeonatoBrasileiro2023',
    where: [{ subject: '?p', predicate: '<https://example.test/type>', object: '<https://example.test/Fire>', filterType: null }],
    subject: '?p',
    predicate: '<https://example.test/speed>',
    limit: 500,
  }]);

  await page.unroute('**/api/query/numeric-profile');
  await page.route('**/api/query/numeric-profile', route => route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"limit must be between 1 and 1000"}' }));
  await expect(page.evaluate(() => fetchNumericProfile('speed-value'))).rejects.toThrow('limit must be between 1 and 1000');
  expect(await page.evaluate(() => fetchNumericProfile('?p'))).toBeNull();
});

// FE-028: filter funnel with a mocked count route.
const funnelPk = 'https://example.test/';
async function addFunnelGraph(page) {
  await disableAutoLayout(page);
  await page.evaluate(pk => {
    cy.add([
      { group: 'nodes', data: { id: '?p', value: '?p', label: '?', type: 'variable' }, position: { x: 200, y: 200 } },
      { group: 'nodes', data: { id: 'fire', value: `<${pk}Fire>`, label: 'Fire', type: 'node' }, position: { x: 450, y: 120 } },
      { group: 'nodes', data: { id: 'speed-value', value: '90', label: '≥ 90', type: 'label', filterType: 2 }, position: { x: 450, y: 300 } },
      { group: 'edges', data: { id: 'type', source: '?p', target: 'fire', nodeId: `<${pk}type>`, label: 'type' } },
      { group: 'edges', data: { id: 'speed', source: '?p', target: 'speed-value', nodeId: `<${pk}speed>`, label: 'speed' } },
    ]);
  }, funnelPk);
}

/** Pokédex-like counts: 151 with any value, 12 Fire, 40 fast, 7 both. */
async function routeFunnelCounts(page, { fail = false } = {}) {
  const requests = [];
  await page.route('**/api/query/count', async route => {
    const body = JSON.parse(route.request().postData());
    requests.push(body);
    if (fail) {
      await route.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"endpoint unavailable"}' });
      return;
    }
    const fire = body.where.some(item => item.object === `<${funnelPk}Fire>`);
    const fast = body.where.some(item => item.filterType === 2);
    const count = fire && fast ? 7 : fire ? 12 : fast ? 40 : 151;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { variableName: body.variableName, count } }) });
  });
  return requests;
}

const funnelRows = page => page.locator('#filter-funnel-steps > li').evaluateAll(items => items.map(item =>
  [...item.querySelectorAll('.funnel-row-head > *')].map(part => part.textContent.trim()).join(' | ')));

test('the filter funnel counts the remaining results after each cumulative filter', async ({ page }) => {
  await addFunnelGraph(page);
  const requests = await routeFunnelCounts(page);
  await page.locator('#filter-funnel-btn').click();
  await expect(page.locator('#filter-funnel-panel')).toBeVisible();
  await expect(page.locator('#filter-funnel-btn')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#filter-funnel-result')).toHaveText('Result: 7 ?p of 151.');
  expect(await funnelRows(page)).toEqual([
    'With these relations, any value | 151',
    'type = Fire | 12 −139',
    'speed ≥ 90 | 7 −5',
  ]);
  await expect(page.locator('#filter-funnel-variable')).toHaveText('Counting distinct ?p');
  const type = { subject: '?p', predicate: `<${funnelPk}type>`, object: `<${funnelPk}Fire>`, filterType: null };
  const speed = { subject: '?p', predicate: `<${funnelPk}speed>`, object: '90', filterType: 2 };
  expect(requests).toEqual([
    { endpointUrl: 'CampeonatoBrasileiro2023', variableName: '?p', where: [{ ...type, object: '?__funnel0' }, { ...speed, object: '?__funnel1', filterType: null }] },
    { endpointUrl: 'CampeonatoBrasileiro2023', variableName: '?p', where: [type, { ...speed, object: '?__funnel1', filterType: null }] },
    { endpointUrl: 'CampeonatoBrasileiro2023', variableName: '?p', where: [type, speed] },
  ]);
});

// BE-004: MAX/MIN are funnel steps that keep every tie; they come after the other filters.
test('a MAX step is counted after the other filters, wherever it sits in the graph', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(pk => {
    cy.add([
      { group: 'nodes', data: { id: '?p', value: '?p', label: '?', type: 'variable' }, position: { x: 200, y: 200 } },
      { group: 'nodes', data: { id: 'hp-value', value: '1', label: 'MAX', type: 'label', filterType: 4 }, position: { x: 450, y: 60 } },
      { group: 'nodes', data: { id: 'fire', value: `<${pk}Fire>`, label: 'Fire', type: 'node' }, position: { x: 450, y: 200 } },
      { group: 'edges', data: { id: 'hp', source: '?p', target: 'hp-value', nodeId: `<${pk}hp>`, label: 'hp' } },
      { group: 'edges', data: { id: 'type', source: '?p', target: 'fire', nodeId: `<${pk}type>`, label: 'type' } },
    ]);
  }, funnelPk);
  const requests = [];
  await page.route('**/api/query/count', async route => {
    const body = JSON.parse(route.request().postData());
    requests.push(body);
    const fire = body.where.some(item => item.object === `<${funnelPk}Fire>`);
    const max = body.where.some(item => item.filterType === 4);
    // Two Fire types tie for the highest hp; three Pokémon tie overall.
    const count = fire && max ? 2 : max ? 3 : fire ? 12 : 151;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { variableName: body.variableName, count } }) });
  });
  await page.locator('#filter-funnel-btn').click();
  await expect(page.locator('#filter-funnel-result')).toHaveText(
    'Result: 2 ?p of 151. MAX/MIN keep every tied result and come after the other filters, as in the query.');
  expect(await funnelRows(page)).toEqual([
    'With these relations, any value | 151',
    'type = Fire | 12 −139',
    'hp MAX | 2 −10',
  ]);
  const hpMax = { subject: '?p', predicate: `<${funnelPk}hp>`, object: '1', filterType: 4 };
  expect(requests.at(-1).where).toEqual([hpMax, { subject: '?p', predicate: `<${funnelPk}type>`, object: `<${funnelPk}Fire>`, filterType: null }]);
});

test('unticking a funnel step previews later counts only and Run Query still sends every filter', async ({ page }) => {
  await addFunnelGraph(page);
  const requests = await routeFunnelCounts(page);
  await page.locator('#filter-funnel-btn').click();
  await expect(page.locator('#filter-funnel-result')).toHaveText('Result: 7 ?p of 151.');

  await page.locator('#filter-funnel-steps .funnel-toggle', { hasText: 'type = Fire' }).click();
  await expect(page.locator('#filter-funnel-result')).toHaveText('Result: 40 ?p of 151. Preview without 1 filter; Run Query still applies every filter.');
  expect(await funnelRows(page)).toEqual([
    'With these relations, any value | 151',
    'type = Fire | 151 (off)',
    'speed ≥ 90 | 40 −111',
  ]);
  // Only the count after the speed step changed; the base comes from the cache.
  expect(requests).toHaveLength(4);
  expect(requests[3].where.map(item => item.object)).toEqual(['?__funnel0', '90']);

  await page.locator('#filter-funnel-steps .funnel-toggle', { hasText: 'type = Fire' }).click();
  await expect(page.locator('#filter-funnel-result')).toHaveText('Result: 7 ?p of 151.');
  expect(requests).toHaveLength(4);

  await page.locator('#filter-funnel-steps .funnel-toggle', { hasText: 'type = Fire' }).click();
  await expect(page.locator('#filter-funnel-result')).toContainText('Preview without 1 filter');
  // Run Query runs a staged query since BUG-005; it still sends every filter.
  const staged = () => server.requests.filter(({ path }) => path === '/api/query/stage');
  const before = staged().length;
  await page.locator('#run-query-btn').click();
  await expect.poll(() => staged().length).toBeGreaterThan(before);
  const body = JSON.parse(staged().at(-1).body);
  expect(body.where.map(item => item.object)).toEqual([`<${funnelPk}Fire>`, '90']);
});

test('the filter funnel shows count errors with a retry', async ({ page }) => {
  await addFunnelGraph(page);
  await routeFunnelCounts(page, { fail: true });
  await page.locator('#filter-funnel-btn').click();
  await expect(page.locator('#filter-funnel-status')).toHaveText('Could not count results: endpoint unavailable');
  await expect(page.locator('#filter-funnel-retry')).toBeVisible();
  await page.unroute('**/api/query/count');
  await routeFunnelCounts(page);
  await page.locator('#filter-funnel-retry').click();
  await expect(page.locator('#filter-funnel-result')).toHaveText('Result: 7 ?p of 151.');
  await expect(page.locator('#filter-funnel-retry')).toBeHidden();
});

test('the filter funnel explains an empty query and follows graph edits with one debounced refresh', async ({ page }) => {
  await disableAutoLayout(page);
  const requests = await routeFunnelCounts(page);
  await page.locator('#filter-funnel-btn').click();
  await expect(page.locator('#filter-funnel-status')).toHaveText('Add a relation with a variable to see how its filters narrow the result.');
  expect(requests).toEqual([]);

  await addFunnelGraph(page);
  await page.evaluate(() => {
    cy.getElementById('speed-value').data({ value: '95', label: '≥ 95' });
    cy.getElementById('speed-value').data({ value: '90', label: '≥ 90' });
  });
  await expect(page.locator('#filter-funnel-result')).toHaveText('Result: 7 ?p of 151.');
  // One refresh: the ≥ 95 edit is never counted. The badge (FE-039) shares these counts.
  expect(new Set(requests.map(request => JSON.stringify(request))).size).toBe(3);
});

test('a superseded funnel refresh is aborted and its counts are not shown', async ({ page }) => {
  await addFunnelGraph(page);
  const counted = [];
  let releaseSlow;
  await page.route('**/api/query/count', async route => {
    const body = JSON.parse(route.request().postData());
    counted.push(body.where.map(item => item.object).join(','));
    if (counted.length === 1) {
      await new Promise(resolve => { releaseSlow = resolve; });
      await route.fulfill({ contentType: 'application/json', body: '{"data":{"variableName":"?p","count":999}}' }).catch(() => {});
      return;
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { variableName: '?p', count: 5 } }) });
  });
  await page.locator('#filter-funnel-btn').click();
  await expect.poll(() => counted.length).toBe(1);
  await page.locator('#filter-funnel-steps .funnel-toggle', { hasText: 'type = Fire' }).click();
  await expect(page.locator('#filter-funnel-result')).toHaveText('Result: 5 ?p of 5. Preview without 1 filter; Run Query still applies every filter.');
  releaseSlow();
  await page.waitForTimeout(100);
  await expect(page.locator('#filter-funnel-steps')).not.toContainText('999');
});

test('the filter funnel is keyboard reachable and Escape returns focus to its button', async ({ page }) => {
  await addFunnelGraph(page);
  await routeFunnelCounts(page);
  await page.locator('#filter-funnel-btn').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#filter-funnel-close')).toBeFocused();
  await expect(page.locator('#filter-funnel-result')).toHaveText('Result: 7 ?p of 151.');
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-step-key="type"]')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.locator('#filter-funnel-result')).toContainText('Result: 40 ?p');
  await expect(page.locator('[data-step-key="type"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#filter-funnel-panel')).toBeHidden();
  await expect(page.locator('#filter-funnel-btn')).toBeFocused();
  await expect(page.locator('#filter-funnel-btn')).toHaveAttribute('aria-expanded', 'false');
});

test('the filter funnel caps counted steps and fits a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await disableAutoLayout(page);
  const requests = await routeFunnelCounts(page);
  await page.evaluate(pk => {
    cy.add({ group: 'nodes', data: { id: '?p', value: '?p', label: '?', type: 'variable' }, position: { x: 100, y: 100 } });
    for (let index = 0; index < 10; index++) {
      cy.add([
        { group: 'nodes', data: { id: `v${index}`, value: String(index), label: `≥ ${index}`, type: 'label', filterType: 2 }, position: { x: 200, y: 40 * index } },
        { group: 'edges', data: { id: `stat${index}`, source: '?p', target: `v${index}`, nodeId: `<${pk}stat${index}>`, label: `stat${index}` } },
      ]);
    }
  }, funnelPk);
  await page.locator('#filter-funnel-btn').click();
  await expect(page.locator('#filter-funnel-result')).toContainText('Only the first 8 filters are counted.');
  await expect(page.locator('#filter-funnel-steps > li')).toHaveCount(11);
  await expect(page.locator('#filter-funnel-steps > li.funnel-uncounted')).toHaveCount(2);
  await expect(page.locator('[data-step-key="stat9"]')).toBeDisabled();
  await expect.poll(() => requests.length).toBe(9);
  await expect(page.locator('#filter-funnel-status')).toBeHidden();
  const box = await page.locator('#filter-funnel-panel').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
  expect(await page.evaluate(() => document.getElementById('filter-funnel-panel').scrollWidth <= document.getElementById('filter-funnel-panel').clientWidth)).toBe(true);
});

// FE-026: histogram with a two-handle range slider inside the numeric filter editor.
const speedProfile = (numbers, extra = {}) => ({
  subject: '?p',
  predicate: '<https://example.test/speed>',
  count: numbers.length,
  truncated: false,
  min: numbers.length ? Math.min(...numbers) : null,
  max: numbers.length ? Math.max(...numbers) : null,
  values: numbers.map((number, index) => ({ entity: `<https://example.test/p${index}>`, label: `P${index}`, value: String(number), number })),
  ...extra,
});

async function routeSpeedProfile(page, respond) {
  const requests = [];
  await page.route('**/api/query/numeric-profile', async route => {
    requests.push(JSON.parse(route.request().postData()));
    await respond(route);
  });
  return requests;
}

const fulfillProfile = data => route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
const histogram = page => page.locator('#filter-histogram');

// The Materialize stub does not open modals; show the editor as Materialize would.
async function openVisibleFilterEditor(page) {
  await page.evaluate(() => { document.getElementById('modal-change-value').style.display = 'none'; });
  await openFilterEditor(page);
  await page.evaluate(() => Object.assign(document.getElementById('modal-change-value').style, {
    display: 'block', opacity: '1', top: '10%', zIndex: '1003', transform: 'none',
  }));
}
const checkedFilter = page => page.evaluate(() => document.querySelector('#modal-change-value input[name=filter-type]:checked').nextElementSibling.textContent);
const keptBars = page => page.locator('#filter-histogram rect.kept').evaluateAll(rects => rects.map(rect => Math.round(+rect.getAttribute('height'))));
const allBars = page => page.locator('#filter-histogram rect:not(.kept)').evaluateAll(rects => rects.map(rect => Math.round(+rect.getAttribute('height'))));

test('the filter editor histogram follows the range handles and writes at least, between and at most', async ({ page }) => {
  await addSpeedFilterGraph(page);
  const requests = await routeSpeedProfile(page, fulfillProfile(speedProfile([20, 45, 45, 60, 90, 150])));
  await openVisibleFilterEditor(page);
  // FE-035: an exact value keeps only itself; the handles still span the whole range.
  await expect(histogram(page)).toContainText('Keeps 2 of 6 values');
  expect(requests).toHaveLength(1);
  const lo = page.getByRole('slider', { name: 'Lowest kept value' });
  const hi = page.getByRole('slider', { name: 'Highest kept value' });
  await expect(lo).toHaveValue('20');
  await expect(hi).toHaveValue('150');
  // Opening the editor does not change an exact value.
  await expect(page.locator('#modal-new-value')).toHaveValue('45');
  expect((await keptBars(page)).filter(height => height > 0)).toHaveLength(1);

  await lo.fill('40');
  await expect(histogram(page)).toContainText('Keeps 5 of 6 values');
  await expect(page.locator('#modal-new-value')).toHaveValue('40');
  expect(await checkedFilter(page)).toBe('At least (≥)');
  const kept = await keptBars(page);
  const all = await allBars(page);
  expect(kept[0]).toBeLessThan(all[0]);
  expect(kept.slice(1)).toEqual(all.slice(1));

  await hi.focus();
  for (let i = 0; i < 60; i++) await page.keyboard.press('ArrowLeft');
  await expect(hi).toHaveValue('90');
  await expect(histogram(page)).toContainText('Keeps 4 of 6 values');
  await expect(page.locator('#modal-new-value')).toHaveValue('40..90');
  expect(await checkedFilter(page)).toBe('Between (min..max, e.g. 40..80)');

  await lo.fill('20');
  await expect(page.locator('#modal-new-value')).toHaveValue('90');
  expect(await checkedFilter(page)).toBe('At most (≤)');

  // Handles cannot cross: the low handle stops at the high one.
  await lo.fill('120');
  await expect(lo).toHaveValue('90');
  await expect(page.locator('#modal-new-value')).toHaveValue('90..90');
  await expect(histogram(page)).toContainText('Keeps 1 of 6 values');

  await lo.fill('45');
  await page.locator('#apply-filter-btn').click();
  expect(await filterNode(page)).toEqual({ label: '45–90', value: '45..90', filterType: 6 });

  // Reopening starts from the stored filter; typing moves the handles back.
  await openVisibleFilterEditor(page);
  await expect(histogram(page)).toContainText('Keeps 4 of 6 values');
  await expect(lo).toHaveValue('45');
  await expect(hi).toHaveValue('90');
  await page.locator('#modal-new-value').fill('50..150');
  await expect(lo).toHaveValue('50');
  await expect(hi).toHaveValue('150');
  await expect(histogram(page)).toContainText('Keeps 3 of 6 values');
});

test('a truncated profile says what the histogram covers and counts values above it when the top is open', async ({ page }) => {
  await addSpeedFilterGraph(page);
  await routeSpeedProfile(page, fulfillProfile(speedProfile([10, 20, 30, 40], { count: 10, truncated: true, max: 99 })));
  await openVisibleFilterEditor(page);
  await expect(histogram(page)).toContainText('The histogram covers the lowest 4 of 10 values (up to 40; the largest is 99).');
  // The exact value 45 lies above the covered values, so its count is a lower bound.
  await expect(histogram(page)).toContainText('Keeps at least 0 of 10 values');
  await page.getByRole('slider', { name: 'Lowest kept value' }).fill('25');
  await expect(histogram(page)).toContainText('Keeps 8 of 10 values');
  await expect(page.locator('#modal-new-value')).toHaveValue('25');
  await page.getByRole('slider', { name: 'Highest kept value' }).fill('35');
  await expect(histogram(page)).toContainText('Keeps 1 of 10 values');
  await expect(page.locator('#modal-new-value')).toHaveValue('25..35');
});

test('the filter editor histogram shows loading, empty, error and unprofilable states', async ({ page }) => {
  await addSpeedFilterGraph(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await routeSpeedProfile(page, async route => { await gate; await fulfillProfile(speedProfile([]))(route); });
  await openVisibleFilterEditor(page);
  await expect(histogram(page)).toContainText('Loading the value distribution');
  release();
  await expect(histogram(page)).toContainText('No numeric values for this relation under the rest of the query.');
  await expect(histogram(page).getByRole('slider')).toHaveCount(0);

  await page.unroute('**/api/query/numeric-profile');
  await routeSpeedProfile(page, route => route.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"SPARQL endpoint unavailable"}' }));
  await openVisibleFilterEditor(page);
  await expect(histogram(page).getByRole('alert')).toHaveText('Could not load the value distribution: SPARQL endpoint unavailable');

  const replaceSpeedRelation = nodeId => page.evaluate(nodeId => {
    cy.getElementById('speed').remove();
    cy.add({ group: 'edges', data: { id: 'speed', source: '?p', target: cy.nodes('[type = "label"]')[0].id(), nodeId, label: 'speed' } });
  }, nodeId);
  await replaceSpeedRelation('<https://example.test/stats>/<https://example.test/speed>');
  await openVisibleFilterEditor(page);
  await expect(histogram(page)).toContainText('needs exactly one fixed relation');

  // A text value gets no histogram.
  await replaceSpeedRelation('<https://example.test/speed>');
  await page.evaluate(() => { document.getElementById('modal-change-value').style.display = 'none'; });
  await editSpeedFilter(page, 'Exactly Equal', 'fast');
  await openVisibleFilterEditor(page);
  await expect(histogram(page)).toHaveCount(0);
});

test('a slow profile for an earlier editor does not replace the current histogram', async ({ page }) => {
  await addSpeedFilterGraph(page);
  let calls = 0;
  let releaseFirst;
  const first = new Promise(resolve => { releaseFirst = resolve; });
  await routeSpeedProfile(page, async route => {
    calls++;
    if (calls === 1) {
      await first;
      await fulfillProfile(speedProfile([1, 2]))(route).catch(() => {});
      return;
    }
    await fulfillProfile(speedProfile([20, 45, 60]))(route);
  });
  await openVisibleFilterEditor(page);
  await expect(histogram(page)).toContainText('Loading');
  await openVisibleFilterEditor(page);
  await expect(histogram(page)).toContainText('Keeps 1 of 3 values');
  releaseFirst();
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
  await expect(histogram(page)).toContainText('Keeps 1 of 3 values');
});

test('the filter editor histogram fits a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await addSpeedFilterGraph(page);
  await routeSpeedProfile(page, fulfillProfile(speedProfile([20, 45, 45, 60, 90, 150])));
  await openVisibleFilterEditor(page);
  await expect(histogram(page)).toContainText('Keeps 2 of 6 values');
  const [modal, chart, slider, cycle, preview] = await Promise.all(['#modal-change-value-content', '#filter-histogram svg', '#filter-histogram .filter-histogram-slider',
    '#filter-histogram .filter-cycle', '#filter-histogram .filter-preview-graph']
    .map(selector => page.locator(selector).boundingBox()));
  for (const box of [chart, slider, cycle, preview]) {
    expect(box.width).toBeGreaterThan(200);
    expect(box.x).toBeGreaterThanOrEqual(modal.x - 0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(modal.x + modal.width + 0.5);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

// FE-035: with the range fixed, cycle over the kept entities five at a time.
const twelveSpeeds = [20, 45, 45, 50, 55, 60, 65, 70, 75, 80, 90, 150];
const cycleValue = page => page.locator('#filter-histogram .filter-cycle-value');
const cyclePosition = page => page.locator('#filter-histogram .filter-cycle-position');
const previewEntities = page => page.evaluate(() => filterPreviewCy.nodes('[kind = "entity"]').map(node => node.data('label')));
const chooseFilter = (page, name, value) => page.evaluate(([label, text]) => {
  const option = [...document.querySelectorAll('#modal-change-value input[name=filter-type]')]
    .find(input => input.nextElementSibling.textContent.startsWith(label));
  option.checked = true;
  if (text !== undefined) document.getElementById('modal-new-value').value = text;
  option.dispatchEvent(new Event('change'));
}, [name, value]);

test('previous and next cycle over the kept entities five at a time without changing the range', async ({ page }) => {
  await addSpeedFilterGraph(page);
  const requests = await routeSpeedProfile(page, fulfillProfile(speedProfile(twelveSpeeds)));
  const before = await filterNode(page);
  await openVisibleFilterEditor(page);
  const next = page.getByRole('button', { name: 'Next entities' });
  const previous = page.getByRole('button', { name: 'Previous entities' });

  // The exact value 45 keeps two entities: both are shown, nothing to cycle.
  await expect(cyclePosition(page)).toHaveText('1\u20132 of 2 kept');
  await expect(cycleValue(page)).toHaveText('P1 45P2 45');
  expect(await previewEntities(page)).toEqual(['P1', 'P2']);
  expect(await page.evaluate(() => filterPreviewCy.edges().map(edge => edge.data('label')))).toEqual(['speed', 'speed']);
  await expect(next).toBeDisabled();

  await chooseFilter(page, 'At least', '40');
  await expect(cyclePosition(page)).toHaveText('1\u20135 of 11 kept');
  await expect(next).toBeEnabled();
  await next.click();
  await expect(cyclePosition(page)).toHaveText('6\u201310 of 11 kept');
  await expect(cycleValue(page)).toHaveText('P6 65P7 70P8 75P9 80P10 90');
  expect(await previewEntities(page)).toEqual(['P6', 'P7', 'P8', 'P9', 'P10']);
  await next.click();
  await expect(cyclePosition(page)).toHaveText('11 of 11 kept');
  expect(await previewEntities(page)).toEqual(['P11']);
  await next.click();
  await expect(cyclePosition(page)).toHaveText('1\u20135 of 11 kept');
  await previous.click();
  await expect(cyclePosition(page)).toHaveText('11 of 11 kept');
  // Cycling leaves the range and the editor as they were.
  await expect(page.locator('#modal-new-value')).toHaveValue('40');
  await expect(page.getByRole('slider', { name: 'Lowest kept value' })).toHaveValue('40');
  await expect(histogram(page)).toContainText('Keeps 11 of 12 values');

  // A new range starts again from its first entities.
  await page.getByRole('slider', { name: 'Lowest kept value' }).fill('60');
  await expect(cyclePosition(page)).toHaveText('1\u20135 of 7 kept');
  expect(await previewEntities(page)).toEqual(['P5', 'P6', 'P7', 'P8', 'P9']);

  // BE-004: MAX keeps every entity with the highest value; one here, so nothing to cycle.
  await chooseFilter(page, 'MAX');
  await expect(cycleValue(page)).toHaveText('P11 150');
  await expect(histogram(page)).toContainText('Keeps 1 of 12 values');
  await expect(histogram(page)).toContainText('1 entity has the highest value; the query returns all of them, up to the server limit.');
  await expect(next).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled();

  await chooseFilter(page, 'At least', '40');
  expect(await filterNode(page)).toEqual(before);
  expect(requests).toHaveLength(1);
  await page.locator('#apply-filter-btn').click();
  expect(await filterNode(page)).toEqual({ label: '\u2265 40', value: '40', filterType: 2 });
});

test('play cycles the kept entities until paused or the editor closes, and arrows step on the controls', async ({ page }) => {
  await addSpeedFilterGraph(page);
  await routeSpeedProfile(page, fulfillProfile(speedProfile(twelveSpeeds)));
  await openVisibleFilterEditor(page);
  await chooseFilter(page, 'At least', '20');
  const play = page.getByRole('button', { name: 'Play', exact: true });
  await play.click();
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  await expect(pause).toHaveAttribute('aria-pressed', 'true');
  await expect(cyclePosition(page)).toHaveText('6\u201310 of 12 kept');
  await expect(cyclePosition(page)).toHaveText('11\u201312 of 12 kept');
  await expect(cyclePosition(page)).toHaveText('1\u20135 of 12 kept');
  await pause.click();
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  const paused = await cyclePosition(page).textContent();
  await page.waitForTimeout(2000);
  await expect(cyclePosition(page)).toHaveText(paused);
  await expect(page.locator('#modal-new-value')).toHaveValue('20');

  // Arrow keys on the controls step one page.
  await page.getByRole('button', { name: 'Next entities' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(cyclePosition(page)).not.toHaveText(paused);

  // Cancel stops playback and leaves the graph unchanged.
  await play.click();
  await page.locator('#modal-change-value-content .modal-close').click();
  expect(await page.evaluate(() => filterCycleTimer)).toBeNull();
  expect(await filterNode(page)).toEqual({ label: '45', value: '45', filterType: undefined });
});

test('MIN shows every tied lowest entity and cycles them; MAX of a partial profile names only the value', async ({ page }) => {
  await addSpeedFilterGraph(page);
  let profile = speedProfile([10, 10, 10, 10, 10, 10, 10, 40, 90]);
  await routeSpeedProfile(page, route => fulfillProfile(profile)(route));
  await openVisibleFilterEditor(page);
  await chooseFilter(page, 'MIN');
  await expect(cyclePosition(page)).toHaveText('1\u20135 of 7 kept');
  await expect(histogram(page)).toContainText('Keeps 7 of 9 values');
  await expect(histogram(page)).toContainText('7 entities have the lowest value; the query returns all of them, up to the server limit.');
  await page.getByRole('button', { name: 'Next entities' }).click();
  await expect(cycleValue(page)).toHaveText('P5 10P6 10');

  profile = speedProfile([10, 20, 30], { count: 8, truncated: true, max: 99 });
  await openVisibleFilterEditor(page);
  await chooseFilter(page, 'MAX');
  await expect(histogram(page)).toContainText('Keeps the highest value (99)');
  await expect(histogram(page)).toContainText('The highest value is 99; its entities are known after the query runs.');
  await expect(cyclePosition(page)).toHaveText('');
  expect(await previewEntities(page)).toEqual([]);
  await page.locator('#apply-filter-btn').click();
  expect(await filterNode(page)).toEqual({ label: 'MAX', value: '45', filterType: 4 });
});

test('the kept entities say when nothing is kept', async ({ page }) => {
  await addSpeedFilterGraph(page);
  await routeSpeedProfile(page, fulfillProfile(speedProfile([20, 45, 90])));
  await openVisibleFilterEditor(page);
  await page.locator('#modal-new-value').fill('50');
  await expect(histogram(page)).toContainText('No entity is kept.');
  await expect(cyclePosition(page)).toHaveText('');
  expect(await previewEntities(page)).toEqual([]);
});

// BUG-006: re-fetching a fixed IRI neighbour after result selection asked for a
// literal, so the IRI came back as a pink value node labelled with the raw IRI.
test('choosing a result re-adds a fixed IRI neighbour as an IRI node with its label', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: '?mon', value: '?mon', label: '?', type: 'variable' }, position: { x: 400, y: 300 } },
      { group: 'nodes', data: { id: '<https://e/Electric>', value: '<https://e/Electric>', label: 'Electric', type: 'node' }, position: { x: 150, y: 300 } },
      { group: 'nodes', data: { id: 'attack-value', value: '130', label: '130', type: 'label' }, position: { x: 400, y: 100 } },
      { group: 'edges', data: { id: 'immune', source: '?mon', target: '<https://e/Electric>', nodeId: '<https://e/immuneTo>', label: 'immune to' } },
      { group: 'edges', data: { id: 'attack', source: '?mon', target: 'attack-value', nodeId: '<https://e/attack>', label: 'Attack' } },
    ]);
  });
  await page.route('**/api/query', route => route.fulfill({ contentType: 'application/json',
    body: JSON.stringify({ data: [{ propertyId: '<https://e/Rhydon>', propertyLabel: 'Rhydon', propertyType: 'object', propertyClass: null }] }) }));
  const valueRequests = [];
  await page.route('**/api/query/relationship-value', route => {
    const request = route.request().postDataJSON();
    valueRequests.push(request);
    const data = request.isLiteral
      ? [{ propertyId: '130', propertyLabel: '130', propertyType: 'text' }]
      : [{ propertyId: '<https://e/Electric>', propertyLabel: 'Electric', propertyType: null }];
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  await runLegacyQueryFromNode(page, '?mon');
  await expect(page.locator('#table-results-body')).toContainText('Rhydon');
  await page.locator('#table-results-body tr.query-row').dispatchEvent('click');

  await expect.poll(() => valueRequests.length).toBe(2);
  expect(valueRequests.map(({ predicateId, isLiteral }) => [predicateId, isLiteral]).sort())
    .toEqual([['<https://e/attack>', true], ['<https://e/immuneTo>', false]]);
  await expect.poll(() => page.evaluate(() => cy.nodes().map(node => [node.id(), node.data('label'), node.data('type')]).sort()))
    .toEqual([['130', '130', 'label'], ['<https://e/Electric>', 'Electric', 'node'], ['<https://e/Rhydon>', 'Rhydon', 'node']]);
});

// FE-030: Add value filter creates a value node through a datatype relation
// and opens its filter editor.
async function addValueFilterGraph(page, { profile }) {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: '?mon', value: '?mon', label: '?', type: 'variable' }, position: { x: 300, y: 300 } },
      { group: 'nodes', data: { id: '<https://e/Fire>', value: '<https://e/Fire>', label: 'Fire', type: 'node' }, position: { x: 100, y: 300 } },
      { group: 'edges', data: { id: 'has-type', source: '?mon', target: '<https://e/Fire>', nodeId: '<https://e/hasType>', label: 'has type' } },
    ]);
  });
  const relationshipRequests = [];
  await page.route('**/api/query/relationships', route => {
    relationshipRequests.push(route.request().postDataJSON());
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [
      { propertyId: '<https://e/speed>', propertyLabel: 'Speed', propertyType: 'label' },
      { propertyId: '<https://e/hasType>', propertyLabel: 'has type', propertyType: 'objeto' },
      { propertyId: '<https://e/category>', propertyLabel: 'category', propertyType: 'label' },
      { propertyId: '<https://e/hp>', propertyLabel: 'HP', propertyType: 'label' },
      { propertyId: '<https://e/x>', propertyLabel: '', propertyType: 'outro' },
    ] }) });
  });
  const profileRequests = [];
  await page.route('**/api/query/numeric-profile', route => {
    profileRequests.push(route.request().postDataJSON());
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: profile }) });
  });
  await clickGraphNode(page, '?mon');
  await page.locator('#node-action-menu').getByRole('button', { name: 'Add value filter' }).click();
  return { relationshipRequests, profileRequests };
}

test('Add value filter lists datatype relations and opens the editor on a seeded value node', async ({ page }) => {
  const { relationshipRequests, profileRequests } = await addValueFilterGraph(page, { profile: {
    subject: '?mon', predicate: '<https://e/hp>', count: 3, min: 39, max: 78, truncated: true,
    values: [{ entity: { type: 'iri', value: 'https://e/Charmander', datatype: null, language: null }, label: 'Charmander', value: '39', datatype: 'http://www.w3.org/2001/XMLSchema#integer', number: 39 }],
  } });
  const menu = page.locator('#node-action-menu');
  await expect(menu.locator('.node-action-menu-message')).toHaveText('Choose a value relation:');
  await expect(menu.locator('button[data-action="choose-predicate"]')).toHaveText(['category', 'HP', 'Speed']);
  expect(relationshipRequests[0].id).toBe('?mon');

  await menu.getByRole('button', { name: 'HP', exact: true }).click();

  await expect(page.locator('#modal-new-value')).toHaveValue('39');
  await expect(page.locator('#modal-change-value')).toContainText('At least (≥)');
  // The seed request comes first; an editor histogram may profile again.
  expect(profileRequests[0]).toMatchObject({
    where: [{ subject: '?mon', predicate: '<https://e/hasType>', object: '<https://e/Fire>', filterType: null }],
    subject: '?mon', predicate: '<https://e/hp>', limit: 1,
  });
  // FE-034: the new node is a value variable that keeps any value until a filter is applied.
  expect(await checkedFilter(page)).toBe('Any value');
  const valueVariable = () => page.evaluate(() => {
    const node = cy.nodes('[type = "value-variable"]')[0];
    const edge = node.connectedEdges()[0];
    return { id: node.id(), value: node.data('value'), label: node.data('label'), filterType: node.data('filterType'), filterValue: node.data('filterValue'),
      source: edge.data('source'), nodeId: edge.data('nodeId'), edgeLabel: edge.data('label') };
  });
  const added = await valueVariable();
  expect(added.id).toMatch(/^\?value_\d+$/);
  expect(added).toEqual({ id: added.id, value: added.id, label: '?', filterType: null, filterValue: '',
    source: '?mon', nodeId: '<https://e/hp>', edgeLabel: 'HP' });

  await page.evaluate(() => {
    document.querySelector('#modal-change-value input[name=filter-type][value="2"]').checked = true;
    document.getElementById('modal-new-value').value = '60';
    document.getElementById('apply-filter-btn').click();
  });
  expect(await valueVariable()).toMatchObject({ id: added.id, label: '? ≥ 60', filterType: 2, filterValue: '60', edgeLabel: 'HP' });
});

test('Add value filter on a relation without numbers opens the text editor on an empty value', async ({ page }) => {
  await addValueFilterGraph(page, { profile: { subject: '?mon', predicate: '<https://e/category>', count: 0, min: null, max: null, truncated: false, values: [] } });
  await page.locator('#node-action-menu').getByRole('button', { name: 'category', exact: true }).click();
  await expect(page.locator('#modal-change-value')).toContainText('Starts with');
  await expect(page.locator('#modal-new-value')).toHaveValue('');
});

// FE-036: kept/total badges over filtered nodes and, once the subject is a
// fixed entity, its actual value next to the kept filter.
const filterBadge = page => page.locator('#filter-badge-layer .filter-badge');
const actualValueChip = page => page.locator('#filter-badge-layer .filter-actual-value');
// Editing a filter replaces the value node, so it is found by type, not id.
const speedNodeData = page => page.evaluate(() => {
  const { id, ...data } = cy.nodes('[type = "label"]')[0].data();
  return data;
});
const sentFilters = page => page.evaluate(() => buildFilters(cy.elements()));

/**
 * FE-039: the badge shows its funnel step. Distinct ?p after the speed filter
 * among [speeds]: a request without the filter counts every entity.
 */
async function routeSpeedCounts(page, speeds, respond) {
  const requests = [];
  await page.route('**/api/query/count', async route => {
    const body = JSON.parse(route.request().postData());
    requests.push(body);
    if (respond) {
      await respond(route, requests.length, body);
      return;
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { variableName: body.variableName, count: speedCount(body, speeds) } }) });
  });
  return requests;
}

function speedCount(body, speeds) {
  const filter = body.where.find(item => item.predicate === '<https://example.test/speed>' && item.filterType != null);
  if (!filter) return speeds.length;
  const value = Number(filter.object);
  const [min, max] = filter.object.split('..').map(Number);
  const keep = {
    0: speed => String(speed).startsWith(filter.object),
    2: speed => speed >= value,
    3: speed => speed <= value,
    4: speed => speed === Math.max(...speeds),
    5: speed => speed === Math.min(...speeds),
    6: speed => speed >= min && speed <= max,
  }[filter.filterType];
  return speeds.filter(keep).length;
}

test('a numeric filter node shows a live kept/total badge that never changes query data', async ({ page }) => {
  await addSpeedFilterGraph(page);
  const requests = await routeSpeedCounts(page, [43, 45, 65, 90, 100, 100]);
  await page.waitForTimeout(500);
  await expect(filterBadge(page)).toHaveCount(0); // an exact value is not a filter

  await editSpeedFilter(page, 'At least', '60');
  await expect(filterBadge(page)).toHaveText('4 / 6');
  await expect(filterBadge(page)).toHaveAttribute('data-state', 'ok');
  await expect(filterBadge(page)).toHaveAttribute('aria-label', 'This filter keeps 4 of the 6 ?p that reach it.');
  await expect(actualValueChip(page)).toHaveCount(0);
  // The funnel's base and step requests: the relation with any value, then the filter.
  const speed = { subject: '?p', predicate: '<https://example.test/speed>', object: '60', filterType: 2 };
  expect(requests.slice(-2)).toEqual([
    { endpointUrl: 'CampeonatoBrasileiro2023', variableName: '?p', where: [{ ...speed, object: '?__funnel0', filterType: null }] },
    { endpointUrl: 'CampeonatoBrasileiro2023', variableName: '?p', where: [speed] },
  ]);

  await editSpeedFilter(page, 'Between', '200..300');
  await expect(filterBadge(page)).toHaveText('0 / 6');
  await expect(filterBadge(page)).toHaveAttribute('data-state', 'none');
  expect(await page.evaluate(() => cy.nodes('[type = "label"]')[0].hasClass('filter-keeps-none'))).toBe(true);

  await editSpeedFilter(page, 'MAX', '90');
  await expect(filterBadge(page)).toHaveText('2 / 6');
  await editSpeedFilter(page, 'MIN', '90');
  await expect(filterBadge(page)).toHaveText('1 / 6');
  expect(await page.evaluate(() => cy.nodes('[type = "label"]')[0].hasClass('filter-keeps-none'))).toBe(false);

  // The badge is an overlay: node data and the sent filter are the editor's.
  await editSpeedFilter(page, 'At most', '50');
  await expect(filterBadge(page)).toHaveText('2 / 6');
  expect(await speedNodeData(page)).toEqual({ value: '50', label: '≤ 50', type: 'label', filterType: 3 });
  expect(await sentFilters(page)).toEqual([{ subject: '?p', predicate: '<https://example.test/speed>', object: '50', filterType: 3 }]);

  // A text filter is counted too.
  await page.evaluate(() => { cy.nodes('[type = "label"]')[0].data({ value: '4', label: 'starts with 4', filterType: 0 }); });
  await expect(filterBadge(page)).toHaveText('2 / 6');

  await editSpeedFilter(page, 'Exactly Equal', '45');
  await expect(filterBadge(page)).toHaveCount(0);
});

test('the badge ignores a stale count after an endpoint edit', async ({ page }) => {
  await addSpeedFilterGraph(page);
  let releaseFirst;
  const firstGate = new Promise(resolve => { releaseFirst = resolve; });
  const requests = await routeSpeedCounts(page, [], async (route, count, body) => {
    if (count === 1) await firstGate;
    const total = body.endpointUrl === 'PokemonGen1' ? 9 : 5;
    const kept = body.where.some(item => item.filterType === 6) ? total - 3 : total;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { variableName: body.variableName, count: kept } }) });
  });
  await page.evaluate(() => { cy.nodes('[type = "label"]')[0].data({ value: '60..120', label: '60–120', filterType: 6 }); });
  await expect(filterBadge(page)).toHaveAttribute('data-state', 'loading');

  await page.locator('#input-endpoint-sparql').fill('PokemonGen1');
  await expect(filterBadge(page)).toHaveText('6 / 9');
  expect(requests.map(request => request.endpointUrl)).toEqual(['CampeonatoBrasileiro2023', 'PokemonGen1', 'PokemonGen1']);

  releaseFirst();
  await page.waitForTimeout(600);
  await expect(filterBadge(page)).toHaveText('6 / 9');
});

test('the badge follows its node and reports a count error', async ({ page }) => {
  await addSpeedFilterGraph(page);
  await routeSpeedCounts(page, [], route => route.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"endpoint unavailable"}' }));
  await page.evaluate(() => { cy.nodes('[type = "label"]')[0].data({ value: '60', label: '≥ 60', filterType: 2 }); });
  await expect(filterBadge(page)).toHaveText('?');
  await expect(filterBadge(page)).toHaveAttribute('aria-label', 'Could not count results: endpoint unavailable');

  const before = await filterBadge(page).boundingBox();
  await page.evaluate(() => { cy.nodes('[type = "label"]')[0].shift({ x: -60, y: 40 }); });
  await expect.poll(async () => (await filterBadge(page).boundingBox()).y).toBeGreaterThan(before.y + 30);
});

async function assumeSpeedSubject(page, { filter = { value: '90', label: '≥ 90', filterType: 2 } } = {}) {
  await addSpeedFilterGraph(page);
  await page.evaluate(data => { cy.nodes('[type = "label"]')[0].data(data); }, filter);
  await routeSpeedProfile(page, fulfillProfile(speedProfile([45, 90, 100])));
  const stageRequests = await routeStages(page, request => ({ body: stagePage(request, [
    iri('https://example.test/Pikachu', 'Pikachu'),
    iri('https://example.test/Mew', 'Mew'),
  ]) }));
  await page.locator('#run-query-btn').click();
  await expect(candidateButtons(page)).toHaveCount(2);
  return stageRequests;
}

async function routeActualValues(page, respond) {
  const requests = [];
  await page.route('**/api/query/relationship-value', async route => {
    requests.push(route.request().postDataJSON());
    await respond(route, requests.length);
  });
  return requests;
}
const fulfillValues = values => route => route.fulfill({ contentType: 'application/json',
  body: JSON.stringify({ data: values.map(value => ({ propertyId: value, propertyLabel: value, propertyType: 'text' })) }) });

test('after Assume the filtered node shows the actual value, keeps its filter and checks it', async ({ page }) => {
  const stageRequests = await assumeSpeedSubject(page);
  expect(stageRequests[0].where).toEqual([{ subject: '?p', predicate: '<https://example.test/speed>', object: '90', filterType: 2 }]);
  const valueRequests = await routeActualValues(page, fulfillValues(['90']));

  await page.getByRole('button', { name: 'Assume ?p = Pikachu in the graph now' }).click();

  await expect(actualValueChip(page)).toHaveText('90');
  await expect(actualValueChip(page)).toHaveAttribute('aria-label', 'Actual value: 90');
  await expect(filterBadge(page)).toHaveText('✓');
  await expect(filterBadge(page)).toHaveAttribute('aria-label', 'The actual value 90 passes the filter ≥ 90.');
  expect(valueRequests).toEqual([{ endpointUrl: 'CampeonatoBrasileiro2023', subjectId: '<https://example.test/Pikachu>', predicateId: '<https://example.test/speed>', isLiteral: true }]);
  // Display only: the node keeps its filter, which is still sent.
  expect(await speedNodeData(page)).toEqual({ value: '90', label: '≥ 90', type: 'label', filterType: 2 });
  expect(await sentFilters(page)).toEqual([{ subject: '<https://example.test/Pikachu>', predicate: '<https://example.test/speed>', object: '90', filterType: 2 }]);

  // A changed filter re-checks the same value without a new lookup. The node
  // menu offers Edit value only under a variable, so the data is set directly.
  const setSpeedFilter = data => page.evaluate(item => { cy.nodes('[type = "label"]')[0].data(item); }, data);
  await setSpeedFilter({ value: '100', label: '≥ 100', filterType: 2 });
  await expect(filterBadge(page)).toHaveText('✗');
  await expect(filterBadge(page)).toHaveAttribute('data-state', 'none');
  await expect(filterBadge(page)).toHaveAttribute('aria-label', 'The actual value 90 does not pass the filter ≥ 100.');
  await expect(actualValueChip(page)).toHaveText('90');
  expect(await page.evaluate(() => cy.nodes('[type = "label"]')[0].hasClass('filter-keeps-none'))).toBe(true);
  expect(valueRequests).toHaveLength(1);

  // MAX/MIN depend on other entities: the value shows without a verdict.
  await setSpeedFilter({ value: '90', label: 'MAX', filterType: 4 });
  await expect(filterBadge(page)).toHaveCount(0);
  await expect(actualValueChip(page)).toHaveText('90');

  // Removing the filter clears the shown value.
  await setSpeedFilter({ value: '90', label: '90', filterType: null });
  await expect(actualValueChip(page)).toHaveCount(0);
  await expect(filterBadge(page)).toHaveCount(0);
});

test('after Apply several actual values are joined and a text filter is checked too', async ({ page }) => {
  await assumeSpeedSubject(page, { filter: { value: '9', label: 'starts with 9', filterType: 0 } });
  await routeActualValues(page, fulfillValues(['90', '95', '99', '120']));
  await candidateButtons(page).first().click();
  await page.getByRole('button', { name: 'Apply to graph' }).click();

  await expect(actualValueChip(page)).toHaveText('90, 95, 99, …');
  await expect(actualValueChip(page)).toHaveAttribute('title', 'Actual value: 90, 95, 99, 120');
  await expect(filterBadge(page)).toHaveText('✓');
  expect(await speedNodeData(page)).toEqual({ value: '9', label: 'starts with 9', type: 'label', filterType: 0 });
});

test('a failed or empty value lookup keeps the filter and says the value is unknown; stale lookups are ignored', async ({ page }) => {
  await assumeSpeedSubject(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const valueRequests = await routeActualValues(page, async (route, count) => {
    if (count === 1) {
      await gate;
      return fulfillValues(['10'])(route);
    }
    if (count === 2) return route.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"endpoint unavailable"}' });
    return fulfillValues([])(route);
  });

  await page.getByRole('button', { name: 'Assume ?p = Pikachu in the graph now' }).click();
  await expect(actualValueChip(page)).toHaveText('…');
  // A new endpoint makes a new lookup; the first one answers late and is ignored.
  await page.locator('#input-endpoint-sparql').fill('PokemonGen1');
  await expect(actualValueChip(page)).toHaveText('value unknown');
  await expect(actualValueChip(page)).toHaveAttribute('title', 'Could not load the actual value: endpoint unavailable.');
  await expect(filterBadge(page)).toHaveText('?');
  release();
  await page.waitForTimeout(600);
  await expect(actualValueChip(page)).toHaveText('value unknown');

  // The failure is not cached: the next graph change looks the value up again.
  await page.evaluate(() => { cy.nodes('[type = "label"]')[0].data({ value: '80', label: '≥ 80' }); });
  await expect.poll(() => valueRequests.length).toBe(3);
  await expect(actualValueChip(page)).toHaveAttribute('title', 'This entity has no value for this relation.');
  await expect(filterBadge(page)).toHaveAttribute('aria-label', 'This entity has no value for this relation. The filter ≥ 80 cannot be checked.');
  expect(await speedNodeData(page)).toEqual({ value: '80', label: '≥ 80', type: 'label', filterType: 2 });
});

// ── QUAL-005: every node kind against every node action ────────────────
// The kinds are built with the app's own factories, so their data is what a
// user gets.
const kpk = 'https://example.test/';
const kindIri = name => `<${kpk}${name}>`;
const COMMON_ACTIONS = ['Connect with variable predicate', 'Connect with defined predicate', 'Convert to variable', 'Remove'];
const VARIABLE_ACTIONS = ['Run query', 'Add value filter', ...COMMON_ACTIONS];
const VALUE_VARIABLE_ACTIONS = ['Edit filter', ...COMMON_ACTIONS];
// FE-034: literal kinds convert to a value variable; `valueVariable` rows need
// the value variable ?value_hp (hp ≥ 100) in the graph.
const NODE_KINDS = [
  { kind: 'variable', key: 'variable', actions: VARIABLE_ACTIONS },
  { kind: '"N results"', key: 'results', actions: VARIABLE_ACTIONS },
  { kind: 'IRI', key: 'iri', actions: ['Explore relationships', ...COMMON_ACTIONS] },
  { kind: 'class', key: 'class', actions: ['Explore values', ...COMMON_ACTIONS] },
  { kind: 'literal value', key: 'literal', actions: ['Edit value', ...COMMON_ACTIONS] },
  { kind: 'Boolean value', key: 'boolean', actions: ['Toggle Boolean value', 'Edit value', ...COMMON_ACTIONS] },
  { kind: 'filtered value', key: 'filtered', actions: ['Edit value', ...COMMON_ACTIONS] },
  { kind: 'image link', key: 'link', actions: ['Open link', 'Edit value', ...COMMON_ACTIONS] },
  { kind: 'value of a fixed entity', key: 'fixedValue', actions: COMMON_ACTIONS },
  { kind: 'value variable', key: 'valueVariable', actions: VALUE_VARIABLE_ACTIONS, valueVariable: true },
];
const LITERAL_KINDS = new Set(['literal', 'boolean', 'filtered', 'link', 'fixedValue']);

// ?mon with one relation per kind, plus <Mew> name "Mew" as a separate group;
// with `valueVariable`, also ?mon hp ?value_hp kept at hp ≥ 100 (FE-034).
async function addNodeKindGraph(page, { valueVariable = false } = {}) {
  await disableAutoLayout(page);
  return page.evaluate(([pk, withValueVariable]) => {
    const iriOf = name => `<${pk}${name}>`;
    cy.add({ group: 'nodes', data: { id: '?mon', value: '?mon', label: '?', type: 'variable' } });
    const relation = (id, text, type, predicate) =>
      addNodeWithRelationship(cy, id, text, type, '?mon', iriOf(predicate), predicate);
    relation(iriOf('Electric'), 'Electric', 'node', 'type');
    relation('Pikachu', 'Pikachu', 'text', 'name');
    relation('true', 'true', 'text', 'legendary');
    relation('90', '90', 'text', 'speed');
    changeElementStringValue('90', '90', '2');
    relation(`${pk}pikachu.png`, `${pk}pikachu.png`, 'text', 'image');
    relation('?node_moves', '3 results', 'many-results', 'move');
    cy.add([
      { group: 'nodes', data: { id: '?class', value: '?class', label: '?', type: 'variable' } },
      { group: 'edges', data: { id: 'instance-of', source: '?mon', target: '?class', nodeId: iriOf('instanceOf'), label: 'instance of' } },
    ]);
    replaceWithNewNode(cy, '?class', iriOf('Pokemon'), 'Pokémon', 'default', iriOf('Pokemon'));
    cy.add({ group: 'nodes', data: { id: iriOf('Mew'), value: iriOf('Mew'), label: 'Mew', type: 'node' } });
    addNodeWithRelationship(cy, 'Mew', 'Mew', 'text', iriOf('Mew'), iriOf('name'), 'name');

    const ids = {
      variable: '?mon', results: '?node_moves', iri: iriOf('Electric'), class: iriOf('Pokemon'),
      literal: 'Pikachu', boolean: 'true', filtered: cy.nodes('[filterType]').id(), link: `${pk}pikachu.png`, fixedValue: 'Mew',
    };
    const ring = ['results', 'iri', 'class', 'literal', 'boolean', 'filtered', 'link'];
    if (withValueVariable) {
      ids.valueVariable = addValueVariableNode(cy, '?mon', iriOf('hp'), 'hp', '?value_hp');
      changeElementStringValue('?value_hp', '100', '2');
      ring.push('valueVariable');
    }
    cy.getElementById('?mon').position({ x: 330, y: 260 });
    ring.forEach((key, index) => {
      const angle = 2 * Math.PI * index / ring.length;
      cy.getElementById(ids[key]).position({ x: 330 + 210 * Math.cos(angle), y: 260 + 180 * Math.sin(angle) });
    });
    cy.getElementById(iriOf('Mew')).position({ x: 660, y: 90 });
    cy.getElementById('Mew').position({ x: 660, y: 230 });
    return ids;
  }, [kpk, valueVariable]);
}

const kindFilter = (subject, predicate, object, filterType = null) =>
  ({ subject, predicate: kindIri(predicate), object, filterType });
const KIND_GRAPH_FILTERS = [
  kindFilter('?mon', 'type', kindIri('Electric')),
  kindFilter('?mon', 'name', 'Pikachu'),
  kindFilter('?mon', 'legendary', 'true'),
  kindFilter('?mon', 'speed', '90', 2),
  kindFilter('?mon', 'image', `${kpk}pikachu.png`),
  kindFilter('?mon', 'move', '?node_moves'),
  kindFilter('?mon', 'instanceOf', kindIri('Pokemon')),
];
const MEW_FILTER = kindFilter(kindIri('Mew'), 'name', 'Mew');
const VALUE_VARIABLE_RELATION = kindFilter('?mon', 'hp', '?value_hp');
// Filters are compared as multisets: element order is not part of the payload contract.
const sortJson = items => items.map(item => JSON.stringify(item)).sort().map(item => JSON.parse(item));
const allFilters = async page => sortJson(await page.evaluate(() => buildFilters(cy.elements())));
const menuActions = page => page.locator('#node-action-menu-list button[data-action]').allTextContents();
const nodeMenu = page => page.locator('#node-action-menu');
const dismissMenus = page => page.locator('#cy').click({ position: { x: 16, y: 16 } });
const edgeEnds = page => page.evaluate(() => cy.edges()
  .map(edge => `${edge.id()}|${edge.data('source')}|${edge.data('nodeId')}|${edge.data('target')}`).sort());
const nodeValue = (page, id) => page.evaluate(nodeId => cy.getElementById(nodeId).data('value'), id);
const actionRequests = () => server.requests.filter(({ path }) => path !== '/api/query/numeric-profile');
const VARIABLE_COLOR = 'rgb(169,209,142)';

test('QUAL-005 the node-kind graph sends one filter per relation', async ({ page }) => {
  await addNodeKindGraph(page);
  expect(await allFilters(page)).toEqual(sortJson([...KIND_GRAPH_FILTERS, MEW_FILTER]));
});

// Building the graph schedules debounced funnel/badge counts; wait until no request arrives for 600 ms.
async function settleRequests(page) {
  let last = -1;
  await expect.poll(async () => {
    const count = server.requests.length;
    const quiet = count === last;
    last = count;
    if (!quiet) await page.waitForTimeout(600);
    return quiet;
  }, { timeout: 15_000, intervals: [0] }).toBe(true);
}

test('QUAL-005 each node kind offers exactly its actions and selecting it sends no request', async ({ page }) => {
  const ids = await addNodeKindGraph(page, { valueVariable: true });
  await settleRequests(page);
  for (const row of NODE_KINDS) {
    await test.step(row.kind, async () => {
      await dismissMenus(page);
      const before = actionRequests().length;
      await clickGraphNode(page, ids[row.key]);
      await expect(nodeMenu(page)).toHaveAttribute('data-node-id', ids[row.key]);
      expect(await menuActions(page)).toEqual(row.actions);
      expect(actionRequests().length).toBe(before);
    });
  }
});

for (const row of NODE_KINDS) {
  const valueVariable = LITERAL_KINDS.has(row.key);
  test(`QUAL-005 Convert to variable turns a ${row.kind} node into a ${valueVariable ? 'value variable' : 'plain variable'}`, async ({ page }) => {
    const ids = await addNodeKindGraph(page, { valueVariable: Boolean(row.valueVariable) });
    const oldId = ids[row.key];
    const oldValue = await nodeValue(page, oldId);
    const edgesBefore = await edgeEnds(page);
    const filtersBefore = await allFilters(page);

    await clickGraphNode(page, oldId);
    await nodeMenu(page).getByRole('button', { name: 'Convert to variable' }).click();

    const newId = await nodeMenu(page).getAttribute('data-node-id');
    expect(newId).toMatch(/^\?node_\d+$/);
    expect(await menuActions(page)).toEqual(valueVariable ? VALUE_VARIABLE_ACTIONS : VARIABLE_ACTIONS);
    expect(await page.evaluate(([from, to]) => {
      const node = cy.getElementById(to);
      return { oldExists: cy.getElementById(from).length > 0, type: node.data('type'), value: node.data('value'),
        label: node.data('label'), color: node.style('background-color'), shape: node.style('shape'),
        filterType: node.data('filterType') ?? null, filterValue: node.data('filterValue') ?? null };
    }, [oldId, newId])).toEqual({ oldExists: false, type: valueVariable ? 'value-variable' : 'variable', value: newId, label: '?',
      color: VARIABLE_COLOR, shape: valueVariable ? 'rectangle' : 'ellipse', filterType: null, filterValue: valueVariable ? '' : null });
    // Every relation keeps its ID and predicate and now ends at the variable.
    expect(await edgeEnds(page)).toEqual(edgesBefore
      .map(item => item.split('|').map((part, index) => (index !== 2 && part === oldId ? newId : part)).join('|')).sort());
    expect(await allFilters(page)).toEqual(sortJson(filtersBefore.map(filter => ({
      ...filter,
      subject: filter.subject === oldValue ? newId : filter.subject,
      object: filter.object === oldValue ? newId : filter.object,
      filterType: filter.object === oldValue ? null : filter.filterType,
    }))));
  });
}

test('QUAL-005 Remove deletes only the chosen node of each kind and its relations', async ({ page }) => {
  const ids = await addNodeKindGraph(page, { valueVariable: true });
  const variableLast = [...NODE_KINDS.slice(1), NODE_KINDS[0]];
  for (const row of variableLast) {
    await test.step(row.kind, async () => {
      const id = ids[row.key];
      const value = await nodeValue(page, id);
      const expected = await page.evaluate(nodeId => ({
        nodes: cy.nodes().map(node => node.id()).filter(other => other !== nodeId).sort(),
        edges: cy.edges().filter(edge => edge.data('source') !== nodeId && edge.data('target') !== nodeId)
          .map(edge => `${edge.id()}|${edge.data('source')}|${edge.data('nodeId')}|${edge.data('target')}`).sort(),
      }), id);
      const filtersBefore = await allFilters(page);

      await dismissMenus(page);
      await clickGraphNode(page, id);
      await nodeMenu(page).getByRole('button', { name: 'Remove', exact: true }).click();

      await expect(nodeMenu(page)).toBeHidden();
      expect(await page.evaluate(() => cy.nodes().map(node => node.id()).sort())).toEqual(expected.nodes);
      expect(await edgeEnds(page)).toEqual(expected.edges);
      expect(await allFilters(page)).toEqual(filtersBefore.filter(filter => filter.subject !== value && filter.object !== value));
    });
  }
  expect(await allFilters(page)).toEqual([]);
});

test('QUAL-005 every node kind connects to an existing node with a variable or a defined predicate', async ({ page }) => {
  const ids = await addNodeKindGraph(page, { valueVariable: true });
  const kanto = kindIri('Kanto');
  await page.evaluate(id => {
    cy.add({ group: 'nodes', data: { id, value: id, label: 'Kanto', type: 'node' }, position: { x: 660, y: 400 } });
  }, kanto);
  const newEdge = async (before) => page.evaluate(known => {
    const added = cy.edges().filter(edge => !known.includes(edge.id()));
    return added.map(edge => ({ source: edge.data('source'), target: edge.data('target'), nodeId: edge.data('nodeId'),
      label: edge.data('label'), type: edge.data('type') ?? null }));
  }, before);
  const edgeIds = () => page.evaluate(() => cy.edges().map(edge => edge.id()));

  for (const row of NODE_KINDS) {
    await test.step(row.kind, async () => {
      const id = ids[row.key];
      const value = await nodeValue(page, id);

      let before = await edgeIds();
      await dismissMenus(page);
      await clickGraphNode(page, id);
      await nodeMenu(page).getByRole('button', { name: 'Connect with variable predicate' }).click();
      await clickGraphNode(page, kanto);
      const [variableEdge] = await newEdge(before);
      expect(variableEdge).toMatchObject({ source: id, target: kanto, label: '?', type: 'variable' });
      expect(variableEdge.nodeId).toMatch(/^\?predicate_\d+$/);
      expect(await allFilters(page)).toContainEqual({ subject: value, predicate: variableEdge.nodeId, object: kanto, filterType: null });

      before = await edgeIds();
      const relationshipCount = server.requests.filter(({ path }) => path === '/api/query/relationships').length;
      await clickGraphNode(page, id);
      await nodeMenu(page).getByRole('button', { name: 'Connect with defined predicate' }).click();
      await nodeMenu(page).getByRole('button', { name: 'name', exact: true }).click();
      await clickGraphNode(page, kanto);
      const relationshipRequests = server.requests.filter(({ path }) => path === '/api/query/relationships');
      expect(relationshipRequests).toHaveLength(relationshipCount + 1);
      expect(JSON.parse(relationshipRequests.at(-1).body).id).toBe(value);
      expect(await newEdge(before)).toEqual([
        { source: id, target: kanto, nodeId: '<https://example.test/hasName>', label: 'name', type: null },
      ]);
      expect(await allFilters(page)).toContainEqual({ subject: value, predicate: '<https://example.test/hasName>', object: kanto, filterType: null });
    });
  }
});

test('QUAL-005 type-specific node actions change only their node and the next query payload', async ({ page }) => {
  const ids = await addNodeKindGraph(page, { valueVariable: true });
  const lastRequest = path => JSON.parse(server.requests.filter(request => request.path === path).at(-1).body);
  const selected = () => nodeMenu(page).getAttribute('data-node-id');
  const selectedData = () => page.evaluate(() => {
    const { id, ...data } = cy.getElementById(document.getElementById('node-action-menu').dataset.nodeId).data();
    return { value: data.value, label: data.label, type: data.type, filterType: data.filterType ?? null };
  });
  const runAction = async (id, action) => {
    await dismissMenus(page);
    await clickGraphNode(page, id);
    await nodeMenu(page).getByRole('button', { name: action, exact: true }).click();
  };
  const applyEditor = (filterType, value) => page.evaluate(([type, text]) => {
    document.querySelector(`#modal-change-value input[name=filter-type][value="${type}"]`).checked = true;
    document.getElementById('modal-new-value').value = text;
    document.getElementById('apply-filter-btn').click();
  }, [filterType, value]);
  const relationTarget = predicate => page.evaluate(nodeId => cy.edges()
    .filter(edge => edge.data('source') === '?mon' && edge.data('nodeId') === nodeId)
    .map(edge => edge.data('target')), kindIri(predicate));
  const filters = [...KIND_GRAPH_FILTERS, VALUE_VARIABLE_RELATION];
  let hpFilter = { variableName: '?value_hp', filterType: 2, value: '100' };
  const replaceFilter = (predicate, object, filterType = null) => {
    const index = filters.findIndex(filter => filter.predicate === kindIri(predicate));
    filters[index] = kindFilter('?mon', predicate, object, filterType);
  };

  await test.step('Toggle Boolean value', async () => {
    await runAction(ids.boolean, 'Toggle Boolean value');
    const id = await selected();
    expect(id).toMatch(/^node_\d+$/);
    expect(await selectedData()).toEqual({ value: 'false', label: 'false', type: 'label', filterType: null });
    expect(await relationTarget('legendary')).toEqual([id]);
    replaceFilter('legendary', 'false');
    expect(await allFilters(page)).toEqual(sortJson([...filters, MEW_FILTER]));
  });

  await test.step('Edit value of a literal value', async () => {
    await runAction(ids.literal, 'Edit value');
    await expect(page.locator('#modal-new-value')).toHaveValue('Pikachu');
    await expect(page.locator('#modal-change-value')).toContainText('Starts with');
    await applyEditor('0', 'Pi');
    const id = await selected();
    expect(id).toMatch(/^node_\d+$/);
    expect(await selectedData()).toEqual({ value: 'Pi', label: 'starts with Pi', type: 'label', filterType: 0 });
    expect(await relationTarget('name')).toEqual([id]);
    replaceFilter('name', 'Pi', 0);
    expect(await allFilters(page)).toEqual(sortJson([...filters, MEW_FILTER]));
  });

  await test.step('Edit value of a filtered value', async () => {
    await runAction(ids.filtered, 'Edit value');
    await expect(page.locator('#modal-new-value')).toHaveValue('90');
    expect(await checkedFilter(page)).toBe('At least (≥)');
    await applyEditor('6', '80..100');
    const id = await selected();
    expect(id).not.toBe(ids.filtered);
    expect(await selectedData()).toEqual({ value: '80..100', label: '80–100', type: 'label', filterType: 6 });
    expect(await relationTarget('speed')).toEqual([id]);
    replaceFilter('speed', '80..100', 6);
    expect(await allFilters(page)).toEqual(sortJson([...filters, MEW_FILTER]));
  });

  await test.step('Edit filter of a value variable', async () => {
    await runAction(ids.valueVariable, 'Edit filter');
    await expect(page.locator('#modal-new-value')).toHaveValue('100');
    expect(await checkedFilter(page)).toBe('At least (≥)');
    await expect(page.locator('#modal-change-value')).not.toContainText('MAX');
    await applyEditor('6', '80..120');
    // The variable keeps its ID and relation; only its filter changes.
    expect(await selected()).toBe(ids.valueVariable);
    expect(await page.evaluate(id => {
      const { filterType, filterValue, label, type } = cy.getElementById(id).data();
      return { filterType, filterValue, label, type };
    }, ids.valueVariable)).toEqual({ filterType: 6, filterValue: '80..120', label: '? in 80–120', type: 'value-variable' });
    hpFilter = { variableName: '?value_hp', filterType: 6, value: '80..120' };
    expect(await allFilters(page)).toEqual(sortJson([...filters, MEW_FILTER]));
  });

  await test.step('Explore relationships of an IRI', async () => {
    const before = server.requests.length;
    await runAction(ids.iri, 'Explore relationships');
    await expect.poll(() => server.requests.slice(before).some(({ path }) => path === '/api/query/relationships')).toBe(true);
    expect(lastRequest('/api/query/relationships')).toEqual({ endpointUrl: 'CampeonatoBrasileiro2023', id: kindIri('Electric') });
  });

  await test.step('Explore values of a class', async () => {
    const before = server.requests.length;
    await runAction(ids.class, 'Explore values');
    await expect.poll(() => server.requests.slice(before).some(({ path }) => path === '/api/query')).toBe(true);
    const request = lastRequest('/api/query');
    expect(request.variableName).toMatch(/^\?default_\d+$/);
    expect(request.where).toEqual([{ subject: request.variableName, predicate: 'rdfs:domain', object: kindIri('Pokemon') }]);
  });

  await test.step('Open link of an image link', async () => {
    await page.evaluate(() => { window.open = (...args) => { window.__openedLink = args; }; });
    await runAction(ids.link, 'Open link');
    expect(await page.evaluate(() => window.__openedLink)).toEqual([`${kpk}pikachu.png`, '_blank', 'noopener,noreferrer']);
  });

  for (const [kind, id] of [['variable', ids.variable], ['"N results"', ids.results]]) {
    await test.step(`Run query on a ${kind} node`, async () => {
      const before = server.requests.length;
      await runAction(id, 'Run query');
      await expect.poll(() => server.requests.slice(before).some(({ path }) => path === '/api/query')).toBe(true);
      const request = lastRequest('/api/query');
      expect(request.variableName).toBe(id);
      expect(sortJson(request.where)).toEqual(sortJson(filters));
      expect(request.variableFilters).toEqual([hpFilter]);
    });
  }

  await test.step('Add value filter on a "N results" node', async () => {
    await runAction(ids.results, 'Add value filter');
    await nodeMenu(page).getByRole('button', { name: 'name', exact: true }).click();
    await expect(page.locator('#modal-change-value')).toContainText('Starts with');
    const valueId = await page.locator('#modal-change-value-content').getAttribute('data-node-id');
    expect(valueId).toMatch(/^\?value_\d+$/);
    await applyEditor('', 'Tackle');
    const edges = await page.evaluate(() => cy.edges().filter(edge => edge.data('nodeId') === '<https://example.test/hasName>')
      .map(edge => ({ source: edge.data('source'), target: cy.getElementById(edge.data('target')).data() })));
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe(ids.results);
    // FE-034: the new value is a value variable holding the exact match.
    expect(edges[0].target).toMatchObject({ id: valueId, value: valueId, label: '? = Tackle', type: 'value-variable', filterType: null, filterValue: 'Tackle' });
    expect(await allFilters(page)).toEqual(sortJson([...filters, MEW_FILTER,
      { subject: ids.results, predicate: '<https://example.test/hasName>', object: valueId, filterType: null }]));
  });
});

test('QUAL-005 a results-table choice replaces the variable and refetches each relation from the chosen IRI', async ({ page }) => {
  const ids = await addNodeKindGraph(page);
  const pikachu = kindIri('Pikachu');
  await page.route('**/api/query', route => route.fulfill({ contentType: 'application/json',
    body: JSON.stringify({ data: [{ propertyId: pikachu, propertyLabel: 'Pikachu', propertyType: 'object', propertyClass: null }] }) }));
  const valueRequests = [];
  await page.route('**/api/query/relationship-value', route => {
    const request = route.request().postDataJSON();
    valueRequests.push(request);
    const name = request.predicateId.slice(kpk.length + 1, -1);
    return route.fulfill({ contentType: 'application/json',
      body: JSON.stringify({ data: [{ propertyId: `${name}-value`, propertyLabel: `${name}-value`, propertyType: 'text' }] }) });
  });

  await runLegacyQueryFromNode(page, ids.variable);
  await expect(page.locator('#table-results-body')).toContainText('Pikachu');
  await page.locator('#table-results-body tr.query-row').dispatchEvent('click');

  const predicates = KIND_GRAPH_FILTERS.map(filter => filter.predicate).sort();
  await expect.poll(() => valueRequests.length).toBe(predicates.length);
  expect(valueRequests.map(request => request.subjectId)).toEqual(predicates.map(() => pikachu));
  expect(valueRequests.map(request => request.predicateId).sort()).toEqual(predicates);
  await expect.poll(() => page.evaluate(() => cy.nodes().length)).toBe(predicates.length + 3);
  expect(await page.evaluate(id => cy.getElementById(id).data(), pikachu))
    .toEqual({ id: pikachu, value: pikachu, label: 'Pikachu', type: 'node' });
  expect(await page.evaluate(() => cy.getElementById('?mon').length)).toBe(0);
  // Each relation of the chosen value now ends at its own fetched value.
  expect(await allFilters(page)).toEqual(sortJson([MEW_FILTER, ...KIND_GRAPH_FILTERS.map(filter => kindFilter(
    pikachu, filter.predicate.slice(kpk.length + 1, -1), `${filter.predicate.slice(kpk.length + 1, -1)}-value`))]));
});

test('QUAL-005 a results-table choice for a value variable becomes a literal value node', async ({ page }) => {
  const ids = await addNodeKindGraph(page);
  await page.route('**/api/query', route => route.fulfill({ contentType: 'application/json',
    body: JSON.stringify({ data: [{ propertyId: 'Thunderbolt', propertyLabel: 'Thunderbolt', propertyType: 'text', propertyClass: null }] }) }));
  const edgesBefore = await edgeEnds(page);

  await runLegacyQueryFromNode(page, ids.results);
  await expect(page.locator('#table-results-body')).toContainText('Thunderbolt');
  await page.locator('#table-results-body tr.query-row').dispatchEvent('click');

  expect(await page.evaluate(() => cy.getElementById('Thunderbolt').data()))
    .toEqual({ id: 'Thunderbolt', value: 'Thunderbolt', label: 'Thunderbolt', type: 'label' });
  expect(await edgeEnds(page)).toEqual(edgesBefore.map(item => item.replace(/\|\?node_moves$/, '|Thunderbolt')).sort());
  await clickGraphNode(page, 'Thunderbolt');
  expect(await menuActions(page)).toEqual(['Edit value', ...COMMON_ACTIONS]);
  expect(await allFilters(page)).toEqual(sortJson([MEW_FILTER, ...KIND_GRAPH_FILTERS
    .map(filter => (filter.object === '?node_moves' ? { ...filter, object: 'Thunderbolt' } : filter))]));
});

const thunderbolt = { term: { type: 'literal', value: 'Thunderbolt', datatype: null, language: null }, label: null, selectable: true };
async function stageNodeKindGraph(page) {
  const ids = await addNodeKindGraph(page);
  const edgesBefore = await edgeEnds(page);
  const requests = await routeStages(page, request => ({ body: stagePage(request,
    request.variableName === '?mon' ? [iri(`${kpk}Pikachu`, 'Pikachu')] : [thunderbolt]) }));
  await expect(blockNames(page)).toHaveText(['?mon', '?node_moves']);
  await page.locator('#run-query-btn').click();
  await expect(candidateButtons(page)).toHaveCount(1);
  return { ids, requests, edgesBefore };
}

// Both stages bound: ?mon is <Pikachu> and ?node_moves is the literal "Thunderbolt".
async function expectBoundNodeKindGraph(page, edgesBefore) {
  const pikachu = kindIri('Pikachu');
  expect(await page.evaluate(() => cy.nodes().filter(node => node.data('type') === 'variable').length)).toBe(0);
  expect(await page.evaluate(id => cy.getElementById(id).data(), pikachu))
    .toEqual({ id: pikachu, value: pikachu, label: 'Pikachu', type: 'node' });
  expect(await page.evaluate(() => cy.getElementById('Thunderbolt').data()))
    .toEqual({ id: 'Thunderbolt', value: 'Thunderbolt', label: 'Thunderbolt', type: 'label' });
  expect(await edgeEnds(page)).toEqual(edgesBefore.map(item => item.split('|')
    .map((part, index) => (index === 2 ? part : part === '?mon' ? pikachu : part === '?node_moves' ? 'Thunderbolt' : part))
    .join('|')).sort());
  // The filtered value keeps its filter.
  expect(await page.evaluate(() => cy.nodes('[filterType]').map(node => [node.data('value'), node.data('filterType')])))
    .toEqual([['90', 2]]);
  expect(await allFilters(page)).toEqual(sortJson([MEW_FILTER, ...KIND_GRAPH_FILTERS.map(filter => ({
    ...filter, subject: pikachu, object: filter.object === '?node_moves' ? 'Thunderbolt' : filter.object,
  }))]));
}

test('QUAL-005 Assume binds an IRI variable and then a value variable in the node-kind graph', async ({ page }) => {
  const { requests, edgesBefore } = await stageNodeKindGraph(page);

  await page.getByRole('button', { name: 'Assume ?mon = Pikachu in the graph now' }).click();
  await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 1: ?node_moves');
  const last = requests.at(-1);
  expect(last.variableName).toBe('?node_moves');
  expect(last.bindings).toEqual([]);
  expect(sortJson(last.where)).toEqual(sortJson(KIND_GRAPH_FILTERS.map(filter => ({ ...filter, subject: kindIri('Pikachu') }))));

  await page.getByRole('button', { name: 'Assume ?node_moves = Thunderbolt in the graph now' }).click();
  await expect(page.locator('#two-variable-panel')).toBeHidden();
  await expectBoundNodeKindGraph(page, edgesBefore);
});

test('QUAL-005 Apply to graph binds the same node kinds as Assume', async ({ page }) => {
  const { edgesBefore } = await stageNodeKindGraph(page);

  await candidateButtons(page).first().click();
  await expect(page.locator('#stage-heading')).toHaveText('Stage 2 of 2: ?node_moves');
  await expect(candidateButtons(page)).toHaveCount(1);
  await candidateButtons(page).first().click();
  await page.getByRole('button', { name: 'Apply to graph' }).click();

  await expect(page.locator('#two-variable-panel')).toBeHidden();
  await expectBoundNodeKindGraph(page, edgesBefore);
});

test('QUAL-005 Remove relation deletes only the chosen relation of each kind', async ({ page }) => {
  const ids = await addNodeKindGraph(page);
  await page.evaluate(([source, target]) => {
    cy.add({ group: 'edges', data: { id: 'variable-relation', source, target, nodeId: '?predicate_9', label: '?', type: 'variable' } });
  }, [ids.variable, ids.iri]);
  const relations = [
    ['fixed IRI relation', `${kindIri('type')}0`],
    ['variable predicate relation', 'variable-relation'],
    ['relation to a literal value', `${kindIri('name')}0`],
    ['relation to a filtered value', `${kindIri('speed')}0`],
    ['relation of a fixed entity', `${kindIri('name')}0_1`],
  ];
  for (const [kind, edgeId] of relations) {
    await test.step(kind, async () => {
      const nodesBefore = await page.evaluate(() => cy.nodes().map(node => node.id()).sort());
      const edgesBefore = await edgeEnds(page);
      const filtersBefore = await allFilters(page);
      const removed = await page.evaluate(id => {
        const edge = cy.getElementById(id);
        return buildFilters(edge)[0];
      }, edgeId);
      await dismissMenus(page);
      await clickGraphEdge(page, edgeId);
      await expect(page.locator('#edge-action-menu')).toHaveAttribute('data-edge-id', edgeId);
      await page.locator('#edge-action-menu').getByRole('button', { name: 'Remove relation' }).click();

      expect(await page.evaluate(() => cy.nodes().map(node => node.id()).sort())).toEqual(nodesBefore);
      expect(await edgeEnds(page)).toEqual(edgesBefore.filter(item => !item.startsWith(`${edgeId}|`)));
      const index = filtersBefore.findIndex(filter => JSON.stringify(filter) === JSON.stringify(removed));
      expect(index).toBeGreaterThanOrEqual(0);
      expect(await allFilters(page)).toEqual(filtersBefore.filter((_, other) => other !== index));
    });
  }
});

// ── FE-034: a value variable holds a filter and becomes a value when chosen ──
const hpIri = '<https://example.test/hp>';
const literal160 = { term: { type: 'literal', value: '160', datatype: XSD_INTEGER, language: null }, label: null, selectable: true };

// ?pokemon hp ?hp with ?hp kept at ≥ 90, made with the app's own functions.
async function addHpValueVariable(page) {
  await disableAutoLayout(page);
  await page.evaluate(hp => {
    cy.add({ group: 'nodes', data: { id: '?pokemon', value: '?pokemon', label: '?', type: 'variable' }, position: { x: 200, y: 320 } });
    addValueVariableNode(cy, '?pokemon', hp, 'HP', '?hp');
    changeElementStringValue('?hp', '90', '2');
  }, hpIri);
}

test('FE-034 a value variable looks like a value in variable green with a pink border and its filter as label', async ({ page }) => {
  await addHpValueVariable(page);
  expect(await page.evaluate(() => {
    const node = cy.getElementById('?hp');
    return { shape: node.style('shape'), height: node.style('height'), color: node.style('background-color'),
      border: node.style('border-color'), borderWidth: node.style('border-width'), label: node.data('label') };
  })).toEqual({ shape: 'rectangle', height: '50px', color: VARIABLE_COLOR, border: 'rgb(244,143,177)', borderWidth: '4px', label: '? ≥ 90' });
  // The relation shows the plain predicate; the filter is on the node.
  expect(await page.evaluate(() => edgeLabelHtml(cy.edges()[0].data()))).toBe('<div class="edge-label">HP</div>');
  expect(await page.evaluate(() => buildFilters(cy.elements())))
    .toEqual([{ subject: '?pokemon', predicate: '<https://example.test/hp>', object: '?hp', filterType: null }]);
});

test('FE-034 staged Run Query sends the value variable filter and Apply turns it into the chosen value', async ({ page }) => {
  await addHpValueVariable(page);
  const requests = await routeStages(page, request => ({ body: stagePage(request,
    request.variableName === '?hp' ? [literal160] : [iri('https://example.test/Snorlax', 'Snorlax')]) }));
  await expect(blockNames(page)).toHaveText(['?hp', '?pokemon']);
  await page.locator('#run-query-btn').click();
  await expect(candidateButtons(page)).toHaveCount(1);
  const hpFilter = { variableName: '?hp', filterType: 2, value: '90' };
  expect(requests[0]).toMatchObject({ variableName: '?hp', variableFilters: [hpFilter], bindings: [] });
  expect(requests[0].where).toEqual([{ subject: '?pokemon', predicate: hpIri, object: '?hp', filterType: null }]);

  await candidateButtons(page).first().click();
  await expect(page.locator('#stage-heading')).toHaveText('Stage 2 of 2: ?pokemon');
  expect(requests.at(-1)).toMatchObject({ variableName: '?pokemon', variableFilters: [hpFilter], bindings: [{ variableName: '?hp', term: literal160.term }] });
  await candidateButtons(page).first().click();
  await page.getByRole('button', { name: 'Apply to graph' }).click();

  const snorlax = '<https://example.test/Snorlax>';
  expect(await page.evaluate(() => cy.nodes().map(node => node.data()).sort((a, b) => (a.id < b.id ? -1 : 1)))).toEqual([
    { id: '160', value: '160', label: '160', type: 'label' },
    { id: snorlax, value: snorlax, label: 'Snorlax', type: 'node' },
  ]);
  expect(await page.evaluate(() => buildFilters(cy.elements())))
    .toEqual([{ subject: snorlax, predicate: hpIri, object: '160', filterType: null }]);
  expect(await page.evaluate(() => variableFilterItems(cy.elements()))).toEqual([]);
});

test('FE-034 Assume settles the value variable at once, without its filter', async ({ page }) => {
  await addHpValueVariable(page);
  await routeStages(page, request => ({ body: stagePage(request,
    request.variableName === '?hp' ? [literal160] : [iri('https://example.test/Snorlax', 'Snorlax')]) }));
  await page.locator('#run-query-btn').click();
  await page.getByRole('button', { name: 'Assume ?hp = 160 in the graph now' }).click();
  await expect(page.locator('#stage-heading')).toHaveText('Stage 1 of 1: ?pokemon');
  expect(await page.evaluate(() => {
    const { id, ...data } = cy.getElementById('160').data();
    return { exists: cy.getElementById('?hp').length > 0, data };
  })).toEqual({ exists: false, data: { value: '160', label: '160', type: 'label' } });
});

test('FE-034 View SPARQL, legacy Run query and the badge use the value variable filter', async ({ page }) => {
  await addHpValueVariable(page);
  const counts = [];
  await page.route('**/api/query/count', async route => {
    const body = JSON.parse(route.request().postData());
    counts.push(body);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { variableName: body.variableName, count: body.variableFilters ? 3 : 4 } }) });
  });
  const hpFilter = { variableName: '?hp', filterType: 2, value: '90' };

  // The test server keeps requests from earlier tests: read only the new ones.
  const sentAfter = (before, path) => server.requests.slice(before).filter(request => request.path === path);
  let before = server.requests.length;
  await page.evaluate(() => window.seeSparqlQuery());
  await expect.poll(() => sentAfter(before, '/api/query/sparql').length).toBe(1);
  expect(JSON.parse(sentAfter(before, '/api/query/sparql')[0].body).variableFilters).toEqual([hpFilter]);

  before = server.requests.length;
  await clickGraphNode(page, '?pokemon');
  await nodeMenu(page).getByRole('button', { name: 'Run query', exact: true }).click();
  await expect.poll(() => sentAfter(before, '/api/query').length).toBe(1);
  expect(JSON.parse(sentAfter(before, '/api/query')[0].body).variableFilters).toEqual([hpFilter]);

  // FE-039: the badge is the funnel step of the value variable's filter, counting ?pokemon.
  await expect(filterBadge(page)).toHaveText('3 / 4');
  const where = [{ subject: '?pokemon', predicate: hpIri, object: '?hp', filterType: null }];
  expect(counts.slice(-2)).toEqual([
    { endpointUrl: 'CampeonatoBrasileiro2023', variableName: '?pokemon', where },
    { endpointUrl: 'CampeonatoBrasileiro2023', variableName: '?pokemon', where, variableFilters: [hpFilter] },
  ]);
});

// FE-039: value-variable filters are funnel steps and each badge shows its step.
test('FE-039 value-variable filters are funnel steps counted on the entity variable and badges show each step', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(pk => {
    cy.add([
      { group: 'nodes', data: { id: '?p', value: '?p', label: '?', type: 'variable' }, position: { x: 200, y: 250 } },
      { group: 'nodes', data: { id: 'fire', value: `<${pk}Fire>`, label: 'Fire', type: 'node' }, position: { x: 450, y: 100 } },
      { group: 'edges', data: { id: 'type', source: '?p', target: 'fire', nodeId: `<${pk}type>`, label: 'type' } },
    ]);
    addValueVariableNode(cy, '?p', `<${pk}speed>`, 'speed', '?speed');
    changeElementStringValue('?speed', '90', '2');
    addValueVariableNode(cy, '?p', `<${pk}hp>`, 'hp', '?hp');
    changeElementStringValue('?hp', '80', '2');
    cy.getElementById('?speed').position({ x: 450, y: 250 });
    cy.getElementById('?hp').position({ x: 450, y: 400 });
  }, funnelPk);
  // 151 Pokémon; 12 Fire; 7 of them fast; 2 of those with high HP.
  const requests = [];
  await page.route('**/api/query/count', async route => {
    const body = JSON.parse(route.request().postData());
    requests.push(body);
    const fire = body.where.some(item => item.object === `<${funnelPk}Fire>`);
    const filtered = new Set((body.variableFilters ?? []).map(filter => filter.variableName));
    const count = !fire ? 151 : filtered.has('?hp') ? 2 : filtered.has('?speed') ? 7 : 12;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { variableName: body.variableName, count } }) });
  });

  await page.locator('#filter-funnel-btn').click();
  await expect(page.locator('#filter-funnel-result')).toHaveText('Result: 2 ?p of 151.');
  await expect(page.locator('#filter-funnel-variable-select')).toHaveValue('?p');
  expect(await funnelRows(page)).toEqual([
    'With these relations, any value | 151',
    'type = Fire | 12 −139',
    'speed ≥ 90 | 7 −5',
    'hp ≥ 80 | 2 −5',
  ]);
  const badgeOf = id => page.locator(`#filter-badge-layer .filter-badge[data-node-id="${id}"]`);
  await expect(badgeOf('?speed')).toHaveText('7 / 12');
  await expect(badgeOf('?hp')).toHaveText('2 / 7');
  await expect(badgeOf('?hp')).toHaveAttribute('aria-label', 'This filter keeps 2 of the 7 ?p that reach it.');
  // The base keeps both relations with any value and leaves out their filters.
  const base = requests.find(request => request.where[0].object === '?__funnel0');
  expect(base.where.map(item => item.object)).toEqual(['?__funnel0', '?speed', '?hp']);
  expect(base.variableFilters).toBeUndefined();

  // Unticking a value-variable step previews without its filter; badges keep the query as it runs.
  await page.locator('#filter-funnel-steps .funnel-toggle', { hasText: 'speed ≥ 90' }).click();
  await expect(page.locator('#filter-funnel-result')).toContainText('Preview without 1 filter');
  await expect(badgeOf('?speed')).toHaveText('7 / 12');
});

test('FE-034 Convert to variable on a value gives a value variable whose editor starts at Any value', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    cy.add({ group: 'nodes', data: { id: '?pokemon', value: '?pokemon', label: '?', type: 'variable' }, position: { x: 200, y: 320 } });
    addNodeWithRelationship(cy, '45', '45', 'text', '?pokemon', '<https://example.test/hp>', 'HP');
    cy.getElementById('45').position({ x: 420, y: 200 });
  });
  await clickGraphNode(page, '45');
  await nodeMenu(page).getByRole('button', { name: 'Convert to variable' }).click();
  const id = await nodeMenu(page).getAttribute('data-node-id');
  expect(await menuActions(page)).toEqual(VALUE_VARIABLE_ACTIONS);

  await nodeMenu(page).getByRole('button', { name: 'Edit filter' }).click();
  expect(await checkedFilter(page)).toBe('Any value');
  await expect(page.locator('#modal-change-value')).not.toContainText('MAX');
  await expect(histogram(page)).toHaveJSProperty('hidden', false);
  // Typing a value picks Exact match; an empty value goes back to any value.
  await page.evaluate(() => {
    const input = document.getElementById('modal-new-value');
    input.value = '45';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(await checkedFilter(page)).toBe('Exact match');
  await page.evaluate(() => document.getElementById('apply-filter-btn').click());
  expect(await page.evaluate(nodeId => cy.getElementById(nodeId).data('label'), id)).toBe('? = 45');
  await page.evaluate(nodeId => changeElementStringValue(nodeId, '', '2'), id);
  expect(await page.evaluate(nodeId => {
    const { label, filterType, filterValue } = cy.getElementById(nodeId).data();
    return { label, filterType, filterValue };
  }, id)).toEqual({ label: '?', filterType: null, filterValue: '' });
  expect(await page.evaluate(() => variableFilterItems(cy.elements()))).toEqual([{ variableName: id, filterType: null, value: null }]);
});

// ── FE-037: Add Value Variable button ──────────────────────────────
test('FE-037 Add Value Variable adds a value variable that a defined predicate connects and Edit filter filters', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    cy.add({ group: 'nodes', data: { id: '?pokemon', value: '?pokemon', label: '?', type: 'variable' }, position: { x: 200, y: 320 } });
  });
  await page.locator('#add-value-variable-btn').click();
  await expect(page.locator('#status-nodes')).toHaveText('Nodes: 2');
  const id = await page.evaluate(() => cy.nodes('[type = "value-variable"]').id());
  expect(id).toMatch(/^\?value_\d+$/);
  expect(await page.evaluate(nodeId => {
    const node = cy.getElementById(nodeId);
    node.position({ x: 460, y: 200 });
    const { filterType, filterValue, label } = node.data();
    return { filterType, filterValue, label, shape: node.style('shape'), border: node.style('border-color') };
  }, id)).toEqual({ filterType: null, filterValue: '', label: '?', shape: 'rectangle', border: 'rgb(244,143,177)' });

  await clickGraphNode(page, id);
  expect(await menuActions(page)).toEqual(VALUE_VARIABLE_ACTIONS);

  // Connect ?pokemon to it through a defined predicate.
  await dismissMenus(page);
  await clickGraphNode(page, '?pokemon');
  await nodeMenu(page).getByRole('button', { name: 'Connect with defined predicate' }).click();
  await nodeMenu(page).getByRole('button', { name: 'name', exact: true }).click();
  await clickGraphNode(page, id);
  expect(await page.evaluate(() => buildFilters(cy.elements())))
    .toEqual([{ subject: '?pokemon', predicate: '<https://example.test/hasName>', object: id, filterType: null }]);

  await page.evaluate(nodeId => changeElementStringValue(nodeId, 'Pi', '0'), id);
  expect(await page.evaluate(() => variableFilterItems(cy.elements()))).toEqual([{ variableName: id, filterType: 0, value: 'Pi' }]);
  expect(await page.evaluate(nodeId => cy.getElementById(nodeId).data('label'), id)).toBe('? starts with Pi');
});

// ── FE-038: text values suggested while typing in the filter editor ──
const literalTerm = value => ({ term: { type: 'literal', value, datatype: null, language: 'en' }, label: null, selectable: true });
const typeInEditor = (page, text) => page.evaluate(value => {
  const input = document.getElementById('modal-new-value');
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}, text);
const chooseFilterType = (page, value) => page.evaluate(type => {
  const radio = document.querySelector(`#modal-change-value input[name=filter-type][value="${type}"]`);
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true }));
}, value);
const suggestionTexts = page => page.locator('#filter-suggestions button.filter-suggestion').allTextContents();
const suggestionStatus = page => page.locator('#filter-suggestions .filter-suggestions-status');

test('FE-038 typing in a value variable filter suggests the values that start with the text and a choice is an exact match', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    cy.add({ group: 'nodes', data: { id: '?pokemon', value: '?pokemon', label: '?', type: 'variable' }, position: { x: 200, y: 320 } });
    addValueVariableNode(cy, '?pokemon', '<https://example.test/name>', 'name', '?name');
    cy.getElementById('?name').position({ x: 460, y: 200 });
  });
  const requests = await routeStages(page, request => ({ body: stagePage(request,
    [literalTerm('Pikachu'), literalTerm('Pidgey'), { ...literalTerm('Pikachu'), term: { type: 'literal', value: 'Pikachu', datatype: null, language: 'fr' } }]) }));
  await clickGraphNode(page, '?name');
  await nodeMenu(page).getByRole('button', { name: 'Edit filter' }).click();
  await chooseFilterType(page, '0');
  await typeInEditor(page, 'P');
  await typeInEditor(page, 'Pi');

  await expect.poll(() => suggestionTexts(page)).toEqual(['Pikachu', 'Pidgey']);
  // Typing again within the delay sends one request, for the last text.
  expect(requests).toEqual([{
    endpointUrl: 'CampeonatoBrasileiro2023', variableName: '?name', bindings: [], limit: 20, offset: 0,
    where: [{ subject: '?pokemon', predicate: '<https://example.test/name>', object: '?name', filterType: null }],
    variableFilters: [{ variableName: '?name', filterType: 0, value: 'Pi' }],
  }]);

  await page.evaluate(() => document.querySelector('#filter-suggestions button.filter-suggestion').click());
  await expect(page.locator('#modal-new-value')).toHaveValue('Pikachu');
  expect(await checkedFilter(page)).toBe('Exact match');
  await expect(page.locator('#filter-suggestions')).toBeHidden();
  await page.waitForTimeout(600);
  expect(requests).toHaveLength(1);
  await page.evaluate(() => document.getElementById('apply-filter-btn').click());
  expect(await page.evaluate(() => cy.getElementById('?name').data('label'))).toBe('? = Pikachu');
});

test('FE-038 Edit value on a value node suggests values containing the text through a stand-in variable', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    cy.add({ group: 'nodes', data: { id: '?pokemon', value: '?pokemon', label: '?', type: 'variable' }, position: { x: 200, y: 320 } });
    addNodeWithRelationship(cy, 'Pikachu', 'Pikachu', 'text', '?pokemon', '<https://example.test/name>', 'name');
    cy.getElementById('Pikachu').position({ x: 460, y: 200 });
  });
  let fail = false;
  const requests = await routeStages(page, request => (fail
    ? { status: 502, body: { error: 'upstream down' } }
    : { body: stagePage(request, request.variableFilters[0].value === 'chu' ? [literalTerm('Pikachu'), literalTerm('Raichu')] : []) }));
  await clickGraphNode(page, 'Pikachu');
  await nodeMenu(page).getByRole('button', { name: 'Edit value' }).click();
  await typeInEditor(page, 'chu');

  await expect.poll(() => suggestionTexts(page)).toEqual(['Pikachu', 'Raichu']);
  expect(requests[0]).toMatchObject({
    variableName: '?suggestedValue',
    where: [{ subject: '?pokemon', predicate: '<https://example.test/name>', object: '?suggestedValue', filterType: null }],
    variableFilters: [{ variableName: '?suggestedValue', filterType: 1, value: 'chu' }],
  });

  await typeInEditor(page, 'xyz');
  await expect(suggestionStatus(page)).toHaveText('No value contains “xyz”.');
  fail = true;
  await typeInEditor(page, 'Ra');
  await expect(suggestionStatus(page)).toHaveText('Could not load matching values: upstream down');
  // Clearing the text hides the list and sends nothing.
  const sent = requests.length;
  await typeInEditor(page, '');
  await expect(page.locator('#filter-suggestions')).toBeHidden();
  await page.waitForTimeout(600);
  expect(requests).toHaveLength(sent);
});

// ── QUAL-006: legacy utilities without earlier coverage ───────────────
// These pin toolbar and page behavior the SvelteKit app must reproduce
// (tcc/04 - Frontend/Frontend Parity Checklist.md).

test('QUAL-006 the guided tour starts once on page load', async ({ page }) => {
  await page.addInitScript(() => {
    window.__tourStarts = 0;
    Object.defineProperty(window, 'introJs', {
      configurable: true,
      get: () => () => ({ setOptions() { return this; }, start() { window.__tourStarts += 1; } }),
      set() {},
    });
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__tourStarts)).toBe(1);
});

// The jQuery stub's is() is always false, so the toggle-on handler
// (index2.html, cose on check) is not observable here; the checkbox state is.
test('QUAL-006 Auto Layout decides whether adding a node runs the cose layout', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    window.__layouts = [];
    const original = cy.layout.bind(cy);
    cy.layout = options => { window.__layouts.push(options.name); return original(options); };
  });
  await page.evaluate(() => window.addNewVariable());
  expect(await page.evaluate(() => window.__layouts)).toEqual([]);
  await page.evaluate(() => { document.getElementById('auto-layout').checked = true; });
  await page.evaluate(() => window.addNewVariable());
  await page.evaluate(() => window.addNewValueVariable());
  expect(await page.evaluate(() => window.__layouts)).toEqual(['cose', 'cose']);
});

test('QUAL-006 Export Query downloads the graph and Upload Query restores it', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: '?team', value: '?team', label: '?', type: 'variable' }, position: { x: 100, y: 100 } },
      { group: 'nodes', data: { id: '<https://example.test/poa>', value: '<https://example.test/poa>', label: 'Porto Alegre', type: 'node' }, position: { x: 300, y: 100 } },
      { group: 'edges', data: { id: 'city', source: '?team', target: '<https://example.test/poa>', nodeId: '<https://example.test/city>', label: 'city' } },
    ]);
  });
  const downloadPromise = page.waitForEvent('download');
  await page.evaluate(() => window.saveQuery());
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('query_exported.json');
  const saved = JSON.parse(await (await download.createReadStream()).toArray().then(chunks => Buffer.concat(chunks).toString('utf8')));
  expect(saved.elements.nodes.map(node => node.data.id).sort()).toEqual(['<https://example.test/poa>', '?team']);
  expect(saved.elements.edges.map(edge => edge.data.nodeId)).toEqual(['<https://example.test/city>']);

  await page.evaluate(() => newQuery());
  await expect(page.locator('#status-nodes')).toHaveText('Nodes: 0');
  await page.locator('#upload-json').setInputFiles({ name: 'query.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });
  await expect.poll(() => page.evaluate(() => cy.nodes().length)).toBe(2);
  expect(await page.evaluate(() => cy.edges().map(edge => [edge.id(), edge.data('source'), edge.data('target')]))).toEqual([
    ['city', '?team', '<https://example.test/poa>'],
  ]);

  await page.locator('#upload-json').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"nodes": []}') });
  await page.locator('#upload-json').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  await expect.poll(() => page.evaluate(() => cy.nodes().length)).toBe(2);
});

test('QUAL-006 New Query clears every node and relation', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    window.addNewVariable();
    window.addNewValueVariable();
  });
  await expect(page.locator('#status-nodes')).toHaveText('Nodes: 2');
  await page.getByRole('button', { name: 'New Query' }).click();
  await expect(page.locator('#status-nodes')).toHaveText('Nodes: 0');
  await expect(page.locator('#status-edges')).toHaveText('Edges: 0');
});

test('QUAL-006 zoom buttons zoom in by 1.25, out by 0.8 and fit the graph', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => window.addNewVariable());
  await page.getByRole('button', { name: 'Zoom in' }).click();
  expect(await page.evaluate(() => cy.zoom())).toBeCloseTo(1.25, 5);
  await page.getByRole('button', { name: 'Zoom out' }).click();
  expect(await page.evaluate(() => cy.zoom())).toBeCloseTo(1, 5);
  await page.getByRole('button', { name: 'Fit graph' }).click();
  expect(await page.evaluate(() => cy.zoom())).toBe(3);
});

test('QUAL-006 the results table filter hides rows that do not contain the text', async ({ page }) => {
  await page.evaluate(() => {
    document.getElementById('table-results-body').innerHTML =
      '<tr data-index="0" class="query-row"><td>a</td><td>Bulbasaur</td></tr>'
      + '<tr data-index="1" class="query-row"><td>b</td><td>Charmander</td></tr>';
  });
  // The Materialize stub never opens the modal, so the hidden input is set directly.
  await page.evaluate(() => {
    const input = document.getElementById('table-search-input');
    input.value = 'char';
    input.dispatchEvent(new Event('input'));
  });
  expect(await page.locator('#table-results-body tr').evaluateAll(rows => rows.map(row => row.style.display))).toEqual(['none', '']);
});

// Enter in a toolbar input submits the toolbar form, whose submit button runs
// the query; elsewhere the document keydown handler runs it.
test('QUAL-006 Enter runs the query from the toolbar inputs and the page, not from buttons', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    window.__runs = 0;
    const original = window.runQuery;
    window.runQuery = () => { window.__runs += 1; return original(); };
  });
  await page.locator('#input-max-results').focus();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.__runs)).toBe(1);
  await page.locator('#status-bar').click();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.__runs)).toBe(2);
  await page.getByRole('button', { name: 'New Query' }).focus();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.__runs)).toBe(2);
});

test('QUAL-006 a search result already related to a node is added with the discovered relation', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => addNode(cy, '<https://example.test/poa>', 'Porto Alegre'));
  await page.route('**/api/query', async route => {
    const body = JSON.parse(route.request().postData());
    const fromNew = body.where[0].subject === '<https://example.test/team-a>';
    await route.fulfill({ json: { data: fromNew
      ? [{ propertyId: '<https://example.test/city>', propertyLabel: 'city', propertyType: 'objetoClasse', propertyClass: null }]
      : [] } });
  });
  await page.locator('#input-busca-elementos').fill('Team');
  await page.locator('#input-busca-elementos').dispatchEvent('input');
  await expect.poll(() => page.locator('#input-busca-elementos').getAttribute('data-autocomplete')).toContain('Team A');
  await page.evaluate(() => window.__autocompleteCallbacks.get('input-busca-elementos')('Team A'));
  await expect.poll(() => page.evaluate(() => cy.edges().map(edge => [edge.data('source'), edge.data('nodeId'), edge.data('target')]))).toEqual([
    ['<https://example.test/team-a>', '<https://example.test/city>', '<https://example.test/poa>'],
  ]);
  await expect(page.locator('#status-nodes')).toHaveText('Nodes: 2');
});

test('QUAL-006 Alt+drag from a node to empty space adds a variable node joined by a variable relation', async ({ page }) => {
  await disableAutoLayout(page);
  await page.evaluate(() => {
    cy.add([
      { group: 'nodes', data: { id: '<https://example.test/a>', value: '<https://example.test/a>', label: 'A', type: 'node' }, position: { x: 150, y: 150 } },
      { group: 'nodes', data: { id: '<https://example.test/b>', value: '<https://example.test/b>', label: 'B', type: 'node' }, position: { x: 450, y: 150 } },
    ]);
  });
  const box = await page.locator('#cy').boundingBox();
  const at = async id => page.evaluate(nodeId => cy.getElementById(nodeId).renderedPosition(), id);
  const a = await at('<https://example.test/a>');
  const b = await at('<https://example.test/b>');

  await page.keyboard.down('Alt');
  await page.mouse.move(box.x + a.x, box.y + a.y);
  await page.mouse.down();
  await page.mouse.move(box.x + b.x, box.y + b.y, { steps: 8 });
  await page.mouse.up();
  await page.mouse.move(box.x + a.x, box.y + a.y);
  await page.mouse.down();
  await page.mouse.move(box.x + a.x, box.y + a.y + 220, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up('Alt');

  const graph = await page.evaluate(() => ({
    nodes: cy.nodes().map(node => node.data('type')).sort(),
    edges: cy.edges().map(edge => [edge.data('source'), edge.data('target').startsWith('?node_') ? '?new' : edge.data('target'), edge.data('label'), edge.data('type')]),
    positionA: cy.getElementById('<https://example.test/a>').position(),
  }));
  expect(graph.nodes).toEqual(['node', 'node', 'variable']);
  expect(graph.edges).toEqual([
    ['<https://example.test/a>', '<https://example.test/b>', '?', 'variable'],
    ['<https://example.test/a>', '?new', '?', 'variable'],
  ]);
  expect(graph.positionA).toEqual({ x: 150, y: 150 });
});

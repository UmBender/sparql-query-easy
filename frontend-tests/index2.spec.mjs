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
  await expect(histogram(page)).toContainText('Keeps 6 of 6 values');
  expect(requests).toHaveLength(1);
  const lo = page.getByRole('slider', { name: 'Lowest kept value' });
  const hi = page.getByRole('slider', { name: 'Highest kept value' });
  await expect(lo).toHaveValue('20');
  await expect(hi).toHaveValue('150');
  // Opening the editor does not change an exact value.
  await expect(page.locator('#modal-new-value')).toHaveValue('45');
  expect(await keptBars(page)).toEqual(await allBars(page));

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
  await expect(histogram(page)).toContainText('Keeps 10 of 10 values');
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
  await expect(histogram(page)).toContainText('Keeps 3 of 3 values');
  releaseFirst();
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
  await expect(histogram(page)).toContainText('Keeps 3 of 3 values');
});

test('the filter editor histogram fits a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await addSpeedFilterGraph(page);
  await routeSpeedProfile(page, fulfillProfile(speedProfile([20, 45, 45, 60, 90, 150])));
  await openVisibleFilterEditor(page);
  await expect(histogram(page)).toContainText('Keeps 6 of 6 values');
  const [modal, chart, slider] = await Promise.all(['#modal-change-value-content', '#filter-histogram svg', '#filter-histogram .filter-histogram-slider']
    .map(selector => page.locator(selector).boundingBox()));
  for (const box of [chart, slider]) {
    expect(box.width).toBeGreaterThan(200);
    expect(box.x).toBeGreaterThanOrEqual(modal.x - 0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(modal.x + modal.width + 0.5);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
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
  const value = await page.evaluate(() => {
    const node = cy.nodes('[type = "label"]')[0];
    const edge = node.connectedEdges()[0];
    return { value: node.data('value'), label: node.data('label'), source: edge.data('source'), nodeId: edge.data('nodeId'), edgeLabel: edge.data('label') };
  });
  expect(value).toEqual({ value: '39', label: '39', source: '?mon', nodeId: '<https://e/hp>', edgeLabel: 'HP' });

  await page.evaluate(() => {
    document.querySelector('#modal-change-value input[name=filter-type][value="2"]').checked = true;
    document.getElementById('modal-new-value').value = '60';
    document.getElementById('apply-filter-btn').click();
  });
  expect(await filterNode(page)).toEqual({ label: '≥ 60', value: '60', filterType: 2 });
});

test('Add value filter on a relation without numbers opens the text editor on an empty value', async ({ page }) => {
  await addValueFilterGraph(page, { profile: { subject: '?mon', predicate: '<https://e/category>', count: 0, min: null, max: null, truncated: false, values: [] } });
  await page.locator('#node-action-menu').getByRole('button', { name: 'category', exact: true }).click();
  await expect(page.locator('#modal-change-value')).toContainText('Starts with');
  await expect(page.locator('#modal-new-value')).toHaveValue('');
});

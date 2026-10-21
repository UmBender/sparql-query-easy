/**
 * FE-044 parity: the graph-editing rows of tcc/04 - Frontend/Frontend Parity
 * Checklist.md, ported from frontend-tests/index2.spec.mjs to the new app.
 * The API is mocked (support/mock-api.ts, the legacy server.mjs defaults);
 * no external request is allowed.
 */
import { expect, test, type Page } from '@playwright/test';
import { guardOffline } from './support/offline';
import { mockApi, type MockApi } from './support/mock-api';
import {
	addGraph,
	clickBackground,
	clickEdge,
	clickNode,
	expectCanvasMatchesStore,
	dragNode,
	graphOf,
	nodePagePosition,
	openEditor
} from './support/editor';

let unexpected: string[];
let api: MockApi;
let requests: MockApi['requests'];

test.beforeEach(async ({ page, baseURL }) => {
	unexpected = await guardOffline(page, baseURL!);
	api = await mockApi(page);
	requests = api.requests;
	await openEditor(page);
});

test.afterEach(async ({ page }) => {
	await expectCanvasMatchesStore(page);
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});

const menu = (page: Page) => page.locator('#node-action-menu');
const edgeMenu = (page: Page) => page.locator('#edge-action-menu');
const menuActions = (page: Page) =>
	page.locator('#node-action-menu button[data-action]').allTextContents();
const bodies = (path: string) =>
	requests.filter((request) => request.path === path).map((request) => request.body);
const PK = 'https://example.test/';
const kindIri = (name: string) => `<${PK}${name}>`;

test('P-01 the API warm-up reads /health and the status bar reports it', async () => {
	expect(requests.some((request) => request.path === '/health')).toBe(true);
});

test('P-02 search nodes sends the debounced text with the limit and adds the chosen IRI node', async ({
	page
}) => {
	await page.getByRole('combobox', { name: 'Search nodes' }).fill('Team');
	await expect(page.getByRole('option', { name: /Team A/ })).toBeVisible();
	expect(bodies('/api/query/search')).toEqual([
		{ endpointUrl: 'CampeonatoBrasileiro2023', search: 'Team', limit: 150 }
	]);
	await page.getByRole('option', { name: /Team A/ }).click();
	await expect(page.locator('#status-nodes')).toHaveText('Nodes: 1');
	expect((await graphOf(page)).nodes).toEqual(['<https://example.test/team-a>|entity|Team A']);
});

test('P-03 a search result related to an existing node is added with the discovered relation', async ({
	page
}) => {
	await addGraph(page, [
		{ kind: 'entity', id: '<https://example.test/poa>', label: 'Porto Alegre', x: 200, y: 200 }
	]);
	api.override('/api/query', (body) => {
		const fromNew =
			(body as { where: { subject: string }[] }).where[0].subject ===
			'<https://example.test/team-a>';
		return {
			data: fromNew
				? [
						{
							propertyId: '<https://example.test/city>',
							propertyLabel: 'city',
							propertyType: 'objetoClasse'
						}
					]
				: []
		};
	});
	await page.getByRole('combobox', { name: 'Search nodes' }).fill('Team');
	await page.getByRole('option', { name: /Team A/ }).click();
	await expect
		.poll(async () => (await graphOf(page)).edges)
		.toEqual([
			'<https://example.test/city>0|<https://example.test/team-a>|<https://example.test/city>|<https://example.test/poa>'
		]);
	await expect(page.locator('#status-nodes')).toHaveText('Nodes: 2');
});

test('P-04 P-05 the limit and endpoint fields feed requests', async ({ page }) => {
	await page.locator('#input-max-results').fill('7');
	const endpoint = page.getByRole('combobox', { name: 'SPARQL endpoint' });
	await expect(endpoint).toHaveValue('CampeonatoBrasileiro2023');
	await endpoint.fill('PokemonGen1');
	await page.getByRole('combobox', { name: 'Search nodes' }).fill('Pika');
	await expect
		.poll(() => bodies('/api/query/search'))
		.toEqual([{ endpointUrl: 'PokemonGen1', search: 'Pika', limit: 7 }]);
});

test('P-06 P-07 P-14 add, count and clear nodes; undo and redo edits', async ({ page }) => {
	await page.getByRole('button', { name: 'Add Variable' }).click();
	await page.getByRole('button', { name: 'Add Value Variable' }).click();
	await expect(page.locator('#status-nodes')).toHaveText('Nodes: 2');
	expect((await graphOf(page)).nodes.map((node) => node.split('|')[1]).sort()).toEqual([
		'valueVariable',
		'variable'
	]);
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(page.locator('#status-nodes')).toHaveText('Nodes: 1');
	await page.getByRole('button', { name: 'Redo' }).click();
	await expect(page.locator('#status-nodes')).toHaveText('Nodes: 2');
	await page.getByRole('button', { name: 'New Query' }).click();
	await expect(page.locator('#status-nodes')).toHaveText('Nodes: 0');
	await expect(page.locator('#status-edges')).toHaveText('Edges: 0');
	await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

test('P-13 zoom buttons zoom by 1.25 and 0.8 and fit; one wheel notch zooms gently', async ({
	page
}) => {
	await addGraph(page, [{ kind: 'variable', id: '?a', x: 200, y: 200 }]);
	const zoom = () =>
		page.evaluate(() =>
			(
				window as never as { __easyquery: { view: { cy: { zoom(): number } } } }
			).__easyquery.view.cy.zoom()
		);
	await page.getByRole('button', { name: 'Zoom in' }).click();
	expect(await zoom()).toBeCloseTo(1.25, 5);
	await page.getByRole('button', { name: 'Zoom out' }).click();
	expect(await zoom()).toBeCloseTo(1, 5);
	await page.locator('#cy').hover({ position: { x: 300, y: 200 } });
	await page.mouse.wheel(0, -100);
	await expect.poll(zoom).toBeGreaterThan(1);
	expect(await zoom()).toBeLessThan(1.5);
	await page.getByRole('button', { name: 'Fit graph' }).click();
	await expect.poll(zoom).toBe(3);
});

test('G-01 G-12 node kinds and variable relations use the token colors', async ({ page }) => {
	await addGraph(page, [
		{ kind: 'entity', id: '<https://e/a>', label: 'A', x: 100, y: 100 },
		{ kind: 'variable', id: '?v', x: 300, y: 100 },
		{ kind: 'value', id: '90', x: 500, y: 100 },
		{ kind: 'valueVariable', id: '?w', x: 700, y: 100 },
		{ kind: 'class', id: 'c', label: 'Class', value: '<https://e/C>', x: 100, y: 300 },
		{
			edge: 'fixed',
			source: '<https://e/a>',
			target: '?v',
			predicate: '<https://e/p>',
			label: 'p'
		},
		{ edge: 'var', source: '?v', target: '90', predicate: '?p', label: '?' }
	]);
	const styles = await page.evaluate(() => {
		const { cy } = (
			window as never as { __easyquery: { view: { cy: import('cytoscape').Core } } }
		).__easyquery.view;
		const node = (id: string) => [
			cy.getElementById(id).style('background-color'),
			cy.getElementById(id).style('shape')
		];
		return {
			entity: node('<https://e/a>'),
			variable: node('?v'),
			value: node('90'),
			valueVariable: [...node('?w'), cy.getElementById('?w').style('border-color')],
			class: node('c'),
			variableEdge: cy.getElementById('var').style('text-background-color'),
			fixedEdge: cy.getElementById('fixed').style('text-background-color')
		};
	});
	expect(styles).toEqual({
		entity: ['rgb(68,114,196)', 'ellipse'],
		variable: ['rgb(169,209,142)', 'ellipse'],
		value: ['rgb(244,143,177)', 'rectangle'],
		valueVariable: ['rgb(169,209,142)', 'rectangle', 'rgb(244,143,177)'],
		class: ['rgb(253,216,53)', 'ellipse'],
		variableEdge: 'rgb(169,209,142)',
		fixedEdge: 'rgb(255,255,255)'
	});
});

test('G-02 left click opens a persistent node action list that only the background dismisses', async ({
	page
}) => {
	await addGraph(page, [
		{ kind: 'entity', id: '<https://e/a>', label: 'Pikachu', x: 300, y: 250 }
	]);
	await clickNode(page, '<https://e/a>');
	await expect(menu(page)).toBeVisible();
	await expect(menu(page)).toHaveAttribute('data-node-id', '<https://e/a>');
	await expect(menu(page).getByText('Actions for Pikachu')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(menu(page)).toBeVisible();
	await page.getByRole('button', { name: 'Zoom in' }).click();
	const box = await menu(page).boundingBox();
	const canvas = await page.locator('#cy').boundingBox();
	expect(box!.x).toBeGreaterThanOrEqual(canvas!.x);
	expect(box!.x + box!.width).toBeLessThanOrEqual(canvas!.x + canvas!.width);
	await clickBackground(page);
	await expect(menu(page)).toBeHidden();
	expect(requests.filter((request) => request.path.startsWith('/api/query'))).toEqual([]);
});

test('G-03 each node kind offers exactly its legacy actions', async ({ page }) => {
	const COMMON = [
		'Connect with variable predicate',
		'Connect with defined predicate',
		'Convert to variable',
		'Remove'
	];
	await addGraph(page, [
		{ kind: 'variable', id: '?mon', x: 330, y: 260 },
		{ kind: 'entity', id: kindIri('Electric'), label: 'Electric', x: 200, y: 100 },
		{ kind: 'value', id: 'true', x: 540, y: 120 },
		{ kind: 'value', id: 'Pikachu', x: 750, y: 100 },
		{
			kind: 'valueVariable',
			id: '?hp',
			x: 750,
			y: 330,
			filter: { code: 2, value: '100' },
			label: '? ≥ 100'
		},
		{ kind: 'class', id: 'cls', label: 'Pokémon', value: kindIri('Pokemon'), x: 950, y: 260 },
		{ edge: 't', source: '?mon', target: kindIri('Electric'), predicate: kindIri('type') },
		{ edge: 'l', source: '?mon', target: 'true', predicate: kindIri('legendary') },
		{ edge: 'n', source: '?mon', target: 'Pikachu', predicate: kindIri('name') },
		{ edge: 'h', source: '?mon', target: '?hp', predicate: kindIri('hp') }
	]);
	const expected: [string, string[]][] = [
		['?mon', ['Run query', 'Add value filter', ...COMMON]],
		[kindIri('Electric'), ['Explore relationships', ...COMMON]],
		['true', ['Toggle Boolean value', 'Edit value', ...COMMON]],
		['Pikachu', ['Edit value', ...COMMON]],
		['?hp', ['Edit filter', ...COMMON]],
		['cls', ['Explore values', ...COMMON]]
	];
	for (const [id, actions] of expected) {
		// Like the legacy test, dismiss the previous list so it cannot cover the next node.
		await clickBackground(page);
		await clickNode(page, id);
		await expect(menu(page)).toHaveAttribute('data-node-id', id);
		expect(await menuActions(page), id).toEqual(actions);
	}
});

test('G-04 Explore relationships fills the results table and a row adds the value with its relation', async ({
	page
}) => {
	await addGraph(page, [
		{ kind: 'entity', id: '<https://example.test/team-a>', label: 'Team A', x: 300, y: 250 }
	]);
	await clickNode(page, '<https://example.test/team-a>');
	await menu(page).getByRole('button', { name: 'Explore relationships' }).click();
	await expect(page.locator('#table-results-body')).toContainText('name');
	expect(bodies('/api/query/relationships')).toEqual([
		{ endpointUrl: 'CampeonatoBrasileiro2023', id: '<https://example.test/team-a>' }
	]);
	await page.locator('#table-results-body tr', { hasText: 'name' }).click();
	await expect(page.locator('#status-nodes')).toHaveText('Nodes: 2');
	expect(bodies('/api/query/relationship-value')).toEqual([
		{
			endpointUrl: 'CampeonatoBrasileiro2023',
			subjectId: '<https://example.test/team-a>',
			predicateId: '<https://example.test/hasName>',
			isLiteral: true
		}
	]);
	expect((await graphOf(page)).edges).toEqual([
		'<https://example.test/hasName>0|<https://example.test/team-a>|<https://example.test/hasName>|Team A'
	]);
	await expect(page.locator('#results-sheet')).toBeHidden();
});

test('P-16 the results filter hides rows without the text', async ({ page }) => {
	api.override('/api/query/relationships', () => ({
		data: [
			{ propertyId: '<a>', propertyLabel: 'Bulbasaur' },
			{ propertyId: '<b>', propertyLabel: 'Charmander' }
		]
	}));
	await addGraph(page, [{ kind: 'entity', id: '<https://e/a>', x: 300, y: 250 }]);
	await clickNode(page, '<https://e/a>');
	await menu(page).getByRole('button', { name: 'Explore relationships' }).click();
	await page.getByRole('textbox', { name: 'Filter results' }).fill('char');
	await expect(page.locator('#table-results-body tr')).toHaveText([/Charmander/]);
});

test('G-05 Explore values on a class sends the full rdfs:domain IRI', async ({ page }) => {
	await addGraph(page, [
		{ kind: 'class', id: 'cls', label: 'Type', value: kindIri('Type'), x: 300, y: 250 }
	]);
	await clickNode(page, 'cls');
	await menu(page).getByRole('button', { name: 'Explore values' }).click();
	await expect(page.locator('#table-results-body')).toContainText('No results found.');
	const [body] = bodies('/api/query') as {
		where: { predicate: string; object: string }[];
		variableName: string;
	}[];
	expect(body.where).toEqual([
		{
			subject: body.variableName,
			predicate: '<http://www.w3.org/2000/01/rdf-schema#domain>',
			object: kindIri('Type')
		}
	]);
	expect(body.variableName).toMatch(/^\?default_\d{13}$/);
});

test('G-06 Run query on a variable binds the chosen row and refetches its outgoing relation', async ({
	page
}) => {
	await addGraph(page, [
		{ kind: 'variable', id: '?x', x: 200, y: 250 },
		{ kind: 'entity', id: kindIri('Kanto'), label: 'Kanto', x: 450, y: 250 },
		{
			edge: 'region',
			source: '?x',
			target: kindIri('Kanto'),
			predicate: kindIri('region'),
			label: 'region'
		}
	]);
	api.override('/api/query', () => ({
		data: [
			{
				propertyId: kindIri('Pikachu'),
				propertyLabel: 'Pikachu',
				propertyType: 'objeto'
			}
		]
	}));
	api.override('/api/query/relationship-value', () => ({
		data: [{ propertyId: kindIri('Kanto'), propertyLabel: 'Kanto', propertyType: 'objeto' }]
	}));
	await clickNode(page, '?x');
	await menu(page).getByRole('button', { name: 'Run query' }).click();
	expect(bodies('/api/query')).toEqual([
		{
			endpointUrl: 'CampeonatoBrasileiro2023',
			where: [
				{
					subject: '?x',
					predicate: kindIri('region'),
					object: kindIri('Kanto'),
					filterType: null
				}
			],
			variableName: '?x',
			limit: 150
		}
	]);
	await page.locator('#table-results-body tr', { hasText: 'Pikachu' }).click();
	await expect
		.poll(async () => (await graphOf(page)).edges)
		.toEqual([
			`${kindIri('region')}0|${kindIri('Pikachu')}|${kindIri('region')}|${kindIri('Kanto')}`
		]);
	expect(bodies('/api/query/relationship-value')).toEqual([
		{
			endpointUrl: 'CampeonatoBrasileiro2023',
			subjectId: kindIri('Pikachu'),
			predicateId: kindIri('region'),
			isLiteral: false
		}
	]);
	await expect(menu(page)).toHaveAttribute('data-node-id', kindIri('Pikachu'));
});

test('G-07 connect with a variable or a defined predicate; Escape and the background cancel', async ({
	page
}) => {
	await addGraph(page, [
		{ kind: 'variable', id: '?s', x: 200, y: 250 },
		{ kind: 'entity', id: '<https://e/o>', label: 'O', x: 500, y: 250 }
	]);
	await clickNode(page, '?s');
	await menu(page).getByRole('button', { name: 'Connect with variable predicate' }).click();
	await expect(page.locator('#connection-preview')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.locator('#connection-preview')).toBeHidden();
	await clickNode(page, '?s');
	await menu(page).getByRole('button', { name: 'Connect with variable predicate' }).click();
	await clickBackground(page);
	await expect(page.locator('#connection-preview')).toBeHidden();
	expect((await graphOf(page)).edges).toEqual([]);
	await clickNode(page, '?s');
	await menu(page).getByRole('button', { name: 'Connect with variable predicate' }).click();
	await clickNode(page, '<https://e/o>');
	await expect
		.poll(async () =>
			(await graphOf(page)).edges.map((edge) => edge.split('|').slice(1).join('|'))
		)
		.toEqual(['?s|?predicate_3|<https://e/o>']);

	await clickNode(page, '?s');
	await menu(page).getByRole('button', { name: 'Connect with defined predicate' }).click();
	await expect(menu(page).getByText('Choose a predicate:')).toBeVisible();
	expect(bodies('/api/query/relationships')).toEqual([
		{ endpointUrl: 'CampeonatoBrasileiro2023', id: '?s', limit: 150 }
	]);
	await menu(page).getByRole('button', { name: 'name' }).click();
	await clickNode(page, '<https://e/o>');
	await expect
		.poll(async () =>
			(await graphOf(page)).edges.map((edge) => edge.split('|').slice(1).join('|')).sort()
		)
		.toEqual([
			'?s|<https://example.test/hasName>|<https://e/o>',
			'?s|?predicate_3|<https://e/o>'
		]);
});

test('G-07 a click that moves a little still ends the connection and never drags the destination (BUG-007)', async ({
	page
}) => {
	const pikachu = '<https://e/Pikachu>';
	await addGraph(page, [
		{ kind: 'valueVariable', id: '?v', x: 200, y: 250 },
		{ kind: 'entity', id: pikachu, label: 'Pikachu', x: 500, y: 250 }
	]);
	const position = () =>
		page.evaluate((id) => {
			const { store } = (
				window as never as {
					__easyquery: {
						store: { graph: { elements: { id: string; position?: object }[] } };
					};
				}
			).__easyquery;
			return JSON.stringify(
				store.graph.elements.find((element) => element.id === id)?.position
			);
		}, pikachu);
	const before = await position();
	for (const [step, wobble] of [0, 8, 25].entries()) {
		await clickNode(page, '?v');
		await menu(page).getByRole('button', { name: 'Connect with variable predicate' }).click();
		// A hand click: press on the node, move a few pixels, release.
		const at = await nodePagePosition(page, pikachu);
		await page.mouse.move(at.x, at.y);
		await page.mouse.down();
		await page.mouse.move(at.x + wobble, at.y + wobble, { steps: 3 });
		await page.mouse.up();
		await expect.poll(async () => (await graphOf(page)).edges.length).toBe(step + 1);
		await expect(page.locator('#connection-preview')).toBeHidden();
		await expect(menu(page)).toBeHidden();
		// Moving on without a button pressed leaves the node where it was.
		await page.mouse.move(at.x + 150, at.y + 120, { steps: 5 });
		expect(await position()).toBe(before);
	}
	expect((await graphOf(page)).edges.map((edge) => edge.split('|')[1])).toEqual([
		'?v',
		'?v',
		'?v'
	]);

	// Outside a connection, nodes drag as before.
	await dragNode(page, pikachu, { x: 60, y: 0 });
	await expect.poll(position).not.toBe(before);
});

test('G-08 Alt+drag adds a variable relation to a node, or a new variable node', async ({
	page
}) => {
	await addGraph(page, [
		{ kind: 'entity', id: '<https://e/a>', label: 'A', x: 150, y: 150 },
		{ kind: 'entity', id: '<https://e/b>', label: 'B', x: 450, y: 150 }
	]);
	const box = (await page.locator('#cy').boundingBox())!;
	await page.keyboard.down('Alt');
	await page.mouse.move(box.x + 150, box.y + 150);
	await page.mouse.down();
	await page.mouse.move(box.x + 450, box.y + 150, { steps: 8 });
	await page.mouse.up();
	await page.mouse.move(box.x + 150, box.y + 150);
	await page.mouse.down();
	await page.mouse.move(box.x + 150, box.y + 370, { steps: 8 });
	await page.mouse.up();
	await page.keyboard.up('Alt');
	const graph = await graphOf(page);
	expect(graph.nodes.map((node) => node.split('|')[1]).sort()).toEqual([
		'entity',
		'entity',
		'variable'
	]);
	expect(
		graph.edges
			.map((edge) =>
				edge
					.split('|')
					.slice(1)
					.join('|')
					.replace(/\?node_\d+/, '?new')
			)
			.sort()
	).toEqual(['<https://e/a>|null|<https://e/b>', '<https://e/a>|null|?new']);
});

test('G-09 G-10 G-11 convert and remove nodes and relations', async ({ page }) => {
	await addGraph(page, [
		{ kind: 'variable', id: '?s', x: 200, y: 250 },
		{ kind: 'value', id: '90', x: 500, y: 250 },
		{ kind: 'entity', id: '<https://e/o>', label: 'O', x: 350, y: 400 },
		{
			edge: 'speed',
			source: '?s',
			target: '90',
			predicate: '<https://e/speed>',
			label: 'speed'
		},
		{
			edge: 'rel',
			source: '?s',
			target: '<https://e/o>',
			predicate: '<https://e/p>',
			label: 'p'
		}
	]);
	await clickNode(page, '90');
	await expect(menu(page)).toHaveAttribute('data-node-id', '90');
	await menu(page).getByRole('button', { name: 'Convert to variable' }).click();
	const converted = await menu(page).getAttribute('data-node-id');
	expect(converted).toMatch(/^\?node_\d+$/);
	expect(await menuActions(page)).toEqual([
		'Edit filter',
		'Connect with variable predicate',
		'Connect with defined predicate',
		'Convert to variable',
		'Remove'
	]);
	await clickEdge(page, 'rel');
	await expect(edgeMenu(page)).toBeVisible();
	await expect(edgeMenu(page).getByRole('button', { name: 'Remove relation' })).toHaveClass(
		/text-danger/
	);
	await edgeMenu(page).getByRole('button', { name: 'Convert relation to variable' }).click();
	expect((await graphOf(page)).edges).toContain('rel|?s|?predicate_1|<https://e/o>');
	await clickEdge(page, 'rel');
	expect(await edgeMenu(page).locator('button').allTextContents()).toEqual(['Remove relation']);
	await edgeMenu(page).getByRole('button', { name: 'Remove relation' }).click();
	expect((await graphOf(page)).edges.map((edge) => edge.split('|')[0])).toEqual(['speed']);
	await clickNode(page, converted!);
	await menu(page).getByRole('button', { name: 'Remove' }).click();
	await expect(menu(page)).toBeHidden();
	expect((await graphOf(page)).edges).toEqual([]);
	await expect(page.locator('#status-nodes')).toHaveText('Nodes: 2');
});

test('View SPARQL shows the generated query and Copy reports the result', async ({ page }) => {
	await addGraph(page, [{ kind: 'variable', id: '?item', x: 300, y: 250 }]);
	await page.getByRole('button', { name: 'View SPARQL' }).click();
	await expect(page.locator('#sparql-content')).toHaveText(
		'SELECT DISTINCT ?item WHERE { ?item ?p ?o } LIMIT 20'
	);
	expect(bodies('/api/query/sparql')).toEqual([
		{ endpointUrl: 'CampeonatoBrasileiro2023', where: [], variableName: '?item', limit: 150 }
	]);
});

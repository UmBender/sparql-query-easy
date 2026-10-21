import { describe, expect, it } from 'vitest';
import { createTestStore } from '#lib/testing/store.js';
import { edgesOf, nodeById, nodesOf, saveQueryText, loadQuery } from '#lib/domain/index.js';

const PK = 'http://easyquery.example.org/pokemon#';
const iri = (local: string) => `<${PK}${local}>`;

describe('QueryStore actions', () => {
	it('builds the graph through domain operations with legacy ids', () => {
		const store = createTestStore();
		const pokemon = store.addVariable({ x: 100, y: 100 });
		expect(pokemon).toBe('?node_1760000000000');
		store.addEntity(iri('FireType'), 'Fire', { x: 300, y: 100 });
		store.connect(pokemon, iri('FireType'), iri('hasType'), 'has type');
		const speed = store.addValueFilterVariable(pokemon, iri('speed'), 'Speed');
		expect(speed).toBe('?value_1760000000001');
		expect(store.setValueVariableFilter(speed, '90', '2')).toEqual({});
		expect(nodesOf(store.graph).map((node) => node.kind)).toEqual([
			'variable',
			'entity',
			'valueVariable'
		]);
		expect(
			edgesOf(store.graph).map((edge) => [edge.source, edge.predicate, edge.target])
		).toEqual([
			[pokemon, iri('hasType'), iri('FireType')],
			[pokemon, iri('speed'), speed]
		]);
		expect(nodeById(store.graph, speed)).toMatchObject({
			filter: { code: 2, value: '90' },
			label: '? ≥ 90'
		});
		expect(store.setValueVariableFilter(speed, 'fast', '2')).toEqual({
			error: 'At least and At most need a number.'
		});
	});

	it('convert, toggle, filter edits and results-table choices keep the selection on the new node', () => {
		const store = createTestStore();
		const variable = store.addVariable();
		store.addRelationValue({
			id: 'true',
			text: 'true',
			valueType: 'text',
			sourceNodeId: variable,
			predicateId: iri('legendary'),
			predicateLabel: 'legendary'
		});
		store.select({ kind: 'node', id: 'true' });
		const toggled = store.toggleBoolean('true')!;
		expect(store.selection).toEqual({ kind: 'node', id: toggled });
		expect(nodeById(store.graph, toggled)!.label).toBe('false');
		const filtered = store.applyFilter(toggled, '40..80', '6');
		expect(store.selection).toEqual({ kind: 'node', id: filtered.id });
		expect(store.applyFilter(filtered.id!, '9..1', '6')).toEqual({
			error: expect.stringContaining('Between')
		});
		const converted = store.convertToVariable(filtered.id!)!;
		expect(nodeById(store.graph, converted)!.kind).toBe('valueVariable');
		store.select({ kind: 'node', id: variable });
		const refetch = store.chooseResult(variable, {
			id: iri('Mew'),
			label: 'Mew',
			propertyType: 'objeto'
		});
		expect(store.selection).toEqual({ kind: 'node', id: iri('Mew') });
		expect(refetch).toHaveLength(1);
		expect(store.chooseResult('missing', { id: 'x', label: 'x' })).toEqual([]);
		expect(store.toggleBoolean(iri('Mew'))).toBeNull();
		expect(store.convertToVariable('missing')).toBeNull();
	});

	it('removes nodes and relations, clears the selection of a removed element, and clears the graph', () => {
		const store = createTestStore();
		const a = store.addVariable();
		const b = store.addVariable();
		store.dragConnect(a, b);
		const edge = edgesOf(store.graph)[0];
		store.select({ kind: 'edge', id: edge.id });
		store.convertEdgeToVariable(edge.id);
		expect(edgesOf(store.graph)[0]).toMatchObject({
			predicate: '?predicate_1',
			variableMark: true
		});
		expect(store.nextPredicateVariable()).toBe('?predicate_2');
		store.removeEdge(edge.id);
		expect(store.selection).toBeNull();
		const fresh = store.dragToNewVariable(a, { x: 1, y: 1 });
		store.select({ kind: 'node', id: fresh });
		store.removeNode(fresh);
		expect(store.selection).toBeNull();
		store.clear();
		expect(store.graph.elements).toEqual([]);
	});

	it('saves and loads documents with endpoint, limit and stage order', () => {
		const store = createTestStore();
		store.setEndpoint('CampeonatoBrasileiro2023');
		store.setLimit(40);
		const a = store.addVariable();
		const b = store.addVariable();
		store.connect(a, b, '?p', '?');
		store.moveStage(0, 2);
		const text = saveQueryText(store.document);
		const other = createTestStore();
		const loaded = loadQuery(text);
		if (!('document' in loaded)) throw new Error(loaded.error.message);
		other.load(loaded.document);
		expect(other.endpoint).toEqual({ kind: 'builtIn', id: 'CampeonatoBrasileiro2023' });
		expect(other.limit).toBe(40);
		expect(other.order).toEqual(store.order);
		expect(other.graph).toEqual(store.graph);
	});
});

describe('QueryStore derived values', () => {
	it('context follows the endpoint and limit', () => {
		const store = createTestStore();
		expect(store.context).toMatchObject({
			endpointUrl: 'PokemonGen1',
			limit: 150
		});
		store.setEndpoint('https://query.wikidata.org/sparql');
		store.setLimit(0);
		expect(store.context).toMatchObject({
			endpointUrl: 'https://query.wikidata.org/sparql',
			limit: 20
		});
		expect(store.endpoint).toEqual({
			kind: 'remote',
			url: 'https://query.wikidata.org/sparql'
		});
		store.setEndpoint({ kind: 'uploaded', id: 'abc' });
		expect(store.context.endpointUrl).toBe('abc');
	});

	it('validation follows graph edits', () => {
		const store = createTestStore();
		expect(store.validation.map((error) => error.code)).toEqual(['empty']);
		store.addEntity('<a>', 'A');
		expect(store.validation.map((error) => error.code)).toEqual(['no-variable']);
		const variable = store.addVariable();
		// Only the group with a variable runs (BUG-004), so a fixed group beside it is fine.
		expect(store.validation).toEqual([]);
		const other = store.addVariable();
		expect(store.validation.map((error) => error.code)).toEqual(['separate-variable-groups']);
		store.connect(variable, '<a>', '<p>', 'p');
		store.connect(other, '<a>', '<q>', 'q');
		expect(store.validation).toEqual([]);
	});

	it('the stage order resets on signature changes and keeps a manual order otherwise', () => {
		const store = createTestStore();
		const a = store.addVariable();
		const b = store.addVariable();
		store.connect(a, b, '<p>', 'p');
		const version = store.signatureVersion;
		expect(store.order).toEqual([a, b]);
		expect(store.moveStage(0, 1)).toBe(true);
		expect(store.moveStage(0, 0)).toBe(false);
		expect(store.order).toEqual([b, a]);
		store.moveNode(a, { x: 5, y: 5 });
		expect(store.order).toEqual([b, a]);
		store.setEndpoint('CampeonatoBrasileiro2023');
		expect(store.order).toEqual([a, b]);
		expect(store.signatureVersion).toBe(version + 1);
		store.setPositions({ [a]: { x: 9, y: 9 } });
		expect(nodeById(store.graph, a)!.position).toEqual({ x: 9, y: 9 });
	});

	it('active filters, funnel steps and the selected node follow their edits', () => {
		const store = createTestStore({
			endpoint: { kind: 'builtIn', id: 'PokemonGen1' },
			limit: 150
		});
		const pokemon = store.addVariable();
		store.addEntity(iri('WaterType'), 'Water');
		store.connect(pokemon, iri('WaterType'), iri('hasType'), 'has type');
		expect(store.activeFilters).toEqual([]);
		const hp = store.addValueFilterVariable(pokemon, iri('hp'), 'hp');
		store.setValueVariableFilter(hp, '80', '2');
		expect(store.activeFilters).toEqual([
			{ nodeId: hp, filterType: 2, value: '80', variable: true }
		]);
		expect(store.funnelSteps.map((step) => [step.label, step.enabled])).toEqual([
			['has type = Water', true],
			['hp ≥ 80', true]
		]);
		const key = store.funnelSteps[1].key;
		store.setFunnelStep(key, false);
		expect(store.funnelSteps[1].enabled).toBe(false);
		expect(store.funnel.plan!.requests[2]).toBeNull();
		store.setFunnelVariable(hp);
		expect(store.funnel.plan!.variableName).toBe(hp);
		store.removeNode(hp);
		expect(store.funnelDisabled.has(key)).toBe(false);
		expect(store.selectedNode).toBeUndefined();
		store.select({ kind: 'node', id: pokemon });
		expect(store.selectedNode?.id).toBe(pokemon);
		store.applyChoices([
			{
				variableName: pokemon,
				term: { type: 'iri', value: `${PK}Squirtle` },
				label: 'Squirtle'
			}
		]);
		expect(nodeById(store.graph, iri('Squirtle'))).toBeDefined();
		expect(store.selectedNode).toBeUndefined();
	});
});

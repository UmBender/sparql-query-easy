import { describe, expect, it } from 'vitest';
import {
	addElements,
	BUILT_IN_ENDPOINTS,
	DEFAULT_ENDPOINT,
	emptyGraph,
	endpointFromText,
	endpointUrl,
	exploreValuesRequest,
	extractVariableName,
	funnelInput,
	initialVariableOrder,
	nodeFromData,
	nodeData,
	nodeQueryRequest,
	numericProfileRequestFor,
	presentFunnelSteps,
	refreshVariableOrder,
	relationshipsRequest,
	runQueryDecision,
	searchProbeRequests,
	sparqlRequest,
	textSuggestionRequestFor,
	toggleFunnelStep,
	wantedFilterBadges,
	defaultFunnelVariable,
	componentOf,
	components,
	valueVariableNodeLabel,
	type QueryContext
} from './index.js';

const context: QueryContext = { endpointUrl: 'PokemonGen1', limit: 20, now: () => 7 };
const two = addElements(emptyGraph, [
	{ kind: 'entity', id: '<a>', value: '<a>', label: 'A' },
	{ kind: 'variable', id: '?x', name: '?x', label: '?' },
	{ kind: 'entity', id: '<b>', value: '<b>', label: 'B' },
	{ id: 'e1', source: '?x', target: '<a>', predicate: null, label: '?' }
]);

describe('query mapping', () => {
	it('explains why View SPARQL and Run Query cannot run', () => {
		expect(sparqlRequest(emptyGraph, context)).toEqual({
			message: 'Add at least one node to preview the query.'
		});
		const separate = addElements(emptyGraph, [
			{ kind: 'variable', id: '?a', name: '?a', label: '?' },
			{ kind: 'variable', id: '?b', name: '?b', label: '?' }
		]);
		expect(sparqlRequest(separate, context)).toHaveProperty('message');
		expect(runQueryDecision(separate, [], context)).toMatchObject({ kind: 'error' });
		expect(runQueryDecision(emptyGraph, [], context)).toEqual({
			kind: 'error',
			message: 'Add at least one node before running the query.'
		});
		const parallel = addElements(emptyGraph, [
			{ kind: 'entity', id: '<a>', value: '<a>', label: 'a' },
			{ kind: 'entity', id: '<b>', value: '<b>', label: 'b' },
			{ id: 'p', source: '<a>', target: '<b>', predicate: '?p', label: '?' },
			{ id: 'q', source: '<a>', target: '<b>', predicate: '?q', label: '?' }
		]);
		expect(runQueryDecision(parallel, ['?p', '?q'], context)).toMatchObject({ kind: 'error' });
		const fixed = addElements(emptyGraph, [
			{ kind: 'entity', id: '<a>', value: '<a>', label: 'a' }
		]);
		expect(runQueryDecision(fixed, [], context)).toEqual({
			kind: 'error',
			message: 'Add at least one variable (?) node before running.'
		});
	});

	it('a relation without predicate uses a fresh ?empty_ variable; the last variable names the query', () => {
		const result = sparqlRequest(two, context);
		expect(result).toEqual({
			request: {
				endpointUrl: 'PokemonGen1',
				where: [{ subject: '?x', predicate: '?empty_7', object: '<a>', filterType: null }],
				variableName: '?x',
				limit: 20
			}
		});
		expect(runQueryDecision(two, [], context)).toMatchObject({
			kind: 'legacy',
			request: { variableName: '?x' }
		});
		expect(extractVariableName(componentOf(two, '?x'))).toBe('?x');
		expect(components(two).map((items) => items.map((item) => item.id))).toEqual([
			['<a>', '?x', 'e1'],
			['<b>']
		]);
	});

	it('node Run query uses predicate edges when the variable is a predicate', () => {
		const graph = addElements(emptyGraph, [
			{ kind: 'entity', id: '<a>', value: '<a>', label: 'A' },
			{ kind: 'entity', id: '<b>', value: '<b>', label: 'B' },
			{ kind: 'variable', id: '?p', name: '?p', label: '?' },
			{ id: 'rel', source: '<a>', target: '<b>', predicate: '?p', label: '?' }
		]);
		expect(nodeQueryRequest(graph, '?p', context)).toMatchObject({
			method: 'replacePredicateVariable',
			predicateEdgeIds: ['rel']
		});
		expect(nodeQueryRequest(graph, 'missing', context)).toBeNull();
	});

	it('explore values, relationships and search probes', () => {
		const klass = nodeFromData({
			id: 'k',
			value: '<https://e/Type>',
			label: 'Type',
			type: 'default'
		});
		expect(exploreValuesRequest(klass, context, 5)).toEqual({
			endpointUrl: 'PokemonGen1',
			where: [
				{
					subject: '?default_5',
					predicate: '<http://www.w3.org/2000/01/rdf-schema#domain>',
					object: '<https://e/Type>'
				}
			],
			variableName: '?default_5',
			limit: 20
		});
		expect(relationshipsRequest(two, '<a>', context, { withLimit: true })).toEqual({
			endpointUrl: 'PokemonGen1',
			id: '<a>',
			limit: 20
		});
		expect(relationshipsRequest(two, 'missing', context, { withLimit: false })).toEqual({
			endpointUrl: 'PokemonGen1',
			id: 'missing'
		});
		const probes = searchProbeRequests(two, '<new>', context);
		expect(
			probes.map((probe) => [probe.existingId, probe.invert, probe.request.where[0]])
		).toEqual([
			['<a>', false, { subject: '<new>', predicate: '?predicate', object: '<a>' }],
			['<a>', true, { subject: '<a>', predicate: '?predicate', object: '<new>' }],
			['<b>', false, { subject: '<new>', predicate: '?predicate', object: '<b>' }],
			['<b>', true, { subject: '<b>', predicate: '?predicate', object: '<new>' }]
		]);
		expect(probes[0].request).toMatchObject({
			variableName: '?predicate',
			limit: 1,
			ignoreWikidata: false
		});
		expect(numericProfileRequestFor(two, 'missing', context)).toBeNull();
		expect(textSuggestionRequestFor(two, 'missing', 'x', true, context)).toBeNull();
	});

	it('the stage order resets only when the signature changes', () => {
		const first = refreshVariableOrder(initialVariableOrder, two, 'PokemonGen1');
		expect(first).toMatchObject({ changed: true, state: { order: ['?x'] } });
		const reordered = { ...first.state, order: ['custom'] };
		expect(refreshVariableOrder(reordered, two, 'PokemonGen1')).toMatchObject({
			changed: false,
			state: { order: ['custom'] }
		});
		expect(refreshVariableOrder(reordered, two, 'Other')).toMatchObject({
			changed: true,
			state: { order: ['?x'] }
		});
	});

	it('funnel input messages, default variable and toggles', () => {
		expect(funnelInput(emptyGraph, { order: [], variable: null }, context)).toHaveProperty(
			'message'
		);
		const noVariable = addElements(emptyGraph, [
			{ kind: 'entity', id: '<a>', value: '<a>', label: 'A' },
			{ kind: 'entity', id: '<b>', value: '<b>', label: 'B' },
			{ id: 'r', source: '<a>', target: '<b>', predicate: '<p>', label: 'p' }
		]);
		expect(funnelInput(noVariable, { order: [], variable: null }, context)).toEqual({
			message: 'Add at least one variable (?) node to count results.'
		});
		const funnel = funnelInput(two, { order: [], variable: 'unknown' }, context);
		expect(funnel.plan?.variableName).toBe('?x');
		const graph = addElements(emptyGraph, [
			{ kind: 'valueVariable', id: '?v', name: '?v', label: '?', filter: null },
			{ kind: 'variable', id: '?x', name: '?x', label: '?' }
		]);
		expect(defaultFunnelVariable(graph, ['?v', '?x'])).toBe('?x');
		expect(defaultFunnelVariable(graph, ['?v'])).toBe('?v');
		const disabled = toggleFunnelStep(new Set(), 'a', false);
		expect([...disabled]).toEqual(['a']);
		expect([...toggleFunnelStep(disabled, 'a', true)]).toEqual([]);
		expect([
			...presentFunnelSteps(
				{
					variableName: '?x',
					steps: [{ key: 'a', index: 0, counted: true, extreme: false }],
					extremes: 0,
					requests: []
				},
				['a', 'gone']
			)
		]).toEqual(['a']);
		expect(wantedFilterBadges(emptyGraph, [], null, context).size).toBe(0);
	});

	it('typed nodes convert to legacy data and back for every kind', () => {
		const samples = [
			{ id: '<a>', value: '<a>', label: 'A', type: 'node' },
			{
				id: '<a.png>',
				value: '<a.png>',
				label: 'View image',
				type: 'node',
				isLink: true,
				href: 'a.png'
			},
			{ id: 'k', value: '<K>', label: 'K', type: 'default' },
			{ id: '?n', value: '?n', label: '3 results', type: 'variable', color: 'gray' },
			{
				id: '?v',
				value: '?v',
				label: '? ≥ 90',
				type: 'value-variable',
				filterType: 2,
				filterValue: '90'
			},
			{
				id: '?w',
				value: '?w',
				label: '?',
				type: 'value-variable',
				filterType: null,
				filterValue: ''
			},
			{ id: '90', value: '90', label: '≥ 90', type: 'label', filterType: 2 },
			{ id: 'old', value: 'x', label: 'x', type: 'label-filter' },
			{
				id: 'img',
				value: 'img',
				label: 'View image',
				type: 'label',
				isLink: true,
				href: 'img'
			}
		];
		for (const data of samples) expect(nodeData(nodeFromData(data))).toEqual(data);
		expect(valueVariableNodeLabel({ code: 6, value: '1..2' })).toBe('? in 1–2');
	});

	it('endpoints map to the endpointUrl field', () => {
		expect(endpointUrl(DEFAULT_ENDPOINT)).toBe('PokemonGen1');
		expect(endpointUrl({ kind: 'remote', url: 'https://query.wikidata.org/sparql' })).toBe(
			'https://query.wikidata.org/sparql'
		);
		expect(endpointFromText(' PokemonGen1 ')).toEqual({ kind: 'builtIn', id: 'PokemonGen1' });
		expect(endpointFromText('https://example.test/sparql')).toEqual({
			kind: 'remote',
			url: 'https://example.test/sparql'
		});
		expect(endpointFromText('graph-123')).toEqual({ kind: 'uploaded', id: 'graph-123' });
		expect(BUILT_IN_ENDPOINTS.map((item) => item.id)).toContain('PokemonGen1');
	});
});

import { describe, expect, it } from 'vitest';
import {
	addElements,
	addEntity,
	addRelationValue,
	addValueFilterVariable,
	addValueVariable,
	addVariable,
	applyChoices,
	bindPredicateEdges,
	bindVariable,
	chooseResult,
	clearGraph,
	connectNodes,
	convertEdgeToVariable,
	convertToVariable,
	dragConnect,
	dragToNewVariable,
	edgeById,
	edgesOf,
	elementData,
	emptyGraph,
	hasVariableSource,
	moveNode,
	nextPredicateVariable,
	nodeById,
	nodeData,
	nodeForTerm,
	nodesOf,
	removeEdge,
	removeNode,
	setPositions,
	setValueNodeFilter,
	setValueVariableFilter,
	toggleBoolean,
	BETWEEN_ERROR,
	NUMBER_ERROR,
	type QueryGraph,
	type QueryNode
} from './index.js';
import { nodeActions } from './legacy/graph-actions.js';
import { buildFilters } from './legacy/query-calculations.js';
import { filterEdgeItems } from './query.js';

const kpk = 'https://example.test/';
const kindIri = (name: string) => `<${kpk}${name}>`;
const NOW = 1_760_000_000_000;
const sortJson = (items: unknown[]) => items.map((item) => JSON.stringify(item)).sort();
const allFilters = (graph: QueryGraph) =>
	sortJson(buildFilters(filterEdgeItems(graph, graph.elements.slice())));
const kindFilter = (
	subject: string,
	predicate: string,
	object: string,
	filterType: number | null = null
) => ({
	subject,
	predicate: kindIri(predicate),
	object,
	filterType
});

/** The QUAL-005 node-kind graph (index2.spec.mjs addNodeKindGraph) built with domain operations. */
function nodeKindGraph({ valueVariable = false } = {}) {
	let graph = addElements(emptyGraph, [
		{ kind: 'variable', id: '?mon', name: '?mon', label: '?' }
	]);
	const relation = (id: string, text: string, type: string, predicate: string) =>
		(graph = addRelationValue(graph, {
			id,
			text,
			valueType: type,
			sourceNodeId: '?mon',
			predicateId: kindIri(predicate),
			predicateLabel: predicate
		}));
	relation(kindIri('Electric'), 'Electric', 'node', 'type');
	relation('Pikachu', 'Pikachu', 'text', 'name');
	relation('true', 'true', 'text', 'legendary');
	relation('90', '90', 'text', 'speed');
	const filtered = setValueNodeFilter(graph, '90', '90', '2', NOW);
	graph = filtered.graph!;
	relation(`${kpk}pikachu.png`, `${kpk}pikachu.png`, 'text', 'image');
	relation('?node_moves', '3 results', 'many-results', 'move');
	graph = addElements(graph, [
		{ kind: 'variable', id: '?class', name: '?class', label: '?' },
		{
			id: 'instance-of',
			source: '?mon',
			target: '?class',
			predicate: kindIri('instanceOf'),
			label: 'instance of'
		}
	]);
	graph = chooseResult(graph, '?class', {
		id: kindIri('Pokemon'),
		label: 'Pokémon',
		propertyType: 'default',
		propertyClass: kindIri('Pokemon')
	}).graph;
	graph = addElements(graph, [
		{ kind: 'entity', id: kindIri('Mew'), value: kindIri('Mew'), label: 'Mew' }
	]);
	graph = addRelationValue(graph, {
		id: 'Mew',
		text: 'Mew',
		valueType: 'text',
		sourceNodeId: kindIri('Mew'),
		predicateId: kindIri('name'),
		predicateLabel: 'name'
	});
	const ids: Record<string, string> = {
		variable: '?mon',
		results: '?node_moves',
		iri: kindIri('Electric'),
		class: kindIri('Pokemon'),
		literal: 'Pikachu',
		boolean: 'true',
		filtered: filtered.id!,
		link: `${kpk}pikachu.png`,
		fixedValue: 'Mew'
	};
	if (valueVariable) {
		const added = addValueFilterVariable(graph, '?mon', kindIri('hp'), 'hp', NOW);
		graph = setValueVariableFilter(added.graph, added.id, '100', '2').graph!;
		ids.valueVariable = added.id;
	}
	return { graph, ids };
}

const COMMON = [
	'Connect with variable predicate',
	'Connect with defined predicate',
	'Convert to variable',
	'Remove'
];
const VARIABLE_ACTIONS = ['Run query', 'Add value filter', ...COMMON];
const NODE_KINDS: [string, string[]][] = [
	['variable', VARIABLE_ACTIONS],
	['results', VARIABLE_ACTIONS],
	['iri', ['Explore relationships', ...COMMON]],
	['class', ['Explore values', ...COMMON]],
	['literal', ['Edit value', ...COMMON]],
	['boolean', ['Toggle Boolean value', 'Edit value', ...COMMON]],
	['filtered', ['Edit value', ...COMMON]],
	['link', ['Open link', 'Edit value', ...COMMON]],
	['fixedValue', COMMON],
	['valueVariable', ['Edit filter', ...COMMON]]
];
const LITERAL_KINDS = new Set(['literal', 'boolean', 'filtered', 'link', 'fixedValue']);

describe('the QUAL-005 node-kind graph', () => {
	it('sends one filter per relation, like the legacy page', () => {
		const { graph } = nodeKindGraph();
		expect(allFilters(graph)).toEqual(
			sortJson([
				kindFilter('?mon', 'type', kindIri('Electric')),
				kindFilter('?mon', 'name', 'Pikachu'),
				kindFilter('?mon', 'legendary', 'true'),
				kindFilter('?mon', 'speed', '90', 2),
				kindFilter('?mon', 'image', `${kpk}pikachu.png`),
				kindFilter('?mon', 'move', '?node_moves'),
				kindFilter('?mon', 'instanceOf', kindIri('Pokemon')),
				kindFilter(kindIri('Mew'), 'name', 'Mew')
			])
		);
	});

	it('each node kind offers exactly its legacy actions', () => {
		const { graph, ids } = nodeKindGraph({ valueVariable: true });
		for (const [key, actions] of NODE_KINDS) {
			const node = nodeById(graph, ids[key])!;
			expect(
				nodeActions(nodeData(node), hasVariableSource(graph, node.id)).map(
					(action) => action.label
				),
				key
			).toEqual(actions);
		}
	});

	it('Convert to variable gives a value variable for literals and a plain variable otherwise, keeping relations', () => {
		for (const [key] of NODE_KINDS) {
			const { graph, ids } = nodeKindGraph({ valueVariable: key === 'valueVariable' });
			const oldId = ids[key];
			const oldValue = nodeData(nodeById(graph, oldId)!).value;
			const edgesBefore = edgesOf(graph).map((edge) =>
				[edge.id, edge.source, edge.predicate, edge.target].join('|')
			);
			const filtersBefore = buildFilters(filterEdgeItems(graph, graph.elements.slice()));
			const converted = convertToVariable(graph, oldId, NOW + 1)!;
			const node = nodeById(converted.graph, converted.id)!;
			expect(converted.id).toBe(`?node_${NOW + 1}`);
			expect(nodeById(converted.graph, oldId)).toBeUndefined();
			expect(nodeData(node)).toMatchObject({
				type: LITERAL_KINDS.has(key) ? 'value-variable' : 'variable',
				value: converted.id,
				label: '?'
			});
			expect(
				edgesOf(converted.graph)
					.map((edge) => [edge.id, edge.source, edge.predicate, edge.target].join('|'))
					.sort()
			).toEqual(
				edgesBefore
					.map((item) =>
						item
							.split('|')
							.map((part, index) =>
								index !== 2 && part === oldId ? converted.id : part
							)
							.join('|')
					)
					.sort()
			);
			expect(allFilters(converted.graph)).toEqual(
				sortJson(
					filtersBefore.map((filter) => ({
						...filter,
						subject: filter.subject === oldValue ? converted.id : filter.subject,
						object: filter.object === oldValue ? converted.id : filter.object,
						filterType: filter.object === oldValue ? null : filter.filterType
					}))
				)
			);
		}
		expect(convertToVariable(emptyGraph, 'missing', NOW)).toBeNull();
	});

	it('Remove deletes only the chosen node and its relations', () => {
		const { graph, ids } = nodeKindGraph({ valueVariable: true });
		for (const [key] of NODE_KINDS) {
			const id = ids[key];
			const next = removeNode(graph, id);
			expect(
				nodesOf(next)
					.map((node) => node.id)
					.sort()
			).toEqual(
				nodesOf(graph)
					.map((node) => node.id)
					.filter((other) => other !== id)
					.sort()
			);
			expect(edgesOf(next).every((edge) => edge.source !== id && edge.target !== id)).toBe(
				true
			);
			expect(edgesOf(next).length).toBe(
				edgesOf(graph).filter((edge) => edge.source !== id && edge.target !== id).length
			);
		}
	});
});

// Port of frontend-tests/graph-binding.unit.mjs onto the typed graph (same scenarios and expectations).
const PIKACHU = '<https://e/Pikachu>';
const pikachu = nodeForTerm({ type: 'iri', value: 'https://e/Pikachu' }, 'Pikachu');
const node = (id: string, kind: 'variable' | 'entity' | 'value', label = id): QueryNode =>
	kind === 'variable'
		? { kind, id, name: id, label, position: { x: 10, y: 20 } }
		: kind === 'entity'
			? { kind, id, value: id, label, position: { x: 10, y: 20 } }
			: {
					kind,
					id,
					term: { type: 'literal', value: id },
					filter: null,
					label,
					position: { x: 10, y: 20 }
				};
const ends = (graph: QueryGraph, id: string) => {
	const { source, target } = edgeById(graph, id)!;
	return [source, target];
};

describe('binding a variable (graph-binding.unit.mjs)', () => {
	it('a new value replaces the variable at its position, edges keep their ids and data', () => {
		const graph = addElements(emptyGraph, [
			node('?x', 'variable'),
			node('<https://e/Ash>', 'entity'),
			{
				id: 'in',
				source: '<https://e/Ash>',
				target: '?x',
				predicate: '<https://e/owns>',
				label: 'owns'
			}
		]);
		const result = bindVariable(graph, '?x', pikachu);
		expect(result.bound).toBe(true);
		expect(nodeById(result.graph, '?x')).toBeUndefined();
		expect(nodeData(nodeById(result.graph, PIKACHU)!)).toEqual({
			id: PIKACHU,
			value: PIKACHU,
			label: 'Pikachu',
			type: 'node'
		});
		expect(nodeById(result.graph, PIKACHU)!.position).toEqual({ x: 10, y: 20 });
		expect(ends(result.graph, 'in')).toEqual(['<https://e/Ash>', PIKACHU]);
		expect(edgeById(result.graph, 'in')!.predicate).toBe('<https://e/owns>');
	});

	it('a value already in the graph is reused (BUG-003, cycle)', () => {
		const graph = addElements(emptyGraph, [
			node(PIKACHU, 'entity', 'Old label'),
			node('?x', 'variable'),
			{
				id: 'evolves',
				source: PIKACHU,
				target: '?x',
				predicate: '<https://e/evolves>',
				label: 'evolves'
			}
		]);
		const { graph: next } = bindVariable(graph, '?x', pikachu);
		expect(nodesOf(next)).toHaveLength(1);
		expect(nodeById(next, PIKACHU)!.label).toBe('Old label');
		expect(ends(next, 'evolves')).toEqual([PIKACHU, PIKACHU]);
	});

	it('a self-loop on the variable stays a self-loop on the value', () => {
		const graph = addElements(emptyGraph, [
			node('?x', 'variable'),
			{ id: 'loop', source: '?x', target: '?x', predicate: '?p', label: '?' }
		]);
		const result = bindVariable(graph, '?x', pikachu, { refetch: true });
		expect(ends(result.graph, 'loop')).toEqual([PIKACHU, PIKACHU]);
		expect(result.refetch).toEqual([]);
	});

	it('a missing variable or the value itself changes nothing', () => {
		const graph = addElements(emptyGraph, [node(PIKACHU, 'entity')]);
		expect(bindVariable(graph, '?gone', pikachu)).toEqual({ graph, bound: false, refetch: [] });
		expect(bindVariable(graph, PIKACHU, pikachu).bound).toBe(false);
	});

	const withNeighbours = () =>
		addElements(emptyGraph, [
			node('?x', 'variable'),
			node('<https://e/Kanto>', 'entity'),
			node('Rio', 'value'),
			node('?y', 'variable'),
			node('<https://e/Ash>', 'entity'),
			{
				id: 'region',
				source: '?x',
				target: '<https://e/Kanto>',
				predicate: '<https://e/region>',
				label: 'region'
			},
			{
				id: 'name',
				source: '?x',
				target: 'Rio',
				predicate: '<https://e/name>',
				label: 'name'
			},
			{
				id: 'friend',
				source: '?x',
				target: '?y',
				predicate: '<https://e/friend>',
				label: 'friend'
			},
			{
				id: 'owns',
				source: '<https://e/Ash>',
				target: '?x',
				predicate: '<https://e/owns>',
				label: 'owns'
			}
		]);

	it('Assume/Apply keep every neighbour', () => {
		const { graph } = bindVariable(withNeighbours(), '?x', pikachu);
		expect(nodesOf(graph)).toHaveLength(5);
		for (const id of ['region', 'name', 'friend']) expect(ends(graph, id)[0]).toBe(PIKACHU);
		expect(ends(graph, 'owns')).toEqual(['<https://e/Ash>', PIKACHU]);
	});

	it('the results table refetches each outgoing target, IRIs as IRIs (BUG-006)', () => {
		const result = chooseResult(withNeighbours(), '?x', {
			id: PIKACHU,
			label: 'Pikachu',
			propertyType: 'object'
		});
		for (const id of ['<https://e/Kanto>', 'Rio', '?y', 'region', 'name', 'friend']) {
			expect(
				result.graph.elements.some((element) => element.id === id),
				id
			).toBe(false);
		}
		expect(ends(result.graph, 'owns')).toEqual(['<https://e/Ash>', PIKACHU]);
		expect(result.refetch).toEqual([
			{
				targetId: '<https://e/Kanto>',
				predicateId: '<https://e/region>',
				predicateLabel: 'region',
				targetIsIri: true
			},
			{
				targetId: 'Rio',
				predicateId: '<https://e/name>',
				predicateLabel: 'name',
				targetIsIri: false
			},
			{
				targetId: '?y',
				predicateId: '<https://e/friend>',
				predicateLabel: 'friend',
				targetIsIri: false
			}
		]);
	});

	it('predicate-variable edges are bound in place and lose the variable mark', () => {
		const graph = addElements(emptyGraph, [
			node('a', 'entity'),
			node('b', 'entity'),
			{ id: 'e1', source: 'a', target: 'b', predicate: '?p', label: '?', variableMark: true },
			{ id: 'e2', source: 'b', target: 'a', predicate: '?q', label: '?', variableMark: true }
		]);
		const next = bindPredicateEdges(
			graph,
			['e1', 'e2', 'a', 'missing'],
			'?p',
			'<https://e/owns>',
			'owns'
		);
		expect(edgeById(next, 'e1')).toEqual({
			kind: 'relation',
			id: 'e1',
			source: 'a',
			target: 'b',
			predicate: '<https://e/owns>',
			label: 'owns'
		});
		expect(edgeById(next, 'e2')).toMatchObject({ predicate: '?q', variableMark: true });
		expect(nodeById(next, 'a')).toEqual(nodeById(graph, 'a'));
	});

	it('a settled value variable becomes a plain value node without its filter (FE-034)', () => {
		const graph = addElements(emptyGraph, [
			node('?mon', 'variable'),
			{
				kind: 'valueVariable',
				id: '?hp',
				name: '?hp',
				label: '? ≥ 90',
				filter: { code: 2, value: '90' },
				position: { x: 10, y: 20 }
			},
			{ id: 'hp', source: '?mon', target: '?hp', predicate: '<https://e/hp>', label: 'HP' }
		]);
		const value = nodeForTerm(
			{ type: 'literal', value: '160', datatype: 'http://www.w3.org/2001/XMLSchema#integer' },
			'160'
		);
		const result = bindVariable(graph, '?hp', value);
		expect(result.bound).toBe(true);
		expect(nodeById(result.graph, '?hp')).toBeUndefined();
		expect(nodeData(nodeById(result.graph, '160')!)).toEqual({
			id: '160',
			value: '160',
			label: '160',
			type: 'label'
		});
		expect(ends(result.graph, 'hp')).toEqual(['?mon', '160']);
	});
});

describe('other edits', () => {
	it('adds variables, value variables and entities with the legacy ids and data', () => {
		const variable = addVariable(emptyGraph, NOW, { x: 1, y: 2 });
		const { id } = variable;
		expect(id).toBe(`?node_${NOW}`);
		expect(nodeById(variable.graph, id)).toEqual({
			kind: 'variable',
			id,
			name: id,
			label: '?',
			position: { x: 1, y: 2 }
		});
		let { graph } = addValueVariable(variable.graph, NOW);
		expect(elementData(nodeById(graph, `?value_${NOW}`)!)).toEqual({
			id: `?value_${NOW}`,
			value: `?value_${NOW}`,
			label: '?',
			type: 'value-variable',
			filterType: null,
			filterValue: ''
		});
		graph = addEntity(graph, '<https://e/a>', 'A');
		expect(nodeById(graph, '<https://e/a>')).toMatchObject({
			kind: 'entity',
			position: { x: 200, y: 200 }
		});
		expect(clearGraph()).toEqual(emptyGraph);
		expect(() => addEntity(graph, '<https://e/a>', 'again')).toThrow(/Duplicate/);
	});

	it('relationship values: many results, image links, inverse subject and free edge ids', () => {
		let graph = addElements(emptyGraph, [node('<https://e/a>', 'entity')]);
		graph = addRelationValue(graph, {
			id: '?node_9',
			text: '3 results',
			valueType: 'many-results',
			sourceNodeId: '<https://e/a>',
			predicateId: '<https://e/p>',
			predicateLabel: 'p'
		});
		graph = addRelationValue(graph, {
			id: 'https://e/x.png',
			text: 'https://e/x.png',
			valueType: 'text',
			sourceNodeId: '<https://e/a>',
			predicateId: '<https://e/img>',
			predicateLabel: 'image'
		});
		graph = addRelationValue(graph, {
			id: '<https://e/b>',
			text: 'B',
			valueType: 'node',
			sourceNodeId: '<https://e/a>',
			predicateId: '<https://e/p>',
			predicateLabel: 'p',
			subject: '<https://e/b>'
		});
		expect(nodeData(nodeById(graph, '?node_9')!)).toMatchObject({
			type: 'variable',
			color: 'gray',
			label: '3 results'
		});
		expect(nodeData(nodeById(graph, 'https://e/x.png')!)).toMatchObject({
			type: 'label',
			isLink: true,
			href: 'https://e/x.png',
			label: 'View image'
		});
		expect(edgesOf(graph).map((edge) => [edge.id, edge.source, edge.target])).toEqual([
			['<https://e/p>0', '<https://e/a>', '?node_9'],
			['<https://e/img>0', '<https://e/a>', 'https://e/x.png'],
			['<https://e/p>0_1', '<https://e/b>', '<https://e/a>']
		]);
	});

	it('connections, Alt+drag, predicate variables and relation conversion', () => {
		let graph = addElements(emptyGraph, [node('a', 'entity'), node('b', 'entity')]);
		graph = connectNodes(graph, 'a', 'b', '?predicate_1', '?');
		graph = connectNodes(graph, 'a', 'b', '<https://e/p>', 'p');
		graph = dragConnect(graph, 'b', 'a');
		const dragged = dragToNewVariable(graph, 'a', { x: 5, y: 6 }, NOW);
		graph = dragged.graph;
		const [first, second, third, fourth] = edgesOf(graph);
		expect(first).toMatchObject({ predicate: '?predicate_1', variableMark: true });
		expect(second.variableMark).toBeUndefined();
		expect(third).toMatchObject({
			predicate: null,
			label: '?',
			variableMark: true,
			source: 'b',
			target: 'a'
		});
		expect(fourth).toMatchObject({ id: '?edge-4', target: `?node_${NOW}`, variableMark: true });
		expect(nextPredicateVariable(graph, 1)).toEqual({ name: '?predicate_2', sequence: 3 });
		graph = convertEdgeToVariable(graph, second.id, '?predicate_2');
		expect(edgeById(graph, second.id)).toMatchObject({
			predicate: '?predicate_2',
			label: '?',
			variableMark: true
		});
		graph = removeEdge(graph, second.id);
		expect(edgeById(graph, second.id)).toBeUndefined();
		expect(nodesOf(graph)).toHaveLength(3);
		expect(connectNodes(graph, 'a', 'missing', '<https://e/p>', 'p')).toEqual(graph);
	});

	it('Toggle Boolean value and value edits need a variable source', () => {
		let graph = addElements(emptyGraph, [
			node('?s', 'variable'),
			node('true', 'value'),
			node('<https://e/x>', 'entity'),
			{
				id: 'flag',
				source: '?s',
				target: 'true',
				predicate: '<https://e/flag>',
				label: 'flag'
			}
		]);
		expect(hasVariableSource(graph, 'true')).toBe(true);
		expect(hasVariableSource(graph, '<https://e/x>')).toBe(false);
		const toggled = toggleBoolean(graph, 'true', NOW)!;
		graph = toggled.graph;
		expect(nodeData(nodeById(graph, `node_${NOW}`)!)).toMatchObject({
			label: 'false',
			value: 'false',
			type: 'label'
		});
		expect(edgeById(graph, 'flag')!.target).toBe(`node_${NOW}`);
		expect(toggleBoolean(graph, '<https://e/x>', NOW)).toBeNull();
	});

	it('filter edits validate between and numbers; any value clears a value variable', () => {
		let graph = addElements(emptyGraph, [
			node('?s', 'variable'),
			node('50', 'value'),
			{ kind: 'valueVariable', id: '?v', name: '?v', label: '?', filter: null },
			{ id: 'p', source: '?s', target: '50', predicate: '<https://e/p>', label: 'p' },
			{ id: 'q', source: '?s', target: '?v', predicate: '<https://e/q>', label: 'q' }
		]);
		expect(setValueNodeFilter(graph, '50', '80..40', '6', NOW)).toEqual({
			error: BETWEEN_ERROR
		});
		expect(setValueNodeFilter(graph, 'missing', '1', null, NOW).error).toBeTruthy();
		expect(setValueVariableFilter(graph, '?v', '1..x', '6')).toEqual({ error: BETWEEN_ERROR });
		expect(setValueVariableFilter(graph, '?v', 'ten', '2')).toEqual({ error: NUMBER_ERROR });
		graph = setValueNodeFilter(graph, '?v', ' 40..80 ', '6', NOW).graph!;
		expect(nodeById(graph, '?v')).toMatchObject({
			filter: { code: 6, value: '40..80' },
			label: '? in 40–80'
		});
		graph = setValueVariableFilter(graph, '?v', 'Rio', '').graph!;
		expect(nodeById(graph, '?v')).toMatchObject({
			filter: { code: null, value: 'Rio' },
			label: '? = Rio'
		});
		graph = setValueVariableFilter(graph, '?v', 'ignored', 'any').graph!;
		expect(nodeById(graph, '?v')).toMatchObject({ filter: null, label: '?' });
		const exact = setValueNodeFilter(graph, '50', '42', '', NOW)!;
		expect(nodeData(nodeById(exact.graph!, `node_${NOW}`)!)).toEqual({
			id: `node_${NOW}`,
			value: '42',
			label: '42',
			type: 'label'
		});
	});

	it('Apply binds predicate variables to IRIs only and every node of a variable', () => {
		const graph = addElements(emptyGraph, [
			node('?s', 'variable'),
			node('?o', 'variable'),
			{
				id: 'rel',
				source: '?s',
				target: '?o',
				predicate: '?p',
				label: '?',
				variableMark: true
			}
		]);
		const registry = [
			{ name: '?o', nodeIds: ['?o'], edgeIds: [] },
			{ name: '?p', nodeIds: [], edgeIds: ['rel'] },
			{ name: '?s', nodeIds: ['?s'], edgeIds: [] }
		];
		const next = applyChoices(graph, registry, [
			{ variableName: '?p', term: { type: 'iri', value: 'https://e/p' }, label: 'p' },
			{
				variableName: '?o',
				term: {
					type: 'literal',
					value: '7',
					datatype: 'http://www.w3.org/2001/XMLSchema#integer'
				},
				label: '7'
			},
			{ variableName: '?missing', term: { type: 'iri', value: 'https://e/x' }, label: 'x' }
		]);
		expect(edgeById(next, 'rel')).toEqual({
			kind: 'relation',
			id: 'rel',
			source: '?s',
			target: '7',
			predicate: '<https://e/p>',
			label: 'p'
		});
		expect(nodeById(next, '7')).toMatchObject({
			kind: 'value',
			term: { datatype: 'http://www.w3.org/2001/XMLSchema#integer' }
		});
	});

	it('moves nodes and applies layout positions without changing order', () => {
		let graph = addElements(emptyGraph, [
			node('a', 'entity'),
			node('b', 'entity'),
			{ id: 'e', source: 'a', target: 'b', predicate: null, label: '?' }
		]);
		graph = moveNode(graph, 'a', { x: 9, y: 9 });
		graph = setPositions(graph, { b: { x: 1, y: 1 }, e: { x: 3, y: 3 } });
		expect(nodesOf(graph).map((item) => item.position)).toEqual([
			{ x: 9, y: 9 },
			{ x: 1, y: 1 }
		]);
		expect(graph.elements.map((element) => element.id)).toEqual(['a', 'b', 'e']);
	});
});

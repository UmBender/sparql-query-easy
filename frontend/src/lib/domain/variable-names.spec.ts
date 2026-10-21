import { describe, expect, it } from 'vitest';
import {
	addElements,
	emptyGraph,
	variableLabel,
	variableNames,
	type NewEdge,
	type QueryGraph,
	type QueryNode
} from './index.js';

const variable = (name: string): QueryNode => ({ kind: 'variable', id: name, name, label: '?' });
const valueVariable = (name: string): QueryNode => ({
	kind: 'valueVariable',
	id: name,
	name,
	label: '?',
	filter: null
});
const entity = (id: string, label: string): QueryNode => ({
	kind: 'entity',
	id,
	value: id,
	label
});
const klass = (id: string, label: string): QueryNode => ({ kind: 'class', id, value: id, label });
const edge = (
	source: string,
	target: string,
	predicate: string | null,
	label: string
): NewEdge => ({
	source,
	target,
	predicate,
	label
});
const labels = (graph: QueryGraph) =>
	Object.fromEntries([...variableNames(graph)].map(([name, { label }]) => [name, label]));

const POKEMON = '<https://e/Pokemon>';
const FIRE = '<https://e/Fire>';

describe('variableNames (FE-056)', () => {
	it('keeps a given name, then takes the class, then the relation that leads to the variable', () => {
		const graph = addElements(emptyGraph, [
			variable('?node_100'),
			klass(POKEMON, 'Pokémon'),
			entity(FIRE, 'Fire'),
			valueVariable('?value_200'),
			valueVariable('?value_300'),
			variable('?team'),
			edge('?node_100', POKEMON, '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>', 'type'),
			edge('?node_100', FIRE, '<https://e/hasType>', 'has type'),
			edge('?node_100', '?value_200', '<https://e/speed>', 'speed'),
			edge('?node_100', '?value_300', '<https://e/type2>', 'has type')
		]);
		expect(labels(graph)).toEqual({
			'?node_100': 'Pokémon',
			'?value_200': 'Speed',
			'?value_300': 'Type',
			'?team': 'team'
		});
		expect(variableNames(graph).get('?node_100')!.description).toBe(
			'type Pokémon, has type Fire'
		);
		expect(variableNames(graph).get('?value_200')!.description).toBe('speed of Pokémon');
	});

	it('names the rest Item A, B and Relation A by age, and numbers a label already taken', () => {
		const graph = addElements(emptyGraph, [
			variable('?node_30'),
			variable('?node_4'),
			valueVariable('?value_10'),
			valueVariable('?value_20'),
			variable('?speed'),
			edge('?node_30', '?node_4', '?predicate_1', '?'),
			edge('?node_30', '?value_10', '<https://e/speed>', 'speed'),
			edge('?node_30', '?value_20', '<https://e/speed>', 'speed')
		]);
		expect(labels(graph)).toEqual({
			'?node_4': 'Item A',
			'?node_30': 'Item B',
			'?value_10': 'Speed 2',
			'?value_20': 'Speed 3',
			'?speed': 'speed',
			'?predicate_1': 'Relation A'
		});
		expect(variableNames(graph).get('?predicate_1')!.description).toBe(
			'between Item B and Item A'
		);
	});

	it('ignores values that only look like variables and falls back to the bare name', () => {
		const graph = addElements(emptyGraph, [
			variable('?1bad'),
			entity('<https://e/a>', 'A'),
			variable('?node_1'),
			edge('<https://e/a>', '?node_1', '?not-valid', '?')
		]);
		const names = variableNames(graph);
		expect([...names.keys()]).toEqual(['?node_1']);
		expect(variableLabel(names, '?node_1')).toBe('Item A');
		expect(variableLabel(names, '?gone')).toBe('gone');
	});
});

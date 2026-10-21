import { describe, expect, it } from 'vitest';
import { addElements, emptyGraph } from '#lib/domain/index.js';
import { freeSpots, viewElements } from './graph-view.js';

const graph = addElements(emptyGraph, [
	{ kind: 'entity', id: '<a>', value: '<a>', label: 'Pikachu', position: { x: 1, y: 2 } },
	{ kind: 'variable', id: '?n', name: '?n', label: '3 results', many: true },
	{
		kind: 'value',
		id: 'v',
		term: { type: 'literal', value: 'x' },
		filter: null,
		label: 'A very long literal value'
	},
	{
		kind: 'value',
		id: 'old',
		term: { type: 'literal', value: 'x' },
		filter: null,
		label: '(1) Named',
		legacyFilter: true
	},
	{
		kind: 'valueVariable',
		id: '?v',
		name: '?v',
		label: '? ≥ 9',
		filter: { code: 2, value: '9' }
	},
	{ kind: 'class', id: 'c', value: '<C>', label: 'Class' },
	{ id: 'e1', source: '<a>', target: '?n', predicate: '<p>', label: 'p' },
	{ id: 'e2', source: '<a>', target: 'v', predicate: '?p', label: '?' },
	{ id: 'e3', source: '<a>', target: 'c', predicate: null, label: '?' }
]);

describe('graph view', () => {
	it('derives every element, kind, label and class from the graph alone', () => {
		const view = viewElements(graph, {
			selected: ['<a>', 'e1'],
			rejected: new Set(['?v']),
			emphasis: new Set(['?n', 'e2'])
		});
		expect(
			view.map((element) => [
				element.data.id,
				element.data.kind,
				element.data.label,
				element.classes
			])
		).toEqual([
			['<a>', 'entity', 'Pikachu', 'selected'],
			['?n', 'many', '3 results', 'emphasis'],
			['v', 'value', 'A very long literal value', 'label-below'],
			['old', 'legacyFilter', 'Named', ''],
			['?v', 'valueVariable', 'v ≥ 9', 'rejected'],
			['c', 'class', 'Class', ''],
			['e1', 'fixed', 'p', 'selected'],
			['e2', 'variable', 'p', 'emphasis'],
			['e3', 'variable', '?', '']
		]);
		expect(view[0].position).toEqual({ x: 1, y: 2 });
		expect(view[1].position).toBeUndefined();
		expect(view[6].data).toMatchObject({ source: '<a>', target: '?n' });
	});

	it('a variable still labelled ? shows its readable name (FE-056)', () => {
		const named = addElements(emptyGraph, [
			{ kind: 'entity', id: '<a>', value: '<a>', label: 'Pikachu' },
			{ kind: 'variable', id: '?node_1', name: '?node_1', label: '?' },
			{
				kind: 'valueVariable',
				id: '?value_2',
				name: '?value_2',
				label: '?',
				filter: null
			},
			{ id: 'e1', source: '?node_1', target: '<a>', predicate: '?predicate_1', label: '?' },
			{ id: 'e2', source: '?node_1', target: '?value_2', predicate: '<s>', label: 'speed' }
		]);
		expect(viewElements(named).map((element) => element.data.label)).toEqual([
			'Pikachu',
			'Item A',
			'Speed',
			'Relation A',
			'speed'
		]);
	});

	it('is a function of the graph: the same graph gives the same view', () => {
		expect(viewElements(graph)).toEqual(viewElements(structuredClone(graph)));
	});
});

describe('freeSpots (BUG-009)', () => {
	const far = (points: { x: number; y: number }[], gap: number) =>
		points.every((a, i) =>
			points.slice(i + 1).every((b) => Math.hypot(a.x - b.x, a.y - b.y) >= gap - 1e-9)
		);

	it('uses the centre when it is free', () => {
		expect(freeSpots({ x: 100, y: 50 }, [], 1)).toEqual([{ x: 100, y: 50 }]);
	});

	it('moves away from occupied positions and from each other', () => {
		const occupied = [{ x: 0, y: 0 }];
		const spots = freeSpots({ x: 0, y: 0 }, occupied, 3, 90);
		expect(spots).toHaveLength(3);
		expect(far([...occupied, ...spots], 90)).toBe(true);
	});

	it('one node at a time never lands on the previous ones', () => {
		const placed: { x: number; y: number }[] = [];
		for (let index = 0; index < 12; index += 1)
			placed.push(...freeSpots({ x: 10, y: 10 }, placed, 1, 80));
		expect(far(placed, 80)).toBe(true);
	});
});

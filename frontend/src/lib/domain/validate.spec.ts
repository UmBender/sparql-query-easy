import { describe, expect, it } from 'vitest';
import { addElements, emptyGraph, validate } from './index.js';

describe('validate', () => {
	it('reports typed problems instead of throwing', () => {
		expect(validate(emptyGraph).map((error) => error.code)).toEqual(['empty']);
		const separate = addElements(emptyGraph, [
			{ kind: 'variable', id: '?a', name: '?a', label: '?' },
			{ kind: 'variable', id: '?b', name: '?b', label: '?' }
		]);
		expect(validate(separate).map((error) => error.code)).toEqual(['separate-variable-groups']);
		const parallel = addElements(emptyGraph, [
			{ kind: 'entity', id: '<a>', value: '<a>', label: 'a' },
			{ kind: 'entity', id: '<b>', value: '<b>', label: 'b' },
			{ id: 'p', source: '<a>', target: '<b>', predicate: '?p', label: '?' },
			{ id: 'q', source: '<a>', target: '<b>', predicate: '?q', label: '?' }
		]);
		expect(validate(parallel).map((error) => error.code)).toEqual([
			'parallel-predicate-variables'
		]);
		const fixed = addElements(emptyGraph, [
			{ kind: 'entity', id: '<a>', value: '<a>', label: 'a' },
			{
				kind: 'value',
				id: 'x',
				term: { type: 'literal', value: '9..1' },
				filter: 6,
				label: 'x'
			},
			{
				kind: 'valueVariable',
				id: '?v',
				name: '?v',
				label: '?',
				filter: { code: 6, value: 'a..b' }
			},
			{ id: 'r', source: '<a>', target: 'x', predicate: '<p>', label: 'p' },
			{ id: 's', source: '<a>', target: '?v', predicate: '<q>', label: 'q' }
		]);
		expect(validate(fixed).map((error) => error.code)).toEqual([
			'invalid-between',
			'invalid-between'
		]);
		const plain = addElements(emptyGraph, [
			{ kind: 'entity', id: '<a>', value: '<a>', label: 'a' }
		]);
		expect(validate(plain).map((error) => error.code)).toEqual(['no-variable']);
		const dangling = {
			...plain,
			elements: [
				...plain.elements,
				{
					kind: 'relation' as const,
					id: 'd',
					source: '<a>',
					target: 'gone',
					predicate: null,
					label: '?'
				}
			]
		};
		expect(validate(dangling).map((error) => error.code)).toContain('dangling-edge');
	});
});

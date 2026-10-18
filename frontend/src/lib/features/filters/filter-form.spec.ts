import { describe, expect, it } from 'vitest';
import type { QueryNode } from '#lib/domain/index.js';
import { editorMode, editorStart, filterSchema, FILTER_OPTIONS } from './filter-form.js';

const value = (
	text: string,
	filter: 0 | 1 | 2 | 3 | 4 | 5 | 6 | null = null,
	label = text
): QueryNode => ({
	kind: 'value',
	id: 'v',
	term: { type: 'literal', value: text },
	filter,
	label
});
const variable = (filter: { code: 0 | 1 | 2 | 3 | 6 | null; value: string } | null): QueryNode => ({
	kind: 'valueVariable',
	id: '?v',
	name: '?v',
	label: '?',
	filter
});

describe('filter editor form', () => {
	it('chooses the legacy option sets', () => {
		expect(editorMode(variable(null), '')).toBe('variable');
		expect(editorMode(value('90'), '90')).toBe('numeric');
		expect(editorMode(value('MAX', 4), 'MAX')).toBe('numeric');
		expect(editorMode(value('40..80', 6), '40..80')).toBe('numeric');
		expect(editorMode(value('Pikachu'), 'Pikachu')).toBe('text');
		expect(FILTER_OPTIONS.variable.map((option) => option.value)).toEqual([
			'any',
			'',
			'0',
			'1',
			'2',
			'3',
			'6'
		]);
		expect(FILTER_OPTIONS.numeric.map((option) => option.value)).toEqual([
			'',
			'2',
			'3',
			'6',
			'4',
			'5'
		]);
	});

	it('starts from the stored filter, the raw value of a filtered node, or the seed', () => {
		expect(editorStart(value('90', 2, '≥ 90'))).toEqual({ value: '90', filterType: '2' });
		expect(editorStart(value('Rio'))).toEqual({ value: 'Rio', filterType: '' });
		expect(editorStart(variable(null), '45')).toEqual({ value: '45', filterType: 'any' });
		expect(editorStart(variable({ code: null, value: 'Rio' }))).toEqual({
			value: 'Rio',
			filterType: ''
		});
		expect(editorStart(variable({ code: 6, value: '1..2' }))).toEqual({
			value: '1..2',
			filterType: '6'
		});
	});

	it('validates between and numbers with the legacy messages', () => {
		const numeric = filterSchema('numeric');
		expect(numeric.safeParse({ filterType: '6', value: '80..40' }).success).toBe(false);
		expect(numeric.safeParse({ filterType: '2', value: 'fast' }).success).toBe(true);
		const variableSchema = filterSchema('variable');
		const failed = variableSchema.safeParse({ filterType: '2', value: 'fast' });
		expect(failed.success).toBe(false);
		expect(!failed.success && failed.error.issues[0].message).toBe(
			'At least and At most need a number.'
		);
		expect(variableSchema.safeParse({ filterType: '6', value: '' }).success).toBe(true);
		expect(variableSchema.safeParse({ filterType: 'any', value: 'x' }).success).toBe(true);
		expect(variableSchema.safeParse({ filterType: '9', value: 'x' }).success).toBe(false);
	});
});

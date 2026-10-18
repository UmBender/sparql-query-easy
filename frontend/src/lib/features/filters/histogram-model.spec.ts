import { describe, expect, it } from 'vitest';
import { keptView, paint, profileModel } from './histogram-model.js';
import type { NumericProfile } from '#lib/api/client.js';

const profile = (numbers: number[], extra: Partial<NumericProfile> = {}): NumericProfile => ({
	subject: '?p',
	predicate: '<p>',
	count: numbers.length,
	min: Math.min(...numbers),
	max: Math.max(...numbers),
	truncated: false,
	values: numbers.map((number, index) => ({
		entity: { type: 'iri', value: `https://e/${index}` },
		label: `E${index}`,
		value: String(number),
		number
	})),
	...extra
});

describe('histogram model', () => {
	it('explains a profile without numbers', () => {
		expect(
			profileModel(profile([]).count === 0 ? { ...profile([]), values: [] } : profile([]))
		).toEqual({
			kind: 'message',
			text: 'No numeric values for this relation under the rest of the query.'
		});
	});

	it('counts kept values for handles, exact values, MIN and an unknown MAX', () => {
		const model = profileModel(profile([10, 20, 30, 40, 50]));
		if (model.kind !== 'histogram') throw new Error('expected a histogram');
		expect(paint(model, '6', '20..40', 20, 40)).toMatchObject({
			countText: 'Keeps 3 of 5 values',
			rangeText: '20 – 40',
			loOnTop: false
		});
		expect(paint(model, '', '30', 10, 50)).toMatchObject({
			countText: 'Keeps 1 of 5 values',
			range: { lo: 30, hi: 30 }
		});
		const min = paint(model, '5', 'MIN', 10, 50);
		expect(min.countText).toBe('Keeps 1 of 5 values');
		expect(keptView(model, min)).toEqual({
			kept: [{ key: 'https://e/0', label: 'E0', values: [{ value: '10', number: 10 }] }],
			note: '1 entity has the lowest value; the query returns all of them, up to the server limit.'
		});
		expect(paint(model, '1', 'x', 10, 50).range).toBeNull();
		expect(keptView(model, paint(model, '6', '60..70', 60, 70))).toMatchObject({
			note: 'No entity is kept.'
		});

		const truncated = profileModel(profile([10, 20], { count: 4, max: 90, truncated: true }));
		if (truncated.kind !== 'histogram') throw new Error('expected a histogram');
		expect(truncated.notes).toEqual([
			'The histogram covers the lowest 2 of 4 values (up to 20; the largest is 90).'
		]);
		expect(paint(truncated, '2', '15', 15, 20).countText).toBe('Keeps 3 of 4 values');
		expect(paint(truncated, '6', '10..20', 10, 19).countText).toBe('Keeps 1 of 4 values');
		const max = paint(truncated, '4', 'MAX', 10, 20);
		expect(max).toMatchObject({
			countText: 'Keeps the highest value (90)',
			rangeText: '> 20',
			unknownMax: true,
			range: null
		});
		expect(keptView(truncated, max).note).toBe(
			'The highest value is 90; its entities are known after the query runs.'
		);
		expect(
			profileModel(profile([7, 7])).kind === 'histogram' &&
				(profileModel(profile([7, 7])) as { notes: string[] }).notes
		).toEqual(['All 2 values are 7.']);
	});
});

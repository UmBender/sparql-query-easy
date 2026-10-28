/** FE-054: the guided tour covers the current editor and links nowhere outside the app. */
import { describe, expect, it } from 'vitest';
import { FILTER_OPTIONS } from '#lib/features/filters/filter-form.js';
import { TOUR_STEPS } from './tour-steps.js';

describe('TOUR_STEPS', () => {
	const text = TOUR_STEPS.map((step) => step.text).join('\n');

	it.each([
		'filter',
		'funnel',
		'Run the query',
		'View SPARQL',
		'Export Query',
		'literal value variable'
	])('mentions %s', (feature) => expect(text).toContain(feature));

	it('lists only the filters a literal value variable offers (BUG-013)', () => {
		const step = TOUR_STEPS.find((item) => item.target === '#add-value-variable-btn');
		const offered = step?.text.match(/add a filter: ([^.]*)\./)?.[1] ?? '';
		expect(offered).toContain('between');
		expect(offered).not.toMatch(/MAX|MIN/);
		expect(step?.text).toContain('MAX and MIN are on a fixed literal value');
		expect(FILTER_OPTIONS.variable.map((option) => option.value)).not.toContain('4');
		expect(FILTER_OPTIONS.variable.map((option) => option.value)).not.toContain('5');
	});

	it('targets one element id per step, each once', () => {
		const targets = TOUR_STEPS.map((step) => step.target);
		expect(targets.every((target) => /^#[a-z-]+$/.test(target))).toBe(true);
		expect(new Set(targets).size).toBe(targets.length);
	});

	it('has no step for the retired demo video', () => {
		expect(TOUR_STEPS.map((step) => step.target)).not.toContain('#demo-link');
		expect(text).not.toMatch(/video|youtu/i);
	});
});

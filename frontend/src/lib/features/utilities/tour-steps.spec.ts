/** FE-054: the guided tour covers the current editor and links nowhere outside the app. */
import { describe, expect, it } from 'vitest';
import { TOUR_STEPS } from './tour-steps.js';

describe('TOUR_STEPS', () => {
	const text = TOUR_STEPS.map((step) => step.text).join('\n');

	it.each(['filter', 'funnel', 'Run the query', 'View SPARQL', 'Export Query', 'value variable'])(
		'mentions %s',
		(feature) => expect(text).toContain(feature)
	);

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

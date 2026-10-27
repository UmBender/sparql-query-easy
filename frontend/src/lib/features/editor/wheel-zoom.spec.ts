import { describe, expect, it } from 'vitest';
import { WHEEL_ZOOM_PER_PIXEL, wheelZoomFactor } from './wheel-zoom.js';

describe('wheelZoomFactor (FE-060)', () => {
	it('fixes the zoom rate per wheel pixel', () => {
		expect(WHEEL_ZOOM_PER_PIXEL).toBe(0.0016);
	});

	it('zooms about 1.45x per 100 px mouse notch, symmetric in both directions', () => {
		const zoomIn = wheelZoomFactor({ deltaY: -100, deltaMode: 0 });
		expect(zoomIn).toBeGreaterThan(1.4);
		expect(zoomIn).toBeLessThan(1.5);
		expect(wheelZoomFactor({ deltaY: 100, deltaMode: 0 }) * zoomIn).toBeCloseTo(1, 10);
	});

	it('treats a 3-line Firefox notch like a pixel notch', () => {
		const lines = wheelZoomFactor({ deltaY: -3, deltaMode: 1 });
		expect(lines).toBeGreaterThan(1.4);
		expect(lines).toBeLessThan(1.5);
	});

	it('keeps small trackpad deltas gentle and caps coarse ones', () => {
		expect(wheelZoomFactor({ deltaY: -4, deltaMode: 0 })).toBeLessThan(1.02);
		expect(wheelZoomFactor({ deltaY: -1000, deltaMode: 0 })).toBeCloseTo(
			wheelZoomFactor({ deltaY: -200, deltaMode: 0 }),
			10
		);
		expect(wheelZoomFactor({ deltaY: -1, deltaMode: 2 })).toBeLessThan(2.1);
	});
});

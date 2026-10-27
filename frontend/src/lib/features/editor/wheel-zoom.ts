import type { Core } from 'cytoscape';

/**
 * FE-060: wheel zoom owned by the app instead of Cytoscape's handler.
 *
 * Cytoscape 3.33 clamps the first wheel deltas to 5 px and then divides
 * deltas that are multiples of 5 (mouse notches of 100 px) by their smallest
 * value, so with `wheelSensitivity: 0.2` one notch zoomed only ~1.01x. No
 * single sensitivity fixes that without making Firefox line-mode wheels or
 * trackpads jump, so the zoom is a plain exponential of the pixel delta.
 */

/** log10 zoom change per wheel pixel: one 100 px notch zooms 10^0.16 ≈ 1.45x. */
export const WHEEL_ZOOM_PER_PIXEL = 0.0016;
/** Pixels per line for `deltaMode` 1 (Firefox): 3 lines ≈ one 100 px notch. */
export const WHEEL_LINE_PIXELS = 33;
/** Pixels per page for `deltaMode` 2. */
export const WHEEL_PAGE_PIXELS = 800;
/** Upper bound on one event's delta, so a coarse device cannot jump. */
export const WHEEL_MAX_PIXELS = 200;

type WheelLike = Pick<WheelEvent, 'deltaY' | 'deltaMode'>;

/** Zoom multiplier for one wheel event (>1 zooms in for an upward scroll). */
export function wheelZoomFactor(event: WheelLike): number {
	const unit =
		event.deltaMode === 1 ? WHEEL_LINE_PIXELS : event.deltaMode === 2 ? WHEEL_PAGE_PIXELS : 1;
	const pixels = Math.max(-WHEEL_MAX_PIXELS, Math.min(WHEEL_MAX_PIXELS, event.deltaY * unit));
	return Math.pow(10, -pixels * WHEEL_ZOOM_PER_PIXEL);
}

/**
 * Zooms `cy` around the pointer on wheel events over `container`. Listens in
 * the capture phase on the container's parent and stops propagation so
 * Cytoscape's own wheel handler (registered on the container) does not also
 * zoom. Touch pinch and the zoom buttons are untouched. Returns a disposer.
 */
export function installWheelZoom(cy: Core, container: HTMLElement): () => void {
	const host = container.parentElement ?? container;
	const onWheel = (event: WheelEvent) => {
		if (!container.contains(event.target as Node) || event.deltaY === 0) return;
		event.stopPropagation();
		event.preventDefault();
		// Like Cytoscape: no wheel zoom while a mouse button is held (drags).
		if (event.buttons !== 0 || !cy.zoomingEnabled() || !cy.userZoomingEnabled()) return;
		const box = container.getBoundingClientRect();
		cy.zoom({
			level: cy.zoom() * wheelZoomFactor(event),
			renderedPosition: { x: event.clientX - box.left, y: event.clientY - box.top }
		});
	};
	host.addEventListener('wheel', onWheel, { capture: true, passive: false });
	return () => host.removeEventListener('wheel', onWheel, { capture: true });
}

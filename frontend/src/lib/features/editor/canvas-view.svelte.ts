/**
 * The mounted Cytoscape instance and a counter bumped on pan, zoom, resize
 * and node moves, so overlays (action lists, badges, connection preview)
 * reposition. Cytoscape stays a view: no query state lives here.
 */
import { untrack } from 'svelte';
import type { Core } from 'cytoscape';

export class CanvasView {
	cy = $state.raw<Core | null>(null);
	version = $state(0);
	/** Pointer position over the canvas while a connection is pending. */
	pointer = $state.raw<{ x: number; y: number } | null>(null);

	/** Untracked read, so an effect that bumps does not depend on the counter. */
	bump() {
		this.version = untrack(() => this.version) + 1;
	}

	/** Rendered centre and radius of a node, relative to the canvas, or null when hidden. */
	nodeBox(
		id: string
	): { x: number; y: number; radius: number; width: number; height: number } | null {
		void this.version;
		const node = this.cy?.getElementById(id);
		if (!node || node.empty() || !node.isNode()) return null;
		const position = node.renderedPosition();
		return {
			x: position.x,
			y: position.y,
			radius: node.renderedOuterWidth() / 2,
			width: this.cy!.width(),
			height: this.cy!.height()
		};
	}

	/** Rendered midpoint of an edge, relative to the canvas. */
	edgeMidpoint(id: string): { x: number; y: number; width: number; height: number } | null {
		void this.version;
		const edge = this.cy?.getElementById(id);
		if (!edge || edge.empty() || !edge.isEdge()) return null;
		const midpoint = edge.midpoint();
		const zoom = this.cy!.zoom();
		const pan = this.cy!.pan();
		return {
			x: midpoint.x * zoom + pan.x,
			y: midpoint.y * zoom + pan.y,
			width: this.cy!.width(),
			height: this.cy!.height()
		};
	}

	zoomBy(factor: number) {
		if (!this.cy) return;
		this.cy.zoom(this.cy.zoom() * factor);
		this.cy.center();
	}

	fit() {
		this.cy?.fit();
	}
}

/**
 * Where a floating list goes beside an anchor (legacy `positionNodeActionMenu`):
 * right of it, or left when it would overflow, clamped 8 px inside the canvas.
 */
export function menuPosition(
	anchor: { x: number; y: number; radius?: number; width: number; height: number },
	menu: { width: number; height: number },
	gap = 12
): { left: number; top: number; visible: boolean } {
	const radius = anchor.radius ?? 0;
	const visible = !(
		anchor.x + radius < 0 ||
		anchor.y + radius < 0 ||
		anchor.x - radius > anchor.width ||
		anchor.y - radius > anchor.height
	);
	let left = anchor.x + radius + gap;
	if (left + menu.width > anchor.width - 8) left = anchor.x - radius - gap - menu.width;
	left = Math.max(8, Math.min(left, anchor.width - menu.width - 8));
	const top = Math.max(8, Math.min(anchor.y - menu.height / 2, anchor.height - menu.height - 8));
	return { left, top, visible };
}

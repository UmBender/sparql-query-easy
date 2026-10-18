<!--
	The Cytoscape canvas (FE-044). It renders `viewElements(store.graph)` and
	turns gestures into controller/store actions; it never keeps query state of
	its own. New nodes without a position get one from the layout (Auto Layout
	on) or near the viewport centre, written back to the store.
-->
<script lang="ts">
	import cytoscape, { type Core, type EventObject, type NodeSingular } from 'cytoscape';
	import { graphStylesheet } from '#lib/design/cytoscape.js';
	import { viewElements, type ViewState } from './graph-view.js';
	import type { CanvasView } from './canvas-view.svelte.js';
	import type { EditorController } from './editor-controller.svelte.js';

	let {
		controller,
		view,
		viewState = {},
		onhover
	}: {
		controller: EditorController;
		view: CanvasView;
		viewState?: ViewState;
		onhover?: (id: string | null, kind: 'node' | 'edge') => void;
	} = $props();

	const store = $derived(controller.store);
	let container: HTMLDivElement;

	/** Places nodes without a position, then (Auto Layout) runs cose and stores the positions. */
	function placeNew(cy: Core, added: string[]) {
		if (!added.length) return;
		if (store.autoLayout) {
			cy.layout({ name: 'cose', animate: false, fit: true } as cytoscape.LayoutOptions).run();
		} else {
			const extent = cy.extent();
			added.forEach((id, index) => {
				cy.getElementById(id).position({
					x: (extent.x1 + extent.x2) / 2 + index * 40,
					y: (extent.y1 + extent.y2) / 2 + index * 40
				});
			});
		}
		const positions: Record<string, { x: number; y: number }> = {};
		cy.nodes().forEach((node) => {
			positions[node.id()] = { ...node.position() };
		});
		store.setPositions(positions);
	}

	function sync(cy: Core) {
		const elements = viewElements(store.graph, viewState);
		const wanted = new Map(elements.map((element) => [element.data.id, element]));
		const unplaced: string[] = [];
		cy.batch(() => {
			cy.elements().forEach((element) => {
				const want = wanted.get(element.id());
				if (!want || want.group !== element.group()) element.remove();
			});
			// Nodes first: the graph's element order can put a relation before its node.
			const ordered = [
				...elements.filter((item) => item.group === 'nodes'),
				...elements.filter((item) => item.group === 'edges')
			];
			for (const element of ordered) {
				const existing = cy.getElementById(element.data.id);
				if (existing.empty()) {
					cy.add({
						group: element.group,
						data: { ...element.data },
						classes: element.classes,
						...(element.position ? { position: element.position } : {})
					});
					if (element.group === 'nodes' && !element.position)
						unplaced.push(element.data.id);
					continue;
				}
				if (
					element.group === 'edges' &&
					(existing.data('source') !== element.data.source ||
						existing.data('target') !== element.data.target)
				) {
					existing.move({ source: element.data.source, target: element.data.target });
				}
				existing.data({ ...element.data });
				existing.classes(element.classes);
				if (element.position && existing.isNode() && !existing.grabbed()) {
					const current = existing.position();
					if (current.x !== element.position.x || current.y !== element.position.y)
						existing.position(element.position);
				}
			}
		});
		placeNew(cy, unplaced);
		view.bump();
	}

	$effect(() => {
		const cy = cytoscape({
			container,
			elements: [],
			style: graphStylesheet() as cytoscape.StylesheetJson,
			// FE-014: one wheel notch zooms ~1.2x instead of ~2.5x.
			wheelSensitivity: 0.2,
			minZoom: 0.15,
			maxZoom: 3,
			layout: { name: 'preset' }
		});
		view.cy = cy;

		// ── Alt+drag: a variable relation to a node, or a new variable (graph-menus.js) ──
		let drag: { source: NodeSingular; origin: { x: number; y: number } } | null = null;
		cy.on('mousedown', 'node', (event: EventObject) => {
			const original = event.originalEvent as MouseEvent | undefined;
			if (original?.altKey)
				drag = { source: event.target, origin: { ...event.target.position() } };
		});
		cy.on('drag', 'node', () => {
			if (drag) drag.source.position(drag.origin);
		});
		cy.on('mouseup', (event: EventObject) => {
			const original = event.originalEvent as MouseEvent | undefined;
			const current = drag;
			drag = null;
			if (!current || !original?.altKey) return;
			const released = event.position;
			const nearby = cy.nodes().filter((node) => {
				const position = node.position();
				return Math.hypot(position.x - released.x, position.y - released.y) < 30;
			});
			if (nearby.length) store.dragConnect(current.source.id(), nearby.first().id());
			else store.dragToNewVariable(current.source.id(), { x: released.x, y: released.y });
		});
		cy.on('mouseout', 'node', () => {
			drag = null;
		});

		// ── Selection, dismissal, moves, hover ──
		cy.on('tap', 'node', (event: EventObject) => controller.tapNode(event.target.id()));
		cy.on('tap', 'edge', (event: EventObject) => controller.openEdgeMenu(event.target.id()));
		cy.on('tap', (event: EventObject) => {
			if (event.target === cy) controller.tapBackground();
		});
		cy.on('dragfree', 'node', (event: EventObject) =>
			store.moveNode(event.target.id(), { ...event.target.position() })
		);
		cy.on('mouseover', 'node, edge', (event: EventObject) => {
			event.target.addClass('hover');
			onhover?.(event.target.id(), event.target.isNode() ? 'node' : 'edge');
		});
		cy.on('mouseout', 'node, edge', (event: EventObject) => {
			event.target.removeClass('hover');
			onhover?.(null, event.target.isNode() ? 'node' : 'edge');
		});
		cy.on('pan zoom resize position layoutstop', () => view.bump());

		const resize = new ResizeObserver(() => cy.resize());
		resize.observe(container);
		return () => {
			resize.disconnect();
			view.cy = null;
			cy.destroy();
		};
	});

	$effect(() => {
		const cy = view.cy;
		void store.graph;
		void viewState;
		if (cy) sync(cy);
	});
</script>

<!-- Cytoscape makes its container position: relative, so the wrapper does the absolute fill. -->
<div class="absolute inset-0">
	<div
		bind:this={container}
		id="cy"
		data-testid="graph-canvas"
		class="h-full w-full bg-canvas"
		role="application"
		aria-label="Query graph. Click a node or relation for its actions; click the background to close them; Alt+drag from a node to add a variable relation."
		onpointermove={(event) => {
			if (!controller.connection) return;
			const box = container.getBoundingClientRect();
			view.pointer = { x: event.clientX - box.left, y: event.clientY - box.top };
		}}
	></div>
</div>

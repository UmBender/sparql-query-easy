<!--
	Possible graph window (FE-017, FE-024): a read-only copy of the query with
	the committed values, the option under the cursor and, cycling every 3 s,
	up to three possible values of the next variable. The main graph is never
	touched. Long labels wrap under their node or relation.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import cytoscape, { type Core } from 'cytoscape';
	import { possibleGraphStylesheet } from '#lib/design/cytoscape.js';
	import { tokens } from '#lib/design/tokens.js';
	import { selectQueryComponent, elementData } from '#lib/domain/index.js';
	import {
		consolidatedGraphElements,
		possibleGraphView
	} from '#lib/domain/legacy/query-stages.js';
	import type { Exploration } from './exploration.svelte.js';

	let { exploration }: { exploration: Exploration } = $props();

	const CYCLE_MS = 3000;
	const LABEL_BELOW_WIDTH = 150;
	let container = $state<HTMLDivElement | null>(null);
	let cy: Core | null = null;
	let cycle = $state(0);
	let cycleKey: string | null = null;

	const current = $derived(exploration.state!);
	const nameOf = (name: string) => exploration.store.nameOf(name);
	const view = $derived(
		possibleGraphView({ ...current, complete: exploration.complete }, cycle, nameOf)
	);

	// The cycle restarts at the first value whenever the hovered option changes.
	$effect(() => {
		const key = current.previewKey;
		const count = view.valueCount;
		untrack(() => {
			if (key !== cycleKey) {
				cycleKey = key;
				cycle = 0;
			}
		});
		if (count < 2) return;
		const timer = setInterval(() => (cycle += 1), CYCLE_MS);
		return () => clearInterval(timer);
	});

	let measure: CanvasRenderingContext2D | null = null;
	function labelWidth(text: string, size: number) {
		measure ??= document.createElement('canvas').getContext('2d');
		if (!measure) return text.length * size * 0.6;
		measure.font = `${size}px ${tokens.font.canvas}`;
		return measure.measureText(text).width;
	}

	/** Moves a label under its element when it does not fit (FE-024). */
	function placeLabels(graph: Core) {
		graph.batch(() =>
			graph.elements().forEach((element) => {
				const label = String(element.data('label') ?? '');
				let below: boolean;
				if (element.isNode()) {
					below = labelWidth(label, 11) > element.width() - 8;
				} else {
					const edge = element as unknown as cytoscape.EdgeSingular;
					const start = edge.source().position();
					const end = edge.target().position();
					const length =
						Math.hypot(end.x - start.x, end.y - start.y) -
						(edge.source().width() + edge.target().width()) / 2;
					const width = labelWidth(label, 10);
					below = width + 12 > length;
					if (below)
						edge.data('labelOffset', Math.ceil(width / LABEL_BELOW_WIDTH) * 7 + 6);
				}
				element.toggleClass('label-below', below);
			})
		);
	}

	$effect(() => {
		if (!container) return;
		const graph = cytoscape({
			container,
			style: possibleGraphStylesheet() as cytoscape.StylesheetJson,
			userZoomingEnabled: false,
			userPanningEnabled: false,
			boxSelectionEnabled: false,
			autoungrabify: true,
			autounselectify: true,
			layout: { name: 'preset' }
		});
		cy = graph;
		if (import.meta.env.MODE === 'e2e')
			Object.assign((window as unknown as { __easyquery: object }).__easyquery ?? {}, {
				possibleCy: graph
			});
		const resize = new ResizeObserver(() => {
			graph.resize();
			graph.fit(undefined, 16);
		});
		resize.observe(container);
		return () => {
			resize.disconnect();
			cy = null;
			graph.destroy();
		};
	});

	$effect(() => {
		const assignments = view.assignments;
		const { component } = selectQueryComponent(exploration.store.graph);
		const items = (component ?? []).map((element) => ({
			...elementData(element),
			...(element.kind !== 'relation' && element.position
				? { position: { ...element.position } }
				: {})
		}));
		void container;
		if (!cy) return;
		const graph = cy;
		graph.batch(() => {
			graph.elements().remove();
			graph.add(consolidatedGraphElements(items, assignments, nameOf));
		});
		placeLabels(graph);
		graph.fit(undefined, 16);
	});
</script>

<section
	id="possible-graph-window"
	aria-labelledby="possible-graph-title"
	class="pointer-events-auto flex min-h-0 w-full flex-col gap-1 rounded-lg border bg-surface p-3 text-surface-foreground shadow-md lg:w-[min(30rem,40vw)]"
>
	<h2 id="possible-graph-title" class="text-sm font-semibold">Possible graph</h2>
	<div
		bind:this={container}
		id="possible-graph-canvas"
		role="img"
		aria-label="Possible consolidated query graph"
		class="h-[min(380px,calc(100vh-260px))] min-h-32 w-full rounded border bg-canvas max-lg:h-auto max-lg:flex-1"
	></div>
	<p id="possible-graph-caption" aria-live="polite" class="text-xs">{view.caption}</p>
	<ul
		id="possible-graph-legend"
		class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"
	>
		<li class="flex items-center gap-1">
			<span class="size-3 rounded-full bg-node-entity"></span>Chosen
		</li>
		<li class="flex items-center gap-1">
			<span class="size-3 rounded-full bg-node-entity ring-2 ring-possible-assumed"
			></span>Option under the cursor
		</li>
		<li class="flex items-center gap-1">
			<span class="size-3 rounded-full bg-possible-possible"></span>Possible next value
		</li>
		<li class="flex items-center gap-1">
			<span class="size-3 rounded-full bg-node-variable"></span>Open variable
		</li>
	</ul>
</section>

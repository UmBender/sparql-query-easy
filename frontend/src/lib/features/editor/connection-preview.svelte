<!-- Dashed arrow from a pending connection's source to the pointer (FE-007). -->
<script lang="ts">
	import type { CanvasView } from './canvas-view.svelte.js';
	import type { EditorController } from './editor-controller.svelte.js';

	let { controller, view }: { controller: EditorController; view: CanvasView } = $props();

	const start = $derived(
		controller.connection ? view.nodeBox(controller.connection.sourceId) : null
	);
	const end = $derived(view.pointer ?? (start ? { x: start.x + 80, y: start.y } : null));
</script>

{#if controller.connection && start && end}
	<svg
		id="connection-preview"
		class="pointer-events-none absolute inset-0 z-(--z-overlay) h-full w-full text-graph-selected"
		aria-hidden="true"
	>
		<defs>
			<marker
				id="connection-preview-arrow"
				markerWidth="10"
				markerHeight="10"
				refX="8"
				refY="3"
				orient="auto"
				markerUnits="strokeWidth"
			>
				<path d="M0,0 L0,6 L9,3 z" fill="currentColor" />
			</marker>
		</defs>
		<line
			x1={start.x}
			y1={start.y}
			x2={end.x}
			y2={end.y}
			stroke="currentColor"
			stroke-width="3"
			stroke-dasharray="6 4"
			marker-end="url(#connection-preview-arrow)"
		/>
	</svg>
{/if}

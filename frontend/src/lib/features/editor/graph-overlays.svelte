<!-- Graph legend and zoom controls (legacy #legend, #zoom-controls). -->
<script lang="ts">
	import ZoomInIcon from '@lucide/svelte/icons/zoom-in';
	import ZoomOutIcon from '@lucide/svelte/icons/zoom-out';
	import ScanIcon from '@lucide/svelte/icons/scan';
	import { IconButton } from '#lib/components/ui/icon-button/index.js';
	import type { CanvasView } from './canvas-view.svelte.js';

	let { view }: { view: CanvasView } = $props();
</script>

<!--
	FE-057: one colour rule — fixed elements keep their own colour, variables
	are green — shown in three columns: nodes, literals and predicates.
-->
{#snippet arrow(colour: string)}
	<svg viewBox="0 0 24 8" aria-hidden="true" class="h-2 w-6 shrink-0 {colour}">
		<line x1="0" y1="4" x2="18" y2="4" stroke="currentColor" stroke-width="2" />
		<path d="M17 0 L24 4 L17 8 Z" fill="currentColor" />
	</svg>
{/snippet}

<div
	id="legend"
	role="group"
	aria-label="Graph legend"
	class="absolute bottom-3 left-3 z-(--z-overlay) grid max-w-[calc(100%-5rem)] grid-cols-2 gap-x-3 gap-y-1 rounded-md border bg-surface/90 p-2 text-xs shadow-sm sm:grid-cols-3"
>
	<div class="flex flex-col gap-1">
		<strong class="font-semibold">Nodes</strong>
		<span class="flex items-center gap-2"
			><span class="size-3 shrink-0 rounded-full bg-node-entity"></span>Entity</span
		>
		<span class="flex items-center gap-2"
			><span class="size-3 shrink-0 rounded-full bg-node-variable"></span>Node variable</span
		>
		<span class="flex items-center gap-2"
			><span class="size-3 shrink-0 rounded-full bg-node-many"></span>Multiple results</span
		>
	</div>
	<div class="flex flex-col gap-1">
		<strong class="font-semibold">Literals</strong>
		<span class="flex items-center gap-2"
			><span class="h-3 w-4 shrink-0 rounded-sm bg-node-value"></span>Literal value</span
		>
		<span class="flex items-center gap-2"
			><span class="h-3 w-4 shrink-0 rounded-sm bg-node-value-variable"></span>Literal value
			variable</span
		>
	</div>
	<div class="flex flex-col gap-1">
		<strong class="font-semibold">Predicates</strong>
		<span class="flex items-center gap-2"
			>{@render arrow('text-edge-line')}Defined predicate</span
		>
		<span class="flex items-center gap-2"
			>{@render arrow('text-edge-variable-line')}Variable predicate</span
		>
	</div>
</div>

<div
	id="zoom-controls"
	aria-label="Zoom controls"
	class="absolute right-3 bottom-3 z-(--z-overlay) flex flex-col gap-1 rounded-md border bg-surface/90 p-1 shadow-sm"
>
	<IconButton label="Zoom in" onclick={() => view.zoomBy(1.25)}><ZoomInIcon /></IconButton>
	<IconButton label="Fit graph" onclick={() => view.fit()}><ScanIcon /></IconButton>
	<IconButton label="Zoom out" onclick={() => view.zoomBy(0.8)}><ZoomOutIcon /></IconButton>
</div>

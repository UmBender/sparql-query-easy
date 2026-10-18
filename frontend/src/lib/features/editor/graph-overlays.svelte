<!-- Node-type legend and zoom controls (legacy #legend, #zoom-controls). -->
<script lang="ts">
	import ZoomInIcon from '@lucide/svelte/icons/zoom-in';
	import ZoomOutIcon from '@lucide/svelte/icons/zoom-out';
	import ScanIcon from '@lucide/svelte/icons/scan';
	import { IconButton } from '#lib/components/ui/icon-button/index.js';
	import type { CanvasView } from './canvas-view.svelte.js';

	let { view }: { view: CanvasView } = $props();
</script>

<div
	id="legend"
	aria-label="Node type legend"
	class="absolute bottom-3 left-3 z-(--z-overlay) flex flex-col gap-1 rounded-md border bg-surface/90 p-2 text-xs shadow-sm"
>
	<strong class="font-semibold">Node types</strong>
	<span class="flex items-center gap-2"
		><span class="size-3 rounded-full bg-node-entity"></span>Entity</span
	>
	<span class="flex items-center gap-2"
		><span class="size-3 rounded-full bg-node-variable"></span>Variable</span
	>
	<span class="flex items-center gap-2"
		><span class="h-3 w-4 rounded-sm bg-node-value"></span>Value</span
	>
	<span class="flex items-center gap-2"
		><span
			class="h-3 w-4 rounded-sm border-2 border-node-value-variable-border bg-node-value-variable"
		></span>Value variable</span
	>
	<span class="flex items-center gap-2"
		><span class="size-3 rounded-full bg-node-class"></span>Class</span
	>
	<span class="flex items-center gap-2"
		><span class="size-3 rounded-full bg-node-many"></span>Many results</span
	>
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

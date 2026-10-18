<!-- Badges and actual-value chips over filtered nodes (FE-036/FE-039); an overlay only. -->
<script lang="ts">
	import { CountBadge } from '#lib/components/ui/count-badge/index.js';
	import type { CanvasView } from '#lib/features/editor/canvas-view.svelte.js';
	import type { FilterBadges } from './badges.svelte.js';

	let { badges, view }: { badges: FilterBadges; view: CanvasView } = $props();

	const items = $derived(
		Object.entries(badges.byNode)
			.map(([nodeId, item]) => ({ nodeId, item, box: view.nodeBounds(nodeId) }))
			.filter((entry) => entry.box)
	);
</script>

<div
	id="filter-badge-layer"
	role="group"
	aria-label="Filter results"
	class="pointer-events-none absolute inset-0 z-(--z-overlay)"
>
	{#each items as { nodeId, item, box } (nodeId)}
		{#if item.badge}
			<CountBadge
				class="filter-badge pointer-events-auto absolute -translate-x-1/2 -translate-y-full"
				style="left: {(box!.x1 + box!.x2) / 2}px; top: {box!.y1 - 4}px"
				data-node-id={nodeId}
				state={item.badge.state === 'unknown' || item.badge.state === 'ok-chip'
					? 'error'
					: item.badge.state}
				text={item.badge.text}
				description={item.badge.description}
			/>
		{/if}
		{#if item.chip}
			<!-- Focusable so keyboard users reach the actual value (legacy). -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<span
				class="filter-actual-value pointer-events-auto absolute -translate-x-1/2 rounded-md border bg-surface px-1.5 text-xs whitespace-nowrap shadow-sm"
				class:text-muted-foreground={item.chip.state !== 'ok-chip'}
				style:left="{(box!.x1 + box!.x2) / 2}px"
				style:top="{box!.y2 + 4}px"
				role="note"
				tabindex="0"
				data-node-id={nodeId}
				data-state={item.chip.state === 'ok-chip' ? 'ok' : item.chip.state}
				title={item.chip.description}
				aria-label={item.chip.description}
				aria-busy={item.chip.state === 'loading'}>{item.chip.text}</span
			>
		{/if}
	{/each}
</div>

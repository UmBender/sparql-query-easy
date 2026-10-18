<!--
	The exploration panel and the possible-graph window over the canvas: side
	by side on wide screens, the window as a sheet below the panel on narrow
	ones (legacy narrow-screen layout).
-->
<script lang="ts">
	import ExplorationPanel from './exploration-panel.svelte';
	import PossibleGraph from './possible-graph.svelte';
	import type { Exploration } from './exploration.svelte.js';

	let {
		exploration,
		onassume,
		onclose
	}: { exploration: Exploration; onassume: (remaining: string[]) => void; onclose: () => void } =
		$props();
</script>

{#if exploration.state}
	<div
		class="pointer-events-none absolute inset-3 z-(--z-panel) flex flex-col items-stretch gap-3 lg:flex-row-reverse lg:items-start"
	>
		<ExplorationPanel {exploration} {onassume} {onclose} />
		<PossibleGraph {exploration} />
	</div>
{/if}

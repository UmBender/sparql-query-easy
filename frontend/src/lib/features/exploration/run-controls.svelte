<!-- Stage order and Run Query (legacy toolbar right cell); feature cards add buttons before Run Query. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import PlayIcon from '@lucide/svelte/icons/play';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { QueryStore } from '#lib/stores/query-store.svelte.js';
	import type { Emphasis } from './emphasis.svelte.js';
	import StageOrder from './stage-order.svelte';

	let {
		store,
		emphasis,
		children
	}: { store: QueryStore; emphasis: Emphasis; children?: Snippet } = $props();
</script>

<StageOrder {store} {emphasis} />
{@render children?.()}
<!-- The toolbar form's submit button: Enter in a toolbar field runs the query (legacy). -->
<Button
	id="run-query-btn"
	type="submit"
	class="bg-success text-success-foreground hover:bg-success/85"
	title="Run the SPARQL query"
>
	<PlayIcon />Run Query
</Button>

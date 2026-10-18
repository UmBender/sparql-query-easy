<!-- Node and edge counts and the API warm-up result (legacy #status-bar). -->
<script lang="ts">
	import { edgesOf, nodesOf } from '#lib/domain/index.js';
	import type { QueryStore } from '#lib/stores/query-store.svelte.js';

	let { store, health }: { store: QueryStore; health: 'checking' | 'ok' | 'down' } = $props();
</script>

<footer
	id="status-bar"
	class="flex items-center gap-4 border-t bg-surface px-4 py-1 text-xs text-muted-foreground"
>
	<span id="status-nodes">Nodes: {nodesOf(store.graph).length}</span>
	<span id="status-edges">Edges: {edgesOf(store.graph).length}</span>
	<span id="status-api" class="ml-auto" role="status">
		API: {health === 'ok' ? 'online' : health === 'down' ? 'offline' : 'checking…'}
	</span>
</footer>

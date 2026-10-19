<!--
	FE-053 test harness: one or more QueryEditors with the root layout's query
	client and tooltip providers,
	each with a marked panel and toolbar action. Used by query-editor.svelte.spec.ts.
-->
<script lang="ts">
	import { QueryClientProvider } from '@tanstack/svelte-query';
	import { createAppQueryClient } from '#lib/api/queries.js';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import type { QueryStore } from '#lib/stores/query-store.svelte.js';
	import type { Endpoint, QueryDocument } from '#lib/domain/index.js';
	import QueryEditor from './query-editor.svelte';

	type EditorProps = { initial?: QueryDocument; endpoint?: Endpoint; lockEndpoint?: boolean };

	let {
		editors,
		onready
	}: { editors: EditorProps[]; onready: (index: number, store: QueryStore) => void } = $props();
</script>

<QueryClientProvider client={createAppQueryClient()}>
	<Tooltip.Provider>
		{#each editors as props, index (index)}
			<section data-testid={`editor-${index}`} class="h-dvh">
				<QueryEditor {...props} onready={(store) => onready(index, store)}>
					{#snippet panel()}
						<p data-testid={`panel-${index}`}>Task statement {index}</p>
					{/snippet}
					{#snippet actions()}
						<button type="button" data-testid={`action-${index}`}>Submit answer</button>
					{/snippet}
				</QueryEditor>
			</section>
		{/each}
	</Tooltip.Provider>
</QueryClientProvider>

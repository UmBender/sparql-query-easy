<!--
	QUAL-012: the root layout's providers (a svelte-query client and the
	tooltip provider) around one component under test. Rendered by
	`renderWithProviders` (render.ts).
-->
<script lang="ts" generics="Props extends Record<string, unknown>">
	import type { Component } from 'svelte';
	import { QueryClientProvider, type QueryClient } from '@tanstack/svelte-query';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';

	let {
		component: Inner,
		props,
		client
	}: { component: Component<Props>; props: Props; client: QueryClient } = $props();
</script>

<QueryClientProvider {client}>
	<Tooltip.Provider>
		<Inner {...props} />
	</Tooltip.Provider>
</QueryClientProvider>

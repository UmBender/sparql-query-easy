<!--
	The query editor page (FE-044–FE-048): toolbar, canvas with its overlays,
	panels and dialogs, all driven by one QueryStore through an EditorController.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '#lib/api/client.js';
	import { BUILT_IN_ENDPOINTS } from '#lib/domain/index.js';
	import { QueryStore } from '#lib/stores/query-store.svelte.js';
	import { EditorController } from './editor-controller.svelte.js';
	import { CanvasView } from './canvas-view.svelte.js';
	import GraphCanvas from './graph-canvas.svelte';
	import { viewElements } from './graph-view.js';
	import ActionMenu from './action-menu.svelte';
	import ConnectionPreview from './connection-preview.svelte';
	import ResultsSheet from './results-sheet.svelte';
	import SparqlDialog from './sparql-dialog.svelte';
	import EditorToolbar from './editor-toolbar.svelte';
	import GraphOverlays from './graph-overlays.svelte';
	import StatusBar from './status-bar.svelte';

	const store = new QueryStore();
	const controller = new EditorController({ store, api });
	const view = new CanvasView();

	let endpoints = $state<{ id: string; label: string }[]>(
		BUILT_IN_ENDPOINTS.map((item) => ({ id: item.id, label: item.label }))
	);
	let health = $state<'checking' | 'ok' | 'down'>('checking');

	onMount(() => {
		// API warm-up (legacy GET /health) and the endpoint list (BE-006).
		api.health().then(
			() => (health = 'ok'),
			() => (health = 'down')
		);
		api.endpoints().then(
			(items) => (endpoints = items),
			() => {}
		);
		// Test handle (e2e builds only), like the legacy page's global cy.
		if (import.meta.env.MODE === 'e2e') {
			(window as unknown as { __easyquery: unknown }).__easyquery = {
				store,
				controller,
				view,
				viewElements
			};
		}
	});
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape' && controller.connection) {
			controller.cancelConnection();
		}
	}}
/>

<div class="flex h-dvh flex-col">
	<EditorToolbar {controller} {endpoints} />
	<main class="relative min-h-0 flex-1 overflow-hidden" id="cy-wrapper">
		<GraphCanvas
			{controller}
			{view}
			viewState={{
				selected: [
					...(store.selection ? [store.selection.id] : []),
					...(controller.connection ? [controller.connection.sourceId] : [])
				]
			}}
		/>
		<ConnectionPreview {controller} {view} />
		<ActionMenu {controller} {view} />
		<GraphOverlays {view} />
		{#if controller.busy > 0}
			<div
				id="loading-overlay"
				role="status"
				aria-label="Loading"
				class="absolute inset-0 z-(--z-dialog) flex items-center justify-center bg-background/40"
			>
				<span
					class="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent"
				></span>
			</div>
		{/if}
	</main>
	<StatusBar {store} {health} />
	<ResultsSheet {controller} />
	<SparqlDialog {controller} />
</div>

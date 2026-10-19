<!--
	The query editor page (FE-044–FE-048): toolbar, canvas with its overlays,
	panels and dialogs, all driven by one QueryStore through an EditorController.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '#lib/api/client.js';
	import { BUILT_IN_ENDPOINTS, nodeById } from '#lib/domain/index.js';
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
	import FilterEditor from '#lib/features/filters/filter-editor.svelte';
	import { runQueryDecision } from '#lib/domain/index.js';
	import { Exploration } from '#lib/features/exploration/exploration.svelte.js';
	import { Emphasis } from '#lib/features/exploration/emphasis.svelte.js';
	import ExplorationLayer from '#lib/features/exploration/exploration-layer.svelte';
	import RunControls from '#lib/features/exploration/run-controls.svelte';
	import FilterIcon from '@lucide/svelte/icons/list-filter';
	import { Button } from '#lib/components/ui/button/index.js';
	import { useQueryClient } from '@tanstack/svelte-query';
	import { createCachedApi } from '#lib/api/queries.js';
	import { CountCache } from '#lib/features/funnel/count-cache.js';
	import { Funnel } from '#lib/features/funnel/funnel.svelte.js';
	import { FilterBadges } from '#lib/features/funnel/badges.svelte.js';
	import FunnelPanel from '#lib/features/funnel/funnel-panel.svelte';
	import FilterBadgeLayer from '#lib/features/funnel/filter-badges.svelte';
	import FileActions from '#lib/features/utilities/file-actions.svelte';
	import GuidedTour from '#lib/features/utilities/guided-tour.svelte';
	import AccountMenu from '#lib/features/auth/account-menu.svelte';

	const store = new QueryStore();
	const controller = new EditorController({ store, api });
	const view = new CanvasView();
	const exploration = new Exploration({ store, api, toast: controller.toast });
	const emphasis = new Emphasis(store);
	const queryClient = useQueryClient();
	const cached = createCachedApi(api, queryClient);
	const counts = new CountCache(api, queryClient);
	const funnel = new Funnel(store, counts);
	const badges = new FilterBadges(store, counts, (request) => cached.actualValues(request));
	let funnelReturn: HTMLElement | null = null;

	function toggleFunnel() {
		if (funnel.open) closeFunnel();
		else {
			funnelReturn = document.activeElement as HTMLElement | null;
			funnel.show();
		}
	}
	function closeFunnel() {
		const restore = document
			.getElementById('filter-funnel-panel')
			?.contains(document.activeElement);
		funnel.hide();
		if (restore)
			(funnelReturn?.isConnected
				? funnelReturn
				: document.getElementById('filter-funnel-btn')
			)?.focus();
	}

	// Graph, endpoint and funnel-variable edits refresh the funnel (350 ms) and the badges (400 ms).
	$effect(() => {
		void store.graph;
		void store.context.endpointUrl;
		void store.funnelVariable;
		funnel.schedule();
		badges.schedule();
	});
	$effect(() => () => badges.dispose());
	controller.onBackground.push(() => closeExploration());

	let returnFocus: HTMLElement | null = null;

	/** Run Query (`runQuery`): staged exploration, or the reason it cannot run. */
	let seenSignature = store.signatureVersion;

	function runQuery() {
		// Edits made just before (Assume) are part of this run, not a reason to close it.
		seenSignature = store.signatureVersion;
		const decision = runQueryDecision(store.graph, store.order, store.context);
		if (decision.kind === 'error') {
			exploration.stop();
			controller.toast(decision.message, 'error');
		} else if (decision.kind === 'staged') {
			if (!exploration.open) returnFocus = document.activeElement as HTMLElement | null;
			exploration.start(decision.order, decision.where, decision.variableFilters);
		} else {
			controller.runLegacyQuery(decision.request);
		}
	}

	function closeExploration() {
		const restore = document
			.getElementById('two-variable-panel')
			?.contains(document.activeElement);
		exploration.stop();
		if (restore && returnFocus?.isConnected) returnFocus.focus();
	}

	// Graph and endpoint edits close the panel; a new stage order restarts it.
	$effect(() => {
		const version = store.signatureVersion;
		if (version !== seenSignature) {
			seenSignature = version;
			exploration.invalidate(true);
		}
	});
	$effect(() => {
		void store.order;
		exploration.invalidate(false);
	});

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
				viewElements,
				exploration,
				funnel,
				badges,
				queryClient
			};
		}
	});
</script>

<svelte:window
	onkeydown={(event) => {
		const active = document.activeElement as HTMLElement | null;
		const inPanel = !!active?.closest('#two-variable-panel, #filter-funnel-panel');
		if (event.key === 'Escape' && controller.connection) {
			controller.cancelConnection();
			return;
		}
		if (event.key === 'Escape' && active?.closest('#filter-funnel-panel')) {
			closeFunnel();
			return;
		}
		if (event.key === 'Escape' && exploration.open && !active?.closest('[role="dialog"]')) {
			closeExploration();
			return;
		}
		if (inPanel || active?.closest('[role="dialog"], #results-sheet')) return;
		// Enter outside fields and buttons runs the query (fields submit the toolbar form).
		if (
			event.key === 'Enter' &&
			!active?.closest('input, textarea, button, select, a, [contenteditable="true"]')
		)
			runQuery();
	}}
/>

<div class="flex h-dvh flex-col">
	<EditorToolbar {controller} {endpoints} onsubmit={runQuery}>
		{#snippet fileActions()}
			<FileActions
				{controller}
				class="text-brand-foreground hover:bg-brand-foreground/15 hover:text-brand-foreground"
			/>
		{/snippet}
		{#snippet account()}
			<AccountMenu
				class="text-brand-foreground hover:bg-brand-foreground/15 hover:text-brand-foreground"
			/>
		{/snippet}
		{#snippet runActions()}
			<RunControls {store} {emphasis}>
				<Button
					id="filter-funnel-btn"
					variant="secondary"
					aria-expanded={funnel.open}
					aria-controls="filter-funnel-panel"
					title="Show how each filter narrows the result"
					onclick={toggleFunnel}
				>
					<FilterIcon aria-hidden="true" />Filter funnel
				</Button>
			</RunControls>
		{/snippet}
	</EditorToolbar>
	<main class="relative min-h-0 flex-1 overflow-hidden" id="cy-wrapper">
		<GraphCanvas
			{controller}
			{view}
			onhover={(id, kind) => emphasis.hover(id, kind)}
			viewState={{
				selected: [
					...(store.selection ? [store.selection.id] : []),
					...(controller.connection ? [controller.connection.sourceId] : [])
				],
				emphasis: emphasis.elementIds,
				rejected: badges.rejected
			}}
		/>
		<ConnectionPreview {controller} {view} />
		<ActionMenu {controller} {view} />
		<GraphOverlays {view} />
		<FilterBadgeLayer {badges} {view} />
		{#if funnel.open}
			<FunnelPanel {funnel} onclose={closeFunnel} />
		{/if}
		<ExplorationLayer
			{exploration}
			onclose={closeExploration}
			onassume={(remaining) => {
				if (remaining.length) runQuery();
			}}
		/>
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
	<GuidedTour />
	{#if controller.editorRequest && nodeById(store.graph, controller.editorRequest.nodeId)}
		{#key controller.editorRequest.token}
			<FilterEditor {controller} request={controller.editorRequest} />
		{/key}
	{/if}
</div>

<!--
	App bar and toolbar (legacy navbar and toolbar panel): search, limit,
	endpoint, Auto Layout, New Query, Add Variable, Add Value Variable, undo
	and redo, View SPARQL. Feature cards add their controls through snippets.
-->
<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { mode, setMode } from 'mode-watcher';
	import Undo2Icon from '@lucide/svelte/icons/undo-2';
	import Redo2Icon from '@lucide/svelte/icons/redo-2';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SunIcon from '@lucide/svelte/icons/sun';
	import CodeIcon from '@lucide/svelte/icons/code';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SearchIcon from '@lucide/svelte/icons/search';
	import CircleHelpIcon from '@lucide/svelte/icons/circle-help';
	import { Button } from '#lib/components/ui/button/index.js';
	import { IconButton } from '#lib/components/ui/icon-button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { Combobox, type ComboboxItem } from '#lib/components/ui/combobox/index.js';
	import { createDebouncedRequest } from '#lib/api/queries.js';
	import { endpointUrl } from '#lib/domain/index.js';
	import type { PropertyItem } from '#lib/api/client.js';
	import type { EditorController } from './editor-controller.svelte.js';

	let {
		controller,
		endpoints,
		fileActions,
		runActions,
		onsubmit
	}: {
		controller: EditorController;
		endpoints: { id: string; label: string }[];
		fileActions?: Snippet;
		runActions?: Snippet;
		/** Enter in a toolbar field submits the form, which runs the query (legacy). */
		onsubmit?: () => void;
	} = $props();

	const store = $derived(controller.store);

	// ── Search nodes: 400 ms after typing, then choose a result ──
	let searchText = $state('');
	let searchResults = $state.raw<PropertyItem[]>([]);
	let searchStatus = $state<string | undefined>(undefined);
	const search = createDebouncedRequest(
		(text: string, signal: AbortSignal) => controller.searchItems(text, signal),
		{
			onResult: (items) => {
				searchResults = items;
				searchStatus = items.length ? undefined : 'No match';
			}
		}
	);
	const searchItems: ComboboxItem[] = $derived(
		searchResults.map((item, index) => ({
			value: `${index}`,
			label: item.propertyLabel,
			hint: item.propertyId
		}))
	);

	$effect(() => {
		const text = searchText.trim();
		if (!text) {
			search.cancel();
			searchResults = [];
			searchStatus = undefined;
			return;
		}
		searchStatus = 'Searching…';
		search.input(text);
	});

	// ── Endpoint: free text or a listed endpoint, applied as it is typed (like the legacy field) ──
	let endpointText = $state('');
	// Follows the store (load, upload) without reacting to the text itself.
	$effect(() => {
		const current = endpointUrl(store.endpoint);
		untrack(() => {
			if (current !== endpointText.trim()) endpointText = current;
		});
	});
	function applyEndpoint(text: string) {
		const value = text.trim();
		if (value && value !== endpointUrl(store.endpoint)) store.setEndpoint(value);
	}
	/** Listed endpoints matching the text; all of them while the text is one of them or empty. */
	const endpointItems: ComboboxItem[] = $derived.by(() => {
		const text = endpointText.trim().toLowerCase();
		const showAll = !text || endpoints.some((item) => item.id.toLowerCase() === text);
		return endpoints
			.filter(
				(item) =>
					showAll ||
					item.id.toLowerCase().includes(text) ||
					item.label.toLowerCase().includes(text)
			)
			.map((item) => ({ value: item.id, label: item.id, hint: item.label }));
	});
</script>

<header class="bg-brand text-brand-foreground">
	<nav
		aria-label="Main navigation"
		class="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-1 px-4 py-2"
	>
		<a
			href="/"
			class="mr-auto flex items-center gap-2 font-semibold"
			aria-label="SPARQL EasyQuery home"
		>
			<span
				aria-hidden="true"
				class="rounded bg-brand-foreground px-1.5 font-mono text-sm text-brand">SPARQL</span
			>
			<span>EasyQuery</span>
		</a>
		{@render fileActions?.()}
		<Button
			variant="ghost"
			class="text-brand-foreground hover:bg-brand-foreground/15 hover:text-brand-foreground"
			onclick={() => controller.viewSparql()}
		>
			<CodeIcon />View SPARQL
		</Button>
		<Button
			variant="ghost"
			class="text-brand-foreground hover:bg-brand-foreground/15 hover:text-brand-foreground"
			href="https://youtu.be/6vh7bccR-Ow"
			target="_blank"
			rel="noopener noreferrer"
		>
			<CircleHelpIcon />Demo
		</Button>
		<IconButton
			label="Undo"
			class="text-brand-foreground hover:bg-brand-foreground/15 hover:text-brand-foreground"
			disabled={!store.canUndo}
			onclick={() => store.undo()}
		>
			<Undo2Icon />
		</IconButton>
		<IconButton
			label="Redo"
			class="text-brand-foreground hover:bg-brand-foreground/15 hover:text-brand-foreground"
			disabled={!store.canRedo}
			onclick={() => store.redo()}
		>
			<Redo2Icon />
		</IconButton>
		<IconButton
			label={mode.current === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
			class="text-brand-foreground hover:bg-brand-foreground/15 hover:text-brand-foreground"
			onclick={() => setMode(mode.current === 'dark' ? 'light' : 'dark')}
		>
			{#if mode.current === 'dark'}<SunIcon />{:else}<MoonIcon />{/if}
		</IconButton>
	</nav>
</header>

<form
	class="border-b bg-surface"
	onsubmit={(event) => {
		event.preventDefault();
		onsubmit?.();
	}}
>
	<div class="mx-auto flex max-w-screen-2xl flex-wrap items-end gap-3 px-4 py-2">
		<div class="flex items-center gap-2 pb-2">
			<Checkbox
				id="auto-layout"
				checked={store.autoLayout}
				onCheckedChange={(checked) => (store.autoLayout = checked === true)}
			/>
			<Label for="auto-layout">Auto Layout</Label>
		</div>
		<div class="flex min-w-56 flex-1 flex-col gap-1">
			<Label for="search-nodes" class="flex items-center gap-1"
				><SearchIcon class="size-3.5" />Search nodes</Label
			>
			<Combobox
				id="search-nodes"
				label="Search nodes"
				placeholder="Type a name and choose a result"
				items={searchItems}
				bind:text={searchText}
				status={searchStatus}
				onselect={(item) => {
					const chosen = searchResults[Number(item.value)];
					searchText = '';
					if (chosen) controller.addSearchResult(chosen);
				}}
			/>
		</div>
		<div class="flex w-24 flex-col gap-1">
			<Label for="input-max-results">Limit</Label>
			<Input
				id="input-max-results"
				type="number"
				min="1"
				max="1000"
				value={store.limit}
				oninput={(event) => store.setLimit(parseInt(event.currentTarget.value, 10))}
			/>
		</div>
		<div class="flex min-w-64 flex-[2] flex-col gap-1">
			<Label for="input-endpoint-sparql">SPARQL endpoint</Label>
			<Combobox
				id="input-endpoint-sparql"
				label="SPARQL endpoint"
				items={endpointItems}
				bind:text={endpointText}
				oninput={applyEndpoint}
				onselect={(item) => {
					endpointText = item.value;
					applyEndpoint(item.value);
				}}
			/>
		</div>
	</div>
	<div class="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-2 px-4 pb-2">
		<Button
			variant="outline"
			onclick={() => {
				controller.tapBackground();
				store.clear();
			}}
		>
			<RefreshCwIcon />New Query
		</Button>
		<Button variant="secondary" onclick={() => store.addVariable()}
			><PlusIcon />Add Variable</Button
		>
		<Button
			variant="secondary"
			title="Add a value variable: a variable for literal values (numbers, text, dates) that can hold a filter"
			onclick={() => store.addValueVariable()}
		>
			<PlusIcon />Add Value Variable
		</Button>
		<div class="ml-auto flex flex-wrap items-center gap-2">
			{@render runActions?.()}
		</div>
	</div>
</form>

<svelte:window
	onkeydown={(event) => {
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, [contenteditable="true"]')) return;
		const key = event.key.toLowerCase();
		if ((event.ctrlKey || event.metaKey) && key === 'z') {
			event.preventDefault();
			if (event.shiftKey) store.redo();
			else store.undo();
		} else if ((event.ctrlKey || event.metaKey) && key === 'y') {
			event.preventDefault();
			store.redo();
		}
	}}
/>

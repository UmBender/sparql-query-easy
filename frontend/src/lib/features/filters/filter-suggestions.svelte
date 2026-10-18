<!--
	Text values suggested while typing in the filter editor (FE-038): 400 ms
	after typing, the values of the node's relation that start with (Starts
	with) or contain the text, under the rest of the query. Choosing one fills
	the input and selects Exact match. Arrow keys move between input and list.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { textSuggestionRequestFor } from '#lib/domain/index.js';
	import { suggestedTexts } from '#lib/domain/legacy/query-calculations.js';
	import { createDebouncedRequest } from '#lib/api/queries.js';
	import type { ApiClient } from '#lib/api/client.js';
	import type { QueryStore } from '#lib/stores/query-store.svelte.js';

	let {
		store,
		api,
		nodeId,
		value,
		filterType,
		onchoose,
		list = $bindable(null)
	}: {
		store: QueryStore;
		api: ApiClient;
		nodeId: string;
		value: string;
		filterType: string;
		onchoose: (value: string) => void;
		list?: HTMLUListElement | null;
	} = $props();

	let suggestions = $state.raw<{ status: string; values: string[] } | null>(null);
	let chosen = '';

	const lookup = createDebouncedRequest(
		(input: { text: string; startsWith: boolean }, signal: AbortSignal) => {
			const request = untrack(() =>
				textSuggestionRequestFor(
					store.graph,
					nodeId,
					input.text,
					input.startsWith,
					store.context
				)
			)!;
			suggestions = { status: 'Looking for matching values…', values: [] };
			return api.stage(request, { signal });
		},
		{
			onResult: (page, input) => {
				const values = suggestedTexts(page);
				suggestions = {
					status: values.length
						? ''
						: `No value ${input.startsWith ? 'starts with' : 'contains'} “${input.text}”.`,
					values
				};
			},
			onError: (error) => {
				suggestions = {
					status: `Could not load matching values: ${error instanceof Error ? error.message : String(error)}`,
					values: []
				};
			}
		}
	);

	$effect(() => {
		const text = value;
		const startsWith = filterType === '0';
		if (text === chosen) return;
		const request = untrack(() =>
			textSuggestionRequestFor(store.graph, nodeId, text, startsWith, store.context)
		);
		if (!request) {
			lookup.cancel();
			suggestions = null;
			return;
		}
		lookup.input({ text, startsWith });
	});

	$effect(() => () => lookup.cancel());

	function choose(text: string) {
		lookup.cancel();
		chosen = text;
		suggestions = null;
		onchoose(text);
	}
</script>

{#if suggestions}
	<div id="filter-suggestions" class="flex flex-col gap-1">
		{#if suggestions.status}<p class="text-xs text-muted-foreground" role="status">
				{suggestions.status}
			</p>{/if}
		<!-- Arrow keys move between the suggestion buttons inside the list. -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<ul
			bind:this={list}
			class="flex max-h-40 flex-col overflow-auto rounded-md border"
			aria-label="Matching values"
			onkeydown={(event) => {
				if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
				const buttons = [
					...(list?.querySelectorAll('button') ?? [])
				] as HTMLButtonElement[];
				const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
				if (index < 0) return;
				event.preventDefault();
				if (event.key === 'ArrowUp' && index === 0)
					document.getElementById('filter-value')?.focus();
				else
					buttons[
						Math.min(
							buttons.length - 1,
							Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1))
						)
					].focus();
			}}
		>
			{#each suggestions.values as text (text)}
				<li>
					<button
						type="button"
						class="filter-suggestion w-full px-2 py-1 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
						data-value={text}
						onclick={() => choose(text)}
					>
						{text}
					</button>
				</li>
			{/each}
		</ul>
	</div>
{/if}

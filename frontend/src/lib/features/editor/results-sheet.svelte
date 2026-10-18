<!--
	Query Results (legacy bottom sheet): relationships or query rows; choosing
	a row adds the value or binds the variable. The filter box hides rows that
	do not contain its text.
-->
<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import { Input } from '#lib/components/ui/input/index.js';
	import { IconButton } from '#lib/components/ui/icon-button/index.js';
	import type { EditorController } from './editor-controller.svelte.js';

	let { controller }: { controller: EditorController } = $props();

	let filter = $state('');
	const sheet = $derived(controller.results);
	const rows = $derived(
		(sheet?.rows ?? []).filter((row) =>
			`${row.propertyId}${row.label}`.toLowerCase().includes(filter.toLowerCase())
		)
	);

	$effect(() => {
		void sheet;
		filter = '';
	});
</script>

{#if sheet}
	<section
		id="results-sheet"
		aria-labelledby="results-title"
		class="fixed inset-x-0 bottom-0 z-(--z-dialog) flex max-h-[55vh] flex-col gap-2 border-t bg-surface p-4 text-surface-foreground shadow-lg"
	>
		<header class="flex flex-wrap items-center gap-3">
			<h2 id="results-title" class="text-lg font-semibold">Query Results</h2>
			<Input
				id="results-filter"
				bind:value={filter}
				placeholder="Filter…"
				aria-label="Filter results"
				class="max-w-64"
				autocomplete="off"
			/>
			<IconButton
				label="Close results"
				class="ml-auto"
				onclick={() => controller.closeResults()}><XIcon /></IconButton
			>
		</header>
		<div class="overflow-auto">
			<table class="w-full text-sm">
				<thead class="text-left text-muted-foreground">
					<tr
						><th class="px-2 py-1 font-medium">Property</th><th
							class="px-2 py-1 font-medium">Label</th
						></tr
					>
				</thead>
				<tbody id="table-results-body">
					{#if sheet.empty}
						<tr
							><td colspan="2" class="px-2 py-6 text-center text-muted-foreground"
								>{sheet.empty}</td
							></tr
						>
					{/if}
					{#each rows as row, index (`${row.propertyId}-${index}`)}
						<tr
							class="cursor-pointer border-t hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
							tabindex="0"
							data-row-kind={row.action.kind}
							onclick={() => controller.chooseRow(row)}
							onkeydown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									controller.chooseRow(row);
								}
							}}
						>
							<td class="px-2 py-1.5 font-mono text-xs break-all">{row.propertyId}</td
							>
							<td class="px-2 py-1.5">{row.label}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
{/if}

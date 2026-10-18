<!--
	Filter funnel panel (FE-028; legacy #filter-funnel-panel): one row per
	filter step with its count, the drop from the previous step and a bar;
	unticking a step previews later counts only.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Panel } from '#lib/components/ui/panel/index.js';
	import { cn } from '#lib/utils.js';
	import type { Funnel } from './funnel.svelte.js';

	let { funnel, onclose }: { funnel: Funnel; onclose: () => void } = $props();

	const rows = $derived(funnel.rows);
	const message = $derived('message' in funnel.view ? funnel.view.message : '');

	$effect(() => {
		tick().then(() => document.getElementById('filter-funnel-close')?.focus());
	});

	const percent = (count: number | null, base: number | null) =>
		count != null && base ? Math.round((count / base) * 100) : 0;
</script>

<Panel
	id="filter-funnel-panel"
	title="Filter funnel"
	closeLabel="Close filter funnel"
	closeId="filter-funnel-close"
	{onclose}
	class="pointer-events-auto absolute top-3 left-3 z-(--z-panel) max-h-[calc(100%-1.5rem)] w-[min(24rem,calc(100%-1.5rem))] overflow-y-auto"
>
	<div id="filter-funnel-variable" class="text-sm text-muted-foreground">
		{#if rows && rows.variables.length >= 2}
			<label for="filter-funnel-variable-select">Counting distinct </label>
			<select
				id="filter-funnel-variable-select"
				class="rounded-md border bg-surface px-1 py-0.5 text-foreground"
				value={rows.variableName}
				onchange={(event) => {
					funnel.store.setFunnelVariable(event.currentTarget.value);
					funnel.refresh();
				}}
			>
				{#each rows.variables as name (name)}<option value={name}>{name}</option>{/each}
			</select>
		{:else if rows}
			Counting distinct {rows.variableName}
		{/if}
	</div>
	<ol
		id="filter-funnel-steps"
		aria-label="Remaining results after each filter"
		class="flex flex-col"
	>
		{#if rows}
			<li class="funnel-row border-b py-1.5">
				<div class="funnel-row-head flex items-center justify-between gap-2 text-sm">
					<span class="text-muted-foreground italic">With these relations, any value</span
					>
					<span class="font-semibold text-primary tabular-nums">{rows.base ?? '…'}</span>
				</div>
				<div class="mt-1 h-1.5 overflow-hidden rounded bg-muted" aria-hidden="true">
					<span
						class="block h-full bg-primary"
						style:width="{percent(rows.base, rows.base)}%"
					></span>
				</div>
			</li>
			{#each rows.steps as row (row.step.key)}
				<li
					class={cn(
						'funnel-row border-b py-1.5',
						!row.enabled && 'funnel-off',
						!row.step.counted && 'funnel-uncounted'
					)}
				>
					<div class="funnel-row-head flex items-center justify-between gap-2 text-sm">
						<label
							class="funnel-toggle flex items-center gap-2"
							class:line-through={!row.enabled}
							class:text-muted-foreground={!row.enabled}
						>
							<input
								type="checkbox"
								class="size-4 accent-primary"
								data-step-key={row.step.key}
								checked={row.enabled}
								disabled={!row.step.counted}
								onchange={(event) => {
									funnel.store.setFunnelStep(
										row.step.key,
										event.currentTarget.checked
									);
									funnel.refresh();
								}}
							/>
							<span>{row.label}</span>
						</label>
						<span
							class="funnel-count font-semibold tabular-nums"
							class:text-primary={row.enabled && row.step.counted}
							class:text-muted-foreground={!row.enabled || !row.step.counted}
						>
							{#if !row.step.counted}not counted{:else if row.count == null}…{:else if !row.enabled}{row.count}
								(off){:else}{row.count}{/if}
							{#if row.step.counted && row.enabled && row.count != null && row.previous != null && row.previous > row.count}
								<span class="funnel-delta text-xs font-normal text-danger"
									>−{row.previous - row.count}</span
								>
							{/if}
						</span>
					</div>
					<div class="mt-1 h-1.5 overflow-hidden rounded bg-muted" aria-hidden="true">
						<span
							class="block h-full"
							class:bg-primary={row.enabled}
							class:bg-muted-foreground={!row.enabled}
							style:width="{percent(row.step.counted ? row.count : null, rows.base)}%"
						></span>
					</div>
				</li>
			{/each}
		{/if}
	</ol>
	<p
		id="filter-funnel-status"
		role="status"
		aria-live="polite"
		class="text-sm"
		class:text-danger={rows?.status.startsWith('Could not')}
		class:text-muted-foreground={!rows?.status.startsWith('Could not')}
		hidden={!(rows ? rows.status : message)}
	>
		{rows ? rows.status : message}
	</p>
	{#if 'status' in funnel.view && funnel.view.status === 'error'}
		<Button
			id="filter-funnel-retry"
			size="sm"
			variant="outline"
			class="self-start"
			onclick={() => funnel.refresh()}>Retry</Button
		>
	{/if}
	<p id="filter-funnel-result" aria-live="polite" class="text-sm font-medium">
		{rows?.result ?? ''}
	</p>
	<p id="filter-funnel-note" class="text-xs text-muted-foreground">
		Unticking a filter previews the result without it. The first row keeps each filtered
		relation with any value.
	</p>
</Panel>

<!--
	Find matching values (DEC-008; legacy #two-variable-panel): one value per
	variable in stage order, shown as steps with readable names (FE-056): done
	steps keep their value and a Change button, the current step has
	loading/empty/error/retry, Load more, the hover/focus preview of the next
	variable and Assume; Apply to graph ends it.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Panel } from '#lib/components/ui/panel/index.js';
	import {
		candidateText,
		termHint,
		termKey,
		type PreviewState,
		type StageCandidate
	} from '#lib/domain/legacy/query-stages.js';
	import type { Exploration } from './exploration.svelte.js';

	let {
		exploration,
		onassume,
		onclose
	}: { exploration: Exploration; onassume: (remaining: string[]) => void; onclose: () => void } =
		$props();

	const current = $derived(exploration.state!);
	const nameOf = (name: string) => exploration.store.nameOf(name);
	const variable = $derived(current.order[current.stage]);
	const candidates = $derived(exploration.candidates);
	const complete = $derived(exploration.complete);
	let heading = $state<HTMLHeadingElement | null>(null);
	let list = $state<HTMLUListElement | null>(null);

	const status = $derived.by(() => {
		if (current.status === 'loading' && !candidates.length)
			return `Loading values for ${nameOf(variable)}…`;
		if (current.status === 'loading') return 'Loading more values…';
		if (current.status === 'error') return current.error ?? '';
		if (complete)
			return 'Apply to graph replaces the variables with these values. Close or Change leaves the graph unchanged.';
		if (!candidates.length) return `No values for ${nameOf(variable)} fit the steps above.`;
		return `${candidates.length} value${candidates.length === 1 ? '' : 's'} for ${nameOf(variable)}.`;
	});

	const preview = $derived.by(() => {
		const candidate = current.previewCandidate;
		const next = current.order[current.stage + 1];
		if (!candidate || !next) return null;
		const shown: PreviewState =
			current.preview.key === current.previewKey
				? current.preview
				: { key: null, status: 'loading' };
		const items = shown.status === 'loaded' ? shown.page!.candidates : [];
		const line =
			shown.status === 'error'
				? (shown.error ?? '')
				: shown.status !== 'loaded'
					? `Loading values for ${nameOf(next)}…`
					: !items.length
						? `No values for ${next} under this assumption.`
						: shown.page!.hasMore
							? `First ${items.length} values:`
							: `${items.length} value${items.length === 1 ? '' : 's'}:`;
		return {
			heading: `If ${nameOf(current.order[current.stage])} = ${candidateText(candidate)}, ${nameOf(next)} could be:`,
			line,
			error: shown.status === 'error',
			items
		};
	});

	// Stage changes move focus to the heading (legacy enterStage / summary).
	let lastStage = -1;
	$effect(() => {
		const stage = current.stage;
		if (stage !== lastStage) {
			const first = lastStage === -1;
			lastStage = stage;
			if (!first) tick().then(() => heading?.focus());
		}
	});

	// Focus starts on Close when the panel opens.
	$effect(() => {
		void exploration.opened;
		tick().then(() =>
			document
				.querySelector<HTMLButtonElement>('#two-variable-panel [data-panel-close]')
				?.focus()
		);
	});

	function choose(candidate: StageCandidate) {
		exploration.select(candidate);
	}
</script>

<Panel
	id="two-variable-panel"
	title="Find matching values"
	closeLabel="Close Find matching values"
	closeId="two-variable-panel-close"
	{onclose}
	class="pointer-events-auto max-h-[55%] w-full shrink-0 overflow-y-auto lg:max-h-full lg:w-[min(26rem,100%)]"
	aria-describedby="two-variable-panel-description"
>
	<p id="two-variable-panel-description" class="text-xs text-muted-foreground">
		Choose one value per step. Each step only lists values that fit the steps above it.
	</p>
	<ol id="stage-steps" aria-label="Steps" class="flex flex-col">
		{#each current.order as name, index (name)}
			{@const label = nameOf(name)}
			{@const last = index === current.order.length - 1}
			<li
				class="stage-step flex gap-3"
				data-variable={name}
				aria-current={index === current.stage ? 'step' : undefined}
			>
				<div class="flex flex-col items-center">
					{#if index < current.stage}
						<span
							class="flex size-7 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground"
							><CheckIcon role="img" aria-label="Done" class="size-4" /></span
						>
					{:else}
						<span
							aria-hidden="true"
							class={[
								'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums',
								index === current.stage
									? 'bg-stage text-stage-foreground'
									: 'border text-muted-foreground'
							]}>{index + 1}</span
						>
					{/if}
					{#if !last}
						<span
							aria-hidden="true"
							class={[
								'min-h-3 w-0.5 grow',
								index < current.stage ? 'bg-success' : 'bg-border'
							]}
						></span>
					{/if}
				</div>
				<div class={['flex min-w-0 grow flex-col gap-2', !last && 'pb-4']}>
					{#if index < current.stage}
						<div class="stage-commitment flex items-start justify-between gap-2 pt-0.5">
							<div
								class="flex min-w-0 flex-col"
								title={current.bindings[index]?.term.value}
							>
								<span class="stage-commitment-name text-sm font-semibold"
									>{label}</span
								>
								<span class="stage-commitment-value truncate text-sm"
									>{current.labels[index]}</span
								>
							</div>
							<Button
								variant="outline"
								size="sm"
								class="stage-change"
								aria-label="Change {label}"
								onclick={() => exploration.back(index)}>Change</Button
							>
						</div>
					{:else if index > current.stage}
						<div class="flex flex-col pt-0.5 text-muted-foreground">
							<span class="text-sm font-semibold">{label}</span>
							<span class="text-xs"
								>Chosen after {nameOf(current.order[index - 1])}</span
							>
						</div>
					{:else}
						{@render stage()}
					{/if}
				</div>
			</li>
		{/each}
	</ol>
	{#if complete}
		<section aria-labelledby="stage-heading" class="flex flex-col gap-2">
			<h3
				id="stage-heading"
				bind:this={heading}
				tabindex="-1"
				class="text-sm font-semibold focus:outline-none"
			>
				All variables chosen
			</h3>
			<p
				id="stage-status"
				role="status"
				aria-live="polite"
				class="text-xs text-muted-foreground"
			>
				{status}
			</p>
			<Button
				id="stage-apply"
				size="sm"
				class="self-start bg-success text-success-foreground hover:bg-success/85"
				onclick={() => exploration.apply()}>Apply to graph</Button
			>
		</section>
	{/if}
</Panel>

{#snippet stage()}
	<section id="stage-view" aria-labelledby="stage-heading" class="flex flex-col gap-2">
		<div class="flex flex-col gap-0.5 pt-0.5">
			<h3
				id="stage-heading"
				bind:this={heading}
				tabindex="-1"
				class="text-sm font-semibold focus:outline-none"
			>
				Step {current.stage + 1} of {current.order.length}: {nameOf(variable)}
			</h3>
			<p
				id="stage-status"
				role="status"
				aria-live="polite"
				class="text-xs"
				class:text-danger={current.status === 'error'}
				class:text-muted-foreground={current.status !== 'error'}
			>
				{status}
			</p>
		</div>
		{#if current.status === 'error'}<Button
				id="stage-retry"
				size="sm"
				variant="outline"
				class="self-start"
				onclick={() => exploration.retry()}>Retry</Button
			>{/if}
		<ul
			bind:this={list}
			id="stage-candidates"
			aria-labelledby="stage-heading"
			class="flex flex-col gap-1"
		>
			{#each candidates as candidate (termKey(candidate.term))}
				<li class="flex items-stretch gap-1">
					<button
						type="button"
						class="stage-candidate flex flex-1 items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:text-muted-foreground"
						data-term={termKey(candidate.term)}
						title={candidate.term.value}
						disabled={!candidate.selectable}
						onclick={() => choose(candidate)}
						onmouseenter={() => exploration.preview(candidate)}
						onfocus={() => exploration.preview(candidate)}
						onmouseleave={() => exploration.settle()}
						onblur={() => exploration.settle()}
					>
						<span>{candidateText(candidate)}</span>
						<span
							class="stage-candidate-hint text-xs whitespace-nowrap text-muted-foreground"
							>{termHint(candidate.term)}{candidate.selectable
								? ''
								: ' (not selectable)'}</span
						>
					</button>
					{#if candidate.selectable}
						<button
							type="button"
							class="stage-assume rounded-md border border-success px-2 text-xs text-success hover:bg-success hover:text-success-foreground focus-visible:bg-success focus-visible:text-success-foreground focus-visible:outline-none"
							aria-label="Assume {nameOf(variable)} = {candidateText(
								candidate
							)} in the graph now"
							title="Apply this value to the graph now"
							onclick={() => onassume(exploration.assume(candidate))}
							onmouseenter={() => exploration.preview(candidate)}
							onfocus={() => exploration.preview(candidate)}
							onmouseleave={() => exploration.settle()}
							onblur={() => exploration.settle()}>Assume</button
						>
					{/if}
				</li>
			{/each}
		</ul>
		{#if current.status === 'loaded' && current.pages.at(-1)?.hasMore}
			<Button
				id="stage-load-more"
				variant="ghost"
				size="sm"
				class="self-start"
				onclick={() => exploration.loadMore()}>Load more</Button
			>
		{/if}
		{#if preview}
			<section
				id="stage-preview"
				aria-labelledby="stage-preview-heading"
				aria-live="polite"
				class="flex flex-col gap-1 rounded-md bg-muted p-2 text-sm"
			>
				<h4 id="stage-preview-heading" class="font-medium">{preview.heading}</h4>
				<p
					id="stage-preview-status"
					class="text-xs"
					class:text-danger={preview.error}
					class:text-muted-foreground={!preview.error}
				>
					{preview.line}
				</p>
				<ul id="stage-preview-list" class="flex flex-col text-xs">
					{#each preview.items as item (termKey(item.term))}<li>
							{candidateText(item)} ({termHint(item.term)})
						</li>{/each}
				</ul>
			</section>
		{/if}
	</section>
{/snippet}

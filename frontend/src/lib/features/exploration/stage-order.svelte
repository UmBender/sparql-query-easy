<!--
	The order in which Run Query explores the variables (FE-009, FE-056): shown
	for two or more variables as numbered chips with readable names. Change
	order opens a list where Move earlier/later buttons and pointer drag both
	reorder; a live region announces the move. Hover/focus emphasizes the
	variable (FE-023).
-->
<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Chip } from '#lib/components/ui/chip/index.js';
	import { IconButton } from '#lib/components/ui/icon-button/index.js';
	import * as Popover from '#lib/components/ui/popover/index.js';
	import type { QueryStore } from '#lib/stores/query-store.svelte.js';
	import type { Emphasis } from './emphasis.svelte.js';

	let { store, emphasis }: { store: QueryStore; emphasis: Emphasis } = $props();

	let open = $state(false);
	let status = $state('');
	let drag = $state.raw<{ from: number; to: number } | null>(null);
	let list = $state<HTMLOListElement | null>(null);

	function move(from: number, to: number) {
		if (!store.moveStage(from, to)) return;
		status = `${store.nameOf(store.order[to])} is now step ${to + 1} of ${store.order.length}.`;
	}

	function focusAfterMove(name: string, action: 'earlier' | 'later') {
		requestAnimationFrame(() => {
			const step = list?.querySelector(`[data-variable="${CSS.escape(name)}"]`);
			const button = step?.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
			(button && !button.disabled
				? button
				: step?.querySelector<HTMLButtonElement>('button:not(:disabled)')
			)?.focus();
		});
	}

	function hoverHandlers(name: string) {
		return {
			onmouseenter: () => emphasis.set(name, 'block-hover'),
			onmouseleave: () => emphasis.clear('block-hover'),
			onfocusin: () => emphasis.set(name, 'block-focus'),
			onfocusout: () => emphasis.clear('block-focus')
		};
	}
</script>

{#if store.order.length >= 2}
	<div
		id="variable-order"
		role="group"
		aria-labelledby="variable-order-title"
		class="flex min-h-9 flex-wrap items-center gap-1 rounded-2xl border bg-surface py-1 pr-1 pl-2"
	>
		<span id="variable-order-title" class="sr-only">Order in which values are chosen</span>
		<ol id="variable-order-list" class="flex flex-wrap items-center gap-1">
			{#each store.order as name, index (name)}
				<li
					class="variable-block flex items-center gap-1"
					data-variable={name}
					data-index={index}
					aria-label="Step {index + 1}: {store.nameOf(name)}"
					{...hoverHandlers(name)}
				>
					<Chip
						label={store.nameOf(name)}
						number={index + 1}
						emphasized={emphasis.name === name}
						class="variable-emphasis-target"
						data-emphasized-chip={emphasis.name === name || undefined}
					/>
					{#if index < store.order.length - 1}
						<ChevronRightIcon
							aria-hidden="true"
							class="size-3.5 text-muted-foreground"
						/>
					{/if}
				</li>
			{/each}
		</ol>
		<Popover.Root bind:open>
			<Popover.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						id="variable-order-edit"
						type="button"
						variant="secondary"
						size="sm"
						class="rounded-full">Change order</Button
					>
				{/snippet}
			</Popover.Trigger>
			<Popover.Content
				id="variable-order-popover"
				align="end"
				class="w-[min(27rem,calc(100vw-2rem))] gap-3 p-4"
				aria-labelledby="variable-order-heading"
			>
				<div class="flex flex-col gap-1">
					<h2 id="variable-order-heading" class="text-base font-semibold">
						Choose values in this order
					</h2>
					<p class="text-sm text-muted-foreground">
						Each step only lists values that fit the steps above it. Drag a step or use
						the arrows.
					</p>
				</div>
				<ol
					bind:this={list}
					id="variable-order-steps"
					class="flex flex-col gap-1.5"
					onpointermove={(event) => {
						if (!drag) return;
						const over = (
							document.elementFromPoint(
								event.clientX,
								event.clientY
							) as HTMLElement | null
						)?.closest<HTMLElement>('.variable-step');
						if (over && list?.contains(over))
							drag = { ...drag, to: Number(over.dataset.index) };
					}}
					onpointerup={() => {
						const current = drag;
						drag = null;
						if (current) move(current.from, current.to);
					}}
					onpointercancel={() => (drag = null)}
				>
					{#each store.order as name, index (name)}
						{@const label = store.nameOf(name)}
						<li
							class={[
								'variable-step flex cursor-grab touch-none items-center gap-2.5 rounded-lg border py-1.5 pr-1.5 pl-1 select-none',
								emphasis.name === name ? 'border-emphasis bg-accent' : 'bg-surface',
								drag?.from === index && 'opacity-60',
								drag !== null &&
									drag.to === index &&
									drag.from !== index &&
									'outline-dashed'
							]}
							data-variable={name}
							data-index={index}
							aria-label="Step {index + 1}: {label}"
							{...hoverHandlers(name)}
							onpointerdown={(event) => {
								if (
									event.button !== 0 ||
									(event.target as HTMLElement).closest('button')
								)
									return;
								event.preventDefault();
								(event.currentTarget as HTMLElement).setPointerCapture?.(
									event.pointerId
								);
								drag = { from: index, to: index };
							}}
						>
							<GripVerticalIcon
								aria-hidden="true"
								class="size-4 shrink-0 text-muted-foreground"
							/>
							<span
								aria-hidden="true"
								class="flex size-6 shrink-0 items-center justify-center rounded-full bg-stage text-xs font-bold text-stage-foreground tabular-nums"
								>{index + 1}</span
							>
							<span class="flex min-w-0 grow flex-col">
								<span class="truncate text-sm font-semibold">{label}</span>
								{#if store.variableNames.get(name)?.description}
									<span class="truncate text-xs text-muted-foreground"
										>{store.variableNames.get(name)?.description}</span
									>
								{/if}
							</span>
							<IconButton
								label="Move {label} earlier"
								variant="outline"
								size="icon-sm"
								data-action="earlier"
								disabled={index === 0}
								onclick={() => {
									move(index, index - 1);
									focusAfterMove(name, 'earlier');
								}}><ChevronUpIcon /></IconButton
							>
							<IconButton
								label="Move {label} later"
								variant="outline"
								size="icon-sm"
								data-action="later"
								disabled={index === store.order.length - 1}
								onclick={() => {
									move(index, index + 1);
									focusAfterMove(name, 'later');
								}}><ChevronDownIcon /></IconButton
							>
						</li>
					{/each}
				</ol>
				<div class="flex justify-end">
					<Button type="button" size="sm" onclick={() => (open = false)}>Done</Button>
				</div>
			</Popover.Content>
		</Popover.Root>
		<span id="variable-order-status" class="sr-only" aria-live="polite">{status}</span>
	</div>
{/if}

<!--
	Numbered stage-order chips next to Run Query (FE-009): shown for two or
	more variables; Move earlier/later buttons and pointer drag both reorder;
	a live region announces the move. Hover/focus emphasizes the variable (FE-023).
-->
<script lang="ts">
	import { Chip } from '#lib/components/ui/chip/index.js';
	import type { QueryStore } from '#lib/stores/query-store.svelte.js';
	import type { Emphasis } from './emphasis.svelte.js';

	let { store, emphasis }: { store: QueryStore; emphasis: Emphasis } = $props();

	let status = $state('');
	let drag = $state.raw<{ from: number; to: number } | null>(null);
	let list = $state<HTMLOListElement | null>(null);

	function move(from: number, to: number) {
		if (!store.moveStage(from, to)) return;
		status = `${store.order[to]} moved to stage ${to + 1} of ${store.order.length}.`;
	}

	function focusAfterMove(name: string, action: 'earlier' | 'later') {
		requestAnimationFrame(() => {
			const block = list?.querySelector(`[data-variable="${CSS.escape(name)}"]`);
			const button = block?.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
			(button && !button.disabled
				? button
				: block?.querySelector<HTMLButtonElement>('button:not(:disabled)')
			)?.focus();
		});
	}
</script>

{#if store.order.length >= 2}
	<div
		id="variable-order"
		role="group"
		aria-labelledby="variable-order-title"
		class="flex items-center gap-1"
	>
		<span id="variable-order-title" class="sr-only">Stage order</span>
		<ol
			bind:this={list}
			id="variable-order-list"
			class="flex flex-wrap items-center gap-1"
			onpointermove={(event) => {
				if (!drag) return;
				const over = (
					document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null
				)?.closest<HTMLElement>('.variable-block');
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
				<li
					class="variable-block cursor-grab touch-none select-none"
					class:opacity-60={drag?.from === index}
					class:outline-dashed={drag !== null && drag.to === index && drag.from !== index}
					data-variable={name}
					data-index={index}
					aria-label="Stage {index + 1}: {name}"
					onpointerdown={(event) => {
						if (event.button !== 0 || (event.target as HTMLElement).closest('button'))
							return;
						event.preventDefault();
						(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
						drag = { from: index, to: index };
					}}
					onmouseenter={() => emphasis.set(name, 'block-hover')}
					onmouseleave={() => emphasis.clear('block-hover')}
					onfocusin={() => emphasis.set(name, 'block-focus')}
					onfocusout={() => emphasis.clear('block-focus')}
				>
					<Chip
						label={name}
						number={index + 1}
						emphasized={emphasis.name === name}
						class="variable-emphasis-target"
						data-emphasized-chip={emphasis.name === name || undefined}
					>
						<button
							type="button"
							data-action="earlier"
							class="rounded px-1 text-xs hover:bg-stage-number focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-35"
							aria-label="Move {name} earlier"
							title="Move {name} earlier"
							disabled={index === 0}
							onclick={() => {
								move(index, index - 1);
								focusAfterMove(name, 'earlier');
							}}>◀</button
						>
						<button
							type="button"
							data-action="later"
							class="rounded px-1 text-xs hover:bg-stage-number focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-35"
							aria-label="Move {name} later"
							title="Move {name} later"
							disabled={index === store.order.length - 1}
							onclick={() => {
								move(index, index + 1);
								focusAfterMove(name, 'later');
							}}>▶</button
						>
					</Chip>
				</li>
			{/each}
		</ol>
		<span id="variable-order-status" class="sr-only" aria-live="polite">{status}</span>
	</div>
{/if}

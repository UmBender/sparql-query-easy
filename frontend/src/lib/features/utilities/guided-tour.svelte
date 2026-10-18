<!--
	Guided tour (legacy Intro.js tour, FE-048): nine steps over the toolbar and
	canvas, shown on the first visit (the legacy page showed it on every load).
	Next, Back, Skip; Escape closes; the highlighted control gets a ring.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { markSeen, seen, TOUR_KEY } from './seen.js';
	import { TOUR_STEPS } from './tour-steps.js';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let index = $state(0);
	let box = $state<{ top: number; left: number; width: number; height: number } | null>(null);
	let card = $state<HTMLElement | null>(null);

	onMount(() => {
		if (!seen(TOUR_KEY)) open = true;
	});

	function place() {
		const element = document.querySelector<HTMLElement>(TOUR_STEPS[index].target);
		const rect = element?.getBoundingClientRect();
		box =
			rect && rect.width
				? { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
				: null;
	}

	$effect(() => {
		if (!open) return;
		void index;
		place();
		tick().then(() => card?.querySelector<HTMLButtonElement>('[data-tour-primary]')?.focus());
		window.addEventListener('resize', place);
		return () => window.removeEventListener('resize', place);
	});

	function finish() {
		markSeen(TOUR_KEY);
		open = false;
		index = 0;
	}

	const position = $derived.by(() => {
		if (!box) return { top: 96, left: 16 };
		const below = box.top + box.height + 12;
		const top = below + 180 > window.innerHeight ? Math.max(16, box.top - 192) : below;
		const left = Math.min(Math.max(16, box.left), window.innerWidth - 336);
		return { top, left };
	});
</script>

{#if open}
	<div
		class="fixed inset-0 z-(--z-dialog) bg-foreground/30"
		aria-hidden="true"
		onclick={finish}
	></div>
	{#if box}
		<div
			class="pointer-events-none fixed z-(--z-dialog) rounded-md ring-4 ring-primary"
			style:top="{box.top - 4}px"
			style:left="{box.left - 4}px"
			style:width="{box.width + 8}px"
			style:height="{box.height + 8}px"
			aria-hidden="true"
		></div>
	{/if}
	<div
		bind:this={card}
		id="guided-tour"
		role="dialog"
		aria-modal="true"
		aria-labelledby="guided-tour-title"
		tabindex="-1"
		class="fixed z-(--z-toast) flex w-80 flex-col gap-3 rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg"
		style:top="{position.top}px"
		style:left="{position.left}px"
		onkeydown={(event) => {
			if (event.key === 'Escape') {
				event.stopPropagation();
				finish();
			}
		}}
	>
		<h2 id="guided-tour-title" class="text-sm font-semibold">
			Step {index + 1} of {TOUR_STEPS.length}
		</h2>
		<p data-testid="tour-text" class="text-sm">{TOUR_STEPS[index].text}</p>
		<div class="flex justify-between gap-2">
			<Button variant="ghost" size="sm" onclick={finish}>Skip tour</Button>
			<div class="flex gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={index === 0}
					onclick={() => (index -= 1)}>Back</Button
				>
				{#if index < TOUR_STEPS.length - 1}
					<Button size="sm" data-tour-primary onclick={() => (index += 1)}>Next</Button>
				{:else}
					<Button size="sm" data-tour-primary onclick={finish}>Done</Button>
				{/if}
			</div>
		</div>
	</div>
{/if}

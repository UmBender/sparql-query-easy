<!--
	A 1..max rating as a radio group (questionnaires, STUDY-002). `value` is
	bindable and null until chosen; the end labels describe the extremes.
-->
<script lang="ts">
	import { cn } from '#lib/utils.js';

	let {
		name,
		legend,
		max = 5,
		minLabel,
		maxLabel,
		value = $bindable(null),
		disabled = false,
		class: className
	}: {
		name: string;
		legend: string;
		max?: number;
		minLabel?: string;
		maxLabel?: string;
		value?: number | null;
		disabled?: boolean;
		class?: string;
	} = $props();

	const options = $derived(Array.from({ length: max }, (_, index) => index + 1));
</script>

<fieldset data-slot="rating-scale" class={cn('flex flex-col gap-1.5', className)} {disabled}>
	<legend class="mb-1 text-sm font-medium">{legend}</legend>
	<div class="flex items-center gap-2">
		{#if minLabel}<span class="text-xs text-muted-foreground" aria-hidden="true"
				>{minLabel}</span
			>{/if}
		{#each options as option (option)}
			<label
				class="relative inline-flex size-9 cursor-pointer items-center justify-center rounded-md border text-sm font-medium has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
			>
				<input
					class="sr-only"
					type="radio"
					{name}
					value={option}
					checked={value === option}
					onchange={() => (value = option)}
					aria-label={option === 1 && minLabel
						? `${option} (${minLabel})`
						: option === max && maxLabel
							? `${option} (${maxLabel})`
							: String(option)}
				/>
				{option}
			</label>
		{/each}
		{#if maxLabel}<span class="text-xs text-muted-foreground" aria-hidden="true"
				>{maxLabel}</span
			>{/if}
	</div>
</fieldset>

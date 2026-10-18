<!--
	A small labelled token. With `number` it is a numbered stage-order chip
	(the legacy orange variable blocks, FE-009); `emphasized` draws the halo a
	variable shares with its graph elements (FE-023). Trailing controls go in
	`children`.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils.js';

	let {
		label,
		number,
		emphasized = false,
		class: className,
		children,
		...restProps
	}: HTMLAttributes<HTMLSpanElement> & {
		label: string;
		number?: number;
		emphasized?: boolean;
		children?: Snippet;
	} = $props();
</script>

<span
	data-slot="chip"
	data-emphasized={emphasized || undefined}
	class={cn(
		'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-sm',
		number === undefined
			? 'border-border bg-secondary text-secondary-foreground'
			: 'border-stage-border bg-stage text-stage-foreground',
		emphasized && 'outline-3 outline-offset-1 outline-emphasis',
		className
	)}
	{...restProps}
>
	{#if number !== undefined}
		<span
			data-slot="chip-number"
			aria-hidden="true"
			class="rounded-sm bg-stage-number px-1 text-xs font-semibold tabular-nums"
			>{number}</span
		>
	{/if}
	<span data-slot="chip-label" class={number === undefined ? '' : 'font-mono'}>{label}</span>
	{@render children?.()}
</span>

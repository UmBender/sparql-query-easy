<!--
	Badge over a filtered node (FE-036/FE-039): `kept` and `empty` show a
	kept/total count, `pass` and `fail` an actual value checked against the
	filter, `loading` and `error` the request state. `description` is the
	accessible name and tooltip.
-->
<script lang="ts" module>
	import { tv } from 'tailwind-variants';

	export const countBadgeVariants = tv({
		base: 'inline-flex min-w-6 items-center justify-center rounded-full border px-1.5 text-xs leading-5 font-semibold tabular-nums shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
		variants: {
			state: {
				kept: 'border-transparent bg-success text-success-foreground',
				empty: 'border-transparent bg-danger text-danger-foreground',
				pass: 'border-transparent bg-success text-success-foreground',
				fail: 'border-transparent bg-danger text-danger-foreground',
				loading: 'border-border bg-muted text-muted-foreground',
				error: 'border-transparent bg-warning text-warning-foreground'
			}
		}
	});

	export type CountBadgeState = 'kept' | 'empty' | 'pass' | 'fail' | 'loading' | 'error';
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils.js';

	let {
		state,
		text,
		description,
		class: className,
		...restProps
	}: HTMLAttributes<HTMLSpanElement> & {
		state: CountBadgeState;
		text: string;
		description: string;
	} = $props();
</script>

<!-- Focusable like the legacy badges, so keyboard users reach its description. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<span
	data-slot="count-badge"
	data-state={state}
	role="note"
	tabindex="0"
	title={description}
	aria-label={description}
	aria-busy={state === 'loading'}
	class={cn(countBadgeVariants({ state }), className)}
	{...restProps}>{text}</span
>

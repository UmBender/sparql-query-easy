<!--
	A titled floating panel (exploration, funnel, possible graph). The heading
	names the region; `onclose` adds a Close button labelled with `closeLabel`.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import XIcon from '@lucide/svelte/icons/x';
	import { cn } from '#lib/utils.js';
	import { IconButton } from '#lib/components/ui/icon-button/index.js';

	let {
		title,
		id,
		onclose,
		closeLabel = 'Close',
		class: className,
		children,
		...restProps
	}: HTMLAttributes<HTMLElement> & {
		title: string;
		id: string;
		onclose?: () => void;
		closeLabel?: string;
		children?: Snippet;
	} = $props();
</script>

<section
	{id}
	aria-labelledby="{id}-title"
	data-slot="panel"
	class={cn(
		'flex flex-col gap-2 rounded-lg border bg-surface p-3 text-surface-foreground shadow-md',
		className
	)}
	{...restProps}
>
	<header class="flex items-center justify-between gap-2">
		<h2 id="{id}-title" class="text-base font-semibold">{title}</h2>
		{#if onclose}
			<IconButton label={closeLabel} size="icon-sm" onclick={onclose} data-panel-close>
				<XIcon />
			</IconButton>
		{/if}
	</header>
	{@render children?.()}
</section>

<!--
	Label, optional description and errors around one form control. The control
	is rendered by `children`, which receives the id and ARIA attributes to
	spread on it. `errors` takes Superforms' `$errors.field` (string array).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Label } from '#lib/components/ui/label/index.js';
	import { cn } from '#lib/utils.js';

	type ControlProps = {
		id: string;
		'aria-describedby': string | undefined;
		'aria-invalid': 'true' | undefined;
	};

	let {
		id,
		label,
		description,
		errors = [],
		class: className,
		children
	}: {
		id: string;
		label: string;
		description?: string;
		errors?: string[] | null;
		class?: string;
		children: Snippet<[ControlProps]>;
	} = $props();

	const errorList = $derived(errors ?? []);
	const describedBy = $derived(
		[description ? `${id}-description` : null, errorList.length ? `${id}-errors` : null]
			.filter(Boolean)
			.join(' ') || undefined
	);
</script>

<div data-slot="field" class={cn('flex flex-col gap-1.5', className)}>
	<Label for={id}>{label}</Label>
	{@render children({
		id,
		'aria-describedby': describedBy,
		'aria-invalid': errorList.length ? 'true' : undefined
	})}
	{#if description}
		<p id="{id}-description" class="text-xs text-muted-foreground">{description}</p>
	{/if}
	{#if errorList.length}
		<ul id="{id}-errors" class="text-xs text-danger" data-slot="field-errors">
			{#each errorList as error (error)}<li>{error}</li>{/each}
		</ul>
	{/if}
</div>

<!--
	A choice question's frame (STUDY-009): the question as the legend of a
	fieldset, its description and its errors, which the controls point to.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Question } from '#lib/domain/forms.js';

	let {
		question,
		errors = [],
		children
	}: {
		question: Question;
		errors?: string[];
		children: Snippet<[{ describedBy: string | undefined; invalid: boolean }]>;
	} = $props();

	const describedBy = $derived(
		[
			question.description ? `${question.id}-description` : null,
			errors.length ? `${question.id}-errors` : null
		]
			.filter(Boolean)
			.join(' ') || undefined
	);
</script>

<fieldset class="flex flex-col gap-2" data-question={question.id} aria-describedby={describedBy}>
	<legend class="mb-1 text-sm font-medium">
		{question.text}{#if !question.required}<span class="font-normal text-muted-foreground">
				(optional)</span
			>{/if}
	</legend>
	{#if question.description}
		<p id="{question.id}-description" class="text-xs text-muted-foreground">
			{question.description}
		</p>
	{/if}
	{@render children({ describedBy, invalid: errors.length > 0 })}
	{#if errors.length}
		<ul id="{question.id}-errors" class="text-xs text-danger" data-slot="field-errors">
			{#each errors as error (error)}<li>{error}</li>{/each}
		</ul>
	{/if}
</fieldset>

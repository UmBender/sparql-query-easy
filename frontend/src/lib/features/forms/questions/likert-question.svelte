<!-- STUDY-009: a 1..scaleMax rating (default 5) with the questionnaire scale component. -->
<script lang="ts">
	import { RatingScale } from '#lib/components/ui/rating-scale/index.js';
	import type { Question } from '#lib/domain/forms.js';

	let {
		question,
		value = $bindable(null),
		errors = []
	}: { question: Question; value?: number | null; errors?: string[] } = $props();
</script>

<div class="flex flex-col gap-1.5" data-question={question.id}>
	<RatingScale
		name={question.id}
		legend={question.required ? question.text : `${question.text} (optional)`}
		max={question.scaleMax ?? 5}
		minLabel={question.minLabel ?? undefined}
		maxLabel={question.maxLabel ?? undefined}
		bind:value
	/>
	{#if question.description}
		<p class="text-xs text-muted-foreground">{question.description}</p>
	{/if}
	{#if errors.length}
		<ul class="text-xs text-danger" data-slot="field-errors" role="alert">
			{#each errors as error (error)}<li>{error}</li>{/each}
		</ul>
	{/if}
</div>

<!-- STUDY-009: a number, with its range and whole-number rule as the field's description. -->
<script lang="ts">
	import { Field } from '#lib/components/ui/field/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import type { Question } from '#lib/domain/forms.js';

	let {
		question,
		value = $bindable(null),
		errors = []
	}: { question: Question; value?: number | null; errors?: string[] } = $props();

	const description = $derived(
		[
			question.description,
			question.min != null && question.max != null
				? `From ${question.min} to ${question.max}.`
				: question.min != null
					? `At least ${question.min}.`
					: question.max != null
						? `At most ${question.max}.`
						: null,
			question.integer ? 'A whole number.' : null
		]
			.filter(Boolean)
			.join(' ') || undefined
	);
</script>

<div data-question={question.id}>
	<Field
		id={question.id}
		label={question.required ? question.text : `${question.text} (optional)`}
		{description}
		{errors}
	>
		{#snippet children(props)}
			<Input
				{...props}
				type="number"
				name={question.id}
				inputmode={question.integer ? 'numeric' : 'decimal'}
				step={question.integer ? 1 : 'any'}
				min={question.min ?? undefined}
				max={question.max ?? undefined}
				bind:value
			/>
		{/snippet}
	</Field>
</div>

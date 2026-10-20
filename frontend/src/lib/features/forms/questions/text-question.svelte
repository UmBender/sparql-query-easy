<!-- STUDY-009: short text as one line, long text as a growing text area; both show the length limit. -->
<script lang="ts">
	import { Field } from '#lib/components/ui/field/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import type { Question } from '#lib/domain/forms.js';

	let {
		question,
		value = $bindable(''),
		errors = []
	}: { question: Question; value?: string; errors?: string[] } = $props();

	const limit = $derived(question.maxLength ?? (question.type === 'short_text' ? 200 : 2000));
	const description = $derived(
		[question.description, `Up to ${limit} characters.`].filter(Boolean).join(' ')
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
			{#if question.type === 'long_text'}
				<Textarea {...props} name={question.id} bind:value rows={4} />
			{:else}
				<Input {...props} name={question.id} autocomplete="off" bind:value />
			{/if}
		{/snippet}
	</Field>
</div>

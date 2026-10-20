<!-- STUDY-009: one option of several, as a radio group; '' is unanswered. -->
<script lang="ts">
	import { Label } from '#lib/components/ui/label/index.js';
	import * as RadioGroup from '#lib/components/ui/radio-group/index.js';
	import type { Question } from '#lib/domain/forms.js';
	import QuestionFrame from '../question-frame.svelte';

	let {
		question,
		value = $bindable(''),
		errors = []
	}: { question: Question; value?: string; errors?: string[] } = $props();
</script>

<QuestionFrame {question} {errors}>
	{#snippet children({ invalid })}
		<RadioGroup.Root bind:value name={question.id} aria-invalid={invalid ? 'true' : undefined}>
			{#each question.options ?? [] as option (option.value)}
				<div class="flex items-center gap-2">
					<RadioGroup.Item value={option.value} id="{question.id}-{option.value}" />
					<Label for="{question.id}-{option.value}" class="font-normal"
						>{option.label}</Label
					>
				</div>
			{/each}
		</RadioGroup.Root>
	{/snippet}
</QuestionFrame>

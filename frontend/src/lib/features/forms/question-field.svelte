<!-- STUDY-009: the component for a question's type. -->
<script lang="ts">
	import type { AnswerValue, Question } from '#lib/domain/forms.js';
	import LikertQuestion from './questions/likert-question.svelte';
	import MultipleChoiceQuestion from './questions/multiple-choice-question.svelte';
	import NumberQuestion from './questions/number-question.svelte';
	import SingleChoiceQuestion from './questions/single-choice-question.svelte';
	import TextQuestion from './questions/text-question.svelte';

	let {
		question,
		value = $bindable(),
		errors = []
	}: { question: Question; value: AnswerValue; errors?: string[] } = $props();
</script>

{#if question.type === 'single_choice'}
	<SingleChoiceQuestion
		{question}
		{errors}
		bind:value={() => value as string, (next) => (value = next)}
	/>
{:else if question.type === 'multiple_choice'}
	<MultipleChoiceQuestion
		{question}
		{errors}
		bind:value={() => value as string[], (next) => (value = next)}
	/>
{:else if question.type === 'likert'}
	<LikertQuestion
		{question}
		{errors}
		bind:value={() => value as number | null, (next) => (value = next)}
	/>
{:else if question.type === 'number'}
	<NumberQuestion
		{question}
		{errors}
		bind:value={() => value as number | null, (next) => (value = next)}
	/>
{:else}
	<TextQuestion
		{question}
		{errors}
		bind:value={() => value as string, (next) => (value = next)}
	/>
{/if}

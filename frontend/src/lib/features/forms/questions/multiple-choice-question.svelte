<!-- STUDY-009: any number of options as checkboxes, kept in the options' order. -->
<script lang="ts">
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import type { Question } from '#lib/domain/forms.js';
	import QuestionFrame from '../question-frame.svelte';

	let {
		question,
		value = $bindable([]),
		errors = []
	}: { question: Question; value?: string[]; errors?: string[] } = $props();

	function toggle(option: string, checked: boolean) {
		const chosen = checked ? [...value, option] : value.filter((item) => item !== option);
		value = (question.options ?? [])
			.map((item) => item.value)
			.filter((item) => chosen.includes(item));
	}
</script>

<QuestionFrame {question} {errors}>
	{#snippet children({ invalid })}
		<div class="flex flex-col gap-2">
			{#each question.options ?? [] as option (option.value)}
				<div class="flex items-center gap-2">
					<Checkbox
						id="{question.id}-{option.value}"
						checked={value.includes(option.value)}
						onCheckedChange={(checked) => toggle(option.value, checked === true)}
						aria-invalid={invalid ? 'true' : undefined}
					/>
					<Label for="{question.id}-{option.value}" class="font-normal"
						>{option.label}</Label
					>
				</div>
			{/each}
		</div>
	{/snippet}
</QuestionFrame>

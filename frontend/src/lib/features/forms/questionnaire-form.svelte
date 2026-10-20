<!--
	A questionnaire rendered from its definition (STUDY-009): one page at a
	time, each checked by its part of the Zod schema `formSchema` builds before
	Next, and the whole form before `onsubmit`. The rules and messages are the
	server's (parity fixtures), and errors the server returns per question are
	shown on the same fields. `onprogress` reports the answers and page after
	each Next, so the caller can keep them (STUDY-010).
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { defaults, setError, superForm } from 'sveltekit-superforms';
	import { zod4 as zod } from 'sveltekit-superforms/adapters';
	import { Button } from '#lib/components/ui/button/index.js';
	import {
		emptyAnswers,
		formSchema,
		type Answers,
		type FormDefinition
	} from '#lib/domain/forms.js';
	import QuestionField from './question-field.svelte';

	let {
		definition,
		initialAnswers,
		initialPage = 0,
		submitLabel = 'Submit',
		onsubmit,
		onprogress
	}: {
		definition: FormDefinition;
		initialAnswers?: Answers;
		initialPage?: number;
		submitLabel?: string;
		/** Sends the answers; resolves to the server's error per question, or null when stored. */
		onsubmit: (answers: Answers) => Promise<Record<string, string> | null>;
		onprogress?: (answers: Answers, page: number) => void;
	} = $props();

	const form = untrack(() => definition);
	const schema = zod(formSchema(form));
	const start = untrack(() => ({ ...emptyAnswers(form), ...(initialAnswers ?? {}) }));
	let page = $state(untrack(() => Math.min(Math.max(initialPage, 0), form.pages.length - 1)));
	let failure = $state('');
	const last = $derived(page === form.pages.length - 1);

	const superform = superForm(defaults(start, schema), {
		SPA: true,
		dataType: 'json',
		validators: schema,
		resetForm: false,
		async onUpdate({ form: submitted }) {
			failure = '';
			if (!submitted.valid) {
				const wrong = form.pages.findIndex((item) =>
					item.questions.some((question) => submitted.errors[question.id])
				);
				if (wrong >= 0) page = wrong;
				return;
			}
			try {
				const errors = await onsubmit(submitted.data as Answers);
				for (const [id, message] of Object.entries(errors ?? {}))
					setError(submitted, id, message);
			} catch (error) {
				failure = error instanceof Error ? error.message : String(error);
			}
		}
	});
	const { form: data, errors, enhance, submitting } = superform;

	/** Superforms keeps an array field's own errors under `_errors`. */
	function errorsOf(id: string): string[] {
		const value = ($errors as Record<string, unknown>)[id];
		if (Array.isArray(value)) return value as string[];
		const nested = (value as { _errors?: string[] } | undefined)?._errors;
		return nested ?? [];
	}

	async function next() {
		const result = await superform.validateForm({
			update: true,
			schema: zod(formSchema(form, page))
		});
		if (!result.valid) return;
		page += 1;
		onprogress?.($data as Answers, page);
	}
</script>

<form method="POST" use:enhance class="flex flex-col gap-6" aria-labelledby="form-title" novalidate>
	<header class="flex flex-col gap-1">
		<h1 id="form-title" class="text-xl font-semibold">{form.title}</h1>
		{#if form.description}<p class="text-sm text-muted-foreground">{form.description}</p>{/if}
		{#if form.pages.length > 1}
			<p class="text-xs text-muted-foreground" data-testid="form-page">
				Page {page + 1} of {form.pages.length}
			</p>
		{/if}
	</header>
	<section aria-labelledby="page-title" class="flex flex-col gap-5">
		<h2 id="page-title" class="text-base font-semibold">{form.pages[page].title}</h2>
		{#each form.pages[page].questions as question (question.id)}
			<QuestionField
				{question}
				errors={errorsOf(question.id)}
				bind:value={
					() => ($data as Answers)[question.id],
					(next) => (($data as Answers)[question.id] = next)
				}
			/>
		{/each}
	</section>
	{#if failure}<p class="text-sm text-danger" role="alert">{failure}</p>{/if}
	<div class="flex flex-wrap gap-2 border-t pt-4">
		{#if page > 0}
			<Button type="button" variant="outline" onclick={() => (page -= 1)}>Back</Button>
		{/if}
		{#if last}
			<Button type="submit" disabled={$submitting}>{submitLabel}</Button>
		{:else}
			<Button type="button" onclick={next}>Next</Button>
		{/if}
	</div>
</form>

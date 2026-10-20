<!--
	One questionnaire in the study flow (STUDY-010, DEC-015 Q3): the profile
	before the proposed tasks, the usability questionnaire after the final
	submission. Answers of completed pages are kept in this browser until the
	submit (DEC-015 Q4); the server checks them again and answers the error per
	question, which the form shows on its fields.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { createQuery } from '@tanstack/svelte-query';
	import { api, questionErrors, type StudyFormSummary } from '#lib/api/client.js';
	import { appQueryClient, queryKeys } from '#lib/api/queries.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { Answers } from '#lib/domain/forms.js';
	import {
		clearProgress,
		loadProgress,
		saveProgress
	} from '#lib/features/forms/form-progress.js';
	import QuestionnaireForm from '#lib/features/forms/questionnaire-form.svelte';
	import { authSession } from '#lib/features/auth/auth-session.svelte.js';

	let { form, user, intro }: { form: StudyFormSummary; user: string; intro: string } = $props();

	const definition = createQuery(() => ({
		queryKey: queryKeys.studyForm(form.slug),
		queryFn: ({ signal }) => api.study.form(form.slug, { signal }),
		staleTime: 0
	}));

	async function submit(answers: Answers): Promise<Record<string, string> | null> {
		const current = definition.data!;
		try {
			await api.study.submitForm(current.slug, current.version, answers);
		} catch (error) {
			const errors = questionErrors(error);
			if (errors) return errors;
			throw error;
		}
		clearProgress(user, current.slug, current.version);
		await appQueryClient.invalidateQueries({ queryKey: queryKeys.study });
		return null;
	}
</script>

<main class="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-4 bg-background px-4 py-10">
	<header class="flex flex-wrap items-start justify-between gap-2">
		<p class="max-w-prose text-sm text-muted-foreground" data-testid="questionnaire-intro">
			{intro}
		</p>
		<div class="flex gap-2">
			<Button variant="outline" href={resolve('/')}>Back to the editor</Button>
			<Button variant="outline" onclick={() => authSession.logout()}>Log out</Button>
		</div>
	</header>
	{#if definition.isPending}
		<p class="text-sm text-muted-foreground" role="status">Loading the questionnaire…</p>
	{:else if definition.isError}
		<p class="text-sm text-danger" role="alert">{definition.error.message}</p>
	{:else}
		{@const current = definition.data}
		{@const saved = loadProgress(user, current.slug, current.version)}
		<section
			class="rounded-lg border bg-surface p-6 text-surface-foreground shadow-md"
			data-testid="questionnaire"
			data-slug={current.slug}
		>
			{#key `${current.slug}:${current.version}`}
				<QuestionnaireForm
					definition={current}
					initialAnswers={saved?.answers}
					initialPage={saved?.page}
					submitLabel="Send my answers"
					onsubmit={submit}
					onprogress={(answers, page) =>
						saveProgress(user, current.slug, current.version, { answers, page })}
				/>
			{/key}
		</section>
	{/if}
</main>

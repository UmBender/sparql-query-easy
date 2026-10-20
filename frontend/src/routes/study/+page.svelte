<!--
	The proposed queries (STUDY-003): the active tasks of the participant's
	group, in the group's order (STUDY-007), or a note that none are assigned,
	and the final submission (STUDY-005), after which the finished view shows.
	The consent screen comes first until the current text is accepted
	(STUDY-008), then the profile questionnaire until it is answered; after
	the final submission the usability questionnaire comes before the finished
	view (STUDY-010, DEC-015 Q3). Admins skip both. The root layout's guard
	sends anonymous visitors to login (AUTH-004).
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { createQuery } from '@tanstack/svelte-query';
	import { ApiError, api } from '#lib/api/client.js';
	import { queryKeys } from '#lib/api/queries.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { CONSENT_REQUIRED, PROFILE_REQUIRED } from '#lib/domain/study.js';
	import { authSession } from '#lib/features/auth/auth-session.svelte.js';
	import ConsentScreen from '#lib/features/study/consent-screen.svelte';
	import FinishStudy from '#lib/features/study/finish-study.svelte';
	import QuestionnaireStep from '#lib/features/study/questionnaire-step.svelte';
	import StudyFinished from '#lib/features/study/study-finished.svelte';

	const consent = createQuery(() => ({
		queryKey: queryKeys.studyConsent,
		queryFn: ({ signal }) => api.study.consent({ signal }),
		staleTime: 0
	}));
	const admin = $derived(authSession.user?.role === 'admin');
	const consented = $derived(!!consent.data?.acceptedAt || admin);
	const forms = createQuery(() => ({
		queryKey: queryKeys.studyForms,
		queryFn: ({ signal }) => api.study.forms({ signal }),
		staleTime: 0,
		enabled: consented
	}));
	const before = $derived(forms.data?.find((form) => form.phase === 'before_tasks'));
	const after = $derived(forms.data?.find((form) => form.phase === 'after_finish'));
	const pending = (form: typeof before) => !admin && !!form && !form.submittedAt;
	const tasks = createQuery(() => ({
		queryKey: queryKeys.studyTasks,
		queryFn: ({ signal }) => api.study.tasks({ signal }),
		staleTime: 0,
		enabled: consented && forms.isSuccess && !pending(before)
	}));
	const finished = $derived(
		tasks.error instanceof ApiError &&
			tasks.error.kind === 'forbidden' &&
			tasks.error.message !== CONSENT_REQUIRED &&
			tasks.error.message !== PROFILE_REQUIRED
	);
	const user = $derived(authSession.user?.username ?? '');
</script>

<svelte:head><title>Proposed queries · SPARQL EasyQuery</title></svelte:head>

{#if consent.isPending}
	<p class="p-6 text-sm text-muted-foreground" role="status">Loading…</p>
{:else if consent.isError}
	<p class="p-6 text-sm text-danger" role="alert">{consent.error.message}</p>
{:else if !consented}
	<ConsentScreen consent={consent.data} />
{:else if forms.isPending}
	<p class="p-6 text-sm text-muted-foreground" role="status">Loading…</p>
{:else if forms.isError}
	<p class="p-6 text-sm text-danger" role="alert">{forms.error.message}</p>
{:else if before && pending(before)}
	<QuestionnaireStep
		form={before}
		{user}
		intro="Before the proposed queries, please answer a few questions about yourself."
	/>
{:else if finished && after && pending(after)}
	<QuestionnaireStep
		form={after}
		{user}
		intro="You made your final submission. One last questionnaire about using the editor."
	/>
{:else if finished}
	<StudyFinished />
{:else}
	<main class="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-4 bg-background px-4 py-10">
		<header class="flex flex-wrap items-center justify-between gap-2">
			<h1 class="text-xl font-semibold">Proposed queries</h1>
			<div class="flex gap-2">
				<Button variant="outline" href={resolve('/')}>Back to the editor</Button>
				<Button variant="outline" onclick={() => authSession.logout()}>Log out</Button>
			</div>
		</header>
		<p class="text-sm text-muted-foreground">
			Logged in as <strong>{authSession.user?.username}</strong>.
		</p>
		{#if tasks.isPending}
			<p class="text-sm text-muted-foreground" role="status">Loading your tasks…</p>
		{:else if tasks.isError}
			<p class="text-sm text-danger" role="alert">{tasks.error.message}</p>
		{:else if tasks.data.length === 0}
			<p class="text-sm" data-testid="no-tasks">
				No tasks are assigned to you yet. Ask the study's organizer to add you to a group.
			</p>
		{:else}
			<ol class="flex flex-col gap-2" aria-label="Your tasks">
				{#each tasks.data as task, index (task.key)}
					<li>
						<a
							href={resolve('/study/[key]', { key: task.key })}
							class="flex flex-col gap-1 rounded-lg border bg-surface px-4 py-3 text-surface-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
							data-testid="study-task"
						>
							<span class="font-medium">{index + 1}. {task.title}</span>
							<span class="text-sm text-muted-foreground">{task.summary}</span>
						</a>
					</li>
				{/each}
			</ol>
		{/if}
		{#if tasks.isSuccess}
			<footer class="flex flex-col items-start gap-2 border-t pt-4">
				<p class="text-sm text-muted-foreground">
					When you are done with every task, make your final submission.
				</p>
				<FinishStudy />
			</footer>
		{/if}
	</main>
{/if}

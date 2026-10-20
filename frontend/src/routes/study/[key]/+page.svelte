<!--
	STUDY-003: one proposed task of the participant's group; others are 404.
	After the final submission (STUDY-005) the finished view shows instead;
	without consent (STUDY-008) or the profile questionnaire (STUDY-010) the
	participant is sent to /study, which shows what comes first.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { createQuery } from '@tanstack/svelte-query';
	import { ApiError, api } from '#lib/api/client.js';
	import { queryKeys } from '#lib/api/queries.js';
	import { CONSENT_REQUIRED, PROFILE_REQUIRED } from '#lib/domain/study.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import StudyFinished from '#lib/features/study/study-finished.svelte';
	import StudyTask from '#lib/features/study/study-task.svelte';

	const key = $derived(page.params.key ?? '');
	const task = createQuery(() => ({
		queryKey: queryKeys.studyTask(key),
		queryFn: ({ signal }) => api.study.task(key, { signal }),
		staleTime: 0
	}));
	const needsConsent = $derived(
		task.error instanceof ApiError &&
			(task.error.message === CONSENT_REQUIRED || task.error.message === PROFILE_REQUIRED)
	);
	$effect(() => {
		if (needsConsent) void goto(resolve('/study'), { replaceState: true });
	});
</script>

<svelte:head><title>{task.data?.title ?? 'Task'} · SPARQL EasyQuery</title></svelte:head>

{#if task.isPending || needsConsent}
	<p class="p-6 text-sm text-muted-foreground" role="status">Loading the task…</p>
{:else if task.error instanceof ApiError && task.error.kind === 'forbidden'}
	<StudyFinished />
{:else if task.isError}
	<main class="flex flex-col items-start gap-3 p-6">
		<p class="text-sm text-danger" role="alert">{task.error.message}</p>
		<Button variant="outline" href={resolve('/study')}>All tasks</Button>
	</main>
{:else}
	{#key task.data.key}
		<StudyTask task={task.data} />
	{/key}
{/if}

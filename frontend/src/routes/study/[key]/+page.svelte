<!-- STUDY-003: one proposed task of the participant's group; others are 404. -->
<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { createQuery } from '@tanstack/svelte-query';
	import { api } from '#lib/api/client.js';
	import { queryKeys } from '#lib/api/queries.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import StudyTask from '#lib/features/study/study-task.svelte';

	const key = $derived(page.params.key ?? '');
	const task = createQuery(() => ({
		queryKey: queryKeys.studyTask(key),
		queryFn: ({ signal }) => api.study.task(key, { signal }),
		staleTime: 0
	}));
</script>

<svelte:head><title>{task.data?.title ?? 'Task'} · SPARQL EasyQuery</title></svelte:head>

{#if task.isPending}
	<p class="p-6 text-sm text-muted-foreground" role="status">Loading the task…</p>
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

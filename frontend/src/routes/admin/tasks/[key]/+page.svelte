<!-- STUDY-006: edit one proposed task, loaded fresh from the server. -->
<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { createQuery } from '@tanstack/svelte-query';
	import { api } from '#lib/api/client.js';
	import { queryKeys } from '#lib/api/queries.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import TaskEditor from '#lib/features/admin/task-editor.svelte';

	const key = $derived(page.params.key ?? '');
	const task = createQuery(() => ({
		queryKey: queryKeys.adminTask(key),
		queryFn: ({ signal }) => api.admin.task(key, { signal }),
		staleTime: 0
	}));
</script>

<svelte:head><title>Task {key} · Admin · SPARQL EasyQuery</title></svelte:head>

{#if task.isPending}
	<p class="p-6 text-sm text-muted-foreground" role="status">Loading the task…</p>
{:else if task.isError}
	<main class="flex flex-col items-start gap-3 p-6">
		<p class="text-sm text-danger" role="alert">{task.error.message}</p>
		<Button variant="outline" href={resolve('/admin/tasks')}>All tasks</Button>
	</main>
{:else}
	{#key task.data.key}
		<TaskEditor task={task.data} />
	{/key}
{/if}

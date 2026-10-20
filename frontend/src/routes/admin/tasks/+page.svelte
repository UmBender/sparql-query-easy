<!--
	STUDY-006: every proposed task, active or not, with its revision and the
	size of the expected result the server stored. Tasks are never deleted;
	deactivating hides one from participants.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { api, type AdminTaskSummary } from '#lib/api/client.js';
	import { queryKeys } from '#lib/api/queries.js';
	import { Button } from '#lib/components/ui/button/index.js';

	const queryClient = useQueryClient();
	const tasks = createQuery(() => ({
		queryKey: queryKeys.adminTasks,
		queryFn: ({ signal }) => api.admin.tasks({ signal }),
		staleTime: 0
	}));

	async function setActive(task: AdminTaskSummary, active: boolean) {
		try {
			await api.admin.setTaskActive(task.key, active);
			toast.success(active ? `Reactivated ${task.key}.` : `Deactivated ${task.key}.`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : String(error));
		}
		await queryClient.invalidateQueries({ queryKey: queryKeys.adminTasks });
	}
</script>

<svelte:head><title>Proposed tasks · Admin · SPARQL EasyQuery</title></svelte:head>

<main class="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4 bg-background px-4 py-8">
	<header class="flex flex-wrap items-center justify-between gap-2">
		<h1 class="text-xl font-semibold">Proposed tasks</h1>
		<nav aria-label="Tasks" class="flex gap-2">
			<Button variant="outline" href={resolve('/admin')}>Admin</Button>
			<Button href={resolve('/admin/tasks/new')}>New task</Button>
		</nav>
	</header>
	{#if tasks.isPending}
		<p class="text-sm text-muted-foreground" role="status">Loading tasks…</p>
	{:else if tasks.isError}
		<p class="text-sm text-danger" role="alert">{tasks.error.message}</p>
	{:else if tasks.data.length === 0}
		<p class="text-sm text-muted-foreground">
			No tasks yet. Create one by drawing its reference query.
		</p>
	{:else}
		<div class="overflow-x-auto rounded-lg border bg-surface text-surface-foreground">
			<table class="w-full text-left text-sm">
				<thead class="border-b text-muted-foreground">
					<tr>
						<th scope="col" class="px-3 py-2 font-medium">Key</th>
						<th scope="col" class="px-3 py-2 font-medium">Title</th>
						<th scope="col" class="px-3 py-2 font-medium">Endpoint</th>
						<th scope="col" class="px-3 py-2 font-medium">Comparison</th>
						<th scope="col" class="px-3 py-2 font-medium">Revision</th>
						<th scope="col" class="px-3 py-2 font-medium">Expected</th>
						<th scope="col" class="px-3 py-2 font-medium">Status</th>
						<th scope="col" class="px-3 py-2 font-medium"
							><span class="sr-only">Actions</span></th
						>
					</tr>
				</thead>
				<tbody>
					{#each tasks.data as task (task.key)}
						<tr class="border-b last:border-b-0" data-testid="task-row">
							<td class="px-3 py-2 font-mono">{task.key}</td>
							<td class="px-3 py-2">{task.title}</td>
							<td class="px-3 py-2">{task.endpoint}</td>
							<td class="px-3 py-2">{task.comparison}</td>
							<td class="px-3 py-2">{task.revision}</td>
							<td class="px-3 py-2">{task.expectedCount}</td>
							<td class="px-3 py-2">{task.active ? 'Active' : 'Inactive'}</td>
							<td class="px-3 py-2">
								<div class="flex justify-end gap-2">
									<Button
										variant="outline"
										size="sm"
										href={resolve('/admin/tasks/[key]', { key: task.key })}
										aria-label={`Edit ${task.key}`}>Edit</Button
									>
									<Button
										variant="secondary"
										size="sm"
										aria-label={`${task.active ? 'Deactivate' : 'Reactivate'} ${task.key}`}
										onclick={() => setActive(task, !task.active)}
										>{task.active ? 'Deactivate' : 'Reactivate'}</Button
									>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</main>

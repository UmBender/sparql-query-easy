<!--
	The proposed queries (STUDY-003): the active tasks of the participant's
	group, in the group's order (STUDY-007), or a note that none are assigned.
	The root layout's guard sends anonymous visitors to login (AUTH-004).
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { createQuery } from '@tanstack/svelte-query';
	import { api } from '#lib/api/client.js';
	import { queryKeys } from '#lib/api/queries.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { authSession } from '#lib/features/auth/auth-session.svelte.js';

	const tasks = createQuery(() => ({
		queryKey: queryKeys.studyTasks,
		queryFn: ({ signal }) => api.study.tasks({ signal }),
		staleTime: 0
	}));
</script>

<svelte:head><title>Proposed queries · SPARQL EasyQuery</title></svelte:head>

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
</main>

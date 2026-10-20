<!--
	STUDY-007: the participant groups and the participants not yet in one. Each
	participant is in at most one group and sees only its active tasks; the
	admin assigns them (no random assignment, DEC-014).
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { api } from '#lib/api/client.js';
	import { queryKeys } from '#lib/api/queries.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Field } from '#lib/components/ui/field/index.js';
	import { Input } from '#lib/components/ui/input/index.js';

	const queryClient = useQueryClient();
	const groups = createQuery(() => ({
		queryKey: queryKeys.adminGroups,
		queryFn: ({ signal }) => api.admin.groups({ signal }),
		staleTime: 0
	}));
	const participants = createQuery(() => ({
		queryKey: queryKeys.adminParticipants,
		queryFn: ({ signal }) => api.admin.participants({ signal }),
		staleTime: 0
	}));
	const unassigned = $derived((participants.data ?? []).filter((item) => item.groupId === null));

	let name = $state('');
	let failure = $state<string | null>(null);

	async function create(event: SubmitEvent) {
		event.preventDefault();
		failure = null;
		try {
			await api.admin.createGroup(name);
			name = '';
			await queryClient.invalidateQueries({ queryKey: queryKeys.adminGroups });
		} catch (error) {
			failure = error instanceof Error ? error.message : String(error);
		}
	}
</script>

<svelte:head><title>Participant groups · Admin · SPARQL EasyQuery</title></svelte:head>

<main class="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 bg-background px-4 py-8">
	<header class="flex flex-wrap items-center justify-between gap-2">
		<h1 class="text-xl font-semibold">Participant groups</h1>
		<nav aria-label="Groups" class="flex gap-2">
			<Button variant="outline" href={resolve('/admin')}>Admin</Button>
			<Button variant="outline" href={resolve('/admin/tasks')}>Proposed tasks</Button>
		</nav>
	</header>

	<form class="flex flex-wrap items-end gap-2" aria-label="New group" onsubmit={create}>
		<Field id="group-name" label="New group name" class="min-w-64 flex-1">
			{#snippet children(props)}
				<Input {...props} bind:value={name} required />
			{/snippet}
		</Field>
		<Button type="submit">Create group</Button>
		{#if failure}<p role="alert" class="w-full text-sm text-danger">{failure}</p>{/if}
	</form>

	<section aria-labelledby="groups-title" class="flex flex-col gap-2">
		<h2 id="groups-title" class="text-lg font-semibold">Groups</h2>
		{#if groups.isPending}
			<p class="text-sm text-muted-foreground" role="status">Loading groups…</p>
		{:else if groups.isError}
			<p class="text-sm text-danger" role="alert">{groups.error.message}</p>
		{:else if groups.data.length === 0}
			<p class="text-sm text-muted-foreground">No groups yet.</p>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each groups.data as group (group.id)}
					<li
						class="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-surface px-4 py-3 text-surface-foreground"
						data-testid="group-row"
					>
						<span class="font-medium">{group.name}</span>
						<span class="text-sm text-muted-foreground"
							>{group.tasks.length} tasks · {group.members.length} participants</span
						>
						<Button
							variant="outline"
							size="sm"
							href={resolve('/admin/groups/[id]', { id: String(group.id) })}
							aria-label={`Open ${group.name}`}>Open</Button
						>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section aria-labelledby="unassigned-title" class="flex flex-col gap-2">
		<h2 id="unassigned-title" class="text-lg font-semibold">Participants without a group</h2>
		{#if participants.isError}
			<p class="text-sm text-danger" role="alert">{participants.error.message}</p>
		{:else if unassigned.length === 0}
			<p class="text-sm text-muted-foreground">Every participant is in a group.</p>
		{:else}
			<ul class="flex flex-wrap gap-2" data-testid="unassigned">
				{#each unassigned as participant (participant.username)}
					<li class="rounded-md border bg-surface px-2 py-1 text-sm">
						{participant.username}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</main>

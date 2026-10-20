<!--
	STUDY-007: one group. Its tasks in the order participants see them (each
	change is saved at once), its members, and the participants who can be
	added; adding one who is in another group moves them there.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { api, type StudyGroup } from '#lib/api/client.js';
	import { queryKeys } from '#lib/api/queries.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Field } from '#lib/components/ui/field/index.js';
	import { Input } from '#lib/components/ui/input/index.js';

	const id = $derived(Number(page.params.id));
	const queryClient = useQueryClient();
	const group = createQuery(() => ({
		queryKey: queryKeys.adminGroup(id),
		queryFn: ({ signal }) => api.admin.group(id, { signal }),
		staleTime: 0
	}));
	const tasks = createQuery(() => ({
		queryKey: queryKeys.adminTasks,
		queryFn: ({ signal }) => api.admin.tasks({ signal }),
		staleTime: 0
	}));
	const participants = createQuery(() => ({
		queryKey: queryKeys.adminParticipants,
		queryFn: ({ signal }) => api.admin.participants({ signal }),
		staleTime: 0
	}));

	const keys = $derived(group.data?.tasks.map((task) => task.key) ?? []);
	const addableTasks = $derived((tasks.data ?? []).filter((task) => !keys.includes(task.key)));
	const addableParticipants = $derived(
		(participants.data ?? []).filter((item) => item.groupId !== id)
	);
	let name = $state<string | null>(null);

	async function change(action: () => Promise<StudyGroup | void>, done?: string) {
		try {
			await action();
			if (done) toast.success(done);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : String(error));
		}
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: queryKeys.adminGroups }),
			queryClient.invalidateQueries({ queryKey: queryKeys.adminParticipants })
		]);
	}

	const setTasks = (next: string[]) => change(() => api.admin.setGroupTasks(id, next));

	function move(index: number, by: -1 | 1) {
		const next = keys.slice();
		[next[index], next[index + by]] = [next[index + by], next[index]];
		return setTasks(next);
	}

	async function rename(event: SubmitEvent) {
		event.preventDefault();
		if (name === null) return;
		const value = name;
		await change(() => api.admin.renameGroup(id, value), 'Group renamed.');
		name = null;
	}

	async function remove() {
		try {
			await api.admin.deleteGroup(id);
			toast.success('Group deleted.');
			await queryClient.invalidateQueries({ queryKey: queryKeys.adminGroups });
			await goto(resolve('/admin/groups'));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : String(error));
		}
	}
</script>

<svelte:head><title>{group.data?.name ?? 'Group'} · Admin · SPARQL EasyQuery</title></svelte:head>

<main class="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 bg-background px-4 py-8">
	{#if group.isPending}
		<p class="text-sm text-muted-foreground" role="status">Loading the group…</p>
	{:else if group.isError}
		<p class="text-sm text-danger" role="alert">{group.error.message}</p>
		<Button variant="outline" href={resolve('/admin/groups')}>All groups</Button>
	{:else}
		<header class="flex flex-wrap items-center justify-between gap-2">
			<h1 class="text-xl font-semibold">{group.data.name}</h1>
			<nav aria-label="Group" class="flex gap-2">
				<Button variant="outline" href={resolve('/admin/groups')}>All groups</Button>
				<Button
					variant="destructive"
					disabled={group.data.members.length > 0}
					title={group.data.members.length > 0
						? 'Move its participants first'
						: undefined}
					onclick={remove}>Delete group</Button
				>
			</nav>
		</header>

		<form class="flex flex-wrap items-end gap-2" aria-label="Rename group" onsubmit={rename}>
			<Field id="group-rename" label="Name" class="min-w-64 flex-1">
				{#snippet children(props)}
					<Input
						{...props}
						value={name ?? group.data.name}
						oninput={(event) => (name = event.currentTarget.value)}
						required
					/>
				{/snippet}
			</Field>
			<Button type="submit" variant="secondary" disabled={name === null}>Rename</Button>
		</form>

		<div class="grid gap-6 md:grid-cols-2">
			<section aria-labelledby="group-tasks-title" class="flex flex-col gap-2">
				<h2 id="group-tasks-title" class="text-lg font-semibold">Tasks, in order</h2>
				{#if group.data.tasks.length === 0}
					<p class="text-sm text-muted-foreground">No tasks yet.</p>
				{:else}
					<ol class="flex flex-col gap-1" data-testid="group-tasks">
						{#each group.data.tasks as task, index (task.key)}
							<li
								class="flex items-center justify-between gap-2 rounded-md border bg-surface px-3 py-2 text-sm"
							>
								<span
									>{index + 1}. {task.title}
									<span class="font-mono text-muted-foreground">{task.key}</span>
									{#if !task.active}<span class="text-warning">
											(inactive)</span
										>{/if}</span
								>
								<span class="flex gap-1">
									<Button
										variant="ghost"
										size="sm"
										disabled={index === 0}
										aria-label={`Move ${task.key} up`}
										onclick={() => move(index, -1)}>Up</Button
									>
									<Button
										variant="ghost"
										size="sm"
										disabled={index === group.data.tasks.length - 1}
										aria-label={`Move ${task.key} down`}
										onclick={() => move(index, 1)}>Down</Button
									>
									<Button
										variant="ghost"
										size="sm"
										aria-label={`Remove ${task.key}`}
										onclick={() =>
											setTasks(keys.filter((key) => key !== task.key))}
										>Remove</Button
									>
								</span>
							</li>
						{/each}
					</ol>
				{/if}
				<h3 class="text-sm font-medium">Add a task</h3>
				{#if addableTasks.length === 0}
					<p class="text-sm text-muted-foreground">Every task is in this group.</p>
				{:else}
					<ul class="flex flex-col gap-1">
						{#each addableTasks as task (task.key)}
							<li class="flex items-center justify-between gap-2 text-sm">
								<span
									>{task.title}
									<span class="font-mono text-muted-foreground">{task.key}</span
									></span
								>
								<Button
									variant="secondary"
									size="sm"
									aria-label={`Add task ${task.key}`}
									onclick={() => setTasks([...keys, task.key])}>Add</Button
								>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section aria-labelledby="group-members-title" class="flex flex-col gap-2">
				<h2 id="group-members-title" class="text-lg font-semibold">Participants</h2>
				{#if group.data.members.length === 0}
					<p class="text-sm text-muted-foreground">No participants yet.</p>
				{:else}
					<ul class="flex flex-col gap-1" data-testid="group-members">
						{#each group.data.members as member (member)}
							<li
								class="flex items-center justify-between gap-2 rounded-md border bg-surface px-3 py-2 text-sm"
							>
								{member}
								<Button
									variant="ghost"
									size="sm"
									aria-label={`Remove ${member}`}
									onclick={() =>
										change(() => api.admin.unassignMember(id, member))}
									>Remove</Button
								>
							</li>
						{/each}
					</ul>
				{/if}
				<h3 class="text-sm font-medium">Add a participant</h3>
				{#if addableParticipants.length === 0}
					<p class="text-sm text-muted-foreground">No other participants.</p>
				{:else}
					<ul class="flex flex-col gap-1">
						{#each addableParticipants as participant (participant.username)}
							<li class="flex items-center justify-between gap-2 text-sm">
								<span
									>{participant.username}
									{#if participant.groupName}<span class="text-muted-foreground"
											>(in {participant.groupName})</span
										>{/if}</span
								>
								<Button
									variant="secondary"
									size="sm"
									aria-label={`Add participant ${participant.username}`}
									onclick={() =>
										change(() =>
											api.admin.assignMember(id, participant.username)
										)}>{participant.groupName ? 'Move here' : 'Add'}</Button
								>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		</div>
	{/if}
</main>

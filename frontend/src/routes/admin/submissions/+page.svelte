<!--
	STUDY-017 (DEC-020): the last saved answer of every participant and task,
	under the participant's pseudonym with the account behind it (shown on the
	admin pages only), and the automatic check's hint for the researcher.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { createQuery } from '@tanstack/svelte-query';
	import { api } from '#lib/api/client.js';
	import { queryKeys } from '#lib/api/queries.js';
	import { Button } from '#lib/components/ui/button/index.js';

	const saves = createQuery(() => ({
		queryKey: queryKeys.adminSubmissions,
		queryFn: ({ signal }) => api.admin.submissions({ signal }),
		staleTime: 0
	}));
	const HINTS: Record<string, string> = {
		match: 'Match',
		no_match: 'No match',
		not_checked: 'Not checked'
	};
</script>

<svelte:head><title>Saved answers · Admin · SPARQL EasyQuery</title></svelte:head>

<main class="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4 bg-background px-4 py-8">
	<header class="flex flex-wrap items-center justify-between gap-2">
		<h1 class="text-xl font-semibold">Saved answers</h1>
		<nav aria-label="Saved answers" class="flex gap-2">
			<Button variant="outline" href={resolve('/admin')}>Admin</Button>
		</nav>
	</header>
	<p class="text-sm text-muted-foreground">
		The last save of each participant and task. The automatic check is a hint for the review,
		not a grade; participants never see it.
	</p>
	{#if saves.isPending}
		<p class="text-sm text-muted-foreground" role="status">Loading the saved answers…</p>
	{:else if saves.isError}
		<p class="text-sm text-danger" role="alert">{saves.error.message}</p>
	{:else if saves.data.length === 0}
		<p class="text-sm text-muted-foreground">No participant has saved an answer yet.</p>
	{:else}
		<div class="overflow-x-auto rounded-lg border bg-surface text-surface-foreground">
			<table class="w-full text-left text-sm">
				<thead class="border-b text-muted-foreground">
					<tr>
						<th scope="col" class="px-3 py-2 font-medium">Participant</th>
						<th scope="col" class="px-3 py-2 font-medium">Account</th>
						<th scope="col" class="px-3 py-2 font-medium">Task</th>
						<th scope="col" class="px-3 py-2 font-medium">Revision</th>
						<th scope="col" class="px-3 py-2 font-medium">Saved at</th>
						<th scope="col" class="px-3 py-2 font-medium">Saves</th>
						<th scope="col" class="px-3 py-2 font-medium">Finished</th>
						<th scope="col" class="px-3 py-2 font-medium">Check</th>
						<th scope="col" class="px-3 py-2 font-medium"
							><span class="sr-only">Actions</span></th
						>
					</tr>
				</thead>
				<tbody>
					{#each saves.data as save (save.id)}
						<tr class="border-b last:border-b-0" data-testid="submission-row">
							<td class="px-3 py-2 font-mono">{save.participant}</td>
							<td class="px-3 py-2">{save.username}</td>
							<td class="px-3 py-2"><span class="font-mono">{save.taskKey}</span></td>
							<td class="px-3 py-2">{save.taskRevision}</td>
							<td class="px-3 py-2">{new Date(save.savedAt).toLocaleString()}</td>
							<td class="px-3 py-2">{save.saves}</td>
							<td class="px-3 py-2">{save.finished ? 'Yes' : 'No'}</td>
							<td class="px-3 py-2">{HINTS[save.autoCheck] ?? save.autoCheck}</td>
							<td class="px-3 py-2">
								<div class="flex justify-end">
									<Button
										variant="outline"
										size="sm"
										href={resolve('/admin/submissions/[id]', {
											id: String(save.id)
										})}
										aria-label={`Review ${save.participant} ${save.taskKey}`}
										>Review</Button
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

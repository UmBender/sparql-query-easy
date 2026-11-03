<!-- STUDY-017: review one last saved answer beside the reference of its revision. -->
<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { createQuery } from '@tanstack/svelte-query';
	import { api } from '#lib/api/client.js';
	import { queryKeys } from '#lib/api/queries.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import SubmissionReview from '#lib/features/admin/submission-review.svelte';

	const id = $derived(Number(page.params.id));
	const submission = createQuery(() => ({
		queryKey: queryKeys.adminSubmission(id),
		queryFn: ({ signal }) => api.admin.submission(id, { signal }),
		staleTime: 0
	}));
</script>

<svelte:head><title>Saved answer · Admin · SPARQL EasyQuery</title></svelte:head>

<main class="mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-4 bg-background px-4 py-8">
	<nav aria-label="Saved answer" class="flex gap-2">
		<Button variant="outline" href={resolve('/admin/submissions')}>All saved answers</Button>
	</nav>
	{#if submission.isPending}
		<p class="text-sm text-muted-foreground" role="status">Loading the saved answer…</p>
	{:else if submission.isError}
		<p class="text-sm text-danger" role="alert">{submission.error.message}</p>
	{:else}
		{#key submission.data.summary.id}
			<SubmissionReview submission={submission.data} />
		{/key}
	{/if}
</main>

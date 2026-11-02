<!--
	One proposed task (STUDY-003, STUDY-016): the statement beside the shared
	QueryEditor (FE-053), which starts from the task's starting graph, or empty,
	on the task's endpoint and keeps that endpoint locked. Save answer sends
	the drawn graph and the request derived from it, with or without variables
	(DEC-020 C1, C2). The page tells only when the answer was last saved, never
	whether it is correct (C8); saves are unlimited and the last one counts.
	FE-061: a back link to the proposed queries tops the panel, and after a
	save Back to the tasks and, when one follows in the group's order, Next
	task are offered. All are plain links, so browser Back keeps working.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import SaveIcon from '@lucide/svelte/icons/save';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import { api, type StudySubmission, type StudyTask } from '#lib/api/client.js';
	import { queryKeys } from '#lib/api/queries.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import {
		loadQuery,
		savedAnswerQuery,
		savedAtLabel,
		serializeQuery,
		type QueryDocument
	} from '#lib/domain/index.js';
	import type { QueryStore } from '#lib/stores/query-store.svelte.js';
	import QueryEditor from '#lib/features/editor/query-editor.svelte';

	let { task }: { task: StudyTask } = $props();

	// The task as loaded sets up the editor once.
	const start = (() => task)();
	const initial = ((): QueryDocument | undefined => {
		if (!start.startingGraph) return undefined;
		const loaded = loadQuery(JSON.stringify(start.startingGraph));
		return 'document' in loaded ? loaded.document : undefined;
	})();

	const queryClient = useQueryClient();
	const saves = createQuery(() => ({
		queryKey: queryKeys.studySubmissions(start.key),
		queryFn: ({ signal }) => api.study.submissions(start.key, { signal }),
		staleTime: 0
	}));

	// The group's tasks in order (shared with /study), for Next task.
	const tasks = createQuery(() => ({
		queryKey: queryKeys.studyTasks,
		queryFn: ({ signal }) => api.study.tasks({ signal }),
		staleTime: 0
	}));
	const nextTask = $derived.by(() => {
		const list = tasks.data ?? [];
		const index = list.findIndex((item) => item.key === start.key);
		return index >= 0 ? list[index + 1] : undefined;
	});

	let store = $state<QueryStore | null>(null);
	let pending = $state(false);
	// The save made on this page; the list catches up after the refetch.
	let latest = $state<StudySubmission | null>(null);
	let problem = $state<string | null>(null);
	const lastSavedAt = $derived(latest?.savedAt ?? saves.data?.at(-1)?.savedAt ?? null);

	async function save() {
		if (!store || pending) return;
		problem = null;
		const derived = savedAnswerQuery(store.graph);
		if ('message' in derived) {
			problem = derived.message;
			return;
		}
		pending = true;
		try {
			latest = await api.study.submit(start.key, {
				graph: serializeQuery(store.document),
				query: derived.query
			});
		} catch (error) {
			problem = error instanceof Error ? error.message : String(error);
		} finally {
			pending = false;
		}
		// The save time and the task list's status (DEC-020 C8) change with each save.
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: queryKeys.studySubmissions(start.key) }),
			queryClient.invalidateQueries({ queryKey: queryKeys.studyTasks })
		]);
	}
</script>

<QueryEditor
	{initial}
	endpoint={{ kind: 'builtIn', id: start.endpoint }}
	lockEndpoint
	onready={(created) => (store = created)}
>
	{#snippet actions()}
		<Button id="submit-answer-btn" disabled={pending} onclick={save}
			><SaveIcon aria-hidden="true" />Save answer</Button
		>
	{/snippet}
	{#snippet panel()}
		<div class="flex flex-col gap-4 p-4">
			<section class="flex flex-col gap-3" aria-labelledby="task-title">
				<Button
					id="study-back-link"
					variant="link"
					class="h-auto self-start p-0"
					href={resolve('/study')}
					><ArrowLeftIcon aria-hidden="true" />Proposed queries</Button
				>
				<h1 id="task-title" class="text-lg font-semibold">{start.title}</h1>
				<p class="text-sm whitespace-pre-line" data-testid="task-statement">
					{start.statement}
				</p>
			</section>

			<p class="text-xs text-muted-foreground">
				Draw your answer and save it. You can change it and save again until you finish the
				study; the last saved answer counts.
			</p>

			<div role="status" aria-live="polite" data-testid="answer-feedback">
				{#if problem}
					<p class="text-sm text-danger">{problem}</p>
				{:else if lastSavedAt}
					<p class="text-sm font-medium">
						Saved at <time datetime={lastSavedAt}>{savedAtLabel(lastSavedAt)}</time>
					</p>
				{:else if saves.isError}
					<p class="text-sm text-danger">{saves.error.message}</p>
				{:else if saves.isSuccess}
					<p class="text-xs text-muted-foreground">No answer saved yet.</p>
				{/if}
			</div>
			{#if latest && !problem}
				<nav aria-label="After saving" class="flex flex-wrap gap-2">
					<Button variant="outline" href={resolve('/study')}>Back to the tasks</Button>
					{#if nextTask}
						<Button href={resolve('/study/[key]', { key: nextTask.key })}
							>Next task<ArrowRightIcon aria-hidden="true" /></Button
						>
					{/if}
				</nav>
			{/if}
		</div>
	{/snippet}
</QueryEditor>

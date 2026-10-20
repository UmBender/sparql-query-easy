<!--
	One proposed task (STUDY-003, STUDY-004): the statement beside the shared
	QueryEditor (FE-053), which starts from the task's starting graph, or empty,
	on the task's endpoint and keeps that endpoint locked. Submit answer sends
	the drawn graph and the request derived from it for the chosen answer
	variable; the server decides correctness and answers with a verdict and
	counts (DEC-014 Q2, Q5). Attempts are unlimited (Q1) and listed below.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import SendIcon from '@lucide/svelte/icons/send';
	import { api, type StudySubmission, type StudyTask } from '#lib/api/client.js';
	import { queryKeys } from '#lib/api/queries.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import {
		answerQuery,
		answerVariables,
		loadQuery,
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
	const history = createQuery(() => ({
		queryKey: queryKeys.studySubmissions(start.key),
		queryFn: ({ signal }) => api.study.submissions(start.key, { signal }),
		staleTime: 0
	}));

	let store = $state<QueryStore | null>(null);
	let answerVariable = $state('');
	let pending = $state(false);
	let latest = $state<StudySubmission | null>(null);
	let problem = $state<string | null>(null);

	const variables = $derived(store ? answerVariables(store.graph) : []);
	$effect(() => {
		if (!variables.includes(answerVariable)) answerVariable = variables[0] ?? '';
	});

	async function submit() {
		if (!store || pending) return;
		problem = null;
		const derived = answerQuery(store.graph, answerVariable);
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
		await queryClient.invalidateQueries({ queryKey: queryKeys.studySubmissions(start.key) });
	}

	const verdict = (attempt: StudySubmission) =>
		attempt.invalid ? 'Invalid query' : attempt.correct ? 'Correct' : 'Incorrect';
	const minutes = (ms: number) => {
		const seconds = Math.round(ms / 1000);
		return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
	};
</script>

<QueryEditor
	{initial}
	endpoint={{ kind: 'builtIn', id: start.endpoint }}
	lockEndpoint
	onready={(created) => (store = created)}
>
	{#snippet actions()}
		<Button id="submit-answer-btn" disabled={pending} onclick={submit}
			><SendIcon aria-hidden="true" />Submit answer</Button
		>
	{/snippet}
	{#snippet panel()}
		<div class="flex flex-col gap-4 p-4">
			<section class="flex flex-col gap-3" aria-labelledby="task-title">
				<div class="flex items-center justify-between gap-2">
					<h1 id="task-title" class="text-lg font-semibold">{start.title}</h1>
					<Button variant="link" class="h-auto p-0" href={resolve('/study')}
						>All tasks</Button
					>
				</div>
				<p class="text-sm whitespace-pre-line" data-testid="task-statement">
					{start.statement}
				</p>
			</section>

			<fieldset class="flex flex-col gap-1.5">
				<legend class="mb-1 text-sm font-medium">Answer variable</legend>
				{#each variables as name (name)}
					<label class="flex items-center gap-2 text-sm">
						<input
							type="radio"
							name="answer-variable"
							value={name}
							bind:group={answerVariable}
							class="size-4 accent-primary"
						/>
						{name}
					</label>
				{:else}
					<p class="text-xs text-muted-foreground">
						Add a variable (?) node for the answer to your query.
					</p>
				{/each}
			</fieldset>

			<div role="status" aria-live="polite" data-testid="answer-feedback">
				{#if problem}
					<p class="text-sm text-danger">{problem}</p>
				{:else if latest}
					<p
						class={[
							'text-sm font-medium',
							latest.correct
								? 'text-success'
								: latest.invalid
									? 'text-danger'
									: 'text-warning'
						]}
					>
						{latest.feedback}
					</p>
				{/if}
			</div>

			<section class="flex flex-col gap-2" aria-labelledby="attempts-title">
				<h2 id="attempts-title" class="text-sm font-semibold">Your attempts</h2>
				{#if history.isError}
					<p class="text-sm text-danger">{history.error.message}</p>
				{:else if !history.data?.length}
					<p class="text-xs text-muted-foreground">No attempts yet.</p>
				{:else}
					<ol class="flex flex-col gap-1" data-testid="attempt-history">
						{#each history.data.toReversed() as attempt (attempt.attempt)}
							<li class="rounded-md border px-2 py-1 text-xs">
								<span class="font-medium"
									>#{attempt.attempt} · {verdict(attempt)}</span
								>
								<span class="text-muted-foreground">
									· {minutes(attempt.timeSpentMs)}</span
								>
								<p>{attempt.feedback}</p>
							</li>
						{/each}
					</ol>
				{/if}
			</section>
		</div>
	{/snippet}
</QueryEditor>

<!--
	One proposed task (STUDY-003): the statement beside the shared QueryEditor
	(FE-053), which starts from the task's starting graph, or empty, on the
	task's endpoint and keeps that endpoint locked.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { StudyTask } from '#lib/api/client.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { loadQuery, type QueryDocument } from '#lib/domain/index.js';
	import QueryEditor from '#lib/features/editor/query-editor.svelte';

	let { task }: { task: StudyTask } = $props();

	// The task as loaded sets up the editor once.
	const start = (() => task)();
	const initial = ((): QueryDocument | undefined => {
		if (!start.startingGraph) return undefined;
		const loaded = loadQuery(JSON.stringify(start.startingGraph));
		return 'document' in loaded ? loaded.document : undefined;
	})();
</script>

<QueryEditor {initial} endpoint={{ kind: 'builtIn', id: start.endpoint }} lockEndpoint>
	{#snippet panel()}
		<section class="flex flex-col gap-3 p-4" aria-labelledby="task-title">
			<div class="flex items-center justify-between gap-2">
				<h1 id="task-title" class="text-lg font-semibold">{start.title}</h1>
				<Button variant="link" class="h-auto p-0" href={resolve('/study')}>All tasks</Button
				>
			</div>
			<p class="text-sm whitespace-pre-line" data-testid="task-statement">
				{start.statement}
			</p>
		</section>
	{/snippet}
</QueryEditor>

<!--
	STUDY-006: the admin writes a task's statement and draws its reference query
	in the shared QueryEditor (FE-053) on the task's endpoint, which stays
	locked. The same editor draws the optional starting graph participants open
	with; switching between the two keeps both drawings. Preview runs the
	reference on the server; saving stores the result the server computed
	(DEC-014 Q5): this page never sends expected rows.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import {
		api,
		type AdminTask,
		type AdminTaskBody,
		type DrawnQuery,
		type TaskPreview
	} from '#lib/api/client.js';
	import { queryKeys } from '#lib/api/queries.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Field } from '#lib/components/ui/field/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import {
		BUILT_IN_ENDPOINTS,
		answerQuery,
		answerVariables,
		loadQuery,
		serializeQuery,
		type QueryDocument
	} from '#lib/domain/index.js';
	import type { QueryStore } from '#lib/stores/query-store.svelte.js';
	import QueryEditor from '#lib/features/editor/query-editor.svelte';
	import TermValue from './term-value.svelte';

	let { task }: { task?: AdminTask } = $props();

	const ENDPOINTS = BUILT_IN_ENDPOINTS.filter((item) => item.kind === 'local');
	const toDocument = (graph: unknown): QueryDocument | undefined => {
		const loaded = loadQuery(JSON.stringify(graph));
		return 'document' in loaded ? loaded.document : undefined;
	};

	// The task as loaded sets up the form once; later prop changes are not applied.
	const start = (() => task)();
	let key = $state(start?.key ?? '');
	let title = $state(start?.title ?? '');
	let statement = $state(start?.statement ?? '');
	let endpointId = $state(start?.endpoint ?? 'PokemonGen1');
	let comparison = $state<'set' | 'multiset'>(
		start?.comparison === 'multiset' ? 'multiset' : 'set'
	);
	let maxResults = $state(start?.maxResults ?? 1000);
	let answerVariable = $state(start?.referenceQuery?.variableName ?? '');
	let useStarting = $state(!!start?.startingGraph);
	let mode = $state<'reference' | 'starting'>('reference');
	const documents: { reference?: QueryDocument; starting?: QueryDocument } = {
		reference: start ? toDocument(start.referenceGraph) : undefined,
		starting: start?.startingGraph ? toDocument(start.startingGraph) : undefined
	};
	let store = $state<QueryStore | null>(null);
	let preview = $state<TaskPreview | null>(null);
	let failure = $state<string | null>(null);
	let pending = $state(false);
	const queryClient = useQueryClient();

	/** Keeps the drawing of the editor being left. */
	function capture() {
		if (store) documents[mode] = store.document;
	}

	function show(next: 'reference' | 'starting') {
		if (next === mode) return;
		capture();
		store = null;
		mode = next;
	}

	function changeEndpoint(id: string) {
		capture();
		store = null;
		endpointId = id;
		preview = null;
	}

	const variables = $derived(
		mode === 'reference' && store
			? answerVariables(store.graph)
			: documents.reference
				? answerVariables(documents.reference.graph)
				: []
	);
	$effect(() => {
		if (!variables.includes(answerVariable) && variables.length) answerVariable = variables[0];
	});

	function reference(): DrawnQuery | null {
		capture();
		const document = documents.reference;
		if (!document) {
			failure = 'Draw the reference query first.';
			return null;
		}
		const derived = answerQuery(document.graph, answerVariable);
		if ('message' in derived) {
			failure = derived.message;
			return null;
		}
		return { graph: serializeQuery(document), query: derived.query };
	}

	async function runPreview() {
		failure = null;
		const drawn = reference();
		if (!drawn) return;
		pending = true;
		try {
			preview = await api.admin.previewTask({
				endpoint: endpointId,
				reference: drawn,
				maxResults
			});
		} catch (error) {
			preview = null;
			failure = error instanceof Error ? error.message : String(error);
		} finally {
			pending = false;
		}
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		failure = null;
		const drawn = reference();
		if (!drawn) return;
		const starting =
			useStarting && documents.starting ? serializeQuery(documents.starting) : null;
		const body: AdminTaskBody = {
			key: key.trim(),
			title,
			statement,
			endpoint: endpointId,
			startingGraph: starting,
			reference: drawn,
			comparison,
			maxResults
		};
		pending = true;
		try {
			const saved = start
				? await api.admin.updateTask(start.key, body)
				: await api.admin.createTask(body);
			await queryClient.invalidateQueries({ queryKey: queryKeys.adminTasks });
			toast.success(`Saved ${saved.key} (revision ${saved.revision}).`);
			if (!start) await goto(resolve('/admin/tasks/[key]', { key: saved.key }));
		} catch (error) {
			failure = error instanceof Error ? error.message : String(error);
		} finally {
			pending = false;
		}
	}
</script>

{#key `${mode}|${endpointId}`}
	<QueryEditor
		initial={documents[mode]}
		endpoint={{ kind: 'builtIn', id: endpointId }}
		lockEndpoint
		onready={(created) => (store = created)}
	>
		{#snippet panel()}
			<form
				class="flex flex-col gap-4 p-4"
				aria-label={start ? `Edit task ${start.key}` : 'New task'}
				onsubmit={save}
			>
				<div class="flex items-center justify-between gap-2">
					<h1 class="text-lg font-semibold">
						{start ? `Task ${start.key}` : 'New task'}
					</h1>
					<Button variant="link" class="h-auto p-0" href={resolve('/admin/tasks')}
						>All tasks</Button
					>
				</div>
				{#if start}
					<p class="text-xs text-muted-foreground" data-testid="task-revision">
						Revision {start.revision} · {start.active ? 'active' : 'inactive'}
					</p>
				{:else}
					<Field
						id="task-key"
						label="Key"
						description="Lowercase letters, digits and '-'; it cannot change later."
					>
						{#snippet children(props)}
							<Input {...props} bind:value={key} required autocomplete="off" />
						{/snippet}
					</Field>
				{/if}
				<Field id="task-title" label="Title">
					{#snippet children(props)}
						<Input {...props} bind:value={title} required />
					{/snippet}
				</Field>
				<Field id="task-statement" label="Statement">
					{#snippet children(props)}
						<Textarea {...props} bind:value={statement} rows={4} required />
					{/snippet}
				</Field>
				<fieldset class="flex flex-col gap-1.5">
					<legend class="mb-1 text-sm font-medium">Endpoint</legend>
					{#each ENDPOINTS as item (item.id)}
						<label class="flex items-center gap-2 text-sm">
							<input
								type="radio"
								name="task-endpoint"
								value={item.id}
								checked={endpointId === item.id}
								onchange={() => changeEndpoint(item.id)}
								class="size-4 accent-primary"
							/>
							{item.label}
						</label>
					{/each}
				</fieldset>
				<fieldset class="flex flex-col gap-1.5">
					<legend class="mb-1 text-sm font-medium">Drawing</legend>
					<div class="flex gap-2">
						<Button
							variant={mode === 'reference' ? 'default' : 'outline'}
							size="sm"
							aria-pressed={mode === 'reference'}
							onclick={() => show('reference')}>Reference query</Button
						>
						<Button
							variant={mode === 'starting' ? 'default' : 'outline'}
							size="sm"
							aria-pressed={mode === 'starting'}
							disabled={!useStarting}
							onclick={() => show('starting')}>Starting graph</Button
						>
					</div>
					<label class="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							bind:checked={useStarting}
							onchange={() => {
								if (!useStarting) show('reference');
							}}
							class="size-4 accent-primary"
						/>
						Participants start from a graph
					</label>
				</fieldset>
				<fieldset class="flex flex-col gap-1.5">
					<legend class="mb-1 text-sm font-medium">Answer variable</legend>
					{#each variables as name (name)}
						<label class="flex items-center gap-2 text-sm">
							<input
								type="radio"
								name="task-answer"
								value={name}
								bind:group={answerVariable}
								class="size-4 accent-primary"
							/>
							{store?.nameOf(name) ?? name}
						</label>
					{:else}
						<p class="text-xs text-muted-foreground">
							Add a variable (?) node to the reference query.
						</p>
					{/each}
				</fieldset>
				<!-- DEC-019: answers run as SELECT DISTINCT, so every task compares a set of answer values; only a
				legacy multiset task offers the choice, to move it to set. -->
				{#if start?.comparison === 'multiset'}
					<fieldset class="flex flex-col gap-1.5">
						<legend class="mb-1 text-sm font-medium">Comparison</legend>
						<label class="flex items-center gap-2 text-sm">
							<input
								type="radio"
								name="task-comparison"
								value="set"
								bind:group={comparison}
								class="size-4 accent-primary"
							/>
							Set of answer values
						</label>
						<label class="flex items-center gap-2 text-sm">
							<input
								type="radio"
								name="task-comparison"
								value="multiset"
								bind:group={comparison}
								class="size-4 accent-primary"
							/>
							Every result row (multiset)
						</label>
					</fieldset>
				{/if}
				<Field
					id="task-max-results"
					label="Result cap"
					description="A reference with more results is rejected."
				>
					{#snippet children(props)}
						<Input
							{...props}
							type="number"
							min={1}
							max={10000}
							bind:value={maxResults}
						/>
					{/snippet}
				</Field>
				{#if failure}<p role="alert" class="text-sm text-danger">{failure}</p>{/if}
				<div class="flex flex-wrap gap-2">
					<Button variant="secondary" disabled={pending} onclick={runPreview}
						>Preview expected result</Button
					>
					<Button type="submit" disabled={pending}>Save task</Button>
				</div>
				{#if preview}
					<section aria-label="Expected result" class="flex flex-col gap-2">
						<p class="text-sm" data-testid="preview-count">
							{preview.expected.length} rows, {preview.distinctCount} distinct values
						</p>
						<ul class="max-h-64 overflow-y-auto rounded-md border text-xs">
							{#each preview.expected as term, index (index)}
								<li class="border-b px-2 py-1 last:border-b-0">
									<TermValue {term} />
								</li>
							{/each}
						</ul>
					</section>
				{:else if start}
					<p class="text-xs text-muted-foreground">
						Stored expected result: {start.expected.length} rows.
					</p>
				{/if}
			</form>
		{/snippet}
	</QueryEditor>
{/key}

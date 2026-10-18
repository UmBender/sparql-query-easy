<!--
	Edit Filter Value (FE-045; legacy #modal-change-value): one editor for a
	value node (Edit value) and a value variable (Edit filter, Add value
	filter). Superforms validates the Zod schema before Apply changes the graph.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { defaults, superForm } from 'sveltekit-superforms';
	import { zod4 as zod } from 'sveltekit-superforms/adapters';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Field } from '#lib/components/ui/field/index.js';
	import { nodeById } from '#lib/domain/index.js';
	import type { EditorController } from '#lib/features/editor/editor-controller.svelte.js';
	import {
		editorMode,
		editorStart,
		FILTER_OPTIONS,
		filterSchema,
		type FilterForm
	} from './filter-form.js';
	import FilterHistogram from './filter-histogram.svelte';
	import FilterSuggestions from './filter-suggestions.svelte';

	let {
		controller,
		request
	}: { controller: EditorController; request: { nodeId: string; seed: string } } = $props();

	const store = untrack(() => controller.store);
	const node = untrack(() => nodeById(store.graph, request.nodeId))!;
	const start = editorStart(
		node,
		untrack(() => request.seed)
	);
	const mode = editorMode(node, start.value);
	const schema = filterSchema(mode);
	const currentValue = start.value;

	const form = superForm(
		defaults({ filterType: start.filterType, value: start.value } as FilterForm, zod(schema)),
		{
			SPA: true,
			validators: zod(schema),
			resetForm: false,
			onUpdate({ form: submitted }) {
				if (!submitted.valid) {
					const message = submitted.errors.value?.[0];
					if (message) controller.toast(message, 'error');
					return;
				}
				const { value, filterType } = submitted.data;
				const result =
					node.kind === 'valueVariable'
						? store.setValueVariableFilter(node.id, value, filterType)
						: store.applyFilter(node.id, value, filterType === '' ? null : filterType);
				if (result.error) controller.toast(result.error, 'error');
				else controller.editorRequest = null;
			}
		}
	);
	const { form: data, errors, enhance } = form;

	let suggestionList = $state<HTMLUListElement | null>(null);

	function close() {
		controller.editorRequest = null;
	}
</script>

<Dialog.Root
	open
	onOpenChange={(open) => {
		if (!open) close();
	}}
>
	<Dialog.Content class="max-h-[90vh] max-w-xl overflow-y-auto" id="filter-editor">
		<Dialog.Header>
			<Dialog.Title>Edit Filter Value</Dialog.Title>
			<Dialog.Description
				>Current value: <strong data-testid="current-value">{currentValue}</strong
				></Dialog.Description
			>
		</Dialog.Header>
		<form method="POST" use:enhance class="flex flex-col gap-4">
			<Field id="filter-value" label="New Value" errors={$errors.value}>
				{#snippet children(props)}
					<Input
						{...props}
						name="value"
						autocomplete="off"
						placeholder="Enter new value"
						bind:value={$data.value}
						oninput={() => {
							// Typing a value while "Any value" is chosen means that exact value.
							if ($data.filterType === 'any') $data.filterType = '';
						}}
						onkeydown={(event) => {
							if (event.key !== 'ArrowDown') return;
							const first = suggestionList?.querySelector('button');
							if (!first) return;
							event.preventDefault();
							first.focus();
						}}
					/>
				{/snippet}
			</Field>
			<FilterSuggestions
				{store}
				api={controller.api}
				nodeId={node.id}
				value={$data.value}
				filterType={$data.filterType}
				bind:list={suggestionList}
				onchoose={(text) => {
					$data.value = text;
					$data.filterType = '';
					document.getElementById('filter-value')?.focus();
				}}
			/>
			{#if mode !== 'text'}
				<FilterHistogram
					{store}
					api={controller.api}
					nodeId={node.id}
					bind:value={$data.value}
					bind:filterType={$data.filterType}
				/>
			{/if}
			<fieldset class="flex flex-col gap-1.5">
				<legend class="mb-1 text-sm font-semibold">Filter Type:</legend>
				{#each FILTER_OPTIONS[mode] as option (option.value)}
					<label class="flex items-center gap-2 text-sm">
						<input
							type="radio"
							name="filterType"
							value={option.value}
							bind:group={$data.filterType}
							class="size-4 accent-primary"
						/>
						{option.label}
					</label>
				{/each}
			</fieldset>
			<Dialog.Footer>
				<Button variant="ghost" type="button" onclick={close}>Cancel</Button>
				<Button type="submit" id="apply-filter-btn">Apply</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

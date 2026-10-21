<!--
	Upload Triples, Upload Query and Export Query (legacy navbar, FE-048).
	Queries use the versioned saved format (FE-042); legacy query_exported.json
	files are refused with an explanation (D6b). With a locked endpoint (FE-053)
	there is no Upload Triples, which would replace it.
-->
<script lang="ts">
	import UploadIcon from '@lucide/svelte/icons/upload';
	import FileUpIcon from '@lucide/svelte/icons/file-up';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import { Button } from '#lib/components/ui/button/index.js';
	import { loadQuery, saveQueryText } from '#lib/domain/index.js';
	import type { EditorController } from '#lib/features/editor/editor-controller.svelte.js';

	let { controller, class: className = '' }: { controller: EditorController; class?: string } =
		$props();

	let triples = $state<HTMLInputElement | null>(null);
	let query = $state<HTMLInputElement | null>(null);
	const store = $derived(controller.store);

	async function uploadTriples(file: File) {
		controller.busy++;
		try {
			const id = await controller.api.upload(file, file.name);
			store.setEndpoint({ kind: 'uploaded', id });
			controller.toast('Triples uploaded — endpoint updated.', 'success');
		} catch (error) {
			controller.toast(
				`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'error'
			);
		} finally {
			controller.busy--;
		}
	}

	async function uploadQuery(file: File) {
		const loaded = loadQuery(await file.text());
		if ('error' in loaded) {
			controller.toast(loaded.error.message, 'error');
			return;
		}
		controller.tapBackground();
		store.load(loaded.document);
		controller.toast('Query loaded successfully.', 'success');
	}

	function exportQuery() {
		const url = URL.createObjectURL(
			new Blob([saveQueryText(store.document)], { type: 'application/json' })
		);
		const link = document.createElement('a');
		link.href = url;
		link.download = 'easyquery-query.json';
		document.body.append(link);
		link.click();
		link.remove();
		URL.revokeObjectURL(url);
		controller.toast('Query exported.', 'success');
	}
</script>

<input
	bind:this={triples}
	id="upload-triple"
	type="file"
	accept=".ttl"
	class="hidden"
	aria-label="Upload Turtle triples file"
	onchange={(event) => {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';
		if (file) uploadTriples(file);
	}}
/>
<input
	bind:this={query}
	id="upload-json"
	type="file"
	accept=".json"
	class="hidden"
	aria-label="Upload a saved query"
	onchange={(event) => {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';
		if (file) uploadQuery(file);
	}}
/>
{#if !store.endpointLocked}
	<Button
		id="upload-triples-btn"
		variant="ghost"
		class={className}
		title="Upload Turtle triples file"
		onclick={() => triples?.click()}
	>
		<UploadIcon />Upload Triples
	</Button>
{/if}
<Button
	id="load-query-btn"
	variant="ghost"
	class={className}
	title="Load a saved query"
	onclick={() => query?.click()}
>
	<FileUpIcon />Upload Query
</Button>
<Button
	id="export-query-btn"
	variant="ghost"
	class={className}
	title="Export the current query"
	onclick={exportQuery}
>
	<DownloadIcon />Export Query
</Button>

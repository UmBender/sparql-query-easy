<!-- View SPARQL: the generated query with Copy (legacy #modal-sparql). -->
<script lang="ts">
	import CopyIcon from '@lucide/svelte/icons/copy';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { EditorController } from './editor-controller.svelte.js';

	let { controller }: { controller: EditorController } = $props();
</script>

<Dialog.Root
	open={controller.sparql !== null}
	onOpenChange={(open) => {
		if (!open) controller.closeSparql();
	}}
>
	<Dialog.Content class="max-w-3xl">
		<Dialog.Header>
			<Dialog.Title>SPARQL Query</Dialog.Title>
			<Dialog.Description
				>The query the backend generates for the current graph.</Dialog.Description
			>
		</Dialog.Header>
		<pre class="max-h-[60vh] overflow-auto rounded-md bg-muted p-3 font-mono text-xs"><code
				id="sparql-content">{controller.sparql?.text}</code
			></pre>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => controller.copySparql()}
				><CopyIcon />Copy</Button
			>
			<Button onclick={() => controller.closeSparql()}>Close</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

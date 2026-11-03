<!--
	STUDY-017: a saved diagram (FE-042 format) drawn read-only with the editor's
	view (`viewElements`) and stylesheet. Nodes cannot be moved, selected or
	edited; pan and zoom stay. The same diagram is listed as text below the
	canvas for screen readers and for reading labels the canvas cuts.
-->
<script lang="ts">
	import cytoscape from 'cytoscape';
	import { graphStylesheet } from '#lib/design/cytoscape.js';
	import { loadQuery, type SavedQueryV1 } from '#lib/domain/index.js';
	import { viewElements } from '#lib/features/editor/graph-view.js';

	let { graph, label }: { graph: SavedQueryV1; label: string } = $props();

	const loaded = $derived(loadQuery(JSON.stringify(graph)));
	const elements = $derived('document' in loaded ? viewElements(loaded.document.graph) : []);
	const nodes = $derived(elements.filter((element) => element.group === 'nodes'));
	const edges = $derived(elements.filter((element) => element.group === 'edges'));
	const nodeLabel = (id: string | undefined) =>
		nodes.find((node) => node.data.id === id)?.data.label || '(no label)';

	let container: HTMLDivElement;

	$effect(() => {
		const placed = nodes.every((node) => node.position);
		const cy = cytoscape({
			container,
			elements: [...nodes, ...edges].map((element) => ({
				group: element.group,
				data: { ...element.data },
				...(element.position ? { position: element.position } : {})
			})),
			style: graphStylesheet() as cytoscape.StylesheetJson,
			layout: placed
				? { name: 'preset', fit: true, padding: 24 }
				: { name: 'cose', animate: false },
			autoungrabify: true,
			autounselectify: true,
			boxSelectionEnabled: false,
			minZoom: 0.15,
			maxZoom: 3
		});
		const resize = new ResizeObserver(() => {
			cy.resize();
			cy.fit(undefined, 24);
		});
		resize.observe(container);
		return () => {
			resize.disconnect();
			cy.destroy();
		};
	});
</script>

<figure class="flex flex-col gap-2" data-testid="diagram-view">
	{#if 'error' in loaded}
		<p class="text-sm text-danger" role="alert">
			The saved diagram cannot be read: {loaded.error.message}
		</p>
	{/if}
	<div
		bind:this={container}
		role="img"
		aria-label="{label} (read-only)"
		class="h-72 w-full rounded-md border bg-background"
	></div>
	<figcaption class="text-sm">
		<details>
			<summary class="cursor-pointer text-muted-foreground">{label} as text</summary>
			<ol class="mt-2 flex list-decimal flex-col gap-1 pl-6" data-testid="diagram-nodes">
				{#each nodes as node (node.data.id)}
					<li>
						{node.data.label || '(no label)'}
						<span class="text-muted-foreground">({node.data.kind})</span>
					</li>
				{/each}
			</ol>
			{#if edges.length}
				<ul class="mt-2 flex flex-col gap-1" data-testid="diagram-relations">
					{#each edges as edge (edge.data.id)}
						<li>
							{nodeLabel(edge.data.source)} —{edge.data.label}→ {nodeLabel(
								edge.data.target
							)}
						</li>
					{/each}
				</ul>
			{/if}
		</details>
	</figcaption>
</figure>

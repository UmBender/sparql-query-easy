<!--
	Every node kind and relation kind drawn with the token stylesheet, so a
	token change is visible on /styleguide (FE-050).
-->
<script lang="ts">
	import cytoscape from 'cytoscape';
	import { graphStylesheet } from '#lib/design/cytoscape.js';

	let container: HTMLDivElement;

	const nodes = [
		{ id: 'entity', kind: 'entity', label: 'Entity' },
		{ id: 'variable', kind: 'variable', label: '?' },
		{ id: 'value', kind: 'value', label: 'Value' },
		{ id: 'valueVariable', kind: 'valueVariable', label: '? ≥ 90' },
		{ id: 'class', kind: 'class', label: 'Class' },
		{ id: 'many', kind: 'many', label: '12 results' }
	];

	$effect(() => {
		const cy = cytoscape({
			container,
			style: graphStylesheet() as cytoscape.StylesheetJson,
			userZoomingEnabled: false,
			userPanningEnabled: false,
			autoungrabify: true,
			elements: [
				...nodes.map((data, index) => ({
					group: 'nodes' as const,
					data,
					position: { x: 80 + (index % 3) * 200, y: 80 + Math.floor(index / 3) * 200 },
					classes:
						data.id === 'entity' ? 'selected' : data.id === 'value' ? 'rejected' : ''
				})),
				{
					group: 'edges',
					data: {
						id: 'e1',
						source: 'entity',
						target: 'variable',
						label: 'fixed',
						kind: 'fixed'
					}
				},
				{
					group: 'edges',
					data: {
						id: 'e2',
						source: 'variable',
						target: 'value',
						label: '?',
						kind: 'variable'
					}
				},
				{
					group: 'edges',
					data: {
						id: 'e3',
						source: 'many',
						target: 'valueVariable',
						label: 'speed',
						kind: 'fixed'
					},
					classes: 'emphasis'
				}
			]
		});
		cy.fit(undefined, 24);
		return () => cy.destroy();
	});
</script>

<div
	bind:this={container}
	data-testid="node-kind-canvas"
	role="img"
	aria-label="Node kinds: entity (selected), variable, value (rejected), value variable, class, N results; fixed, variable and emphasized relations"
	class="h-80 w-full rounded-md border bg-canvas"
></div>

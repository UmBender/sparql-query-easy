<!--
	The persistent action list of the selected node or relation (FE-002,
	FE-022): a floating list beside its element that only a background click
	(or an action that ends it) closes. Danger actions are red (FE-016).
-->
<script lang="ts">
	import { cn } from '#lib/utils.js';
	import { menuPosition, type CanvasView } from './canvas-view.svelte.js';
	import type { EditorController } from './editor-controller.svelte.js';

	let { controller, view }: { controller: EditorController; view: CanvasView } = $props();

	let element = $state<HTMLElement | null>(null);
	let size = $state({ width: 220, height: 200 });

	const nodeMenu = $derived(controller.nodeMenu);
	const edgeMenu = $derived(controller.edgeMenu);
	const anchor = $derived(
		nodeMenu
			? view.nodeBox(nodeMenu.node.id)
			: edgeMenu
				? { ...view.edgeMidpoint(edgeMenu.edge.id)!, radius: 0 }
				: null
	);
	const placed = $derived(anchor ? menuPosition(anchor, size) : null);
	const choices = $derived(
		nodeMenu && controller.predicateChoices?.sourceId === nodeMenu.node.id
			? controller.predicateChoices
			: null
	);
	const title = $derived(
		nodeMenu
			? `Actions for ${nodeMenu.node.label || nodeMenu.node.id}`
			: edgeMenu
				? `Actions for relation ${edgeMenu.edge.label || edgeMenu.edge.predicate || edgeMenu.edge.id}`
				: ''
	);

	$effect(() => {
		void title;
		void choices;
		if (element) size = { width: element.offsetWidth, height: element.offsetHeight };
	});

	const button =
		'w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none';
</script>

{#if (nodeMenu || edgeMenu) && placed}
	<aside
		bind:this={element}
		id={nodeMenu ? 'node-action-menu' : 'edge-action-menu'}
		data-node-id={nodeMenu?.node.id}
		data-edge-id={edgeMenu?.edge.id}
		aria-labelledby="action-menu-title"
		class="absolute z-(--z-menu) flex w-56 flex-col gap-1 rounded-lg border bg-popover p-2 text-popover-foreground shadow-md"
		style:left="{placed.left}px"
		style:top="{placed.top}px"
		style:visibility={placed.visible ? 'visible' : 'hidden'}
	>
		<p
			id="action-menu-title"
			class="px-2 pb-1 text-xs font-semibold break-words text-muted-foreground"
		>
			{title}
		</p>
		<ul class="flex flex-col">
			{#if nodeMenu}
				{#each nodeMenu.actions as action (action.id)}
					<li>
						<button
							type="button"
							data-action={action.id}
							class={cn(button, action.danger && 'text-danger')}
							onclick={() => controller.runNodeAction(action.id)}
						>
							{action.label}
						</button>
					</li>
				{/each}
				{#if choices}
					{#if choices.message}<li
							class="px-2 py-1 text-xs text-muted-foreground"
							role="status"
						>
							{choices.message}
						</li>{/if}
					{#each choices.items as predicate, index (`${predicate.propertyId}-${index}`)}
						<li>
							<button
								type="button"
								data-action="choose-predicate"
								data-predicate-index={index}
								class={button}
								onclick={() => controller.runNodeAction('choose-predicate', index)}
							>
								{predicate.propertyLabel || predicate.propertyId}
							</button>
						</li>
					{/each}
				{/if}
			{:else if edgeMenu}
				{#each edgeMenu.actions as action (action.id)}
					<li>
						<button
							type="button"
							data-action={action.id}
							class={cn(button, action.danger && 'text-danger')}
							onclick={() => controller.runEdgeAction(action.id)}
						>
							{action.label}
						</button>
					</li>
				{/each}
			{/if}
		</ul>
	</aside>
{/if}

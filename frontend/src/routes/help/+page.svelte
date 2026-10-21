<!--
	DOC-006 (DEC-018 Q4 C): the user guide, public like the editor. One
	section per feature group of the editor and the study pages, with a worked
	example on PokemonGen1. The images in static/help-images/ are written by
	`npm run help:screens` (tests-help/); edit the text here, never the images.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { asset, resolve } from '$app/paths';
	import { Button } from '#lib/components/ui/button/index.js';
	import { forget, TOUR_KEY } from '#lib/features/utilities/seen.js';

	/** The files `npm run help:screens` writes to static/help-images/. */
	type HelpImage =
		'editor' | 'action-list' | 'filter-editor' | 'run-query' | 'filter-funnel' | 'view-sparql';

	const sections = [
		{ id: 'start', title: 'Getting started' },
		{ id: 'example', title: 'A worked example' },
		{ id: 'nodes', title: 'Node kinds' },
		{ id: 'relations', title: 'Relations and the action list' },
		{ id: 'filters', title: 'Filters' },
		{ id: 'run', title: 'Running the query' },
		{ id: 'funnel', title: 'Filter funnel and badges' },
		{ id: 'sparql', title: 'View SPARQL' },
		{ id: 'files', title: 'Files: triples and saved queries' },
		{ id: 'more', title: 'Search, layout and undo' },
		{ id: 'study', title: 'Accounts and the study' }
	] as const;

	const nodeKinds = [
		{
			swatch: 'rounded-full bg-node-entity',
			name: 'Entity',
			text: 'A fixed thing, such as Fire or Pikachu. Add one with Search nodes.'
		},
		{
			swatch: 'rounded-full bg-node-variable',
			name: 'Variable (?)',
			text: 'An unknown entity the query looks for. Add one with Add Variable.'
		},
		{
			swatch: 'rounded-sm bg-node-value',
			name: 'Value',
			text: 'A fixed number, text or date, such as a speed of 90.'
		},
		{
			swatch: 'rounded-sm border-2 border-node-value-variable-border bg-node-value-variable',
			name: 'Value variable',
			text: 'An unknown number, text or date. It can hold a filter. Add one with Add Value Variable.'
		},
		{
			swatch: 'rounded-full bg-node-class',
			name: 'Class',
			text: 'A kind of thing, such as Pokémon. Use Explore values on it to see its members.'
		}
	];

	const filterKinds = [
		['Exact match', 'the value equals what you type'],
		['Starts with / Contains', 'text values; suggestions appear while you type'],
		['At least / At most', 'numbers and dates, including the limit'],
		['Between', 'numbers and dates within a range, set on the histogram slider'],
		['MAX / MIN', 'only the entities with the largest or smallest value (all ties kept)'],
		['Any value', 'no filter: the relation only has to exist']
	];

	function startTour() {
		forget(TOUR_KEY);
		goto(resolve('/'));
	}
</script>

{#snippet figure(file: HelpImage, alt: string, caption: string)}
	<figure class="flex flex-col gap-2">
		<img
			src={asset(`help-images/${file}.png`)}
			{alt}
			width="1280"
			height="800"
			loading="lazy"
			class="h-auto w-full rounded-md border shadow-sm"
		/>
		<figcaption class="text-xs text-muted-foreground">{caption}</figcaption>
	</figure>
{/snippet}

<svelte:head><title>Help · SPARQL EasyQuery</title></svelte:head>

<main
	class="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-8 bg-background px-4 py-10 text-foreground"
>
	<header class="flex flex-wrap items-center justify-between gap-2">
		<h1 class="text-xl font-semibold">Help</h1>
		<div class="flex flex-wrap gap-2">
			<Button variant="outline" onclick={startTour} data-testid="start-tour"
				>Start the tour</Button
			>
			<Button href={resolve('/')}>Back to the editor</Button>
		</div>
	</header>

	<p class="text-sm">
		SPARQL EasyQuery lets you ask questions of a knowledge graph by drawing the question as a
		graph instead of writing SPARQL. Each arrow you draw is one fact the answers must have; the
		editor turns the drawing into a query, runs it and shows the answers.
	</p>

	<nav
		aria-label="Help contents"
		class="rounded-lg border bg-surface p-4 text-surface-foreground"
	>
		<h2 class="mb-2 text-sm font-semibold">Contents</h2>
		<ol class="grid list-inside list-decimal gap-1 text-sm sm:grid-cols-2">
			{#each sections as section (section.id)}
				<li>
					<a class="text-primary underline-offset-2 hover:underline" href="#{section.id}"
						>{section.title}</a
					>
				</li>
			{/each}
		</ol>
	</nav>

	<section id="start" aria-labelledby="start-title" class="flex flex-col gap-3">
		<h2 id="start-title" class="text-lg font-semibold">Getting started</h2>
		<p class="text-sm">
			Choose what to query in the <strong>SPARQL endpoint</strong> field: a built-in dataset
			such as
			<code>PokemonGen1</code> (the first 151 Pokémon), or the address of a SPARQL endpoint
			such as Wikidata. <strong>Limit</strong> sets how many results a query returns at most.
			Then add nodes and connect them on the canvas. The guided tour points at each control;
			you can start it again with <em>Start the tour</em> above.
		</p>
	</section>

	<section id="example" aria-labelledby="example-title" class="flex flex-col gap-3">
		<h2 id="example-title" class="text-lg font-semibold">A worked example</h2>
		<p class="text-sm">
			Question: <em>which Fire-type Pokémon have a speed of at least 90?</em> On
			<code>PokemonGen1</code>: add a variable (the Pokémon we look for), search for
			<strong>Fire</strong> and connect the variable to it with the relation
			<em>has type</em>, add a value variable and connect the variable to it with
			<em>speed</em>, then give the value variable the filter <em>at least 90</em>. The badge
			<strong>7 / 12</strong> says that 7 of the 12 Fire-type Pokémon pass the filter. Run Query
			lists them.
		</p>
		{@render figure(
			'editor',
			'The editor with a variable connected to the entity Fire by has type and to a value variable at least 90 by speed; a badge 7 / 12 above the value variable.',
			'The question drawn as a graph. The numbered chips next to Run Query give the order in which the variables are explored.'
		)}
	</section>

	<section id="nodes" aria-labelledby="nodes-title" class="flex flex-col gap-3">
		<h2 id="nodes-title" class="text-lg font-semibold">Node kinds</h2>
		<p class="text-sm">The color and shape of a node say what it stands for:</p>
		<ul class="flex flex-col gap-2 text-sm">
			{#each nodeKinds as kind (kind.name)}
				<li class="flex items-start gap-3">
					<span aria-hidden="true" class="mt-0.5 size-4 shrink-0 {kind.swatch}"></span>
					<span><strong>{kind.name}.</strong> {kind.text}</span>
				</li>
			{/each}
		</ul>
		<p class="text-sm">
			A grey node stands for a result with many values. The <em>Node types</em> legend in the corner
			of the canvas repeats these colors.
		</p>
	</section>

	<section id="relations" aria-labelledby="relations-title" class="flex flex-col gap-3">
		<h2 id="relations-title" class="text-lg font-semibold">Relations and the action list</h2>
		<p class="text-sm">
			An arrow between two nodes is a relation, labelled with its property (<em>has type</em>,
			<em>speed</em>). Every arrow is one condition of the query. Click a node to open its
			<strong>action list</strong>. On an entity, <em>Explore relationships</em> lists its
			properties so you can add one to the graph; on a variable, <em>Run query</em> and
			<em>Add value filter</em>; on a value variable, <em>Edit filter</em>; on a value,
			<em>Edit value</em>. Every node can be connected to another one with a defined predicate
			(you choose the property from a list) or a variable predicate (any property), converted
			to a variable, or removed. Click an arrow to convert the relation to a variable or
			remove it. Alt+drag from one node to another draws a new relation. Click the background
			to close the list.
		</p>
		{@render figure(
			'action-list',
			'The action list of the variable node: Run query, Add value filter, Connect with variable predicate, Connect with defined predicate, Convert to variable, Remove.',
			'The action list of a variable.'
		)}
	</section>

	<section id="filters" aria-labelledby="filters-title" class="flex flex-col gap-3">
		<h2 id="filters-title" class="text-lg font-semibold">Filters</h2>
		<p class="text-sm">
			Values and value variables can hold a filter. Choose <em>Add value filter</em> or
			<em>Edit filter</em> in the action list. The filter editor shows the real values found in
			the data: a histogram for numbers, with the kept part highlighted, and the entities that would
			be kept; for text it suggests matching values while you type.
		</p>
		<dl class="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
			{#each filterKinds as [name, text] (name)}
				<dt class="font-medium">{name}</dt>
				<dd class="text-muted-foreground">{text}</dd>
			{/each}
		</dl>
		{@render figure(
			'filter-editor',
			'The filter editor for speed: value 90, a histogram from 60 to 105 with 90 to 105 highlighted, keeps 7 of 12 values, and the kept Pokémon Moltres, Ponyta, Magmar, Arcanine and Charizard.',
			'Editing the speed filter: 7 of the 12 Fire-type Pokémon have a speed of at least 90.'
		)}
	</section>

	<section id="run" aria-labelledby="run-title" class="flex flex-col gap-3">
		<h2 id="run-title" class="text-lg font-semibold">Running the query</h2>
		<p class="text-sm">
			<strong>Run Query</strong> explores the variables one at a time, in the order of the
			numbered chips next to the button; use the arrows on a chip to change the order. For
			each stage the panel lists the possible values. Hover over one to preview the graph it
			leads to in the
			<em>Possible graph</em> window, click it to choose it and go to the next variable, or
			press
			<strong>Assume</strong> to put it into the graph at once.
			<strong>Apply to graph</strong> puts the chosen values into the graph.
		</p>
		{@render figure(
			'run-query',
			'The Explore query variables panel at stage 1 of 2 for ?pokemon, listing Arcanine, Charizard, Magmar, Moltres, Ninetales, Ponyta and Rapidash, each with an Assume button, beside the Possible graph window.',
			'Stage 1: the seven Pokémon that answer the question.'
		)}
	</section>

	<section id="funnel" aria-labelledby="funnel-title" class="flex flex-col gap-3">
		<h2 id="funnel-title" class="text-lg font-semibold">Filter funnel and badges</h2>
		<p class="text-sm">
			<strong>Filter funnel</strong> shows how each filter narrows the result, one step at a time:
			here 151 Pokémon, then 12 of type Fire, then 7 with a speed of at least 90. Untick a step
			to see the result without that filter; the graph is not changed. The badge above a filtered
			node shows how many values it keeps of the total. Once its subject is a fixed entity, the
			badge shows that entity's actual value and whether it passes.
		</p>
		{@render figure(
			'filter-funnel',
			'The Filter funnel panel counting distinct ?pokemon: any value 151, has type = Fire 12 (minus 139), speed at least 90 7 (minus 5). Result: 7 ?pokemon of 151.',
			'The funnel of the example.'
		)}
	</section>

	<section id="sparql" aria-labelledby="sparql-title" class="flex flex-col gap-3">
		<h2 id="sparql-title" class="text-lg font-semibold">View SPARQL</h2>
		<p class="text-sm">
			<strong>View SPARQL</strong> shows the SPARQL query the graph turns into, with a Copy button,
			so you can learn the language or run the query elsewhere.
		</p>
		{@render figure(
			'view-sparql',
			'The SPARQL Query dialog with the generated SELECT query, ending with FILTER (isLiteral(?speed) && ?speed >= 90) and LIMIT 150, and Copy and Close buttons.',
			'The SPARQL behind the example.'
		)}
	</section>

	<section id="files" aria-labelledby="files-title" class="flex flex-col gap-3">
		<h2 id="files-title" class="text-lg font-semibold">Files: triples and saved queries</h2>
		<ul class="flex list-inside list-disc flex-col gap-1 text-sm">
			<li>
				<strong>Upload Triples</strong> sends a Turtle (<code>.ttl</code>) file and queries
				it as a local dataset.
			</li>
			<li>
				<strong>Export Query</strong> saves the graph, the endpoint and the variable order
				to a
				<code>.json</code> file; <strong>Upload Query</strong> opens it again. Files exported
				by the old version of the editor are refused with an explanation.
			</li>
		</ul>
	</section>

	<section id="more" aria-labelledby="more-title" class="flex flex-col gap-3">
		<h2 id="more-title" class="text-lg font-semibold">Search, layout and undo</h2>
		<ul class="flex list-inside list-disc flex-col gap-1 text-sm">
			<li>
				<strong>Search nodes</strong> finds entities by name in the chosen endpoint; choosing
				a result adds it to the graph.
			</li>
			<li>
				<strong>Auto Layout</strong> arranges the graph whenever a node is added; turn it off
				to keep your own positions. The buttons in the corner zoom and fit the graph.
			</li>
			<li>
				<strong>Undo</strong> and <strong>Redo</strong> (also Ctrl+Z and Ctrl+Y) step
				through your edits; <strong>New Query</strong> clears the graph. The moon and sun button
				switches between the light and the dark theme.
			</li>
		</ul>
	</section>

	<section id="study" aria-labelledby="study-title" class="flex flex-col gap-3">
		<h2 id="study-title" class="text-lg font-semibold">Accounts and the study</h2>
		<p class="text-sm">
			The editor works without an account. With an account (<strong>Log in</strong>, then
			create one) you can take part in the study: accept the consent text, answer a short
			questionnaire, then solve the <strong>proposed queries</strong> by drawing each answer in
			the editor and submitting it. You may submit as often as you like until you make the final
			submission; a last questionnaire about using the editor follows it.
		</p>
	</section>

	<footer class="border-t pt-4">
		<Button href={resolve('/')}>Back to the editor</Button>
	</footer>
</main>

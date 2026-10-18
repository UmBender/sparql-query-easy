<!--
	Value histogram with a range slider (FE-026) and the kept-entity cycle with
	a mini result graph (FE-035). Moving a handle writes At least, At most or
	Between into the editor; editing the value or type moves the handles.
	Cycling never changes the editor or the graph and sends no request.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import cytoscape, { type Core } from 'cytoscape';
	import PlayIcon from '@lucide/svelte/icons/play';
	import PauseIcon from '@lucide/svelte/icons/pause';
	import SkipBackIcon from '@lucide/svelte/icons/skip-back';
	import SkipForwardIcon from '@lucide/svelte/icons/skip-forward';
	import { IconButton } from '#lib/components/ui/icon-button/index.js';
	import { filterPreviewStylesheet } from '#lib/design/cytoscape.js';
	import {
		possibilityGraph,
		rangeFilter,
		rangeFromFilter
	} from '#lib/domain/legacy/query-calculations.js';
	import { numericProfileRequestFor, edgesOf } from '#lib/domain/index.js';
	import { isAbort, type ApiClient } from '#lib/api/client.js';
	import type { QueryStore } from '#lib/stores/query-store.svelte.js';
	import {
		CYCLE_INTERVAL_MS,
		CYCLE_PAGE,
		keptView,
		paint,
		profileModel,
		type ProfileModel
	} from './histogram-model.js';

	let {
		store,
		api,
		nodeId,
		value = $bindable(),
		filterType = $bindable()
	}: {
		store: QueryStore;
		api: ApiClient;
		nodeId: string;
		value: string;
		filterType: string;
	} = $props();

	let model = $state.raw<
		| ProfileModel
		| { kind: 'loading' }
		| { kind: 'unprofilable' }
		| { kind: 'error'; message: string }
	>({ kind: 'loading' });
	let lo = $state(0);
	let hi = $state(0);
	let page = $state(0);
	let playing = $state(false);
	let graphBox = $state<HTMLDivElement | null>(null);

	// The relation shown on the mini graph: the label of the edge into the node.
	const relation = untrack(() => {
		const edge = edgesOf(store.graph).find((item) => item.target === nodeId);
		return edge?.label || '';
	});

	$effect(() => {
		const request = untrack(() => numericProfileRequestFor(store.graph, nodeId, store.context));
		if (!request) {
			model = { kind: 'unprofilable' };
			return;
		}
		const controller = new AbortController();
		model = { kind: 'loading' };
		api.numericProfile(request, { signal: controller.signal }).then(
			(profile) => {
				if (controller.signal.aborted) return;
				model = profileModel(profile);
				if (model.kind === 'histogram')
					({ lo, hi } = rangeFromFilter(model.scale, filterType, value));
			},
			(error) => {
				if (controller.signal.aborted || isAbort(error)) return;
				model = {
					kind: 'error',
					message: error instanceof Error ? error.message : String(error)
				};
			}
		);
		return () => controller.abort();
	});

	const histogram = $derived(model.kind === 'histogram' ? model : null);
	const drawn = $derived(histogram ? paint(histogram, filterType, value, lo, hi) : null);
	const kept = $derived(histogram && drawn ? keptView(histogram, drawn) : { kept: [], note: '' });
	const pages = $derived(Math.ceil(kept.kept.length / CYCLE_PAGE));
	const shown = $derived(kept.kept.slice(page * CYCLE_PAGE, (page + 1) * CYCLE_PAGE));
	const position = $derived(
		shown.length
			? `${page * CYCLE_PAGE + 1 === page * CYCLE_PAGE + shown.length ? page * CYCLE_PAGE + 1 : `${page * CYCLE_PAGE + 1}–${page * CYCLE_PAGE + shown.length}`} of ${kept.kept.length} kept`
			: ''
	);
	const relationLabel = $derived(
		relation ||
			String(histogram?.profile.predicate || '')
				.replace(/^<|>$/g, '')
				.split(/[#/]/)
				.pop() ||
			''
	);

	// A new kept range starts the cycle again; too few entities stop playback.
	let rangeKey = '';
	$effect(() => {
		const key = drawn?.range ? `${drawn.range.lo}|${drawn.range.hi}` : '';
		if (key !== untrack(() => rangeKey)) {
			rangeKey = key;
			page = 0;
		}
		if (pages < 2) playing = false;
	});

	// Editor value or type changed: move the handles (`readEditor`).
	$effect(() => {
		const current = histogram;
		const type = filterType;
		const text = value;
		if (!current) return;
		untrack(() => {
			const range = rangeFromFilter(current.scale, type, text);
			if (
				!(type === '2' || type === '3' || type === '6') ||
				range.lo !== lo ||
				range.hi !== hi
			)
				({ lo, hi } = range);
		});
	});

	function moved(handle: 'lo' | 'hi', next: number) {
		if (!histogram) return;
		if (handle === 'lo') lo = Math.min(next, hi);
		else hi = Math.max(next, lo);
		const filter = rangeFilter(histogram.scale, lo, hi);
		value = filter.value;
		filterType = String(filter.filterType);
	}

	function step(direction: number) {
		if (pages < 2) return;
		page = (page + direction + pages) % pages;
	}

	$effect(() => {
		if (!playing) return;
		const timer = setInterval(() => step(1), CYCLE_INTERVAL_MS);
		return () => clearInterval(timer);
	});

	let preview: Core | null = null;
	$effect(() => {
		if (!graphBox) return;
		const cy = cytoscape({
			container: graphBox,
			style: filterPreviewStylesheet() as cytoscape.StylesheetJson,
			layout: { name: 'preset' },
			userZoomingEnabled: false,
			userPanningEnabled: false,
			boxSelectionEnabled: false,
			autoungrabify: true,
			autounselectify: true,
			maxZoom: 1
		});
		preview = cy;
		const resize = new ResizeObserver(() => {
			cy.resize();
			cy.fit(undefined, 16);
		});
		resize.observe(graphBox);
		return () => {
			resize.disconnect();
			preview = null;
			cy.destroy();
		};
	});
	$effect(() => {
		const elements = possibilityGraph(shown, relationLabel);
		void graphBox;
		if (!preview) return;
		preview.batch(() => {
			preview!.elements().remove();
			preview!.add(elements);
		});
		preview.resize();
		preview.fit(undefined, 16);
	});
</script>

<div id="filter-histogram" class="flex flex-col gap-2 rounded-md border p-3">
	{#if model.kind === 'loading'}
		<p class="text-sm text-muted-foreground" role="status">Loading the value distribution…</p>
	{:else if model.kind === 'unprofilable'}
		<p class="text-sm text-muted-foreground" role="status">
			No value distribution: this value needs exactly one fixed relation pointing at it.
		</p>
	{:else if model.kind === 'error'}
		<p class="text-sm text-danger" role="alert">
			Could not load the value distribution: {model.message}
		</p>
	{:else if model.kind === 'message'}
		<p class="text-sm text-muted-foreground" role="status">{model.text}</p>
	{:else if histogram && drawn}
		<p class="text-sm font-medium" aria-live="polite" data-testid="histogram-count">
			{drawn.countText}
		</p>
		<svg
			class="h-18 w-full text-primary"
			viewBox="0 0 300 72"
			preserveAspectRatio="none"
			role="img"
			aria-label="Histogram of {histogram.numbers.length} values from {histogram.format(
				histogram.scale.min
			)} to {histogram.format(histogram.scale.max)}"
		>
			{#each drawn.bars as bar, index (index)}
				<g>
					<title>{bar.from}–{bar.to}: {bar.count} values, {bar.kept} kept</title>
					<rect
						class="fill-muted-foreground/30"
						x={bar.x}
						y={72 - bar.height}
						width={bar.width}
						height={bar.height}
					></rect>
					<rect
						class="fill-current"
						x={bar.x}
						y={72 - bar.keptHeight}
						width={bar.width}
						height={bar.keptHeight}
					></rect>
				</g>
			{/each}
		</svg>
		<div class="relative h-6">
			<div class="absolute top-1/2 right-0 left-0 h-1.5 -translate-y-1/2 rounded bg-muted">
				<div
					class="absolute h-full rounded bg-primary"
					style:left="{drawn.fillLeft}%"
					style:right="{drawn.fillRight}%"
				></div>
			</div>
			{#each ['lo', 'hi'] as const as handle (handle)}
				<input
					type="range"
					class="pointer-events-none absolute inset-0 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-surface [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-surface"
					class:z-10={handle === 'lo' && drawn.loOnTop}
					aria-label={handle === 'lo' ? 'Lowest kept value' : 'Highest kept value'}
					min={histogram.scale.min}
					max={histogram.scale.max}
					step={histogram.scale.step}
					value={handle === 'lo' ? lo : hi}
					disabled={histogram.single}
					oninput={(event) => moved(handle, Number(event.currentTarget.value))}
				/>
			{/each}
		</div>
		<div class="flex justify-between text-xs text-muted-foreground">
			<span>{histogram.format(histogram.scale.min)}</span><span data-testid="histogram-range"
				>{drawn.rangeText}</span
			><span>{histogram.format(histogram.scale.max)}</span>
		</div>
		{#each histogram.notes as note (note)}<p class="text-xs text-muted-foreground">
				{note}
			</p>{/each}
		<!-- Arrow keys step the cycle from any control inside the group (legacy). -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="flex flex-col gap-2"
			role="group"
			aria-label="Kept entities"
			tabindex="-1"
			onkeydown={(event) => {
				if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
				event.preventDefault();
				playing = false;
				step(event.key === 'ArrowRight' ? 1 : -1);
			}}
		>
			<div class="flex items-center justify-between gap-2">
				<span class="text-xs text-muted-foreground" data-testid="cycle-position"
					>{position}</span
				>
				<div class="flex gap-1">
					<IconButton
						label="Previous entities"
						size="icon-sm"
						disabled={pages < 2}
						onclick={() => ((playing = false), step(-1))}><SkipBackIcon /></IconButton
					>
					<IconButton
						label={playing ? 'Pause' : 'Play'}
						size="icon-sm"
						aria-pressed={playing}
						disabled={pages < 2}
						onclick={() => (playing ? (playing = false) : ((playing = true), step(1)))}
					>
						{#if playing}<PauseIcon />{:else}<PlayIcon />{/if}
					</IconButton>
					<IconButton
						label="Next entities"
						size="icon-sm"
						disabled={pages < 2}
						onclick={() => ((playing = false), step(1))}><SkipForwardIcon /></IconButton
					>
				</div>
			</div>
			<output
				class="flex flex-wrap gap-x-4 gap-y-1 text-lg"
				aria-label="Shown entities"
				data-testid="cycle-entities"
			>
				{#each shown as entity (entity.key)}
					<span
						>{entity.label}
						<span class="font-semibold text-primary tabular-nums"
							>{entity.values.map((item) => item.value).join(', ')}</span
						></span
					>
				{/each}
			</output>
			<div
				bind:this={graphBox}
				class="h-40 w-full rounded-md border bg-canvas"
				role="img"
				aria-label="Shown entities as a result graph"
			></div>
			<p class="text-xs text-muted-foreground" aria-live="polite" data-testid="cycle-note">
				{kept.note}
			</p>
		</div>
	{/if}
</div>

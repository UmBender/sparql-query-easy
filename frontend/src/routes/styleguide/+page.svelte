<!--
	FE-050: every design token group and every base component with its
	variants, in the light and the dark theme (toggle without reload).
-->
<script lang="ts">
	import { mode, setMode } from 'mode-watcher';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SunIcon from '@lucide/svelte/icons/sun';
	import PlayIcon from '@lucide/svelte/icons/play';
	import { tokens } from '#lib/design/tokens.js';
	import { kebab } from '#lib/design/css.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { IconButton } from '#lib/components/ui/icon-button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import { Combobox, type ComboboxItem } from '#lib/components/ui/combobox/index.js';
	import { Chip } from '#lib/components/ui/chip/index.js';
	import { CountBadge } from '#lib/components/ui/count-badge/index.js';
	import { Panel } from '#lib/components/ui/panel/index.js';
	import { RatingScale } from '#lib/components/ui/rating-scale/index.js';
	import { Field } from '#lib/components/ui/field/index.js';
	import { toast } from '#lib/components/ui/sonner/index.js';
	import NodeKindCanvas from '#lib/features/styleguide/node-kind-canvas.svelte';

	const buttonVariants = [
		'default',
		'secondary',
		'outline',
		'ghost',
		'destructive',
		'link'
	] as const;
	const endpoints = ['PokemonGen1', 'CampeonatoBrasileiro2023', 'Wikidata'];
	let endpoint = $state('PokemonGen1');
	let search = $state('');
	const pokemon: ComboboxItem[] = ['Bulbasaur', 'Charmander', 'Squirtle', 'Pikachu'].map(
		(name) => ({
			value: name,
			label: name,
			hint: 'IRI'
		})
	);
	const searchItems = $derived(
		search
			? pokemon.filter((item) => item.label.toLowerCase().includes(search.toLowerCase()))
			: []
	);
	let chosen = $state('');
	let rating = $state<number | null>(null);
	let name = $state('');
	const nameErrors = $derived(
		name.length > 0 && name.length < 3 ? ['Use at least 3 characters.'] : []
	);
	const palettes = [
		['Light', tokens.light],
		['Dark', tokens.dark]
	] as const;
</script>

<svelte:head><title>Styleguide · SPARQL EasyQuery</title></svelte:head>

<main class="mx-auto flex max-w-6xl flex-col gap-10 p-6">
	<header class="flex flex-wrap items-center justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold">Styleguide</h1>
			<p class="text-sm text-muted-foreground">
				Tokens from <code class="font-mono">src/lib/design/tokens.ts</code> and the base components.
			</p>
		</div>
		<Button
			variant="outline"
			onclick={() => setMode(mode.current === 'dark' ? 'light' : 'dark')}
			aria-label="Switch to {mode.current === 'dark' ? 'light' : 'dark'} theme"
			data-testid="theme-toggle"
		>
			{#if mode.current === 'dark'}<SunIcon />Light theme{:else}<MoonIcon />Dark theme{/if}
		</Button>
	</header>

	<section aria-labelledby="palettes" class="flex flex-col gap-4">
		<h2 id="palettes" class="text-xl font-semibold">Palettes</h2>
		<div class="grid gap-6 md:grid-cols-2">
			{#each palettes as [title, palette] (title)}
				<div>
					<h3 class="mb-2 text-sm font-medium">{title}</h3>
					<ul class="grid grid-cols-2 gap-2 sm:grid-cols-3">
						{#each Object.entries(palette) as [key, value] (key)}
							<li class="flex items-center gap-2 text-xs">
								<span
									class="size-6 shrink-0 rounded border"
									style:background={value}
								></span>
								<span class="font-mono">{kebab(key)}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	</section>

	<section aria-labelledby="semantic" class="flex flex-col gap-4">
		<h2 id="semantic" class="text-xl font-semibold">Semantic colors (current theme)</h2>
		<div class="flex flex-wrap gap-2">
			<span class="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
				>primary</span
			>
			<span class="rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground"
				>secondary</span
			>
			<span class="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">accent</span
			>
			<span class="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">muted</span>
			<span class="rounded-md bg-success px-3 py-2 text-sm text-success-foreground"
				>success</span
			>
			<span class="rounded-md bg-warning px-3 py-2 text-sm text-warning-foreground"
				>warning</span
			>
			<span class="rounded-md bg-danger px-3 py-2 text-sm text-danger-foreground">danger</span
			>
			<span class="rounded-md bg-brand px-3 py-2 text-sm text-brand-foreground">brand</span>
			<span class="rounded-md border bg-surface px-3 py-2 text-sm text-surface-foreground"
				>surface</span
			>
		</div>
	</section>

	<section aria-labelledby="node-kinds" class="flex flex-col gap-4">
		<h2 id="node-kinds" class="text-xl font-semibold">Graph node kinds</h2>
		<NodeKindCanvas />
		<div class="flex flex-wrap gap-2 text-sm">
			<span class="rounded-full bg-node-entity px-3 py-1 text-node-entity-text">Entity</span>
			<span class="rounded-full bg-node-variable px-3 py-1 text-node-variable-text"
				>Variable</span
			>
			<span class="rounded-sm bg-node-value px-3 py-1 text-node-value-text">Value</span>
			<span
				class="rounded-sm border-4 border-node-value-variable-border bg-node-value-variable px-3 py-1 text-node-variable-text"
				>Value variable</span
			>
			<span class="rounded-full bg-node-class px-3 py-1 text-node-class-text">Class</span>
		</div>
	</section>

	<section aria-labelledby="type" class="flex flex-col gap-3">
		<h2 id="type" class="text-xl font-semibold">Type, spacing, radii, shadows, layers</h2>
		<div class="flex flex-col gap-1">
			{#each Object.entries(tokens.text) as [name, size] (name)}
				<p style:font-size={size}>
					<span class="font-mono text-xs text-muted-foreground">text-{name}</span> The quick
					Pokémon
				</p>
			{/each}
			<p class="font-mono text-sm">font-mono ?pokemon &lt;pk:hasType&gt;</p>
		</div>
		<div class="flex items-end gap-2">
			{#each [1, 2, 3, 4, 6, 8] as step (step)}
				<div class="flex flex-col items-center gap-1 text-xs">
					<span
						class="bg-primary"
						style:width="calc(var(--spacing) * {step})"
						style:height="calc(var(--spacing) * {step})"
					></span>{step}
				</div>
			{/each}
		</div>
		<div class="flex flex-wrap gap-4">
			{#each Object.keys(tokens.radius) as name (name)}
				<div
					class="flex size-16 items-center justify-center border-2 border-primary text-xs"
					style:border-radius="var(--radius-token-{name})"
				>
					{name}
				</div>
			{/each}
			{#each Object.keys(tokens.shadow) as name (name)}
				<div
					class="flex size-16 items-center justify-center rounded-md bg-surface text-xs"
					style:box-shadow="var(--shadow-token-{name})"
				>
					shadow {name}
				</div>
			{/each}
		</div>
		<ol class="flex flex-wrap gap-2 text-xs">
			{#each Object.entries(tokens.z) as [name, value] (name)}
				<li class="rounded border px-2 py-1 font-mono">z-{name}: {value}</li>
			{/each}
		</ol>
	</section>

	<section aria-labelledby="components" class="flex flex-col gap-6">
		<h2 id="components" class="text-xl font-semibold">Components</h2>

		<div class="flex flex-col gap-2">
			<h3 class="text-sm font-medium">Button</h3>
			<div class="flex flex-wrap items-center gap-2">
				{#each buttonVariants as variant (variant)}<Button {variant}>{variant}</Button
					>{/each}
				<Button disabled>disabled</Button>
				<Button size="sm">small</Button>
				<Button size="lg"><PlayIcon />Run Query</Button>
			</div>
		</div>

		<div class="flex flex-col gap-2">
			<h3 class="text-sm font-medium">IconButton and Tooltip</h3>
			<div class="flex items-center gap-2">
				<IconButton label="Run the query" variant="default"><PlayIcon /></IconButton>
				<IconButton label="Zoom in" variant="outline">+</IconButton>
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}<Button {...props} variant="secondary"
								>Hover me</Button
							>{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content>A tooltip</Tooltip.Content>
				</Tooltip.Root>
			</div>
		</div>

		<div class="grid gap-4 md:grid-cols-3">
			<Field
				id="sg-name"
				label="Name"
				description="At least 3 characters."
				errors={nameErrors}
			>
				{#snippet children(props)}<Input {...props} bind:value={name} />{/snippet}
			</Field>
			<div class="flex flex-col gap-1.5">
				<span class="text-sm font-medium" id="sg-endpoint-label">Endpoint (Select)</span>
				<Select.Root type="single" bind:value={endpoint}>
					<Select.Trigger aria-labelledby="sg-endpoint-label" class="w-full"
						>{endpoint}</Select.Trigger
					>
					<Select.Content>
						{#each endpoints as item (item)}<Select.Item value={item} label={item}
								>{item}</Select.Item
							>{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<div class="flex flex-col gap-1.5">
				<span class="text-sm font-medium">Search nodes (Combobox)</span>
				<Combobox
					id="sg-search"
					label="Search nodes"
					placeholder="Type a name"
					items={searchItems}
					bind:text={search}
					status={search ? 'No match' : undefined}
					onselect={(item) => {
						chosen = item.label;
						search = '';
					}}
				/>
				{#if chosen}<p class="text-xs text-muted-foreground">Chosen: {chosen}</p>{/if}
			</div>
		</div>

		<div class="flex flex-col gap-2">
			<h3 class="text-sm font-medium">Chip</h3>
			<div class="flex flex-wrap items-center gap-2">
				<Chip label="?pokemon" />
				<Chip label="Pokémon" number={1} aria-label="Step 1: Pokémon" />
				<Chip label="Speed" number={2} emphasized aria-label="Step 2: Speed" />
			</div>
		</div>

		<div class="flex flex-col gap-2">
			<h3 class="text-sm font-medium">CountBadge</h3>
			<div class="flex flex-wrap items-center gap-2">
				<CountBadge
					state="kept"
					text="7 / 12"
					description="This filter keeps 7 of the 12 ?pokemon that reach it."
				/>
				<CountBadge
					state="empty"
					text="0 / 12"
					description="This filter keeps none of the 12 ?pokemon."
				/>
				<CountBadge
					state="pass"
					text="✓"
					description="The actual value passes the filter."
				/>
				<CountBadge
					state="fail"
					text="✗"
					description="The actual value does not pass the filter."
				/>
				<CountBadge state="loading" text="…" description="Counting…" />
				<CountBadge state="error" text="?" description="Could not count results." />
			</div>
		</div>

		<div class="grid gap-4 md:grid-cols-2">
			<Panel id="sg-panel" title="Panel" onclose={() => toast('Panel closed')}>
				<p class="text-sm">Panels hold exploration, funnel and the possible graph.</p>
			</Panel>
			<div class="flex flex-col gap-3">
				<RatingScale
					name="sg-rating"
					legend="How easy was it?"
					minLabel="Hard"
					maxLabel="Easy"
					bind:value={rating}
				/>
				<p class="text-xs text-muted-foreground" data-testid="rating-value">
					Rating: {rating ?? 'none'}
				</p>
			</div>
		</div>

		<div class="flex flex-wrap gap-2">
			<Dialog.Root>
				<Dialog.Trigger>
					{#snippet child({ props })}<Button {...props} variant="outline"
							>Open dialog</Button
						>{/snippet}
				</Dialog.Trigger>
				<Dialog.Content>
					<Dialog.Header>
						<Dialog.Title>SPARQL Query</Dialog.Title>
						<Dialog.Description
							>Dialogs hold View SPARQL and the filter editor.</Dialog.Description
						>
					</Dialog.Header>
					<pre
						class="rounded bg-muted p-3 font-mono text-xs">SELECT DISTINCT ?pokemon WHERE &#123; … &#125;</pre>
				</Dialog.Content>
			</Dialog.Root>
			<Button variant="secondary" onclick={() => toast.success('Query exported.')}
				>Toast success</Button
			>
			<Button
				variant="secondary"
				onclick={() => toast.error('Query failed. Please try again.')}>Toast error</Button
			>
		</div>
	</section>
</main>

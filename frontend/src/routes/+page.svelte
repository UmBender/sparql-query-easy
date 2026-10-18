<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchHealth, type HealthResult } from '#lib/api/health.js';

	let result = $state<HealthResult | null>(null);

	onMount(async () => {
		result = await fetchHealth();
	});
</script>

<main class="mx-auto max-w-xl space-y-4 p-8">
	<h1 class="text-2xl font-semibold">SPARQL EasyQuery</h1>
	<p class="text-muted-foreground">
		New frontend (work in progress). The legacy editor stays at
		<a class="underline" href="/index2.html" rel="external">/index2.html</a>.
	</p>
	<section class="rounded-lg border p-4" aria-label="Backend health">
		<h2 class="text-sm font-medium">Backend health</h2>
		{#if result === null}
			<p data-testid="health">Checking…</p>
		{:else if result.ok}
			<pre data-testid="health" class="font-mono text-sm text-green-700">{JSON.stringify(
					result.health
				)}</pre>
		{:else}
			<p data-testid="health" class="text-destructive">Unavailable: {result.error}</p>
		{/if}
	</section>
</main>

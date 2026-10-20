<!--
	STUDY-008 (DEC-015 Q1): the research consent shown on /study before
	anything else. Accepting stores the version on the server and refetches the
	study queries (the app's one cache); declining stores nothing and leaves
	the editor open.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { api, type StudyConsent } from '#lib/api/client.js';
	import { appQueryClient, queryKeys } from '#lib/api/queries.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { textBlocks } from '#lib/domain/study.js';

	let {
		consent,
		accept = async (version: number) => {
			await api.study.acceptConsent(version);
			await appQueryClient.invalidateQueries({ queryKey: queryKeys.study });
		}
	}: {
		consent: StudyConsent;
		accept?: (version: number) => Promise<unknown>;
	} = $props();

	const blocks = $derived(textBlocks(consent.text));
	let declined = $state(false);
	let pending = $state(false);
	let error = $state('');

	async function agree() {
		pending = true;
		error = '';
		try {
			await accept(consent.version);
		} catch (failure) {
			error = failure instanceof Error ? failure.message : String(failure);
		} finally {
			pending = false;
		}
	}
</script>

<main class="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
	<section
		aria-labelledby="consent-title"
		class="flex w-full max-w-2xl flex-col gap-4 rounded-lg border bg-surface p-6 text-surface-foreground shadow-md"
		data-testid="consent-screen"
	>
		{#if declined}
			<h1 id="consent-title" class="text-xl font-semibold">You declined</h1>
			<p class="text-sm" data-testid="consent-declined">
				Nothing about you is stored for the study. You can still use the query editor, and
				come back here if you change your mind.
			</p>
			<div class="flex flex-wrap gap-2">
				<Button href={resolve('/')}>Go to the editor</Button>
				<Button variant="outline" onclick={() => (declined = false)}>Read it again</Button>
			</div>
		{:else}
			<h1 id="consent-title" class="text-xl font-semibold">Consent to take part</h1>
			<div class="flex flex-col gap-3 text-sm" data-testid="consent-text">
				{#each blocks as block, index (index)}
					{#if block.kind === 'list'}
						<ul class="flex list-disc flex-col gap-1 pl-5">
							{#each block.items as item, itemIndex (itemIndex)}<li>{item}</li>{/each}
						</ul>
					{:else}
						<p>{block.text}</p>
					{/if}
				{/each}
			</div>
			{#if error}<p class="text-sm text-danger" role="alert">{error}</p>{/if}
			<div class="flex flex-wrap gap-2 border-t pt-4">
				<Button disabled={pending} onclick={agree}>I agree to take part</Button>
				<Button variant="outline" onclick={() => (declined = true)}>I do not agree</Button>
			</div>
		{/if}
	</section>
</main>

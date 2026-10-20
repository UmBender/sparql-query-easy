<!--
	STUDY-005: shown instead of the proposed queries once the participant has
	made the final submission (D6); the API then answers 403 to every task route.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '#lib/components/ui/button/index.js';
</script>

<main class="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
	<section
		aria-labelledby="study-finished-title"
		class="flex w-full max-w-md flex-col gap-4 rounded-lg border bg-surface p-6 text-surface-foreground shadow-md"
		data-testid="study-finished"
	>
		<h1 id="study-finished-title" class="text-xl font-semibold">Study finished</h1>
		<p class="text-sm text-muted-foreground">
			You made your final submission, so the proposed queries are closed. Thank you for taking
			part.
		</p>
		<div class="flex gap-2">
			<Button href={resolve('/')}>Back to the editor</Button>
		</div>
	</section>
</main>

<!--
	The proposed queries (STUDY-001). AUTH-004 adds this page empty so the
	root layout's guard has a protected page; STUDY-001 fills it.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '#lib/components/ui/button/index.js';
	import { authSession } from '#lib/features/auth/auth-session.svelte.js';
</script>

<svelte:head><title>Proposed queries · SPARQL EasyQuery</title></svelte:head>

<main class="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
	<section
		aria-labelledby="study-title"
		class="flex w-full max-w-md flex-col gap-4 rounded-lg border bg-surface p-6 text-surface-foreground shadow-md"
	>
		<h1 id="study-title" class="text-xl font-semibold">Proposed queries</h1>
		<p class="text-sm text-muted-foreground">
			Logged in as <strong>{authSession.user?.username}</strong>. There are no proposed
			queries yet.
		</p>
		<div class="flex gap-2">
			<Button href={resolve('/')}>Back to the editor</Button>
			<Button variant="outline" onclick={() => authSession.logout()}>Log out</Button>
		</div>
	</section>
</main>

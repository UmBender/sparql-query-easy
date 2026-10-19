<!--
	The admin area (AUTH-005). Only admins reach it (root layout guard); the
	task (STUDY-006) and group (STUDY-007) pages are added here.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '#lib/components/ui/button/index.js';
	import { authSession } from '#lib/features/auth/auth-session.svelte.js';
</script>

<svelte:head><title>Admin · SPARQL EasyQuery</title></svelte:head>

<main class="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
	<section
		aria-labelledby="admin-title"
		class="flex w-full max-w-md flex-col gap-4 rounded-lg border bg-surface p-6 text-surface-foreground shadow-md"
	>
		<h1 id="admin-title" class="text-xl font-semibold">Admin</h1>
		<p class="text-sm text-muted-foreground">
			Logged in as <strong>{authSession.user?.username}</strong>. Task and group management
			come next.
		</p>
		<div class="flex gap-2">
			<Button href={resolve('/')}>Back to the editor</Button>
		</div>
	</section>
</main>

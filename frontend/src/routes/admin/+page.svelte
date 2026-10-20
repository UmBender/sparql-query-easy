<!--
	The admin area (AUTH-005). Only admins reach it (root layout guard): the
	proposed tasks (STUDY-006) and, with STUDY-007, the participant groups.
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
			Logged in as <strong>{authSession.user?.username}</strong>.
		</p>
		<nav aria-label="Admin" class="flex flex-wrap gap-2">
			<Button href={resolve('/admin/tasks')}>Proposed tasks</Button>
			<Button variant="outline" href={resolve('/')}>Back to the editor</Button>
		</nav>
	</section>
</main>

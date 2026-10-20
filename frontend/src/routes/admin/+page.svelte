<!--
	The admin area (AUTH-005). Only admins reach it (root layout guard): the
	proposed tasks (STUDY-006), the participant groups (STUDY-007) and the
	questionnaire responses as CSV, one file per questionnaire (STUDY-011).
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { createQuery } from '@tanstack/svelte-query';
	import { api, formResponsesCsvPath } from '#lib/api/client.js';
	import { queryKeys } from '#lib/api/queries.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { authSession } from '#lib/features/auth/auth-session.svelte.js';

	const forms = createQuery(() => ({
		queryKey: queryKeys.studyForms,
		queryFn: ({ signal }) => api.study.forms({ signal }),
		staleTime: 0
	}));
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
			<Button href={resolve('/admin/groups')}>Participant groups</Button>
			<Button variant="outline" href={resolve('/')}>Back to the editor</Button>
		</nav>
		<section
			aria-labelledby="responses-title"
			class="flex flex-col gap-2 border-t pt-4"
			data-testid="form-exports"
		>
			<h2 id="responses-title" class="font-medium">Questionnaire responses</h2>
			<p class="text-sm text-muted-foreground">
				One CSV per questionnaire; participants appear by their internal number, never by
				username.
			</p>
			{#if forms.isPending}
				<p class="text-sm text-muted-foreground" role="status">
					Loading the questionnaires…
				</p>
			{:else if forms.isError}
				<p class="text-sm text-danger" role="alert">{forms.error.message}</p>
			{:else}
				<ul class="flex flex-col gap-2">
					{#each forms.data as form (form.slug)}
						<li>
							<Button
								variant="outline"
								href={formResponsesCsvPath(form.slug)}
								download="{form.slug}-responses.csv"
								data-sveltekit-reload
							>
								Download {form.title} (CSV)
							</Button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</section>
</main>

<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';
	import { QueryClientProvider } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Toaster } from '#lib/components/ui/sonner/index.js';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import { appQueryClient } from '#lib/api/queries.js';
	import { authSession } from '#lib/features/auth/auth-session.svelte.js';
	import { guardDecision } from '#lib/features/auth/route-guard.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// AUTH-004: protected pages wait for the session and send anonymous visitors to login;
	// AUTH-005: admin pages send a participant back to the editor.
	const root = resolve('/');
	const decision = $derived(
		guardDecision(`/${page.url.pathname.slice(root.length)}`, page.url.search, {
			status: authSession.status,
			loggedIn: authSession.user !== null,
			admin: authSession.user?.role === 'admin'
		})
	);
	$effect(() => {
		if (decision.kind === 'wait') authSession.refresh();
		else if (decision.kind === 'redirect') goto(resolve(decision.to), { replaceState: true });
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ModeWatcher defaultMode="light" />
<Toaster richColors closeButton />
<QueryClientProvider client={appQueryClient}>
	<Tooltip.Provider delayDuration={400}>
		{#if decision.kind === 'show'}
			{@render children()}
		{:else}
			<main class="flex min-h-dvh items-center justify-center bg-background px-4">
				<p role="status" class="text-sm text-muted-foreground">Checking your session…</p>
			</main>
		{/if}
	</Tooltip.Provider>
</QueryClientProvider>

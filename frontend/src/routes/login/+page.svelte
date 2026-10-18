<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/ui/button/index.js';
	import AuthForm from '#lib/features/auth/auth-form.svelte';
	import { authSession } from '#lib/features/auth/auth-session.svelte.js';

	let mode = $state<'login' | 'register'>('login');

	onMount(() => {
		if (authSession.status === 'checking') authSession.refresh();
	});
</script>

<svelte:head
	><title>{mode === 'login' ? 'Log in' : 'Create an account'} · SPARQL EasyQuery</title
	></svelte:head
>

<main class="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
	<section
		aria-labelledby="login-title"
		class="flex w-full max-w-sm flex-col gap-5 rounded-lg border bg-surface p-6 text-surface-foreground shadow-md"
	>
		<header class="flex flex-col gap-1">
			<h1 id="login-title" class="text-xl font-semibold">
				{mode === 'login' ? 'Log in' : 'Create an account'}
			</h1>
			<p class="text-sm text-muted-foreground">
				An account gives access to the proposed queries and questionnaires. The query editor
				works without one.
			</p>
		</header>
		{#if authSession.status === 'unavailable'}
			<p role="status" class="text-sm text-danger">
				Accounts are temporarily unavailable. The query editor still works.
			</p>
		{/if}
		{#if authSession.user}
			<p data-testid="logged-in-as">
				Logged in as <strong>{authSession.user.username}</strong>.
			</p>
			<div class="flex gap-2">
				<Button href={resolve('/')}>Back to the editor</Button>
				<Button variant="outline" onclick={() => authSession.logout()}>Log out</Button>
			</div>
		{:else}
			<AuthForm
				session={authSession}
				bind:mode
				onsuccess={(username) => {
					toast.success(
						mode === 'register'
							? `Account created. Logged in as ${username}.`
							: `Logged in as ${username}.`
					);
					goto(resolve('/'));
				}}
			/>
		{/if}
		<a href={resolve('/')} class="text-sm text-primary underline-offset-4 hover:underline"
			>Continue without an account</a
		>
	</section>
</main>

<!--
	The toolbar's account control (AUTH-003): "Log in" for anonymous users, the
	username and Log out once logged in. The editor works either way.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import LogInIcon from '@lucide/svelte/icons/log-in';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import UserIcon from '@lucide/svelte/icons/circle-user';
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/ui/button/index.js';
	import { authSession, type AuthSession } from './auth-session.svelte.js';

	let {
		session = authSession,
		class: className = ''
	}: { session?: AuthSession; class?: string } = $props();

	onMount(() => {
		if (session.status === 'checking') session.refresh();
	});

	async function logout() {
		const outcome = await session.logout();
		if (outcome.ok) toast.success('Logged out.');
		else toast.error(outcome.error);
	}
</script>

{#if session.user}
	<span class="flex items-center gap-1 px-2 text-sm" data-testid="account-name">
		<UserIcon class="size-4" aria-hidden="true" />{session.user.username}
	</span>
	<Button variant="ghost" class={className} onclick={logout}><LogOutIcon />Log out</Button>
{:else if session.status !== 'checking'}
	<Button variant="ghost" class={className} href={resolve('/login')}><LogInIcon />Log in</Button>
{/if}

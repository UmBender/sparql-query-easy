<!--
	Log in or create an account (AUTH-003). Superforms validates the Zod schema
	in the browser (SPA mode: nothing is posted by the form itself, so the
	password never reaches a URL); the session store sends the request.
-->
<script lang="ts">
	import { defaults, superForm } from 'sveltekit-superforms';
	import { zod4 as zod } from 'sveltekit-superforms/adapters';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Field } from '#lib/components/ui/field/index.js';
	import {
		loginSchema,
		PASSWORD_RULE,
		registerSchema,
		USERNAME_RULE,
		type LoginForm,
		type RegisterForm
	} from './auth-form.js';
	import type { AuthSession } from './auth-session.svelte.js';

	let {
		session,
		mode = $bindable('login'),
		onsuccess
	}: {
		session: Pick<AuthSession, 'login' | 'register'>;
		mode?: 'login' | 'register';
		onsuccess?: (username: string) => void;
	} = $props();

	let failure = $state('');
	let pending = $state(false);

	async function submit(credentials: { username: string; password: string }, register: boolean) {
		failure = '';
		pending = true;
		const outcome = register
			? await session.register(credentials)
			: await session.login(credentials);
		pending = false;
		if (outcome.ok) onsuccess?.(credentials.username);
		else failure = outcome.error;
	}

	const login = superForm(
		defaults({ username: '', password: '' } as LoginForm, zod(loginSchema)),
		{
			id: 'login',
			SPA: true,
			validators: zod(loginSchema),
			resetForm: false,
			async onUpdate({ form }) {
				if (form.valid) await submit(form.data, false);
			}
		}
	);
	const register = superForm(
		defaults({ username: '', password: '', confirm: '' } as RegisterForm, zod(registerSchema)),
		{
			id: 'register',
			SPA: true,
			validators: zod(registerSchema),
			resetForm: false,
			async onUpdate({ form }) {
				if (form.valid)
					await submit(
						{ username: form.data.username, password: form.data.password },
						true
					);
			}
		}
	);
	const { form: loginData, errors: loginErrors, enhance: loginEnhance } = login;
	const { form: registerData, errors: registerErrors, enhance: registerEnhance } = register;

	function switchTo(next: 'login' | 'register') {
		mode = next;
		failure = '';
	}
</script>

<div class="flex flex-col gap-4">
	{#if mode === 'login'}
		<form method="POST" use:loginEnhance class="flex flex-col gap-4" aria-label="Log in">
			<Field id="login-username" label="Username" errors={$loginErrors.username}>
				{#snippet children(props)}
					<Input
						{...props}
						name="username"
						autocomplete="username"
						bind:value={$loginData.username}
					/>
				{/snippet}
			</Field>
			<Field id="login-password" label="Password" errors={$loginErrors.password}>
				{#snippet children(props)}
					<Input
						{...props}
						name="password"
						type="password"
						autocomplete="current-password"
						bind:value={$loginData.password}
					/>
				{/snippet}
			</Field>
			{#if failure}<p role="alert" class="text-sm text-danger">{failure}</p>{/if}
			<Button type="submit" disabled={pending}>Log in</Button>
		</form>
		<p class="text-sm text-muted-foreground">
			No account yet?
			<Button variant="link" class="h-auto p-0" onclick={() => switchTo('register')}
				>Create an account</Button
			>
		</p>
	{:else}
		<form
			method="POST"
			use:registerEnhance
			class="flex flex-col gap-4"
			aria-label="Create an account"
		>
			<Field
				id="register-username"
				label="Username"
				description={USERNAME_RULE}
				errors={$registerErrors.username}
			>
				{#snippet children(props)}
					<Input
						{...props}
						name="username"
						autocomplete="username"
						bind:value={$registerData.username}
					/>
				{/snippet}
			</Field>
			<Field
				id="register-password"
				label="Password"
				description={PASSWORD_RULE}
				errors={$registerErrors.password}
			>
				{#snippet children(props)}
					<Input
						{...props}
						name="password"
						type="password"
						autocomplete="new-password"
						bind:value={$registerData.password}
					/>
				{/snippet}
			</Field>
			<Field
				id="register-confirm"
				label="Repeat the password"
				errors={$registerErrors.confirm}
			>
				{#snippet children(props)}
					<Input
						{...props}
						name="confirm"
						type="password"
						autocomplete="new-password"
						bind:value={$registerData.confirm}
					/>
				{/snippet}
			</Field>
			<p class="text-xs text-muted-foreground">
				There is no password recovery: keep your password safe.
			</p>
			{#if failure}<p role="alert" class="text-sm text-danger">{failure}</p>{/if}
			<Button type="submit" disabled={pending}>Create account</Button>
		</form>
		<p class="text-sm text-muted-foreground">
			Already registered?
			<Button variant="link" class="h-auto p-0" onclick={() => switchTo('login')}
				>Log in</Button
			>
		</p>
	{/if}
</div>

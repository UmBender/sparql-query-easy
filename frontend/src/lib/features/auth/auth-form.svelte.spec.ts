/**
 * AUTH-004: the login form as a component. Superforms imports SvelteKit's
 * `$app/*` modules, which only exist inside a running app, so they are
 * replaced by inert stand-ins here. Its Storybook mode (`globalThis.STORIES`)
 * applies validation results to the form directly instead of through
 * SvelteKit's `applyAction` and `page.form`.
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AuthForm from './auth-form.svelte';

vi.hoisted(() => {
	(globalThis as { STORIES?: unknown }).STORIES = [];
});

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/login'), form: null, status: 200, data: {} },
	navigating: { to: null },
	updated: { current: false, check: async () => false }
}));
vi.mock('$app/navigation', () => {
	const noop = () => {};
	const done = async () => {};
	return {
		afterNavigate: noop,
		beforeNavigate: noop,
		onNavigate: noop,
		disableScrollHandling: noop,
		goto: done,
		invalidate: done,
		invalidateAll: done,
		refreshAll: done,
		preloadCode: done,
		preloadData: done,
		pushState: noop,
		replaceState: noop
	};
});
// Like SvelteKit's `enhance`: stop the browser's submit and hand it to the callback,
// where Superforms (SPA mode) cancels it and validates in the page.
vi.mock('$app/forms', () => ({
	applyAction: async () => {},
	deserialize: (text: string) => JSON.parse(text),
	enhance: (form: HTMLFormElement, submit: (input: object) => unknown) => {
		const listener = (event: SubmitEvent) => {
			event.preventDefault();
			void submit({
				action: new URL(form.action),
				formData: new FormData(form),
				formElement: form,
				controller: new AbortController(),
				submitter: event.submitter,
				cancel: () => {}
			});
		};
		form.addEventListener('submit', listener);
		return { destroy: () => form.removeEventListener('submit', listener) };
	}
}));

function fakeSession(answer: { ok: true } | { ok: false; error: string }) {
	return { login: vi.fn(async () => answer), register: vi.fn(async () => answer) };
}

describe('AuthForm', () => {
	it('validates both login fields before calling the session', async () => {
		const session = fakeSession({ ok: true });
		const screen = await render(AuthForm, { session });
		await screen.getByRole('button', { name: 'Log in' }).click();
		await expect.element(screen.getByText('Enter your username.')).toBeVisible();
		await expect.element(screen.getByText('Enter your password.')).toBeVisible();
		expect(session.login).not.toHaveBeenCalled();
	});

	it('shows the server message for a wrong password', async () => {
		const session = fakeSession({ ok: false, error: 'Invalid username or password' });
		const onsuccess = vi.fn();
		const screen = await render(AuthForm, { session, onsuccess });
		await screen.getByLabelText('Username').fill('Ada');
		await screen.getByLabelText('Password').fill('wrong horse');
		await screen.getByRole('button', { name: 'Log in' }).click();
		await expect
			.element(screen.getByRole('alert'))
			.toHaveTextContent('Invalid username or password');
		expect(session.login).toHaveBeenCalledWith({ username: 'Ada', password: 'wrong horse' });
		expect(onsuccess).not.toHaveBeenCalled();
	});

	it('submits valid credentials to the session and reports success', async () => {
		const session = fakeSession({ ok: true });
		const onsuccess = vi.fn();
		const screen = await render(AuthForm, { session, onsuccess });
		await screen.getByLabelText('Username').fill('Ada');
		await screen.getByLabelText('Password').fill('correct horse');
		await screen.getByRole('button', { name: 'Log in' }).click();
		await vi.waitFor(() => expect(onsuccess).toHaveBeenCalledWith('Ada'));
		expect(session.login).toHaveBeenCalledWith({ username: 'Ada', password: 'correct horse' });
		expect(session.register).not.toHaveBeenCalled();
	});
});

/** STUDY-008: the consent screen accepts the shown version or declines without a request. */
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ConsentScreen from './consent-screen.svelte';

const consent = {
	version: 3,
	text: 'PLACEHOLDER intro.\n\n- first point\n- second point',
	acceptedAt: null
};

describe('ConsentScreen', () => {
	it('shows the text and accepts the shown version', async () => {
		const accept = vi.fn(async () => {});
		const screen = await render(ConsentScreen, { consent, accept });
		await expect.element(screen.getByText('PLACEHOLDER intro.')).toBeVisible();
		await expect.element(screen.getByRole('listitem').nth(1)).toHaveTextContent('second point');
		await screen.getByRole('button', { name: 'I agree to take part' }).click();
		expect(accept).toHaveBeenCalledWith(3);
	});

	it('shows the server error when accepting fails', async () => {
		const accept = vi.fn(async () => {
			throw new Error('This is not the current consent text; reload it');
		});
		const screen = await render(ConsentScreen, { consent, accept });
		await screen.getByRole('button', { name: 'I agree to take part' }).click();
		await expect
			.element(screen.getByRole('alert'))
			.toHaveTextContent('This is not the current consent text; reload it');
	});

	it('declines without calling the server and can show the text again', async () => {
		const accept = vi.fn(async () => {});
		const screen = await render(ConsentScreen, { consent, accept });
		await screen.getByRole('button', { name: 'I do not agree' }).click();
		await expect.element(screen.getByTestId('consent-declined')).toBeVisible();
		await expect.element(screen.getByRole('link', { name: 'Go to the editor' })).toBeVisible();
		expect(accept).not.toHaveBeenCalled();
		await screen.getByRole('button', { name: 'Read it again' }).click();
		await expect.element(screen.getByTestId('consent-text')).toBeVisible();
	});
});

import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { createRawSnippet } from 'svelte';
import Chip from './chip/chip.svelte';
import CountBadge from './count-badge/count-badge.svelte';
import RatingScale from './rating-scale/rating-scale.svelte';
import Field from './field/field.svelte';

describe('base components', () => {
	it('a numbered chip shows its step number beside a readable name (FE-056)', async () => {
		const screen = await render(Chip, {
			label: 'Pokémon',
			number: 2,
			'aria-label': 'Step 2: Pokémon'
		});
		const chip = screen.getByLabelText('Step 2: Pokémon');
		await expect.element(chip).toBeVisible();
		await expect
			.element(chip.getByText('2', { exact: true }))
			.toHaveAttribute('aria-hidden', 'true');
		await expect.element(chip.getByText('Pokémon')).not.toHaveClass(/font-mono/);
		const plain = await render(Chip, { label: '?type' });
		await expect.element(plain.getByText('?type')).not.toHaveClass(/font-mono/);
	});

	it('count badge variants expose their state and description', async () => {
		for (const [state, text] of [
			['kept', '7 / 12'],
			['empty', '0 / 12'],
			['pass', '✓'],
			['fail', '✗'],
			['loading', '…'],
			['error', '?']
		] as const) {
			const screen = await render(CountBadge, { state, text, description: `badge ${state}` });
			const badge = screen.getByRole('note', { name: `badge ${state}` });
			await expect.element(badge).toHaveTextContent(text);
			await expect.element(badge).toHaveAttribute('data-state', state);
			await expect.element(badge).toHaveAttribute('aria-busy', String(state === 'loading'));
			await screen.unmount();
		}
	});

	it('the rating scale reports the chosen value', async () => {
		let value: number | null = null;
		await render(RatingScale, {
			name: 'ease',
			legend: 'How easy was it?',
			minLabel: 'Hard',
			maxLabel: 'Easy',
			get value() {
				return value;
			},
			set value(next) {
				value = next;
			}
		});
		await page.getByRole('radio', { name: '4' }).click();
		expect(value).toBe(4);
		await expect.element(page.getByRole('radio', { name: '5 (Easy)' })).not.toBeChecked();
		await page.getByRole('radio', { name: '1 (Hard)' }).click();
		expect(value).toBe(1);
	});

	it('the field wrapper links its errors to the control and marks it invalid', async () => {
		const children = createRawSnippet((props: () => Record<string, string | undefined>) => ({
			render: () => {
				const attributes = Object.entries(props())
					.filter(([, value]) => value !== undefined)
					.map(([key, value]) => `${key}="${value}"`)
					.join(' ');
				return `<input ${attributes} />`;
			}
		}));
		const screen = await render(Field, {
			id: 'username',
			label: 'Username',
			description: 'Letters and digits.',
			errors: ['Username is taken.'],
			children
		});
		const input = screen.getByLabelText('Username');
		await expect.element(input).toHaveAttribute('aria-invalid', 'true');
		await expect
			.element(input)
			.toHaveAttribute('aria-describedby', 'username-description username-errors');
		await expect.element(screen.getByText('Username is taken.')).toBeVisible();
		const clean = await render(Field, { id: 'email', label: 'Email', errors: [], children });
		await expect.element(clean.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
	});
});

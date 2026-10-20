/**
 * QUAL-012: render a component for a component test (Vitest browser mode)
 * inside the app's providers, with a fresh query client per test (the app's
 * options: no retries), so cached data never leaks between tests.
 */
import type { Component } from 'svelte';
import type { QueryClient } from '@tanstack/svelte-query';
import { render } from 'vitest-browser-svelte';
import { createAppQueryClient } from '#lib/api/queries.js';
import TestProviders from './test-providers.svelte';

export async function renderWithProviders<Props extends Record<string, unknown>>(
	component: Component<Props>,
	props: Props = {} as Props,
	{ client = createAppQueryClient() }: { client?: QueryClient } = {}
) {
	// `props` is also a render option name, so the wrapper's props go under that key.
	const screen = await render(TestProviders, {
		props: { component: component as Component<Record<string, unknown>>, props, client }
	});
	return { screen, client };
}

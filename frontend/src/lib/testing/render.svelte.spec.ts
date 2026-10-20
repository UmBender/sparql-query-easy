/**
 * QUAL-012: the component helpers in browser mode. `renderWithProviders`
 * gives a component that calls `useQueryClient()` its own client, and
 * `mockFetch` answers the API from MSW handlers, including a scenario's
 * captured responses (`fixtureHandlers`).
 */
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { api } from '#lib/api/client.js';
import { queryKeys } from '#lib/api/queries.js';
import FinishStudy from '#lib/features/study/finish-study.svelte';
import { fixtureHandlers } from './fixture-handlers.js';
import { loadFixture } from './fixtures.js';
import { mockFetch } from './mock-fetch.js';
import { renderWithProviders } from './render.js';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('test helpers in the browser', () => {
	it('renders a svelte-query component with one call and its own client', async () => {
		const fetchMock = mockFetch(
			http.post('/api/study/finish', () =>
				HttpResponse.json({ data: { finishedAt: '2026-10-20T12:00:00Z' } })
			)
		);
		const { screen, client } = await renderWithProviders(FinishStudy);
		client.setQueryData(queryKeys.studyTasks, []);
		await screen.getByRole('button', { name: 'Finish the study' }).click();
		await screen.getByRole('button', { name: 'Finish and submit' }).click();
		await expect
			.poll(() => client.getQueryState(queryKeys.studyTasks)?.isInvalidated)
			.toBe(true);
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it('serves captured responses to the app client', async () => {
		mockFetch(...fixtureHandlers('fire-speed-at-least-90'));
		const stage = loadFixture('fire-speed-at-least-90').requests.find(
			(request) => request.path === '/api/query/stage'
		)!;
		const page = await api.stage(stage.body as never);
		expect(page.candidates).toHaveLength(7);
	});
});

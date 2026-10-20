import { expect, type Page } from '@playwright/test';
import type { components } from '../../src/lib/api/schema';
import type { MockApi } from './mock-api';

/**
 * QUAL-014/QUAL-015: the main routes, each with the session and the typed
 * API data it needs offline and a check that it finished loading. Shared by
 * the screenshot suite (screens.e2e.ts) and the axe suite (a11y.e2e.ts).
 */
type Schemas = components['schemas'];
type Role = Schemas['SessionUserHttpResponse']['role'];

export type Screen = {
	/** Screenshot file stem. */
	name: string;
	path: string;
	/** Logged in with this role; anonymous when absent. */
	role?: Role;
	/** Resolves once the page shows its loaded content. */
	ready(page: Page): Promise<void>;
};

const UPDATED = '2026-10-20T12:00:00Z';

const tasks: Schemas['AdminTaskSummaryHttpResponse'][] = [
	{
		key: 'fire-fast',
		title: 'Fast Fire-type Pokémon',
		endpoint: 'PokemonGen1',
		comparison: 'set',
		revision: 2,
		active: true,
		expectedCount: 7,
		updatedAt: UPDATED
	},
	{
		key: 'charmander-family',
		title: 'The Charmander family',
		endpoint: 'PokemonGen1',
		comparison: 'multiset',
		revision: 1,
		active: false,
		expectedCount: 3,
		updatedAt: UPDATED
	}
];

const studyTasks: Schemas['StudyTaskSummaryHttpResponse'][] = [
	{ key: 'fire-fast', title: 'Fast Fire-type Pokémon', summary: 'Speed of at least 90.' },
	{ key: 'charmander-family', title: 'The Charmander family', summary: 'Who evolves from whom.' }
];

const studyTask: Schemas['StudyTaskHttpResponse'] = {
	key: 'fire-fast',
	title: 'Fast Fire-type Pokémon',
	statement: 'Find every Fire-type Pokémon with a speed of at least 90.',
	endpoint: 'PokemonGen1',
	startingGraph: null
};

const forms: Schemas['StudyFormSummaryHttpResponse'][] = [
	{
		slug: 'profile',
		title: 'About you',
		version: 1,
		phase: 'before_tasks',
		submittedAt: UPDATED
	},
	{
		slug: 'usability',
		title: 'Using the editor',
		version: 1,
		phase: 'after_finish',
		submittedAt: null
	}
];

const group: Schemas['StudyGroupHttpResponse'] = {
	id: 1,
	name: 'Group A',
	tasks: [{ key: 'fire-fast', title: 'Fast Fire-type Pokémon', active: true }],
	members: ['ana', 'bruno'],
	updatedAt: UPDATED
};

const participants: Schemas['ParticipantHttpResponse'][] = [
	{ username: 'ana', groupId: 1, groupName: 'Group A' },
	{ username: 'bruno', groupId: 1, groupName: 'Group A' },
	{ username: 'carla', groupId: null, groupName: null }
];

const heading = (name: string) => async (page: Page) =>
	expect(page.getByRole('heading', { name, exact: true, level: 1 })).toBeVisible();

const editorReady = async (page: Page) => {
	await expect(page.locator('#status-api')).toHaveText('API: online');
	await expect(page.locator('#cy canvas').first()).toBeVisible();
};

export const MAIN_ROUTES: Screen[] = [
	{ name: 'editor', path: '/', ready: editorReady },
	{ name: 'login', path: '/login', ready: heading('Log in') },
	{ name: 'study', path: '/study', role: 'participant', ready: heading('Proposed queries') },
	{
		name: 'study-task',
		path: '/study/fire-fast',
		role: 'participant',
		ready: async (page) => {
			await editorReady(page);
			await expect(page.getByText(studyTask.statement)).toBeVisible();
		}
	},
	{ name: 'admin', path: '/admin', role: 'admin', ready: heading('Admin') },
	{ name: 'admin-tasks', path: '/admin/tasks', role: 'admin', ready: heading('Proposed tasks') },
	{ name: 'admin-task-new', path: '/admin/tasks/new', role: 'admin', ready: editorReady },
	{
		name: 'admin-groups',
		path: '/admin/groups',
		role: 'admin',
		ready: heading('Participant groups')
	},
	{ name: 'admin-group', path: '/admin/groups/1', role: 'admin', ready: heading('Group A') },
	{
		name: 'styleguide',
		path: '/styleguide',
		ready: async (page) => {
			await heading('Styleguide')(page);
			await expect(
				page.getByTestId('node-kind-canvas').locator('canvas').first()
			).toBeVisible();
		}
	}
];

/** Session and data for one screen, on top of `mockApi` (later routes win). */
export async function prepareScreen(page: Page, api: MockApi, screen: Screen) {
	await page.addInitScript(() => window.localStorage.setItem('easyquery-tour-seen', 'true'));
	if (screen.role) {
		const user: Schemas['SessionUserHttpResponse'] = { username: 'ana', role: screen.role };
		api.override('/api/auth/session', () => ({ data: user }));
	}
	api.override('/api/study/forms', () => ({ data: forms }));
	api.override('/api/study/tasks', () => ({ data: studyTasks }));
	api.override('/api/study/tasks/fire-fast', () => ({ data: studyTask }));
	api.override('/api/admin/tasks', () => ({ data: tasks }));
	api.override('/api/admin/groups', () => ({ data: [group] }));
	api.override('/api/admin/groups/1', () => ({ data: group }));
	api.override('/api/admin/participants', () => ({ data: participants }));
}

/** Light or dark as the theme toggle stores it (mode-watcher), before the page loads. */
export async function useTheme(page: Page, theme: 'light' | 'dark') {
	await page.addInitScript(
		(mode) => window.localStorage.setItem('mode-watcher-mode', mode),
		theme
	);
	await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
}

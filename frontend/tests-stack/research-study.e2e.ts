/**
 * STUDY-022: the five PokemonGen1 research tasks R1-R5 seeded by `scripts/seed-demo-study.mjs --set=research`
 * on the real stack. The seeder fails when a stored expected count differs from the note's answer count, seeding
 * twice is harmless, the participant sees R1-R5 in order and saves one answer without any correctness shown.
 */
import { expect, test } from '@playwright/test';
import { RESEARCH_STUDY_FILE, readDemoStudy, seedDemoStudy } from '../scripts/seed-demo-study.mjs';
import { PASSWORD, guardOffline, joinStudy, loginAs } from './support.js';

let unexpected: string[];

test.beforeEach(({ page, baseURL }) => {
	unexpected = guardOffline(page, baseURL!);
});

test.afterEach(() => {
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});

test('the research participant sees R1-R5 in order and saves an answer', async ({
	page,
	baseURL
}) => {
	const study = readDemoStudy(RESEARCH_STUDY_FILE);
	const participant = { username: `research-${Date.now()}`, password: PASSWORD };
	const admin = { username: 'stack-admin', password: PASSWORD };
	const first = await seedDemoStudy({ baseUrl: baseURL!, admin, participant, study });
	const again = await seedDemoStudy({ baseUrl: baseURL!, admin, participant, study });
	expect(again).toEqual(first);
	expect(first.keys).toEqual(study.tasks.map((task) => task.key));

	await loginAs(page.request, participant.username);
	await joinStudy(page.request);
	await page.goto('/study');
	const tasks = page.getByTestId('study-task');
	await expect(tasks).toHaveCount(5);
	for (const [index, task] of study.tasks.entries())
		await expect(tasks.nth(index)).toContainText(`${index + 1}. ${task.title}`);

	const [bird] = study.tasks;
	const reply = await page.request.post(`/api/study/tasks/${bird.key}/submissions`, {
		data: { graph: bird.graph, query: bird.query }
	});
	expect(reply.status()).toBe(201);
	const saved = ((await reply.json()) as { data: Record<string, unknown> }).data;
	expect(Object.keys(saved).sort()).toEqual(['save', 'savedAt', 'taskRevision', 'timeSpentMs']);

	await tasks.nth(0).click();
	await expect(page).toHaveURL(new RegExp(`/study/${bird.key}$`));
	await expect(page.getByTestId('task-statement')).toContainText('Use a ferramenta para encontrar');
	await expect(page.getByTestId('task-statement')).toContainText('contém a palavra "Bird"');
});

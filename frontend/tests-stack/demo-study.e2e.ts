/**
 * STUDY-013: the Brasileirão 2023 practice tasks seeded by `scripts/seed-demo-study.mjs` on the real stack.
 * Every stored expected result has the DOC-009 answer count (checked by the seeder), seeding twice is harmless,
 * the participant sees the tasks in order and gets the server's verdict on a right and a wrong answer.
 */
import { expect, test } from '@playwright/test';
import { readDemoStudy, seedDemoStudy } from '../scripts/seed-demo-study.mjs';
import { PASSWORD, guardOffline, joinStudy, loginAs } from './support.js';

let unexpected: string[];

test.beforeEach(({ page, baseURL }) => {
	unexpected = guardOffline(page, baseURL!);
});

test.afterEach(() => {
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});

test('the seeded Brasileirão tasks open to the demo participant in order and check answers', async ({
	page,
	baseURL
}) => {
	const study = readDemoStudy();
	const participant = { username: `demo-${Date.now()}`, password: PASSWORD };
	const admin = { username: 'stack-admin', password: PASSWORD };
	const first = await seedDemoStudy({ baseUrl: baseURL!, admin, participant, study });
	const again = await seedDemoStudy({ baseUrl: baseURL!, admin, participant, study });
	expect(again).toEqual(first);

	await loginAs(page.request, participant.username);
	await joinStudy(page.request);
	await page.goto('/study');
	const tasks = page.getByTestId('study-task');
	await expect(tasks).toHaveCount(study.tasks.length);
	for (const [index, task] of study.tasks.entries())
		await expect(tasks.nth(index)).toContainText(`${index + 1}. ${task.title}`);

	const [relegated, arena] = study.tasks;
	const submit = async (key: string, answer: (typeof study.tasks)[number]) => {
		const reply = await page.request.post(`/api/study/tasks/${key}/submissions`, {
			data: { graph: answer.graph, query: answer.query }
		});
		expect(reply.status(), `submit to ${key}`).toBe(201);
		return ((await reply.json()) as { data: { correct: boolean; feedback: string } }).data;
	};
	expect(await submit(relegated.key, relegated)).toMatchObject({
		correct: true,
		feedback: 'Correct: all 4 expected results.'
	});
	expect(await submit(arena.key, relegated)).toMatchObject({
		correct: false,
		feedback: 'Incorrect: 0 of 8 expected results; 4 extra.'
	});

	await tasks.nth(0).click();
	await expect(page).toHaveURL(new RegExp(`/study/${relegated.key}$`));
	await expect(page.getByTestId('task-statement')).toContainText(
		'Quais times foram rebaixados no Brasileirão 2023?'
	);
	await expect(page.locator('#input-endpoint-sparql')).toHaveValue(/Brasileir/);
});

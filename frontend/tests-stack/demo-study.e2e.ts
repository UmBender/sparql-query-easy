/**
 * STUDY-013: the Brasileirão 2023 practice tasks seeded by `scripts/seed-demo-study.mjs` on the real stack.
 * Every stored expected result has the DOC-009 answer count (checked by the seeder), seeding twice is harmless,
 * the participant sees the tasks in order and saves a right and a wrong answer; the response tells neither, and
 * the stored admin-only check (DEC-020) tells them apart.
 */
import { expect, test } from '@playwright/test';
import { readDemoStudy, seedDemoStudy } from '../scripts/seed-demo-study.mjs';
import { PASSWORD, guardOffline, joinStudy, loginAs, sql } from './support.js';

let unexpected: string[];

test.beforeEach(({ page, baseURL }) => {
	unexpected = guardOffline(page, baseURL!);
});

test.afterEach(() => {
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});

test('the seeded Brasileirão tasks open to the demo participant in order and save answers', async ({
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
		return ((await reply.json()) as { data: Record<string, unknown> }).data;
	};
	for (const saved of [
		await submit(relegated.key, relegated),
		await submit(arena.key, relegated)
	])
		expect(Object.keys(saved).sort()).toEqual([
			'save',
			'savedAt',
			'taskRevision',
			'timeSpentMs'
		]);
	const checks = sql<{ task_key: string; correct: boolean; feedback: string }[]>(
		`select coalesce(json_agg(row_to_json(s) order by s.id), '[]') from (select s.id, t.task_key, s.correct,
		 s.feedback from study_submission s join study_task t on t.id = s.task_id join app_user u on u.id = s.user_id
		 where u.username = '${participant.username.toLowerCase()}') s`
	);
	expect(checks.map(({ task_key, correct }) => ({ task_key, correct }))).toEqual([
		{ task_key: relegated.key, correct: true },
		{ task_key: arena.key, correct: false }
	]);
	// ?equipe is the reference's answer variable in the fixture.
	expect(checks[0].feedback).toContain(`?equipe: Correct: all 4 expected results.`);
	expect(checks[1].feedback).toContain(`?equipe: Incorrect: 0 of 8 expected results; 4 extra.`);

	await tasks.nth(0).click();
	await expect(page).toHaveURL(new RegExp(`/study/${relegated.key}$`));
	await expect(page.getByTestId('task-statement')).toContainText(
		'Quais times foram rebaixados no Brasileirão 2023?'
	);
	await expect(page.locator('#input-endpoint-sparql')).toHaveValue(/Brasileir/);
});

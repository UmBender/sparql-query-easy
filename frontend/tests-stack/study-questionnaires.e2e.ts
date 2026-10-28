/**
 * The whole T9 flow on the real stack (STUDY-011): a new participant accepts
 * the consent, answers the profile questionnaire (question 1 of the
 * dissertation questionnaire, STUDY-015; sending it unanswered is refused
 * first), finishes the proposed tasks and answers the usability questionnaire
 * (questions 2 to 15; an out-of-range number of queries is refused first);
 * then an admin downloads both CSVs from /admin and finds exactly that
 * participant's answers, under the internal number only.
 */
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { QuestionnairePage } from '../tests/support/pages/questionnaire-page';
import { PROFILE_QUESTION, answerPage, guardOffline, loginAs, shippedPages } from './support.js';

let unexpected: string[];

test.beforeEach(({ page, baseURL }) => {
	unexpected = guardOffline(page, baseURL!);
});

test.afterEach(() => {
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});

/** Downloads one questionnaire's CSV from the admin page; returns its rows as cells (no quoted cells here). */
async function downloadCsv(page: Page, title: string): Promise<string[][]> {
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('link', { name: `Download ${title} (CSV)` }).click()
	]);
	const text = await readFile((await download.path())!, 'utf8');
	return text
		.split('\r\n')
		.filter((line) => line !== '')
		.map((line) => line.split(','));
}

test('a participant answers both questionnaires and the admin finds them in the CSV exports', async ({
	page,
	browser
}) => {
	const participant = `t9-${Date.now()}`;
	await loginAs(page.request, participant);
	/** When the participant's response to `slug` was stored, as the server reports and exports it. */
	const submittedAt = async (slug: string) => {
		const status = await page.request.get(`/api/study/forms/${slug}/response`);
		return ((await status.json()) as { data: { submittedAt: string } }).data.submittedAt;
	};

	await page.goto('/study');
	await page.getByRole('button', { name: 'I agree to take part' }).click();

	const questionnaire = new QuestionnairePage(page);
	const form = questionnaire.form;
	await expect(form).toHaveAttribute('data-slug', 'profile');
	await questionnaire.send();
	await expect(form.getByText('Answer this question.')).toBeVisible();
	await questionnaire.rate(PROFILE_QUESTION, 3);
	await questionnaire.send();
	await expect(page.getByTestId('no-tasks')).toBeVisible();
	const profileAt = await submittedAt('profile');

	await page.getByRole('button', { name: 'Finish the study' }).click();
	await page.getByRole('button', { name: 'Finish and submit' }).click();
	await expect(form).toHaveAttribute('data-slug', 'usability');
	const [tool, notation] = shippedPages('usability.v2.json');
	await answerPage(questionnaire, tool, 4, 21);
	await questionnaire.next();
	await expect(form.getByText('Enter a number from 0 to 20.')).toBeVisible();
	await questionnaire.fill(tool[0].text, '5');
	await questionnaire.next();
	await answerPage(questionnaire, notation, 2);
	await questionnaire.send();
	await expect(page.getByTestId('study-finished')).toBeVisible();
	const usabilityAt = await submittedAt('usability');

	const admin = await browser.newContext({ acceptDownloads: true });
	try {
		await loginAs(admin.request, 'stack-admin');
		const adminPage = await admin.newPage();
		await adminPage.goto('/admin');
		const exports = adminPage.getByTestId('form-exports');
		await expect(exports.getByRole('link')).toHaveCount(2);
		const axe = await new AxeBuilder({ page: adminPage }).analyze();
		expect(axe.violations.map((violation) => violation.id)).toEqual([]);
		const participantDenied = await page.request.get('/api/admin/forms/profile/responses.csv');
		expect(participantDenied.status()).toBe(403);

		const usability = await downloadCsv(adminPage, 'Questionário de Avaliação');
		const usabilityHeader = usability[0];
		const column = (header: string[], name: string) => header.indexOf(name);
		const mine = usability.filter(
			(row) => row[column(usabilityHeader, 'submitted_at')] === usabilityAt
		);
		expect(mine).toHaveLength(1);
		const number = mine[0][1];
		expect(Number.isInteger(Number(number))).toBe(true);
		const cell = (name: string) => mine[0][column(usabilityHeader, name)];
		expect(cell('form_version')).toBe('2');
		expect(cell('q02_queries_done')).toBe('5');
		for (const question of tool.slice(1)) expect(cell(question.id)).toBe('4');
		for (const question of notation) expect(cell(question.id)).toBe('2');
		// STUDY-015 scores: usability 2.5 · (3 · (5 − 4) + 4 · (4 − 1)) = 37.5, notation 5 · (2 − 1) = 5.
		expect([cell('usability_score'), cell('notation_score')]).toEqual(['37.5', '5']);
		// The placeholder v1 columns follow, empty for a v2 response.
		expect(cell('easy_to_use')).toBe('');
		expect(usability.flat().join(',')).not.toContain(participant);

		const profile = await downloadCsv(adminPage, 'Conhecimento prévio');
		const profileHeader = profile[0];
		const rows = profile.filter((row) => row[1] === number);
		expect(rows).toHaveLength(1);
		const answer = (name: string) => rows[0][column(profileHeader, name)];
		expect(answer('submitted_at')).toBe(profileAt);
		expect(answer('form_version')).toBe('2');
		expect(answer('q01_sparql_knowledge')).toBe('3');
		expect(profile.flat().join(',')).not.toContain(participant);
	} finally {
		await admin.close();
	}
});

/**
 * The whole T9 flow on the real stack (STUDY-011): a new participant accepts
 * the consent, answers the profile questionnaire (an invalid number is
 * refused first), finishes the proposed tasks and answers the usability
 * questionnaire; then an admin downloads both CSVs from /admin and finds
 * exactly that participant's answers, under the internal number only.
 */
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { QuestionnairePage } from '../tests/support/pages/questionnaire-page';
import { guardOffline, loginAs } from './support.js';

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
	const stamp = Date.now();
	const participant = `t9-${stamp}`;
	const hardest = `Choosing the filter ${stamp}`;
	await loginAs(page.request, participant);

	await page.goto('/study');
	await page.getByRole('button', { name: 'I agree to take part' }).click();

	const questionnaire = new QuestionnairePage(page);
	const form = questionnaire.form;
	await expect(form).toHaveAttribute('data-slug', 'profile');
	await questionnaire.choose('I have used it a few times');
	await questionnaire.check('SQL');
	await questionnaire.check('SPARQL');
	const years = questionnaire.field('PLACEHOLDER How many years have you programmed?');
	await years.fill('99');
	await questionnaire.rate('PLACEHOLDER I am comfortable exploring data in tables.', 5);
	await questionnaire.send();
	await expect(form.getByText('Enter a number from 0 to 60.')).toBeVisible();
	await years.fill('7');
	await questionnaire.send();
	await expect(page.getByTestId('no-tasks')).toBeVisible();

	await page.getByRole('button', { name: 'Finish the study' }).click();
	await page.getByRole('button', { name: 'Finish and submit' }).click();
	await expect(form).toHaveAttribute('data-slug', 'usability');
	await questionnaire.rate('PLACEHOLDER The graph editor was easy to use.', 4);
	await questionnaire.rate('PLACEHOLDER Drawing a query was faster than writing SPARQL.', 3);
	await questionnaire.rate('PLACEHOLDER I was confident my answers were correct.', 2);
	await questionnaire.choose('Run Query stages');
	await questionnaire.next();
	await questionnaire.fill(/PLACEHOLDER In one sentence/, hardest);
	await questionnaire.send();
	await expect(page.getByTestId('study-finished')).toBeVisible();

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

		const usability = await downloadCsv(adminPage, 'PLACEHOLDER Using the editor');
		const usabilityHeader = usability[0];
		const mine = usability.filter((row) => row.includes(hardest));
		expect(mine).toHaveLength(1);
		const number = mine[0][1];
		expect(Number.isInteger(Number(number))).toBe(true);
		const cell = (row: string[], column: string) => row[usabilityHeader.indexOf(column)];
		expect(cell(mine[0], 'easy_to_use')).toBe('4');
		expect(cell(mine[0], 'most_useful')).toBe('run_query_stages');
		expect(usability.flat().join(',')).not.toContain(participant);

		const profile = await downloadCsv(adminPage, 'PLACEHOLDER About you');
		const profileHeader = profile[0];
		const rows = profile.filter((row) => row[1] === number);
		expect(rows).toHaveLength(1);
		const answer = (column: string) => rows[0][profileHeader.indexOf(column)];
		expect(answer('sparql_familiarity')).toBe('used_few');
		expect(answer('query_languages')).toBe('sql;sparql');
		expect(answer('programming_years')).toBe('7');
		expect(answer('data_comfort')).toBe('5');
		expect(profile.flat().join(',')).not.toContain(participant);
	} finally {
		await admin.close();
	}
});

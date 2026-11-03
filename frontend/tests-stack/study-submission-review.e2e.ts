/**
 * STUDY-017/018 on the real stack: a participant saves an answer, the admin
 * finds it under a pseudonym on /admin/submissions, opens it beside the
 * reference of its revision, and downloads the ZIP of the last saves from
 * /admin. The ZIP's contents are checked in AdminSubmissionExportRoutesTest.
 */
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { FIRE_SPEED, FIRE_SPEED_QUERY, guardOffline, loginAs, seedStudy } from './support.js';

let unexpected: string[];

test.beforeEach(({ page, baseURL }) => {
	unexpected = guardOffline(page, baseURL!);
});

test.afterEach(() => {
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});

test('an admin reviews a saved answer beside its reference and downloads the ZIP', async ({
	page,
	browser
}) => {
	const participant = `reviewed-${Date.now()}`;
	const keys = await seedStudy(browser, participant);
	const graph = JSON.parse(readFileSync(FIRE_SPEED, 'utf8'));
	// A saved answer carries no answer variable (STUDY-016).
	const query = {
		where: FIRE_SPEED_QUERY.where,
		variableFilters: FIRE_SPEED_QUERY.variableFilters
	};
	const participantContext = await browser.newContext();
	try {
		await loginAs(participantContext.request, participant);
		const saved = await participantContext.request.post(
			`/api/study/tasks/${keys[1]}/submissions`,
			{ data: { graph, query } }
		);
		expect(saved.status()).toBe(201);
		const denied = await participantContext.request.get('/api/admin/submissions.zip');
		expect(denied.status()).toBe(403);
	} finally {
		await participantContext.close();
	}

	await loginAs(page.request, 'stack-admin');
	await page.goto('/admin/submissions');
	const row = page.getByTestId('submission-row').filter({ hasText: participant });
	await expect(row).toHaveCount(1);
	await expect(row).toContainText(keys[1]);
	await expect(row).toContainText('Match');
	const pseudonym = (await row.locator('td').first().textContent())!.trim();
	expect(pseudonym).toMatch(/^P\d{3,}$/);

	await row.getByRole('link', { name: `Review ${pseudonym} ${keys[1]}` }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		`${pseudonym} · Fast Fire Pokémon`
	);
	await expect(page.getByTestId('reference-statement')).toHaveText(
		'Find the Fire-type Pokémon with speed of at least 90.'
	);
	await expect(page.getByTestId('diagram-view').locator('canvas').first()).toBeVisible();
	await expect(page.getByTestId('variable-check').first()).toContainText('?pokemon');
	const axe = await new AxeBuilder({ page }).analyze();
	expect(axe.violations.map((violation) => violation.id)).toEqual([]);

	await page.goto('/admin');
	const link = page.getByRole('link', { name: 'Download saved answers (ZIP)' });
	await expect(link).toHaveAttribute('href', '/api/admin/submissions.zip');
	const zip = await page.request.get('/api/admin/submissions.zip');
	expect(zip.status()).toBe(200);
	expect(zip.headers()['content-type']).toBe('application/zip');
	const bytes = await zip.body();
	expect(bytes.subarray(0, 2).toString('latin1')).toBe('PK');
	// Entry names are stored as plain text in the archive; the account name is never one.
	expect(bytes.includes(`${pseudonym}/${keys[1]}/diagram.txt`)).toBe(true);
	expect(bytes.includes(participant)).toBe(false);
});

import type { Locator, Page } from '@playwright/test';

/**
 * QUAL-013: the questionnaire on `/study` (STUDY-009/010): one page of
 * questions at a time, answered by their visible text.
 */
export class QuestionnairePage {
	readonly form: Locator;
	/** "Page n of m". */
	readonly pageLabel: Locator;

	constructor(readonly page: Page) {
		this.form = page.getByTestId('questionnaire');
		this.pageLabel = this.form.getByTestId('form-page');
	}

	/** The form's slug (`profile`, `usability`). */
	slug() {
		return this.form.getAttribute('data-slug');
	}

	async choose(option: string) {
		await this.form.getByRole('radio', { name: option }).click();
	}

	async check(option: string) {
		await this.form.getByRole('checkbox', { name: option }).click();
	}

	field(label: string | RegExp): Locator {
		return this.form.getByLabel(label);
	}

	async fill(label: string | RegExp, value: string) {
		await this.field(label).fill(value);
	}

	/** Picks `value` on the rating scale of `question`. */
	async rate(question: string, value: number) {
		await this.form
			.getByRole('group', { name: question })
			.getByText(String(value), { exact: true })
			.click();
	}

	async next() {
		await this.form.getByRole('button', { name: 'Next' }).click();
	}

	async back() {
		await this.form.getByRole('button', { name: 'Back' }).click();
	}

	async send() {
		await this.form.getByRole('button', { name: 'Send my answers' }).click();
	}
}

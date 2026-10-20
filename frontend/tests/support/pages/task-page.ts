import { expect, type Locator, type Page } from '@playwright/test';
import { EditorPage } from './editor-page';

/**
 * QUAL-013: a proposed task (`/study/<key>`, STUDY-003/004): the editor with
 * the task's panel, the answer variable, Submit answer, its feedback and the
 * attempt history (newest first).
 */
export class TaskPage {
	readonly editor: EditorPage;
	readonly title: Locator;
	readonly statement: Locator;
	readonly feedback: Locator;
	readonly attempts: Locator;
	readonly submitButton: Locator;

	constructor(readonly page: Page) {
		this.editor = new EditorPage(page);
		this.title = page.locator('#task-title');
		this.statement = page.getByTestId('task-statement');
		this.feedback = page.getByTestId('answer-feedback');
		this.attempts = page.getByTestId('attempt-history').getByRole('listitem');
		this.submitButton = page.locator('#submit-answer-btn');
	}

	async open(key: string) {
		await this.editor.open(`/study/${encodeURIComponent(key)}`);
		await expect(this.title).toBeVisible();
	}

	answerVariable(name: string): Locator {
		return this.page.getByRole('radio', { name, exact: true });
	}

	async submit() {
		await this.submitButton.click();
	}
}

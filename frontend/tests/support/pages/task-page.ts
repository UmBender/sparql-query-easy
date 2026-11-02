import { expect, type Locator, type Page } from '@playwright/test';
import { EditorPage } from './editor-page';

/**
 * QUAL-013: a proposed task (`/study/<key>`, STUDY-003/016): the editor with
 * the task's panel, Save answer and its status line (the last save time or
 * why the diagram cannot be saved; never correctness, DEC-020).
 */
export class TaskPage {
	readonly editor: EditorPage;
	readonly title: Locator;
	readonly statement: Locator;
	readonly feedback: Locator;
	readonly savedAt: Locator;
	readonly saveButton: Locator;

	constructor(readonly page: Page) {
		this.editor = new EditorPage(page);
		this.title = page.locator('#task-title');
		this.statement = page.getByTestId('task-statement');
		this.feedback = page.getByTestId('answer-feedback');
		this.savedAt = this.feedback.locator('time');
		this.saveButton = page.locator('#submit-answer-btn');
	}

	async open(key: string) {
		await this.editor.open(`/study/${encodeURIComponent(key)}`);
		await expect(this.title).toBeVisible();
	}

	async save() {
		await this.saveButton.click();
	}
}

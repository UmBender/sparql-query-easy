import { expect, type Locator, type Page } from '@playwright/test';
import {
	addGraph,
	clickBackground,
	clickEdge,
	clickNode,
	dragNode,
	graphOf,
	hoverNode,
	nodeCanvasPosition,
	nodePagePosition
} from '../editor';

/**
 * QUAL-013: the query editor (`/`, and the editor inside the task and admin
 * task pages) for both Playwright suites. Canvas gestures use the nodes'
 * rendered positions from the e2e test hook (`window.__easyquery`), so they
 * work at any zoom and pan.
 */
export class EditorPage {
	readonly canvas: Locator;
	readonly runQueryButton: Locator;
	readonly stageHeading: Locator;
	readonly candidates: Locator;
	readonly assumeButtons: Locator;
	readonly orderChips: Locator;
	readonly nodeCount: Locator;

	constructor(readonly page: Page) {
		this.canvas = page.locator('#cy');
		this.runQueryButton = page.locator('#run-query-btn');
		this.stageHeading = page.locator('#stage-heading');
		this.candidates = page.locator('#stage-candidates .stage-candidate');
		this.assumeButtons = page.locator('#stage-candidates .stage-assume');
		this.orderChips = page.locator('#variable-order-list [data-slot="chip-label"]');
		this.nodeCount = page.locator('#status-nodes');
	}

	/** Opens `path` as a returning visitor (no guided tour) and waits for the API status. */
	async open(path = '/') {
		await this.page.addInitScript(() =>
			window.localStorage.setItem('easyquery-tour-seen', 'true')
		);
		await this.page.goto(path);
		await this.ready();
	}

	async ready() {
		await expect(this.page.locator('#status-api')).toHaveText('API: online');
	}

	async setAutoLayout(on: boolean) {
		await this.page.evaluate(
			(value) =>
				((
					window as never as { __easyquery: { store: { autoLayout: boolean } } }
				).__easyquery.store.autoLayout = value),
			on
		);
	}

	/** Sets the canvas zoom and pan through the test hook. */
	async setViewport(zoom: number, pan: { x: number; y: number }) {
		await this.page.evaluate(
			({ zoom, pan }) => {
				const { cy } = (
					window as never as {
						__easyquery: {
							view: { cy: { zoom(z: number): void; pan(p: object): void } };
						};
					}
				).__easyquery.view;
				cy.zoom(zoom);
				cy.pan(pan);
			},
			{ zoom, pan }
		);
	}

	addGraph(items: Parameters<typeof addGraph>[1]) {
		return addGraph(this.page, items);
	}

	graph() {
		return graphOf(this.page);
	}

	/** The store's current selection (`{ kind, id }` or null). */
	selection() {
		return this.page.evaluate(
			() =>
				(window as never as { __easyquery: { store: { selection: unknown } } }).__easyquery
					.store.selection
		);
	}

	nodeCanvasPosition(id: string) {
		return nodeCanvasPosition(this.page, id);
	}

	nodePagePosition(id: string) {
		return nodePagePosition(this.page, id);
	}

	clickNode(id: string, options?: Parameters<typeof clickNode>[2]) {
		return clickNode(this.page, id, options);
	}

	clickEdge(id: string) {
		return clickEdge(this.page, id);
	}

	clickBackground() {
		return clickBackground(this.page);
	}

	hoverNode(id: string) {
		return hoverNode(this.page, id);
	}

	dragNode(id: string, by: { x: number; y: number }) {
		return dragNode(this.page, id, by);
	}

	async runQuery() {
		await this.runQueryButton.click();
	}

	/** Loads a saved query file through Upload Query. */
	async uploadQuery(name: string, document: unknown) {
		await this.page.locator('#upload-json').setInputFiles({
			name,
			mimeType: 'application/json',
			buffer: Buffer.from(JSON.stringify(document))
		});
	}
}

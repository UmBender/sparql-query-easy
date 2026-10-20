/**
 * QUAL-013: the EditorPage position helpers find a node by id at any zoom and
 * pan, so canvas gestures in both Playwright suites never use pixel literals.
 */
import { expect, test } from '@playwright/test';
import { guardOffline } from './support/offline';
import { mockApi } from './support/mock-api';
import { EditorPage } from './support/pages/editor-page';

let unexpected: string[];
let editor: EditorPage;

test.beforeEach(async ({ page, baseURL }) => {
	unexpected = await guardOffline(page, baseURL!);
	await mockApi(page);
	await page.setViewportSize({ width: 1280, height: 800 });
	editor = new EditorPage(page);
	await editor.open();
	await editor.setAutoLayout(false);
	await editor.addGraph([
		{ id: '?team', kind: 'variable', x: 100, y: 100 },
		{ id: '<https://example.test/team-a>', kind: 'entity', label: 'Team A', x: 320, y: 180 },
		{ edge: 'e1', source: '?team', target: '<https://example.test/team-a>', predicate: '<p>' }
	]);
});

test.afterEach(() => {
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});

for (const viewport of [
	{ zoom: 1, pan: { x: 0, y: 0 } },
	{ zoom: 1.8, pan: { x: -60, y: 40 } },
	{ zoom: 0.6, pan: { x: 250, y: 120 } }
]) {
	test(`clicking a node by id selects it at zoom ${viewport.zoom}`, async () => {
		await editor.setViewport(viewport.zoom, viewport.pan);
		await editor.clickNode('<https://example.test/team-a>');
		expect(await editor.selection()).toEqual({
			kind: 'node',
			id: '<https://example.test/team-a>'
		});
		await editor.clickNode('?team');
		expect(await editor.selection()).toEqual({ kind: 'node', id: '?team' });
	});
}

test('dragging a node moves it by the rendered distance', async () => {
	await editor.setViewport(2, { x: 0, y: 0 });
	const before = await editor.nodeCanvasPosition('?team');
	await editor.dragNode('?team', { x: 120, y: 60 });
	await expect
		.poll(() => editor.nodeCanvasPosition('?team'))
		.toEqual({ x: before.x + 120, y: before.y + 60 });
	await expect(editor.nodePagePosition('nope')).rejects.toThrow('No node nope on the canvas');
});

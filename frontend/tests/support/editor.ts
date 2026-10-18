import { expect, type Page } from '@playwright/test';

/** The e2e-only handle the editor exposes (query-editor.svelte). */
export const handle = `window.__easyquery`;

/** Waits for the editor, turns Auto Layout off and resets the viewport. */
export async function openEditor(page: Page) {
	await page.goto('/');
	await expect(page.locator('#status-api')).toHaveText('API: online');
	await page.evaluate(() => {
		const { store, view } = (
			window as never as {
				__easyquery: {
					store: { autoLayout: boolean };
					view: { cy: { zoom(z: number): void; pan(p: object): void } };
				};
			}
		).__easyquery;
		store.autoLayout = false;
		view.cy.zoom(1);
		view.cy.pan({ x: 0, y: 0 });
	});
}

type Spec =
	| {
			kind: 'variable' | 'entity' | 'value' | 'valueVariable' | 'class';
			id: string;
			label?: string;
			x: number;
			y: number;
			filter?: unknown;
			value?: string;
	  }
	| { edge: string; source: string; target: string; predicate: string | null; label?: string };

/** Adds typed nodes and relations straight to the store's graph (one commit). */
export async function addGraph(page: Page, items: Spec[]) {
	await page.evaluate((specs) => {
		const { store } = (
			window as never as {
				__easyquery: { store: { graph: unknown; commit(graph: unknown): void } };
			}
		).__easyquery;
		type Graph = { elements: unknown[]; incident: Record<string, string[]> };
		const graph = structuredClone(store.graph) as Graph;
		for (const spec of specs as Spec[]) {
			if ('edge' in spec) {
				const edge = {
					kind: 'relation',
					id: spec.edge,
					source: spec.source,
					target: spec.target,
					predicate: spec.predicate,
					label: spec.label ?? '?',
					...(spec.predicate?.startsWith('?') ? { variableMark: true } : {})
				};
				graph.elements.push(edge);
				graph.incident[spec.source] = [...(graph.incident[spec.source] ?? []), spec.edge];
				if (spec.target !== spec.source)
					graph.incident[spec.target] = [
						...(graph.incident[spec.target] ?? []),
						spec.edge
					];
				continue;
			}
			const position = { x: spec.x, y: spec.y };
			const base = {
				id: spec.id,
				label:
					spec.label ??
					(spec.kind === 'variable' || spec.kind === 'valueVariable' ? '?' : spec.id),
				position
			};
			const node =
				spec.kind === 'variable'
					? { ...base, kind: 'variable', name: spec.id }
					: spec.kind === 'valueVariable'
						? {
								...base,
								kind: 'valueVariable',
								name: spec.id,
								filter: spec.filter ?? null
							}
						: spec.kind === 'value'
							? {
									...base,
									kind: 'value',
									term: { type: 'literal', value: spec.value ?? spec.id },
									filter: spec.filter ?? null
								}
							: spec.kind === 'class'
								? { ...base, kind: 'class', value: spec.value ?? spec.id }
								: { ...base, kind: 'entity', value: spec.value ?? spec.id };
			graph.elements.push(node);
			graph.incident[spec.id] = graph.incident[spec.id] ?? [];
		}
		store.commit(graph);
	}, items);
}

/** Clicks a node at its rendered position (the canvas listens to real pointer events). */
export async function clickNode(
	page: Page,
	id: string,
	options: { modifiers?: ('Alt' | 'Shift')[] } = {}
) {
	const point = await page.evaluate(async (nodeId) => {
		const { view } = (
			window as never as { __easyquery: { view: { cy: import('cytoscape').Core } } }
		).__easyquery;
		await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
		const node = view.cy.getElementById(nodeId);
		const rendered = node.renderedPosition();
		return { x: rendered.x, y: rendered.y };
	}, id);
	await page.locator('#cy').click({ position: point, ...options });
}

export async function clickEdge(page: Page, id: string) {
	const point = await page.evaluate(async (edgeId) => {
		const { view } = (
			window as never as { __easyquery: { view: { cy: import('cytoscape').Core } } }
		).__easyquery;
		await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
		const midpoint = view.cy.getElementById(edgeId).midpoint();
		const zoom = view.cy.zoom();
		const pan = view.cy.pan();
		return { x: midpoint.x * zoom + pan.x, y: midpoint.y * zoom + pan.y };
	}, id);
	await page.locator('#cy').click({ position: point });
}

export async function clickBackground(page: Page) {
	await page.locator('#cy').click({ position: { x: 12, y: 12 } });
}

/** Sorted node ids, edge triples and kinds from the store. */
export async function graphOf(page: Page) {
	return page.evaluate(() => {
		const { store } = (
			window as never as {
				__easyquery: { store: { graph: { elements: Record<string, unknown>[] } } };
			}
		).__easyquery;
		const elements = store.graph.elements;
		return {
			nodes: elements
				.filter((element) => element.kind !== 'relation')
				.map((element) => `${element.id}|${element.kind}|${element.label}`)
				.sort(),
			edges: elements
				.filter((element) => element.kind === 'relation')
				.map(
					(element) =>
						`${element.id}|${element.source}|${element.predicate}|${element.target}`
				)
				.sort()
		};
	});
}

/** The canvas shows exactly what the store's graph gives (FE-044 rebuild check). */
export async function expectCanvasMatchesStore(page: Page) {
	await expect
		.poll(() =>
			page.evaluate(() => {
				type Handle = {
					store: { graph: never };
					view: { cy: import('cytoscape').Core };
					viewElements: (
						graph: never
					) => { data: Record<string, unknown>; classes: string }[];
				};
				const { store, view, viewElements } = (window as never as { __easyquery: Handle })
					.__easyquery;
				const canonical = (data: Record<string, unknown>) =>
					JSON.stringify(
						Object.keys(data)
							.filter((key) =>
								['id', 'label', 'kind', 'source', 'target'].includes(key)
							)
							.sort()
							.map((key) => [key, data[key]])
					);
				const expected = viewElements(store.graph)
					.map((element) => canonical(element.data))
					.sort();
				const actual = view.cy
					.elements()
					.map((element) => canonical(element.data()))
					.sort();
				return JSON.stringify(actual) === JSON.stringify(expected)
					? 'equal'
					: JSON.stringify({ actual, expected });
			})
		)
		.toBe('equal');
}

/**
 * The graph keeps Cytoscape's element and component order (graph.ts). Random
 * add/remove/move sequences are applied both to the domain graph and to the
 * legacy page's Cytoscape (sparql/cytoscape.min.js, run headless) and the
 * orders must match. FE-049 keeps this oracle by vendoring that file.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
	addElements,
	components,
	edgesOf,
	emptyGraph,
	moveEdge,
	nodesOf,
	removeElements,
	type QueryGraph,
	type QueryNode
} from './graph.js';

type Cy = {
	add(elements: unknown): unknown;
	getElementById(id: string): { remove(): void; move(ends: object): void; length: number };
	elements(): {
		map<T>(fn: (element: { id(): string }) => T): T[];
		components(): { map<T>(fn: (element: { id(): string }) => T): T[] }[];
	};
	nodes(): { map<T>(fn: (element: { id(): string }) => T): T[] };
	edges(): { map<T>(fn: (element: { id(): string }) => T): T[] };
};

const legacyFile = new URL('../../../../sparql/cytoscape.min.js', import.meta.url);
// Same realm as the test: Cytoscape only accepts options built from its realm's Object.
vm.runInThisContext(readFileSync(legacyFile, 'utf8'));
const cytoscape = (globalThis as unknown as { cytoscape: (options: object) => Cy }).cytoscape;

function random(seed: number) {
	let state = seed;
	return (n: number) => {
		state = (state * 1103515245 + 12345) & 0x7fffffff;
		return state % n;
	};
}

const variable = (id: string): QueryNode => ({ kind: 'variable', id, name: id, label: '?' });

function scenario(seed: number) {
	const pick = random(seed);
	const cy = cytoscape({ headless: true });
	let graph: QueryGraph = emptyGraph;
	let counter = 0;
	for (let step = 0; step < 60; step++) {
		const nodes = nodesOf(graph).map((node) => node.id);
		const edges = edgesOf(graph).map((edge) => edge.id);
		const action = pick(10);
		if (action < 3 || nodes.length < 2) {
			const id = `n${counter++}`;
			graph = addElements(graph, [variable(id)]);
			cy.add({ group: 'nodes', data: { id } });
		} else if (action < 7) {
			const id = `e${counter++}`;
			const source = nodes[pick(nodes.length)];
			const target = pick(5) === 0 ? source : nodes[pick(nodes.length)];
			graph = addElements(graph, [{ id, source, target, predicate: null, label: '?' }]);
			cy.add({ group: 'edges', data: { id, source, target } });
		} else if (action === 7) {
			const id = nodes[pick(nodes.length)];
			graph = removeElements(graph, [id]);
			cy.getElementById(id).remove();
		} else if (action === 8 && edges.length) {
			const id = edges[pick(edges.length)];
			graph = removeElements(graph, [id]);
			cy.getElementById(id).remove();
		} else if (edges.length) {
			const id = edges[pick(edges.length)];
			const ends = pick(2)
				? { source: nodes[pick(nodes.length)] }
				: { target: nodes[pick(nodes.length)] };
			graph = moveEdge(graph, id, ends);
			cy.getElementById(id).move(ends);
		}
		expect(graph.elements.map((element) => element.id)).toEqual(
			cy.elements().map((element) => element.id())
		);
		expect(components(graph).map((items) => items.map((item) => item.id))).toEqual(
			cy
				.elements()
				.components()
				.map((items) => items.map((item) => item.id()))
		);
	}
}

describe('element and component order', () => {
	for (const seed of [1, 7, 42, 99, 2024, 31337]) {
		it(`matches Cytoscape for random edit sequence ${seed}`, () => scenario(seed));
	}
});

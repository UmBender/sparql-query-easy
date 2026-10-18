/**
 * What the Cytoscape canvas shows for a graph (FE-044): one element per node
 * and relation, with `data(kind)` for the token stylesheet and state classes.
 * Pure, so the view can always be rebuilt from the store
 * (graph-view.spec.ts).
 */
import { edgeData, nodeData, type QueryGraph, type QueryNode } from '#lib/domain/index.js';
import { relationLabelKind } from '#lib/domain/legacy/query-calculations.js';
import type { NodeKindName } from '#lib/design/tokens.js';

export type ViewState = {
	/** Node or edge whose action list is open, and a pending connection's source. */
	selected?: readonly string[];
	/** Filtered nodes whose filter keeps nothing or rejects the actual value (FE-036). */
	rejected?: ReadonlySet<string>;
	/** Nodes and relations of the emphasized variable (FE-023). */
	emphasis?: ReadonlySet<string>;
};

export type ViewElement = {
	group: 'nodes' | 'edges';
	data: { id: string; label: string; kind: string; source?: string; target?: string };
	classes: string;
	position?: { x: number; y: number };
};

/** A label longer than this is written under its node (legacy `node-label-big`). */
export const LONG_LABEL = 15;

export function nodeViewKind(node: QueryNode): NodeKindName {
	switch (node.kind) {
		case 'variable':
			return node.many ? 'many' : 'variable';
		case 'value':
			return node.legacyFilter ? 'legacyFilter' : 'value';
		default:
			return node.kind;
	}
}

/** The legacy label: text after a `)`, as the HTML label template showed it. */
export function nodeViewLabel(node: QueryNode): string {
	let label = String(nodeData(node).label ?? '');
	if (label.includes(')')) label = label.split(')')[1].trimStart();
	return label;
}

export function viewElements(graph: QueryGraph, state: ViewState = {}): ViewElement[] {
	const selected = new Set(state.selected ?? []);
	return graph.elements.map((element): ViewElement => {
		const classes = [
			selected.has(element.id) ? 'selected' : '',
			state.rejected?.has(element.id) ? 'rejected' : '',
			state.emphasis?.has(element.id) ? 'emphasis' : ''
		];
		if (element.kind === 'relation') {
			return {
				group: 'edges',
				data: {
					id: element.id,
					source: element.source,
					target: element.target,
					label: element.label,
					kind: relationLabelKind(edgeData(element))
				},
				classes: classes.filter(Boolean).join(' ')
			};
		}
		const label = nodeViewLabel(element);
		if (label.length > LONG_LABEL) classes.push('label-below');
		return {
			group: 'nodes',
			data: { id: element.id, label, kind: nodeViewKind(element) },
			classes: classes.filter(Boolean).join(' '),
			...(element.position ? { position: { ...element.position } } : {})
		};
	});
}

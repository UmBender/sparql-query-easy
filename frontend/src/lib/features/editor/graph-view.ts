/**
 * What the Cytoscape canvas shows for a graph (FE-044): one element per node
 * and relation, with `data(kind)` for the token stylesheet and state classes.
 * Pure, so the view can always be rebuilt from the store
 * (graph-view.spec.ts).
 */
import {
	edgeData,
	nodeData,
	variableNames,
	type QueryGraph,
	type QueryNode,
	type VariableNames
} from '#lib/domain/index.js';
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

/** A variable's `?` (alone or before its filter, `? ≥ 90`) shows its readable name (FE-056). */
function shownLabel(label: string, variable: string | null, names: VariableNames): string {
	const name = variable ? names.get(variable)?.label : undefined;
	if (!name) return label;
	if (label === '?') return name;
	return label.startsWith('? ') ? `${name}${label.slice(1)}` : label;
}

function nodeVariable(node: QueryNode): string | null {
	return node.kind === 'variable' || node.kind === 'valueVariable' ? node.name : null;
}

export function viewElements(
	graph: QueryGraph,
	state: ViewState = {},
	names: VariableNames = variableNames(graph)
): ViewElement[] {
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
					label: shownLabel(element.label, element.predicate, names),
					kind: relationLabelKind(edgeData(element))
				},
				classes: classes.filter(Boolean).join(' ')
			};
		}
		const label = shownLabel(nodeViewLabel(element), nodeVariable(element), names);
		if (label.length > LONG_LABEL) classes.push('label-below');
		return {
			group: 'nodes',
			data: { id: element.id, label, kind: nodeViewKind(element) },
			classes: classes.filter(Boolean).join(' '),
			...(element.position ? { position: { ...element.position } } : {})
		};
	});
}

/** An id set for `ViewState` (kept out of rune modules, whose lint wants reactive sets). */
export function idSet(ids: Iterable<string>): ReadonlySet<string> {
	return new Set(ids);
}

type Point = { x: number; y: number };

/**
 * Spots for `count` new nodes near `centre` without Auto Layout (BUG-009):
 * the centre, then rings of `gap` around it, skipping any spot closer than
 * `gap` to an occupied position or to a spot already handed out.
 */
export function freeSpots(
	centre: Point,
	occupied: readonly Point[],
	count: number,
	gap = 90
): Point[] {
	const taken = [...occupied];
	const spots: Point[] = [];
	const isFree = (point: Point) =>
		taken.every((other) => Math.hypot(other.x - point.x, other.y - point.y) >= gap);
	for (let ring = 0; spots.length < count; ring += 1) {
		const steps = ring === 0 ? 1 : ring * 8;
		for (let step = 0; step < steps && spots.length < count; step += 1) {
			const angle = (2 * Math.PI * step) / steps;
			const point = {
				x: centre.x + ring * gap * Math.cos(angle),
				y: centre.y + ring * gap * Math.sin(angle)
			};
			if (isFree(point)) {
				spots.push(point);
				taken.push(point);
			}
		}
	}
	return spots;
}

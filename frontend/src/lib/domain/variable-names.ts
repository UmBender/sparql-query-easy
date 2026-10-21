/**
 * Readable variable names (FE-056): what the canvas, the stage order, the
 * exploration panel and the funnel show instead of a generated SPARQL name
 * such as `?node_1760012341877`. The SPARQL variable keeps its name; the
 * first rule that applies gives the label:
 *
 * 1. A name the user or a loaded query gave (`?pokemon`) without its `?`.
 * 2. The label of the class the variable has (`?x type Pokémon`).
 * 3. The relation that leads to it (`Pokémon speed ?x` → Speed).
 * 4. Item A, B, … for nodes and Relation A, B, … for predicates, by age.
 *
 * A label already taken gets a number (Speed, Speed 2).
 */
import {
	edgesOf,
	nodeById,
	nodesOf,
	type QueryEdge,
	type QueryGraph,
	type QueryNode
} from './graph.js';

export type VariableName = { label: string; description: string };
export type VariableNames = ReadonlyMap<string, VariableName>;

const VARIABLE = /^[?$][A-Za-z_][A-Za-z0-9_]*$/;
const GENERATED = /^\?(?:node|value|default|empty|predicate)_(\d+)$/;
const RDF_TYPE = new Set(['<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>', 'rdf:type', 'a']);
/** At most this many relations describe a variable. */
const DESCRIBED_RELATIONS = 2;

type Entry = { name: string; nodes: QueryNode[]; edges: QueryEdge[] };

export function isVariableName(value: unknown): value is string {
	return typeof value === 'string' && VARIABLE.test(value);
}

/** The name without its `?` or `$`: the label of a name nobody generated. */
export function plainVariableName(name: string): string {
	return name.replace(/^[?$]/, '');
}

/** The label a variable is shown with; unknown names lose only their `?`. */
export function variableLabel(names: VariableNames, name: string): string {
	return names.get(name)?.label ?? plainVariableName(name);
}

/** A node's text as the canvas shows it (legacy: the part after a `)`). */
function nodeText(node: QueryNode): string {
	const label = node.label ?? '';
	return label.includes(')') ? label.split(')')[1].trimStart() : label;
}

function capitalize(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "has type" → Type, "speed" → Speed. */
function relationNoun(label: string): string {
	return capitalize(label.trim().replace(/^(?:has|is)\s+/i, ''));
}

function fixedPredicate(edge: QueryEdge): boolean {
	return (
		edge.predicate !== null &&
		!/^[?$]/.test(edge.predicate) &&
		!['', '?'].includes(edge.label.trim())
	);
}

function nodeVariable(node: QueryNode): string | null {
	return node.kind === 'variable' || node.kind === 'valueVariable' ? node.name : null;
}

function entries(graph: QueryGraph): Entry[] {
	const byName = new Map<string, Entry>();
	const entry = (name: string) => {
		let found = byName.get(name);
		if (!found) byName.set(name, (found = { name, nodes: [], edges: [] }));
		return found;
	};
	for (const node of nodesOf(graph)) {
		const name = nodeVariable(node);
		if (isVariableName(name)) entry(name).nodes.push(node);
	}
	for (const edge of edgesOf(graph))
		if (isVariableName(edge.predicate)) entry(edge.predicate).edges.push(edge);
	return [...byName.values()];
}

/** Rules 2 and 3 for a node variable, or null. */
function derivedLabel(graph: QueryGraph, entry: Entry): string | null {
	const ids = new Set(entry.nodes.map((node) => node.id));
	const edges = edgesOf(graph);
	for (const edge of edges) {
		if (!ids.has(edge.source)) continue;
		const target = nodeById(graph, edge.target);
		if (target && (target.kind === 'class' || RDF_TYPE.has(edge.predicate ?? '')))
			if (nodeText(target).trim()) return nodeText(target).trim();
	}
	for (const edge of edges)
		if (ids.has(edge.target) && fixedPredicate(edge)) return relationNoun(edge.label);
	return null;
}

/** Age of a generated name (its number), so Item A is the oldest. */
function age(name: string): number {
	return Number(GENERATED.exec(name)?.[1] ?? Number.MAX_SAFE_INTEGER);
}

function letter(index: number): string {
	let text = '';
	for (let rest = index + 1; rest > 0; rest = Math.floor((rest - 1) / 26))
		text = String.fromCharCode(65 + ((rest - 1) % 26)) + text;
	return text;
}

function describe(graph: QueryGraph, entry: Entry, labelOf: (node: QueryNode) => string): string {
	const ids = new Set(entry.nodes.map((node) => node.id));
	const parts: string[] = [];
	for (const edge of edgesOf(graph)) {
		const source = nodeById(graph, edge.source);
		const target = nodeById(graph, edge.target);
		if (!source || !target) continue;
		if (entry.edges.includes(edge))
			parts.push(`between ${labelOf(source)} and ${labelOf(target)}`);
		else if (!fixedPredicate(edge)) continue;
		else if (ids.has(edge.source) && !ids.has(edge.target))
			parts.push(`${edge.label} ${labelOf(target)}`);
		else if (ids.has(edge.target) && !ids.has(edge.source))
			parts.push(`${edge.label} of ${labelOf(source)}`);
	}
	return parts.slice(0, DESCRIBED_RELATIONS).join(', ');
}

export function variableNames(graph: QueryGraph): VariableNames {
	const all = entries(graph);
	const labels = new Map<string, string>();
	const taken = new Set<string>();
	const claim = (name: string, base: string) => {
		let label = base;
		for (let count = 2; taken.has(label.toLowerCase()); count++) label = `${base} ${count}`;
		taken.add(label.toLowerCase());
		labels.set(name, label);
	};

	const byAge = (left: Entry, right: Entry) => age(left.name) - age(right.name);
	const generated = all.filter((entry) => GENERATED.test(entry.name)).sort(byAge);
	for (const entry of all)
		if (!GENERATED.test(entry.name)) claim(entry.name, plainVariableName(entry.name));
	const fallback: Entry[] = [];
	for (const entry of generated) {
		const derived = entry.nodes.length ? derivedLabel(graph, entry) : null;
		if (derived) claim(entry.name, derived);
		else fallback.push(entry);
	}
	const items = fallback.filter((entry) => entry.nodes.length);
	const relations = fallback.filter((entry) => !entry.nodes.length);
	items.forEach((entry, index) => claim(entry.name, `Item ${letter(index)}`));
	relations.forEach((entry, index) => claim(entry.name, `Relation ${letter(index)}`));

	const labelOf = (node: QueryNode) => {
		const name = nodeVariable(node);
		return name && labels.has(name) ? labels.get(name)! : nodeText(node);
	};
	return new Map(
		all.map((entry) => [
			entry.name,
			{ label: labels.get(entry.name)!, description: describe(graph, entry, labelOf) }
		])
	);
}

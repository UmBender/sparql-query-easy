/**
 * The drawn query as a typed, immutable graph (FE-042, DEC-011 condition 1).
 *
 * Nodes have a kind union and, for values, a typed RDF term; relations carry
 * their predicate. Every operation returns a new graph and never imports
 * Svelte, Cytoscape or a transport (checked by `domain-boundary.spec.ts`).
 *
 * Element order follows Cytoscape's, because the legacy page derives request
 * order, the View SPARQL variable and funnel step order from it: `elements`
 * is Cytoscape's element pool (appended on add, swap-removed on remove) and
 * `incident` each node's edge list (appended on add or move, order-preserving
 * removal). `order.spec.ts` checks this against headless Cytoscape.
 */

export type Position = { x: number; y: number };

/** An RDF term with its datatype and language (lost on the legacy wire). */
export type RdfTerm = {
	type: 'iri' | 'literal' | 'bnode';
	value: string;
	datatype?: string | null;
	language?: string | null;
};

/** Filter codes of the API (`where[].filterType`, `variableFilters[].filterType`). */
export const FilterCode = {
	startsWith: 0,
	contains: 1,
	atLeast: 2,
	atMost: 3,
	max: 4,
	min: 5,
	between: 6
} as const;
export type FilterCode = (typeof FilterCode)[keyof typeof FilterCode];
export type FilterName = keyof typeof FilterCode;

/** A value variable's filter: a code with its text, or an exact value (code null). */
export type ValueFilter = { code: FilterCode | null; value: string };

type NodeBase = { id: string; label: string; position?: Position };

/** A fixed IRI node; `value` is the IRI as the API takes it (`<…>`). */
export type EntityNode = NodeBase & { kind: 'entity'; value: string; link?: string };
/** A class node (legacy `default`); `value` is the class IRI. */
export type ClassNode = NodeBase & { kind: 'class'; value: string };
/** A variable; `many` marks an "N results" placeholder (legacy gray). */
export type VariableNode = NodeBase & { kind: 'variable'; name: string; many?: boolean };
/**
 * A literal value. `filter` compares the term's lexical form (null: exact);
 * `legacyFilter` is the older `label-filter` format.
 */
export type ValueNode = NodeBase & {
	kind: 'value';
	term: RdfTerm;
	filter: FilterCode | null;
	link?: string;
	legacyFilter?: boolean;
};
/** A variable restricted to literal values (FE-034); null filter keeps any value. */
export type ValueVariableNode = NodeBase & {
	kind: 'valueVariable';
	name: string;
	filter: ValueFilter | null;
};

export type QueryNode = EntityNode | ClassNode | VariableNode | ValueNode | ValueVariableNode;
export type NodeKind = QueryNode['kind'];

/**
 * A relation. `predicate` is an IRI (`<…>`), a prefixed name, a predicate
 * variable (`?p`) or null (sent as a fresh `?empty_…` variable).
 * `variableMark` is the legacy green "variable relation" flag.
 */
export type QueryEdge = {
	kind: 'relation';
	id: string;
	source: string;
	target: string;
	predicate: string | null;
	label: string;
	variableMark?: boolean;
};

export type GraphElement = QueryNode | QueryEdge;

export type QueryGraph = {
	readonly elements: readonly GraphElement[];
	readonly incident: Readonly<Record<string, readonly string[]>>;
};

export const emptyGraph: QueryGraph = { elements: [], incident: {} };

export function isEdge(element: GraphElement): element is QueryEdge {
	return element.kind === 'relation';
}

export function isNode(element: GraphElement): element is QueryNode {
	return element.kind !== 'relation';
}

export function nodesOf(graph: QueryGraph): QueryNode[] {
	return graph.elements.filter(isNode);
}

export function edgesOf(graph: QueryGraph): QueryEdge[] {
	return graph.elements.filter(isEdge);
}

export function elementById(graph: QueryGraph, id: string): GraphElement | undefined {
	return graph.elements.find((element) => element.id === id);
}

export function nodeById(graph: QueryGraph, id: string): QueryNode | undefined {
	const element = elementById(graph, id);
	return element && isNode(element) ? element : undefined;
}

export function edgeById(graph: QueryGraph, id: string): QueryEdge | undefined {
	const element = elementById(graph, id);
	return element && isEdge(element) ? element : undefined;
}

/** A node's edges in Cytoscape's `connectedEdges()` order. */
export function connectedEdges(graph: QueryGraph, nodeId: string): QueryEdge[] {
	return (graph.incident[nodeId] ?? [])
		.map((id) => edgeById(graph, id))
		.filter((edge): edge is QueryEdge => !!edge);
}

/** Variable name of a variable or value-variable node. */
export function variableName(node: QueryNode): string | null {
	return node.kind === 'variable' || node.kind === 'valueVariable' ? node.name : null;
}

/** First `${base}` or `${base}_<n>` no element uses (BUG-003 edge ids). */
export function freeId(graph: QueryGraph, base: string): string {
	let id = base;
	for (let suffix = 1; elementById(graph, id); suffix++) id = `${base}_${suffix}`;
	return id;
}

/** Cytoscape's generated id for an edge added without one. */
function generatedId(graph: QueryGraph): string {
	let id: string;
	do {
		id = crypto.randomUUID();
	} while (elementById(graph, id));
	return id;
}

function withIncident(
	incident: Readonly<Record<string, readonly string[]>>,
	nodeId: string,
	update: (ids: readonly string[]) => readonly string[]
): Record<string, readonly string[]> {
	return { ...incident, [nodeId]: update(incident[nodeId] ?? []) };
}

function attach(incident: QueryGraph['incident'], edge: QueryEdge): QueryGraph['incident'] {
	let next = withIncident(incident, edge.source, (ids) => [...ids, edge.id]);
	if (edge.target !== edge.source)
		next = withIncident(next, edge.target, (ids) => [...ids, edge.id]);
	return next;
}

function detach(incident: QueryGraph['incident'], edge: QueryEdge): QueryGraph['incident'] {
	let next = withIncident(incident, edge.source, (ids) => ids.filter((id) => id !== edge.id));
	if (edge.target !== edge.source)
		next = withIncident(next, edge.target, (ids) => ids.filter((id) => id !== edge.id));
	return next;
}

export type NewEdge = Omit<QueryEdge, 'kind' | 'id'> & { id?: string };

/**
 * Adds elements in order, like `cy.add([...])`. A node whose id exists is an
 * error; an edge without an id gets a fresh one; an edge whose ends are
 * missing is skipped (Cytoscape does not create it).
 */
export function addElements(graph: QueryGraph, items: (QueryNode | NewEdge)[]): QueryGraph {
	let elements = [...graph.elements];
	let incident = graph.incident;
	let current: QueryGraph = graph;
	for (const item of items) {
		if (!('source' in item)) {
			if (elementById(current, item.id)) throw new Error(`Duplicate element id ${item.id}`);
			elements.push(item);
			incident = { ...incident, [item.id]: incident[item.id] ?? [] };
		} else {
			const ids = new Set(elements.filter(isNode).map((node) => node.id));
			if (!ids.has(item.source) || !ids.has(item.target)) continue;
			const id = item.id ?? generatedId(current);
			if (elementById(current, id)) throw new Error(`Duplicate element id ${id}`);
			const edge: QueryEdge = { ...item, kind: 'relation', id };
			elements.push(edge);
			incident = attach(incident, edge);
		}
		current = { elements, incident };
	}
	elements = [...elements];
	return { elements, incident };
}

/**
 * Removes elements like `collection.remove()`: a node takes its edges along;
 * edges leave the pool first (in reverse discovery order), then nodes, each by
 * swapping the pool's last element into its place.
 */
export function removeElements(graph: QueryGraph, ids: string[]): QueryGraph {
	const toRemove: GraphElement[] = [];
	const seen = new Set<string>();
	const add = (element: GraphElement | undefined) => {
		if (!element || seen.has(element.id)) return;
		seen.add(element.id);
		if (isNode(element)) {
			toRemove.push(element);
			connectedEdges(graph, element.id).forEach(add);
		} else {
			toRemove.unshift(element);
		}
	};
	ids.forEach((id) => add(elementById(graph, id)));
	const elements = [...graph.elements];
	let incident = graph.incident;
	for (const element of toRemove) {
		const index = elements.findIndex((item) => item.id === element.id);
		const last = elements.pop()!;
		if (index < elements.length) elements[index] = last;
		if (isEdge(element)) incident = detach(incident, element);
	}
	for (const element of toRemove) {
		if (isNode(element)) {
			const rest = { ...incident };
			delete rest[element.id];
			incident = rest;
		}
	}
	return { elements, incident };
}

/** Replaces an element's fields in place (`ele.data(...)`); order is unchanged. */
export function updateElement<T extends GraphElement>(
	graph: QueryGraph,
	id: string,
	update: (element: T) => T
): QueryGraph {
	return {
		...graph,
		elements: graph.elements.map((element) =>
			element.id === id ? update(element as T) : element
		)
	};
}

/**
 * Moves an edge to new ends (`edge.move`): its pool position stays, it goes to
 * the end of its new ends' edge lists.
 */
export function moveEdge(
	graph: QueryGraph,
	id: string,
	ends: { source?: string; target?: string }
): QueryGraph {
	const edge = edgeById(graph, id);
	if (!edge) return graph;
	const moved: QueryEdge = {
		...edge,
		source: ends.source ?? edge.source,
		target: ends.target ?? edge.target
	};
	return {
		elements: graph.elements.map((element) => (element.id === id ? moved : element)),
		incident: attach(detach(graph.incident, edge), moved)
	};
}

/**
 * Connected components like `cy.elements().components()`: breadth-first from
 * the first unvisited node (the unvisited list swap-removes like a Cytoscape
 * collection), then each node's edges in node order.
 */
export function components(graph: QueryGraph): GraphElement[][] {
	const unvisited = nodesOf(graph);
	const visited = new Set<string>();
	const result: GraphElement[][] = [];
	const unmerge = (id: string) => {
		const index = unvisited.findIndex((node) => node.id === id);
		if (index < 0) return;
		const last = unvisited.pop()!;
		if (index < unvisited.length) unvisited[index] = last;
	};
	while (unvisited.length) {
		const component: GraphElement[] = [];
		const inComponent = new Set<string>();
		const visit = (node: QueryNode) => {
			visited.add(node.id);
			unmerge(node.id);
			if (!inComponent.has(node.id)) {
				inComponent.add(node.id);
				component.push(node);
			}
		};
		const root = unvisited[0];
		visit(root);
		const queue: QueryNode[] = [root];
		const seen = new Set([root.id]);
		while (queue.length) {
			const node = queue.shift()!;
			visit(node);
			for (const edge of connectedEdges(graph, node.id)) {
				const otherId = edge.source === node.id ? edge.target : edge.source;
				if (otherId === node.id || seen.has(otherId)) continue;
				const other = nodeById(graph, otherId);
				if (!other) continue;
				seen.add(otherId);
				queue.push(other);
			}
		}
		const nodes = component.slice();
		for (const node of nodes) {
			for (const edge of connectedEdges(graph, node.id)) {
				if (
					!inComponent.has(edge.id) &&
					inComponent.has(edge.source) &&
					inComponent.has(edge.target)
				) {
					inComponent.add(edge.id);
					component.push(edge);
				}
			}
		}
		result.push(component);
	}
	return result;
}

/** The component that contains the element. */
export function componentOf(graph: QueryGraph, id: string): GraphElement[] {
	return components(graph).find((items) => items.some((item) => item.id === id)) ?? [];
}

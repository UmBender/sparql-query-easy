/**
 * Edit operations on the query graph (FE-042). Each one reproduces the graph
 * effect of a legacy handler (named in its comment) so the same gestures give
 * the same graph and the same requests. Ids that the legacy page derived from
 * `Date.now()` take a `now` argument.
 */
import {
	addElements,
	connectedEdges,
	edgeById,
	edgesOf,
	elementById,
	freeId,
	isEdge,
	moveEdge,
	nodeById,
	removeElements,
	updateElement,
	type FilterCode,
	type GraphElement,
	type NewEdge,
	type Position,
	type QueryEdge,
	type QueryGraph,
	type QueryNode,
	type RdfTerm,
	type ValueFilter,
	type VariableNode
} from './graph.js';
import { nodeData, nodeForTerm, nodeFromData, valueVariableNodeLabel } from './elements.js';
import {
	convertedVariableData,
	isVariableName,
	nodeDataForRelationValue,
	nodeDataForResult
} from './legacy/graph-model.js';
import { nextPredicateVariableName } from './legacy/graph-actions.js';
import { filterLabel, filterTypeOf, parseBetween } from './legacy/query-calculations.js';
import type { QueryVariableEntry } from './legacy/query-stages.js';

export type OperationResult =
	{ graph: QueryGraph; error?: never } | { graph?: never; error: string };

/** New Query. */
export function clearGraph(): QueryGraph {
	return { elements: [], incident: {} };
}

/** Add Variable (`addNewVariable`): a `?node_<now>` variable. */
export function addVariable(
	graph: QueryGraph,
	now: number,
	position?: Position
): { graph: QueryGraph; id: string } {
	const id = `?node_${now}`;
	const node: VariableNode = {
		kind: 'variable',
		id,
		name: id,
		label: '?',
		...(position ? { position } : {})
	};
	return { graph: addElements(graph, [node]), id };
}

/** Add Value Variable (`addNewValueVariable`, FE-037): `?value_<now>` with any value. */
export function addValueVariable(
	graph: QueryGraph,
	now: number,
	position?: Position
): { graph: QueryGraph; id: string } {
	const id = `?value_${now}`;
	return {
		graph: addElements(graph, [
			{
				kind: 'valueVariable',
				id,
				name: id,
				label: '?',
				filter: null,
				...(position ? { position } : {})
			}
		]),
		id
	};
}

/**
 * A search result as an IRI node (`addNode`). Without `position` the canvas
 * places it (Auto Layout, or a free spot near the viewport centre; BUG-009).
 */
export function addEntity(
	graph: QueryGraph,
	id: string,
	label: string,
	position?: Position
): QueryGraph {
	return addElements(graph, [
		{ kind: 'entity', id, value: id, label, ...(position ? { position: { ...position } } : {}) }
	]);
}

/**
 * A relationship value with its relation (`addNodeWithRelationship`): an
 * existing value node is reused and the edge takes the first free id
 * (BUG-003). With `subject` the new node is the relation's source.
 */
export function addRelationValue(
	graph: QueryGraph,
	{
		id,
		text,
		valueType,
		sourceNodeId,
		predicateId,
		predicateLabel,
		subject,
		predicateIndex = 0
	}: {
		id: string;
		text: string;
		valueType: string | null;
		sourceNodeId: string;
		predicateId: string;
		predicateLabel: string;
		subject?: string | null;
		predicateIndex?: number;
	}
): QueryGraph {
	const source = subject || sourceNodeId;
	const target = source === sourceNodeId ? id : sourceNodeId;
	let next = graph;
	if (!elementById(next, id)) {
		next = addElements(next, [
			nodeFromData(nodeDataForRelationValue({ id, text, valueType, predicateLabel }))
		]);
	}
	const edgeId = freeId(next, `${predicateId}${predicateIndex}`);
	return addElements(next, [
		{ id: edgeId, source, target, predicate: predicateId, label: predicateLabel }
	]);
}

/** Connect with a variable or defined predicate (`completeConnection`). */
export function connectNodes(
	graph: QueryGraph,
	sourceId: string,
	targetId: string,
	predicateId: string,
	predicateLabel: string
): QueryGraph {
	return addElements(graph, [
		{
			source: sourceId,
			target: targetId,
			predicate: predicateId,
			label: predicateLabel,
			...(isVariableName(predicateId) ? { variableMark: true } : {})
		}
	]);
}

/** Alt+drag onto a node: a variable relation without a predicate. */
export function dragConnect(graph: QueryGraph, sourceId: string, targetId: string): QueryGraph {
	return addElements(graph, [
		{ source: sourceId, target: targetId, predicate: null, label: '?', variableMark: true }
	]);
}

/** Alt+drag into empty space: a new `?node_<now>` variable and `?edge-<n>` relation. */
export function dragToNewVariable(
	graph: QueryGraph,
	sourceId: string,
	position: Position,
	now: number
): { graph: QueryGraph; id: string } {
	const id = `?node_${now}`;
	const next = addElements(graph, [
		{ kind: 'variable', id, name: id, label: '?', position: { ...position } },
		{
			id: `?edge-${edgesOf(graph).length + 1}`,
			label: '?',
			source: sourceId,
			target: id,
			predicate: null,
			variableMark: true
		}
	]);
	return { graph: next, id };
}

/** The next free `?predicate_<n>` (`nextPredicateVariableName` in the menus). */
export function nextPredicateVariable(
	graph: QueryGraph,
	sequence: number
): { name: string; sequence: number } {
	return nextPredicateVariableName(sequence, (candidate) =>
		graph.elements.some((element) => {
			const data =
				element.kind === 'relation'
					? { id: element.id, nodeId: element.predicate }
					: nodeData(element);
			return ['id', 'nodeId', 'value'].some(
				(key) => (data as Record<string, unknown>)[key] === candidate
			);
		})
	);
}

/** Convert relation to variable (FE-003): the predicate becomes `name`. */
export function convertEdgeToVariable(graph: QueryGraph, edgeId: string, name: string): QueryGraph {
	return updateElement<QueryEdge>(graph, edgeId, (edge) => ({
		...edge,
		predicate: name,
		label: '?',
		variableMark: true
	}));
}

/** Remove (node action): the node's relations first, then the node. */
export function removeNode(graph: QueryGraph, nodeId: string): QueryGraph {
	const edges = edgesOf(graph).filter((edge) => edge.source === nodeId || edge.target === nodeId);
	return removeElements(
		removeElements(
			graph,
			edges.map((edge) => edge.id)
		),
		[nodeId]
	);
}

/** Remove relation: only this edge. */
export function removeEdge(graph: QueryGraph, edgeId: string): QueryGraph {
	return removeElements(graph, [edgeId]);
}

/**
 * `rewireEdges`: every edge touching `oldId` is removed and added again on
 * `newId` with the same data. A self-loop keeps its target on `oldId` (the
 * second re-add hits the id already re-added), as in the legacy page.
 */
export function rewireEdges(graph: QueryGraph, oldId: string, newId: string): QueryGraph {
	let next = graph;
	for (const edge of edgesOf(graph)) {
		if (edge.source === oldId) {
			next = removeElements(next, [edge.id]);
			next = addElements(next, [{ ...edge, source: newId }]);
		}
		if (edge.target === oldId && !(edge.source === oldId)) {
			next = removeElements(next, [edge.id]);
			next = addElements(next, [{ ...edge, target: newId }]);
		}
	}
	return next;
}

/** Replaces a node by `replacement` at the same place: add, rewire, remove (legacy edit pattern). */
function replaceNode(graph: QueryGraph, oldId: string, replacement: QueryNode): QueryGraph {
	const old = nodeById(graph, oldId);
	const placed = {
		...replacement,
		...(old?.position ? { position: { ...old.position } } : {})
	} as QueryNode;
	return removeElements(rewireEdges(addElements(graph, [placed]), oldId, placed.id), [oldId]);
}

/** Convert to variable (`convertMenuNodeToVariable`): a literal becomes a value variable (FE-034). */
export function convertToVariable(
	graph: QueryGraph,
	nodeId: string,
	now: number
): { graph: QueryGraph; id: string } | null {
	const node = nodeById(graph, nodeId);
	if (!node) return null;
	const id = `?node_${now}`;
	const data = convertedVariableData(nodeData(node) as Record<string, unknown>, id);
	return { graph: replaceNode(graph, nodeId, nodeFromData(data as never)), id };
}

/** A variable node feeds this node (value edits are offered only then). */
export function hasVariableSource(graph: QueryGraph, nodeId: string): boolean {
	return edgesOf(graph).some((edge) => {
		if (edge.target !== nodeId) return false;
		const source = nodeById(graph, edge.source);
		return source?.kind === 'variable' || source?.kind === 'valueVariable';
	});
}

/** Toggle Boolean value (`changeElementBooleanValue`). */
export function toggleBoolean(
	graph: QueryGraph,
	nodeId: string,
	now: number
): { graph: QueryGraph; id: string } | null {
	const node = nodeById(graph, nodeId);
	if (
		!node ||
		(node.label !== 'true' && node.label !== 'false') ||
		!hasVariableSource(graph, nodeId)
	)
		return null;
	const value = node.label === 'true' ? 'false' : 'true';
	const id = `node_${now}`;
	const replacement = nodeFromData({ ...nodeData(node), id, label: value, value } as never);
	return { graph: replaceNode(graph, nodeId, replacement), id };
}

export const BETWEEN_ERROR =
	'Between needs two numbers as min..max, with min not above max (e.g. 40..80).';
export const NUMBER_ERROR = 'At least and At most need a number.';

/**
 * Apply in the filter editor for a value node (`changeElementStringValue`):
 * a new `node_<now>` node with the value and filter replaces it.
 */
export function setValueNodeFilter(
	graph: QueryGraph,
	nodeId: string,
	value: string,
	filterType: number | string | null,
	now: number
): OperationResult & { id?: string } {
	const node = nodeById(graph, nodeId);
	if (!node) return { error: 'The node no longer exists.' };
	if (node.kind === 'valueVariable')
		return setValueVariableFilter(graph, nodeId, value, filterType);
	const code = filterTypeOf(filterType);
	if (code === 6 && !parseBetween(value)) return { error: BETWEEN_ERROR };
	const id = `node_${now}`;
	const data = {
		...nodeData(node),
		id,
		label: filterLabel(code, value),
		value,
		filterType: code
	};
	return { graph: replaceNode(graph, nodeId, nodeFromData(data as never)), id };
}

/**
 * Apply for a value variable (`changeValueVariableFilter`): the filter changes
 * in place; 'any' or an empty value keeps any value.
 */
export function setValueVariableFilter(
	graph: QueryGraph,
	nodeId: string,
	value: string,
	filterType: number | string | null
): OperationResult {
	const any = filterType === 'any' || String(value ?? '').trim() === '';
	const code = any ? null : filterTypeOf(filterType);
	if (code === 6 && !parseBetween(value)) return { error: BETWEEN_ERROR };
	if ((code === 2 || code === 3) && !Number.isFinite(Number(String(value).trim())))
		return { error: NUMBER_ERROR };
	const text = any ? '' : String(value ?? '').trim();
	const filter: ValueFilter | null =
		text === ''
			? null
			: { code: (text === '' ? null : code) as FilterCode | null, value: text };
	return {
		graph: updateElement(graph, nodeId, (node: QueryNode) =>
			node.kind === 'valueVariable'
				? { ...node, filter, label: valueVariableNodeLabel(filter) }
				: node
		)
	};
}

/**
 * Add value filter (`addValueVariableNode`, FE-030/FE-034): a value variable
 * fed by `sourceId` through the chosen relation, up and right of the source.
 */
export function addValueFilterVariable(
	graph: QueryGraph,
	sourceId: string,
	predicateId: string,
	predicateLabel: string,
	now: number
): { graph: QueryGraph; id: string } {
	const id = `?value_${now}`;
	const at = nodeById(graph, sourceId)?.position ?? { x: 0, y: 0 };
	const next = addElements(graph, [
		{
			kind: 'valueVariable',
			id,
			name: id,
			label: '?',
			filter: null,
			position: { x: at.x + 220, y: at.y - 120 }
		},
		{
			id: `${id.slice(1)}_relation`,
			source: sourceId,
			target: id,
			predicate: predicateId,
			label: predicateLabel
		}
	]);
	return { graph: next, id };
}

export type OutgoingRelation = {
	targetId: string;
	predicateId: string;
	predicateLabel: string;
	targetIsIri: boolean;
};

/**
 * Bind a variable node to a value node (`graph-binding.js` bindVariable,
 * FE-033). A node already holding the value is reused (BUG-003); edges keep
 * ids and data and move to the value. With `refetch` (results table) each
 * outgoing target other than the value is removed and returned so the caller
 * fetches it again from the value (BUG-006).
 */
export function bindVariable(
	graph: QueryGraph,
	variableId: string,
	value: QueryNode,
	{ refetch = false }: { refetch?: boolean } = {}
): { graph: QueryGraph; bound: boolean; refetch: OutgoingRelation[] } {
	const variable = nodeById(graph, variableId);
	const valueId = value.id;
	if (!variable || variableId === valueId) return { graph, bound: false, refetch: [] };
	let next = graph;
	if (!elementById(next, valueId)) {
		next = addElements(next, [
			{
				...value,
				...(variable.position ? { position: { ...variable.position } } : {})
			} as QueryNode
		]);
	}
	const outgoing: OutgoingRelation[] = [];
	for (const edge of connectedEdges(graph, variableId)) {
		const ends: { source?: string; target?: string } = {};
		if (edge.source === variableId) ends.source = valueId;
		if (edge.target === variableId) ends.target = valueId;
		next = moveEdge(next, edge.id, ends);
		const moved = edgeById(next, edge.id)!;
		if (ends.source && moved.target !== valueId) {
			outgoing.push({
				targetId: moved.target,
				predicateId: moved.predicate ?? '',
				predicateLabel: moved.label,
				targetIsIri: nodeById(next, moved.target)?.kind === 'entity'
			});
		}
	}
	next = removeElements(next, [variableId]);
	if (refetch) {
		for (const relation of outgoing) next = removeElements(next, [relation.targetId]);
	}
	return { graph: next, bound: true, refetch: refetch ? outgoing : [] };
}

/** Bind predicate-variable edges still using `variableName` to a fixed predicate. */
export function bindPredicateEdges(
	graph: QueryGraph,
	edgeIds: string[],
	variableName: string,
	predicateId: string,
	label: string
): QueryGraph {
	let next = graph;
	for (const id of edgeIds) {
		const edge = elementById(next, id);
		if (!edge || !isEdge(edge) || edge.predicate !== variableName) continue;
		next = updateElement<QueryEdge>(next, id, (current) => {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { variableMark, ...rest } = current;
			return { ...rest, predicate: predicateId, label };
		});
	}
	return next;
}

/** A results-table choice for a variable (`replaceWithNewNode`). */
export function chooseResult(
	graph: QueryGraph,
	variableId: string,
	result: {
		id: string;
		label: string;
		propertyType?: string | null;
		propertyClass?: string | null;
	}
): { graph: QueryGraph; bound: boolean; refetch: OutgoingRelation[] } {
	const value = nodeFromData(nodeDataForResult(result));
	return bindVariable(graph, variableId, value, { refetch: true });
}

export type Choice = { variableName: string; term: RdfTerm; label: string };

/**
 * Apply to graph / Assume (`applyChoicesToGraph`): predicate-variable edges
 * take IRI values in place, variable nodes become the chosen value nodes.
 */
export function applyChoices(
	graph: QueryGraph,
	registry: QueryVariableEntry[],
	choices: Choice[]
): QueryGraph {
	let next = graph;
	for (const { variableName, term, label } of choices) {
		const entry = registry.find((item) => item.name === variableName);
		if (!entry) continue;
		if (term.type === 'iri')
			next = bindPredicateEdges(next, entry.edgeIds, variableName, `<${term.value}>`, label);
		const value = nodeForTerm(term, label);
		for (const id of entry.nodeIds) next = bindVariable(next, id, value).graph;
	}
	return next;
}

/** Moves a node (canvas drag); no order change. */
export function moveNode(graph: QueryGraph, nodeId: string, position: Position): QueryGraph {
	return updateElement(graph, nodeId, (node: QueryNode) => ({
		...node,
		position: { ...position }
	}));
}

/** Positions from a layout run. */
export function setPositions(graph: QueryGraph, positions: Record<string, Position>): QueryGraph {
	return {
		...graph,
		elements: graph.elements.map((element: GraphElement) =>
			element.kind !== 'relation' && positions[element.id]
				? { ...element, position: { ...positions[element.id] } }
				: element
		)
	};
}

export type { NewEdge };

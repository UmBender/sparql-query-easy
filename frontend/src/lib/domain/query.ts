/**
 * Request mapping (FE-042): the bodies the legacy page sends for a graph,
 * built from the typed graph through the ported calculations. Field shapes:
 * tcc/04 - Frontend/Legacy Wire Format.md; parity: request-parity.spec.ts.
 */
import {
	componentOf,
	components,
	edgesOf,
	nodeById,
	nodesOf,
	type GraphElement,
	type QueryGraph,
	type QueryNode
} from './graph.js';
import { elementData, nodeData, type ElementData } from './elements.js';
import {
	hasVariableMark,
	isVariableName,
	nodeFilter,
	variableFilterOf
} from './legacy/graph-model.js';
import {
	actualValueRequest,
	buildFilters,
	filterFunnelPlan,
	filterLabel,
	filterTypeOf,
	funnelStepKey,
	hasParallelPredicateVariables as parallelPredicates,
	numericProfileRequest,
	textSuggestionRequest,
	withVariableFilters,
	type FilterEdge,
	type FunnelPlan,
	type QueryFilter,
	type VariableFilter
} from './legacy/query-calculations.js';
import {
	buildVariableRegistry,
	explorationSignature,
	queryComponentChoice,
	stageRequest,
	type QueryVariableEntry,
	type StageBinding,
	type StageRequest
} from './legacy/query-stages.js';

export type QueryContext = {
	/** Endpoint field: built-in id, uploaded-graph id or URL. */
	endpointUrl: string;
	/** Limit field (legacy default 150). */
	limit: number;
	/** Clock for `?empty_<now>` fallback predicates. */
	now?: () => number;
};

export const SEPARATE_VARIABLE_GROUPS_MESSAGE =
	'Variables are in separate, unconnected parts of the graph. Connect them or remove one part before running.';
export const PARALLEL_PREDICATES_MESSAGE =
	'Parallel predicate variables between the same fixed subject and object do not form a chain. Keep one predicate variable for this pair.';

/** The component with the variables (BUG-004), or the first one. */
export function selectQueryComponent(graph: QueryGraph): {
	component: GraphElement[] | null;
	ambiguous: boolean;
} {
	const all = components(graph);
	const choice = queryComponentChoice(all.map((items) => items.map(elementData)));
	return {
		component: choice.index === null ? null : all[choice.index],
		ambiguous: choice.ambiguous
	};
}

/** The value a node stands for in a request (`data.value || id`). */
function nodeValue(graph: QueryGraph, id: string): string {
	const node = nodeById(graph, id);
	return (node && nodeData(node).value) || id;
}

/** Relation items of a component as the calculations take them (`filterEdgeItems`). */
export function filterEdgeItems(
	graph: QueryGraph,
	items: GraphElement[],
	now: () => number = Date.now
): FilterEdge[] {
	return items
		.filter((item) => item.kind === 'relation')
		.map((edge) => {
			const target = nodeById(graph, edge.target);
			const targetData = target ? nodeData(target) : ({} as ElementData);
			return {
				id: edge.id,
				source: edge.source,
				target: edge.target,
				sourceValue: nodeValue(graph, edge.source),
				targetValue: nodeValue(graph, edge.target),
				nodeId: edge.predicate ?? undefined,
				// FE-034: a value variable's filter is sent as a variable filter instead.
				filterType: target?.kind === 'valueVariable' ? null : targetData.filterType,
				fallbackPredicate: edge.predicate || `?empty_${now()}`
			};
		});
}

/** Value-variable filters of the nodes among `items`, in order (FE-034). */
export function variableFilterItems(items: GraphElement[]): VariableFilter[] {
	return items
		.filter((item): item is QueryNode => item.kind !== 'relation')
		.map((node) => variableFilterOf(nodeData(node)))
		.filter((filter): filter is VariableFilter => filter !== null);
}

/** The last variable met while scanning a component's elements (`extractVariableName`). */
export function extractVariableName(items: GraphElement[]): string {
	let name = '';
	for (const item of items) {
		const data = elementData(item);
		if (hasVariableMark(data.source)) name = data.source!;
		if (hasVariableMark(data.target)) name = data.target!;
		if (hasVariableMark(data.id)) name = data.id;
		if (isVariableName(data.nodeId)) name = data.nodeId!;
	}
	return name;
}

export function whereOf(
	graph: QueryGraph,
	items: GraphElement[],
	now?: () => number
): QueryFilter[] {
	return buildFilters(filterEdgeItems(graph, items, now));
}

export type SparqlRequest = {
	endpointUrl: string;
	where: QueryFilter[];
	variableName: string;
	limit: number;
	variableFilters?: VariableFilter[];
};

/** View SPARQL (`seeSparqlQuery`): the request, or the message the page shows instead. */
export function sparqlRequest(
	graph: QueryGraph,
	context: QueryContext
): { request: SparqlRequest } | { message: string } {
	const { component, ambiguous } = selectQueryComponent(graph);
	if (ambiguous) return { message: SEPARATE_VARIABLE_GROUPS_MESSAGE };
	if (!component || !component.length)
		return { message: 'Add at least one node to preview the query.' };
	return {
		request: withVariableFilters(
			{
				endpointUrl: context.endpointUrl,
				where: whereOf(graph, component, context.now),
				variableName: extractVariableName(component),
				limit: context.limit
			},
			variableFilterItems(component)
		)
	};
}

export type LegacyQueryRequest = SparqlRequest & { ignoreWikidata?: boolean };

/**
 * Run query on a variable node (`getQuery` from the node action): the request
 * and how a chosen row is applied (predicate-variable edges or the node).
 */
export function nodeQueryRequest(
	graph: QueryGraph,
	nodeId: string,
	context: QueryContext
): {
	request: LegacyQueryRequest;
	method: 'replacePredicateVariable' | 'replaceNodeVariable';
	predicateEdgeIds: string[];
} | null {
	const node = nodeById(graph, nodeId);
	if (!node) return null;
	const component = componentOf(graph, nodeId);
	const variableName = nodeData(node).value ?? nodeId;
	const predicateEdgeIds = edgesOf(graph)
		.filter((edge) => edge.predicate === variableName)
		.map((edge) => edge.id);
	return {
		request: withVariableFilters(
			{
				endpointUrl: context.endpointUrl,
				where: whereOf(graph, component, context.now),
				variableName,
				limit: context.limit
			},
			variableFilterItems(component)
		),
		method: predicateEdgeIds.length ? 'replacePredicateVariable' : 'replaceNodeVariable',
		predicateEdgeIds
	};
}

/**
 * Explore values of a class (`explore-default`). The legacy page sends the
 * prefixed `rdfs:domain`, which Ktor rejects (class-explore-values fixture);
 * the new app sends the full IRI (parity checklist G-05).
 */
export function exploreValuesRequest(
	node: QueryNode,
	context: QueryContext,
	now: number
): {
	endpointUrl: string;
	where: { subject: string; predicate: string; object: string }[];
	variableName: string;
	limit: number;
} {
	const variableName = `?default_${now}`;
	return {
		endpointUrl: context.endpointUrl,
		where: [
			{
				subject: variableName,
				predicate: '<http://www.w3.org/2000/01/rdf-schema#domain>',
				object: nodeData(node).value ?? node.id
			}
		],
		variableName,
		limit: context.limit
	};
}

/** Explore relationships (no limit) or the predicate list of Connect / Add value filter (with limit). */
export function relationshipsRequest(
	graph: QueryGraph,
	nodeId: string,
	context: QueryContext,
	{ withLimit }: { withLimit: boolean }
): { endpointUrl: string; id: string; limit?: number } {
	const node = nodeById(graph, nodeId);
	const id = (node && nodeData(node).value) || nodeId;
	return withLimit
		? { endpointUrl: context.endpointUrl, id, limit: context.limit }
		: { endpointUrl: context.endpointUrl, id };
}

export type SearchProbeRequest = {
	endpointUrl: string;
	where: { subject: string; predicate: string; object: string }[];
	variableName: string;
	limit: number;
	ignoreWikidata: boolean;
};

/**
 * Connection probes for a chosen search result (`verifyAlreadyExistsNodeAndAdd`):
 * two per existing node, new→existing and existing→new. The legacy page also
 * probed edge ids; only nodes are probed here (parity checklist P-03).
 */
export function searchProbeRequests(
	graph: QueryGraph,
	newNodeId: string,
	context: QueryContext
): { existingId: string; invert: boolean; request: SearchProbeRequest }[] {
	return components(graph)
		.flat()
		.filter((item): item is QueryNode => item.kind !== 'relation' && !hasVariableMark(item.id))
		.flatMap((node) =>
			[false, true].map((invert) => ({
				existingId: node.id,
				invert,
				request: {
					endpointUrl: context.endpointUrl,
					where: [
						{
							subject: invert ? node.id : newNodeId,
							predicate: '?predicate',
							object: invert ? newNodeId : node.id
						}
					],
					variableName: '?predicate',
					limit: 1,
					ignoreWikidata: false
				}
			}))
		);
}

/** Histogram / seed profile of the relation into a node (BE-003); null when unprofilable. */
export function numericProfileRequestFor(
	graph: QueryGraph,
	nodeId: string,
	context: QueryContext,
	limit?: number
) {
	if (!nodeById(graph, nodeId)) return null;
	const component = componentOf(graph, nodeId);
	return numericProfileRequest({
		endpointUrl: context.endpointUrl,
		edges: filterEdgeItems(graph, component, context.now),
		literalId: nodeId,
		limit,
		variableFilters: variableFilterItems(component)
	});
}

/** Text suggestions for the filter editor (FE-038); null without text or relation. */
export function textSuggestionRequestFor(
	graph: QueryGraph,
	nodeId: string,
	text: string,
	startsWith: boolean,
	context: QueryContext
) {
	if (!nodeById(graph, nodeId)) return null;
	const component = componentOf(graph, nodeId);
	return textSuggestionRequest({
		endpointUrl: context.endpointUrl,
		edges: filterEdgeItems(graph, component, context.now),
		nodeId,
		text,
		startsWith,
		variableFilters: variableFilterItems(component)
	});
}

/** Actual values of a filtered node whose subject is a fixed entity (FE-036). */
export function actualValueRequestFor(graph: QueryGraph, nodeId: string, context: QueryContext) {
	return actualValueRequest({
		endpointUrl: context.endpointUrl,
		edges: filterEdgeItems(graph, componentOf(graph, nodeId), context.now),
		literalId: nodeId
	});
}

export function hasParallelPredicateVariables(graph: QueryGraph, items: GraphElement[]): boolean {
	return parallelPredicates(
		items
			.filter((item) => item.kind === 'relation')
			.map((edge) => ({
				nodeId: edge.predicate ?? undefined,
				source: edge.source,
				target: edge.target,
				sourceValue: nodeValue(graph, edge.source),
				targetValue: nodeValue(graph, edge.target)
			}))
	);
}

// ── Variable order (DEC-008, FE-008) ──────────────────────────────

export type VariableOrderState = {
	signature: string | null;
	order: string[];
	registry: QueryVariableEntry[];
};
export const initialVariableOrder: VariableOrderState = {
	signature: null,
	order: [],
	registry: []
};

/**
 * `refreshVariableOrder`: the registry of the query component; the order
 * resets to sorted names only when the query signature changes.
 */
export function refreshVariableOrder(
	state: VariableOrderState,
	graph: QueryGraph,
	endpointUrl: string
): { state: VariableOrderState; changed: boolean } {
	const { component } = selectQueryComponent(graph);
	const items = component ? component.map(elementData) : [];
	const registry = buildVariableRegistry(items);
	const signature = explorationSignature(endpointUrl, items);
	const changed = signature !== state.signature;
	return {
		state: {
			signature,
			registry,
			order: changed ? registry.map((entry) => entry.name) : state.order
		},
		changed
	};
}

export type RunDecision =
	| { kind: 'error'; message: string }
	| { kind: 'staged'; order: string[]; where: QueryFilter[]; variableFilters: VariableFilter[] }
	| { kind: 'legacy'; request: LegacyQueryRequest };

/** What Run Query does for the graph and the current stage order (`runQuery`). */
export function runQueryDecision(
	graph: QueryGraph,
	order: string[],
	context: QueryContext
): RunDecision {
	const { component, ambiguous } = selectQueryComponent(graph);
	if (ambiguous) return { kind: 'error', message: SEPARATE_VARIABLE_GROUPS_MESSAGE };
	if (!component || !component.length)
		return { kind: 'error', message: 'Add at least one node before running the query.' };
	if (hasParallelPredicateVariables(graph, component))
		return { kind: 'error', message: PARALLEL_PREDICATES_MESSAGE };
	if (order.length >= 1) {
		return {
			kind: 'staged',
			order: order.slice(),
			where: whereOf(graph, component, context.now),
			variableFilters: variableFilterItems(component)
		};
	}
	const variableName = extractVariableName(component);
	if (!variableName)
		return { kind: 'error', message: 'Add at least one variable (?) node before running.' };
	return {
		kind: 'legacy',
		request: withVariableFilters(
			{
				endpointUrl: context.endpointUrl,
				where: whereOf(graph, component, context.now),
				variableName,
				limit: context.limit
			},
			variableFilterItems(component)
		)
	};
}

/** The stage request for one stage of an exploration. */
export function stageRequestFor(
	exploration: { order: string[]; where: QueryFilter[]; variableFilters: VariableFilter[] },
	stage: number,
	bindings: StageBinding[],
	offset: number,
	context: QueryContext
): StageRequest {
	return stageRequest({
		endpointUrl: context.endpointUrl,
		where: exploration.where,
		variableFilters: exploration.variableFilters,
		variableName: exploration.order[stage],
		bindings,
		limit: context.limit,
		offset
	});
}

// ── Filter funnel (FE-028, FE-039) ────────────────────────────────

export type FunnelInput =
	| { message: string; plan?: never }
	| {
			plan: FunnelPlan;
			variables: string[];
			edges: FilterEdge[];
			labels: string[];
			message?: never;
	  };

/** Variable counted by default: the first entity variable, not a value variable (FE-039). */
export function defaultFunnelVariable(graph: QueryGraph, variables: string[]): string {
	const isValueVariable = (name: string) =>
		nodesOf(graph).some((node) => node.kind === 'valueVariable' && node.name === name);
	return variables.find((name) => !isValueVariable(name)) ?? variables[0];
}

/** Row label of a funnel step (`funnelStepLabel`). */
export function funnelStepLabel(graph: QueryGraph, key: string, edges: FilterEdge[]): string {
	const edge = edges.find((item) => funnelStepKey(item) === key)!;
	const relationEdge = edge.id ? edgesOf(graph).find((item) => item.id === edge.id) : undefined;
	const relation = relationEdge?.label || edge.nodeId || '';
	const target = nodeById(graph, edge.target);
	const data = target ? nodeData(target) : ({} as ElementData);
	if (target?.kind === 'valueVariable') {
		const filter = nodeFilter(data)!;
		return filter.filterType === null
			? `${relation} = ${filter.value}`
			: `${relation} ${filterLabel(filter.filterType, filter.value)}`;
	}
	const value = data.label || edge.targetValue;
	const exact = filterTypeOf(data.filterType) === null;
	return `${relation} ${exact ? '= ' : ''}${value}`;
}

/**
 * The funnel plan for the graph (`currentFunnelPlan`/`funnelInput`), or why it
 * cannot count. Badges pass `disabled = []` (the query as it runs).
 */
export function funnelInput(
	graph: QueryGraph,
	{
		order,
		variable,
		disabled = []
	}: { order: string[]; variable: string | null; disabled?: Iterable<string> },
	context: QueryContext
): FunnelInput {
	const { component, ambiguous } = selectQueryComponent(graph);
	if (ambiguous) return { message: SEPARATE_VARIABLE_GROUPS_MESSAGE };
	if (!component || !component.some((item) => item.kind === 'relation')) {
		return {
			message: 'Add a relation with a variable to see how its filters narrow the result.'
		};
	}
	const variables = order.slice();
	if (!variables.length) {
		const name = extractVariableName(component);
		if (name) variables.push(name);
	}
	if (!variables.length)
		return { message: 'Add at least one variable (?) node to count results.' };
	const variableName =
		variable !== null && variables.includes(variable)
			? variable
			: defaultFunnelVariable(graph, variables);
	const edges = filterEdgeItems(graph, component, context.now);
	const plan = filterFunnelPlan({
		endpointUrl: context.endpointUrl,
		edges,
		variableName,
		disabled,
		variableFilters: variableFilterItems(component)
	});
	return {
		plan,
		variables,
		edges,
		labels: plan.steps.map((step) => funnelStepLabel(graph, step.key, edges))
	};
}

/** Drops disabled step keys that no longer exist (the funnel keeps the rest). */
export function presentFunnelSteps(plan: FunnelPlan, disabled: Iterable<string>): Set<string> {
	const present = new Set(plan.steps.map((step) => step.key));
	return new Set([...disabled].filter((key) => present.has(key)));
}

/** No funnel step switched off. */
export const NO_DISABLED_STEPS: ReadonlySet<string> = new Set();

/** Funnel step toggle (preview only: the filter stays in the graph and in Run Query). */
export function toggleFunnelStep(
	disabled: ReadonlySet<string>,
	key: string,
	enabled: boolean
): Set<string> {
	const next = new Set(disabled);
	if (enabled) next.delete(key);
	else next.add(key);
	return next;
}

export type BadgeWanted =
	| {
			kind: 'actual';
			request: NonNullable<ReturnType<typeof actualValueRequest>>;
			filterType: number | null;
			value: string;
	  }
	| {
			kind: 'count';
			variableName: string;
			before: FunnelPlan['requests'][number];
			after: FunnelPlan['requests'][number];
	  };

/** What each filtered node's badge shows (`wantedFilterBadges`, FE-036/FE-039). */
export function wantedFilterBadges(
	graph: QueryGraph,
	order: string[],
	variable: string | null,
	context: QueryContext
): Map<string, BadgeWanted> {
	const wanted = new Map<string, BadgeWanted>();
	let funnel: FunnelInput | undefined;
	for (const node of nodesOf(graph)) {
		const filter = nodeFilter(nodeData(node));
		if (filter?.filterType == null) continue;
		const actual = actualValueRequestFor(graph, node.id, context);
		if (actual) {
			wanted.set(node.id, { kind: 'actual', request: actual, ...filter });
			continue;
		}
		funnel ??= funnelInput(graph, { order, variable, disabled: [] }, context);
		if (!funnel.plan) continue;
		const keys = new Set(
			funnel.edges.filter((edge) => edge.target === node.id).map(funnelStepKey)
		);
		const step = funnel.plan.steps.find((item) => keys.has(item.key));
		if (!step?.counted) continue;
		wanted.set(node.id, {
			kind: 'count',
			variableName: funnel.plan.variableName,
			before: funnel.plan.requests[step.index],
			after: funnel.plan.requests[step.index + 1]
		});
	}
	return wanted;
}

/**
 * A relationship row chosen in the results table (`getRelationshipValue`):
 * datatype relations (`propertyType: label`) and `image` are literals.
 */
export function relationshipValueRequest(
	subjectId: string,
	row: { propertyId: string; propertyLabel: string; propertyType?: string | null },
	context: QueryContext
): { endpointUrl: string; subjectId: string; predicateId: string; isLiteral: boolean } {
	return {
		endpointUrl: context.endpointUrl,
		subjectId,
		predicateId: row.propertyId,
		isLiteral: row.propertyType === 'label' || row.propertyLabel === 'image'
	};
}

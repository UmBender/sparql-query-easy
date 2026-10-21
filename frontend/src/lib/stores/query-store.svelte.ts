/**
 * The one store of the drawn query (FE-043, DEC-011): the `QueryGraph`, the
 * selection, the endpoint and limit, the stage order and the funnel preview.
 * Every graph change goes through a domain operation and `commit`; views read
 * the `$derived` values. Cytoscape is only a view of `graph`.
 */
import {
	addEntity,
	addRelationValue,
	addValueFilterVariable,
	addValueVariable,
	addVariable,
	applyChoices,
	chooseResult,
	clearGraph,
	connectNodes,
	convertEdgeToVariable,
	convertToVariable,
	DEFAULT_ENDPOINT,
	DEFAULT_LIMIT,
	dragConnect,
	dragToNewVariable,
	emptyGraph,
	endpointFromText,
	endpointUrl,
	funnelInput,
	initialVariableOrder,
	moveNode,
	nextPredicateVariable,
	NO_DISABLED_STEPS,
	nodeData,
	nodesOf,
	presentFunnelSteps,
	refreshVariableOrder,
	removeEdge,
	removeNode,
	setPositions,
	setValueNodeFilter,
	setValueVariableFilter,
	toggleBoolean,
	toggleFunnelStep,
	validate,
	variableLabel,
	variableNames,
	type Choice,
	type Endpoint,
	type OutgoingRelation,
	type Position,
	type QueryContext,
	type QueryDocument,
	type QueryGraph,
	type QueryNode,
	type VariableNames,
	type VariableOrderState
} from '#lib/domain/index.js';
import { nodeFilter } from '#lib/domain/legacy/graph-model.js';
import { moveItem } from '#lib/domain/legacy/query-stages.js';

export type Selection = { kind: 'node' | 'edge'; id: string } | null;
export type ActiveFilter = {
	nodeId: string;
	filterType: number | null;
	value: string;
	variable: boolean;
};
export type FunnelStepView = {
	key: string;
	index: number;
	label: string;
	enabled: boolean;
	counted: boolean;
	extreme: boolean;
};

export type QueryStoreOptions = {
	now?: () => number;
	endpoint?: Endpoint;
	limit?: number;
	historyLimit?: number;
	/** FE-053: keep [endpoint] whatever the user does (a proposed task's endpoint). */
	endpointLocked?: boolean;
};

/** Undo depth (FE-052): older edits are dropped beyond this many. */
export const HISTORY_LIMIT = 100;

export class QueryStore {
	graph = $state.raw<QueryGraph>(emptyGraph);
	endpoint = $state.raw<Endpoint>(DEFAULT_ENDPOINT);
	limit = $state(DEFAULT_LIMIT);
	selection = $state.raw<Selection>(null);
	orderState = $state.raw<VariableOrderState>(initialVariableOrder);
	/** Bumped when the query signature changes; an open exploration closes on it. */
	signatureVersion = $state(0);
	funnelDisabled = $state.raw<ReadonlySet<string>>(NO_DISABLED_STEPS);
	funnelVariable = $state<string | null>(null);
	autoLayout = $state(true);
	/** FE-052: graphs before each edit (oldest first) and after each undo. */
	past = $state.raw<readonly QueryGraph[]>([]);
	future = $state.raw<readonly QueryGraph[]>([]);
	canUndo = $derived(this.past.length > 0);
	canRedo = $derived(this.future.length > 0);
	readonly #historyLimit: number;
	readonly endpointLocked: boolean;

	readonly #now: () => number;
	#predicateSequence = 1;
	#lastStamp = 0;

	constructor({
		now = Date.now,
		endpoint,
		limit,
		historyLimit = HISTORY_LIMIT,
		endpointLocked = false
	}: QueryStoreOptions = {}) {
		this.#now = now;
		this.#historyLimit = historyLimit;
		this.endpointLocked = endpointLocked;
		if (endpoint) this.endpoint = endpoint;
		if (limit) this.limit = limit;
		this.#refreshOrder();
	}

	context: QueryContext = $derived({
		endpointUrl: endpointUrl(this.endpoint),
		limit: this.limit,
		now: () => this.#stamp()
	});
	order: string[] = $derived(this.orderState.order);
	/** Readable names of the graph's variables (FE-056); SPARQL keeps the real names. */
	variableNames: VariableNames = $derived(variableNames(this.graph));
	validation = $derived(validate(this.graph));
	activeFilters: ActiveFilter[] = $derived(
		nodesOf(this.graph).flatMap((node) => {
			const filter = nodeFilter(nodeData(node));
			return filter
				? [{ nodeId: node.id, ...filter, variable: node.kind === 'valueVariable' }]
				: [];
		})
	);
	funnel = $derived(
		funnelInput(
			this.graph,
			{ order: this.order, variable: this.funnelVariable, disabled: this.funnelDisabled },
			this.context
		)
	);
	funnelSteps: FunnelStepView[] = $derived.by(() => {
		const funnel = this.funnel;
		if (!funnel.plan) return [];
		return funnel.plan.steps.map((step, index) => ({
			...step,
			label: funnel.labels[index],
			enabled: !this.funnelDisabled.has(step.key)
		}));
	});
	selectedNode: QueryNode | undefined = $derived(
		this.selection?.kind === 'node'
			? nodesOf(this.graph).find((node) => node.id === this.selection!.id)
			: undefined
	);

	/** Unique, increasing Date.now()-like stamps for generated ids. */
	#stamp(): number {
		const now = this.#now();
		this.#lastStamp = now > this.#lastStamp ? now : this.#lastStamp + 1;
		return this.#lastStamp;
	}

	#refreshOrder(): boolean {
		const { state, changed } = refreshVariableOrder(
			this.orderState,
			this.graph,
			endpointUrl(this.endpoint)
		);
		this.orderState = state;
		if (changed) this.signatureVersion++;
		return changed;
	}

	/**
	 * The single entry point for graph edits (and the undo history, FE-052).
	 * `retarget` moves the selection from a replaced node to its replacement.
	 */
	commit(graph: QueryGraph, retarget?: { from: string; to: string }): void {
		if (graph === this.graph) return;
		this.past = [...this.past, this.graph].slice(-this.#historyLimit);
		this.future = [];
		this.#apply(graph, retarget);
	}

	#apply(graph: QueryGraph, retarget?: { from: string; to: string }): void {
		if (retarget && this.selection?.id === retarget.from)
			this.selection = { kind: 'node', id: retarget.to };
		this.graph = graph;
		if (this.selection && !graph.elements.some((element) => element.id === this.selection!.id))
			this.selection = null;
		this.#refreshOrder();
		if (this.funnel.plan)
			this.funnelDisabled = presentFunnelSteps(this.funnel.plan, this.funnelDisabled);
	}

	// ── Undo and redo (FE-052) ────────────────────────────────────
	undo(): boolean {
		const previous = this.past.at(-1);
		if (!previous) return false;
		this.past = this.past.slice(0, -1);
		this.future = [this.graph, ...this.future];
		this.#apply(previous);
		return true;
	}

	redo(): boolean {
		const [next, ...rest] = this.future;
		if (!next) return false;
		this.future = rest;
		this.past = [...this.past, this.graph].slice(-this.#historyLimit);
		this.#apply(next);
		return true;
	}

	clearHistory() {
		this.past = [];
		this.future = [];
	}

	// ── Graph edits ───────────────────────────────────────────────
	/** New Query: an empty graph and no history. */
	clear() {
		this.commit(clearGraph());
		this.clearHistory();
	}
	addVariable(position?: Position): string {
		const result = addVariable(this.graph, this.#stamp(), position);
		this.commit(result.graph);
		return result.id;
	}
	addValueVariable(position?: Position): string {
		const result = addValueVariable(this.graph, this.#stamp(), position);
		this.commit(result.graph);
		return result.id;
	}
	addEntity(id: string, label: string, position?: Position) {
		this.commit(addEntity(this.graph, id, label, position));
	}
	addRelationValue(input: Parameters<typeof addRelationValue>[1]) {
		this.commit(addRelationValue(this.graph, input));
	}
	connect(sourceId: string, targetId: string, predicateId: string, predicateLabel: string) {
		this.commit(connectNodes(this.graph, sourceId, targetId, predicateId, predicateLabel));
	}
	dragConnect(sourceId: string, targetId: string) {
		this.commit(dragConnect(this.graph, sourceId, targetId));
	}
	dragToNewVariable(sourceId: string, position: Position): string {
		const result = dragToNewVariable(this.graph, sourceId, position, this.#stamp());
		this.commit(result.graph);
		return result.id;
	}
	/** A collision-free `?predicate_<n>` for Connect with variable predicate / Convert relation. */
	nextPredicateVariable(): string {
		const { name, sequence } = nextPredicateVariable(this.graph, this.#predicateSequence);
		this.#predicateSequence = sequence;
		return name;
	}
	convertToVariable(nodeId: string): string | null {
		const result = convertToVariable(this.graph, nodeId, this.#stamp());
		if (!result) return null;
		this.commit(result.graph, { from: nodeId, to: result.id });
		return result.id;
	}
	convertEdgeToVariable(edgeId: string) {
		this.commit(convertEdgeToVariable(this.graph, edgeId, this.nextPredicateVariable()));
	}
	removeNode(nodeId: string) {
		this.commit(removeNode(this.graph, nodeId));
	}
	removeEdge(edgeId: string) {
		this.commit(removeEdge(this.graph, edgeId));
	}
	toggleBoolean(nodeId: string): string | null {
		const result = toggleBoolean(this.graph, nodeId, this.#stamp());
		if (!result) return null;
		this.commit(result.graph, { from: nodeId, to: result.id });
		return result.id;
	}
	/** Apply in the filter editor; returns the error message to show, if any. */
	applyFilter(
		nodeId: string,
		value: string,
		filterType: number | string | null
	): { error?: string; id?: string } {
		const result = setValueNodeFilter(this.graph, nodeId, value, filterType, this.#stamp());
		if (result.error) return { error: result.error };
		const id = result.id ?? nodeId;
		this.commit(result.graph!, { from: nodeId, to: id });
		return { id };
	}
	setValueVariableFilter(
		nodeId: string,
		value: string,
		filterType: number | string | null
	): { error?: string } {
		const result = setValueVariableFilter(this.graph, nodeId, value, filterType);
		if (result.error) return { error: result.error };
		this.commit(result.graph!);
		return {};
	}
	addValueFilterVariable(sourceId: string, predicateId: string, predicateLabel: string): string {
		const result = addValueFilterVariable(
			this.graph,
			sourceId,
			predicateId,
			predicateLabel,
			this.#stamp()
		);
		this.commit(result.graph);
		return result.id;
	}
	/** A results-table choice; returns the relations the caller fetches again. */
	chooseResult(
		variableId: string,
		result: Parameters<typeof chooseResult>[2]
	): OutgoingRelation[] {
		const chosen = chooseResult(this.graph, variableId, result);
		if (!chosen.bound) return [];
		this.commit(chosen.graph, { from: variableId, to: result.id });
		return chosen.refetch;
	}
	/** Apply to graph / Assume. */
	applyChoices(choices: Choice[]) {
		this.commit(applyChoices(this.graph, this.orderState.registry, choices));
	}
	moveNode(nodeId: string, position: Position) {
		this.graph = moveNode(this.graph, nodeId, position);
	}
	setPositions(positions: Record<string, Position>) {
		this.graph = setPositions(this.graph, positions);
	}

	// ── Selection, endpoint, limit, order, funnel ─────────────────
	select(selection: Selection) {
		this.selection = selection;
	}
	setEndpoint(endpoint: Endpoint | string) {
		if (this.endpointLocked) return;
		const next = typeof endpoint === 'string' ? endpointFromText(endpoint) : endpoint;
		if (JSON.stringify(next) !== JSON.stringify(this.endpoint)) this.clearHistory();
		this.endpoint = next;
		this.#refreshOrder();
	}
	setLimit(value: number) {
		this.limit = Number.isFinite(value) && value > 0 ? Math.trunc(value) : 20;
	}
	moveStage(from: number, to: number): boolean {
		const next = moveItem(this.order, from, to);
		if (next.every((name, index) => name === this.order[index])) return false;
		this.orderState = { ...this.orderState, order: next };
		return true;
	}
	/** The label a variable is shown with (FE-056). */
	nameOf(variable: string): string {
		return variableLabel(this.variableNames, variable);
	}
	setOrder(order: string[]) {
		this.orderState = { ...this.orderState, order: order.slice() };
	}
	setFunnelStep(key: string, enabled: boolean) {
		this.funnelDisabled = toggleFunnelStep(this.funnelDisabled, key, enabled);
	}
	setFunnelVariable(name: string | null) {
		this.funnelVariable = name;
	}

	// ── Saved queries ─────────────────────────────────────────────
	get document(): QueryDocument {
		return {
			graph: this.graph,
			endpoint: this.endpoint,
			limit: this.limit,
			order: this.order.slice()
		};
	}
	/** A locked endpoint stays; the document's endpoint is then ignored. */
	load(document: QueryDocument) {
		if (!this.endpointLocked) this.endpoint = document.endpoint;
		this.limit = document.limit;
		this.selection = null;
		this.funnelDisabled = NO_DISABLED_STEPS;
		this.commit(document.graph);
		this.clearHistory();
		const available = this.orderState.registry.map((entry) => entry.name);
		const kept = document.order.filter((name) => available.includes(name));
		this.setOrder([...kept, ...this.order.filter((name) => !kept.includes(name))]);
	}
}

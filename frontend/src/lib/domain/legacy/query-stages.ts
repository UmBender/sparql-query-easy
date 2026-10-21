/**
 * Port of sparql/query-stages.js (FE-042): ordered multi-variable exploration
 * state (DEC-008): variable registry, query signature, block order, stage
 * requests and the budgeted preview scheduler.
 */
import { nodeKind } from './graph-model.js';
import {
	withVariableFilters,
	type QueryFilter,
	type VariableFilter
} from './query-calculations.js';

export { termGraphValue } from './graph-model.js';

export type GraphItem = {
	id?: string;
	value?: string;
	source?: string;
	target?: string;
	nodeId?: string | null;
	filterType?: number | string | null;
	filterValue?: string;
	label?: string;
	type?: string;
};
export type QueryVariableEntry = { name: string; nodeIds: string[]; edgeIds: string[] };
export type RdfTerm = {
	type: 'iri' | 'literal' | 'bnode';
	value: string;
	datatype?: string | null;
	language?: string | null;
};
export type StageCandidate = { term: RdfTerm; label: string | null; selectable: boolean };
export type StagePage = {
	variableName: string;
	offset: number;
	limit: number;
	hasMore: boolean;
	candidates: StageCandidate[];
};
export type StageBinding = { variableName: string; term: RdfTerm };
export type StageRequest = {
	endpointUrl: string;
	variableName: string;
	where: QueryFilter[];
	bindings: StageBinding[];
	limit: number;
	offset: number;
	variableFilters?: VariableFilter[];
};
export type PreviewState = {
	key: string | null;
	status: 'idle' | 'loading' | 'loaded' | 'error';
	page?: StagePage;
	error?: string;
};
export type AssignmentState = 'committed' | 'assumed' | 'possible';
export type Assignment = { term: RdfTerm; text: string; state: AssignmentState };
export type ConsolidationItem = GraphItem & { position?: { x: number; y: number } };
export type ConsolidatedElement = {
	group: 'nodes' | 'edges';
	data: Record<string, string>;
	classes: string;
	position?: { x: number; y: number };
};

export const MAX_POSSIBLE_VALUES = 3;
export const MAX_STAGE_PAGE_SIZE = 50;
export const PREVIEW_DELAY_MS = 300;

const variablePattern = /^[?$][A-Za-z_][A-Za-z0-9_]*$/;
const XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string';
const RDF_LANG_STRING = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';

/** One entry per distinct variable name, sorted; occurrences keep their element ids. */
export function buildVariableRegistry(items: GraphItem[]): QueryVariableEntry[] {
	const entries = new Map<string, QueryVariableEntry>();
	for (const item of items) {
		const isEdge = Boolean(item.source && item.target);
		const name = isEdge ? item.nodeId : item.value || item.id;
		if (typeof name !== 'string' || !variablePattern.test(name) || !item.id) continue;
		const entry = entries.get(name) || { name, nodeIds: [], edgeIds: [] };
		(isEdge ? entry.edgeIds : entry.nodeIds).push(item.id);
		entries.set(name, entry);
	}
	return [...entries.values()].sort((left, right) => compare(left.name, right.name));
}

/** Which component a query uses (BUG-004). */
export function queryComponentChoice(components: GraphItem[][]): {
	index: number | null;
	ambiguous: boolean;
} {
	const withVariables = components.flatMap((items, index) =>
		buildVariableRegistry(items).length ? [index] : []
	);
	if (withVariables.length > 1) return { index: null, ambiguous: true };
	if (withVariables.length === 1) return { index: withVariables[0], ambiguous: false };
	return { index: components.length ? 0 : null, ambiguous: false };
}

/** Stable description of everything a staged query depends on. */
export function explorationSignature(endpointUrl: string, items: GraphItem[]): string {
	const parts = items
		.map((item) => [
			item.id ?? '',
			item.value ?? '',
			item.source ?? '',
			item.target ?? '',
			item.nodeId ?? '',
			item.filterType ?? '',
			item.filterValue ?? ''
		])
		.map((part) => JSON.stringify(part))
		.sort(compare);
	return JSON.stringify([endpointUrl, parts]);
}

export function moveItem(order: string[], from: number, to: number): string[] {
	if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length)
		return order.slice();
	const next = order.slice();
	const [moved] = next.splice(from, 1);
	next.splice(to, 0, moved);
	return next;
}

export function stagePageSize(limit: number): number {
	return Number.isFinite(limit)
		? Math.min(Math.max(Math.trunc(limit), 1), MAX_STAGE_PAGE_SIZE)
		: 20;
}

export function stageRequest({
	endpointUrl,
	where,
	variableName,
	bindings,
	limit,
	offset = 0,
	variableFilters = []
}: {
	endpointUrl: string;
	where: QueryFilter[];
	variableName: string;
	bindings: StageBinding[];
	limit: number;
	offset?: number;
	variableFilters?: VariableFilter[];
}): StageRequest {
	return withVariableFilters(
		{
			endpointUrl,
			variableName,
			where,
			bindings: bindings.map((binding) => ({
				variableName: binding.variableName,
				term: binding.term
			})),
			limit: stagePageSize(limit),
			offset
		},
		variableFilters
	);
}

export function stageCacheKey(request: StageRequest): string {
	return JSON.stringify(request);
}

export function termKey(term: RdfTerm): string {
	return JSON.stringify([term.type, term.value, term.datatype ?? null, term.language ?? null]);
}

export function candidateText(candidate: StageCandidate): string {
	return candidate.label || candidate.term.value;
}

/** Short type hint shown beside a candidate; never used as a binding. */
export function termHint(term: RdfTerm): string {
	if (term.type === 'iri') return 'IRI';
	if (term.type === 'bnode') return 'blank node';
	if (term.language) return `literal @${term.language}`;
	if (term.datatype && term.datatype !== XSD_STRING && term.datatype !== RDF_LANG_STRING) {
		return `literal ${term.datatype.slice(Math.max(term.datatype.lastIndexOf('#'), term.datatype.lastIndexOf('/')) + 1)}`;
	}
	return 'literal';
}

export type PreviewScheduler = {
	schedule(request: StageRequest): void;
	settle(): void;
	cancel(): void;
	readonly currentKey: string | null;
};

/** Budgeted hover/focus preview: one delayed request at a time, cached results. */
export function createPreviewScheduler({
	fetchPage,
	onUpdate,
	cache,
	delay = PREVIEW_DELAY_MS,
	setTimer = setTimeout,
	clearTimer = clearTimeout
}: {
	fetchPage: (request: StageRequest, signal: AbortSignal) => Promise<StagePage>;
	onUpdate: (state: PreviewState) => void;
	cache: Map<string, StagePage>;
	delay?: number;
	setTimer?: (callback: () => void, delay: number) => unknown;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	clearTimer?: (handle: any) => void;
}): PreviewScheduler {
	let currentKey: string | null = null;
	let timer: unknown = null;
	let inFlight: AbortController | null = null;

	function stopPending() {
		if (timer !== null) clearTimer(timer);
		timer = null;
		inFlight?.abort();
		inFlight = null;
	}

	function dispatch(request: StageRequest) {
		const key = stageCacheKey(request);
		const controller = new AbortController();
		inFlight = controller;
		onUpdate({ key, status: 'loading' });
		fetchPage(request, controller.signal).then(
			(page) => {
				if (controller.signal.aborted) return;
				cache.set(key, page);
				if (inFlight === controller) inFlight = null;
				if (currentKey === key) onUpdate({ key, status: 'loaded', page });
			},
			(error) => {
				if (controller.signal.aborted) return;
				if (inFlight === controller) inFlight = null;
				if (currentKey !== key) return;
				currentKey = null;
				onUpdate({
					key,
					status: 'error',
					error: error instanceof Error ? error.message : String(error)
				});
			}
		);
	}

	return {
		schedule(request) {
			const key = stageCacheKey(request);
			if (key === currentKey) return;
			stopPending();
			currentKey = key;
			const cached = cache.get(key);
			if (cached) {
				onUpdate({ key, status: 'loaded', page: cached });
				return;
			}
			timer = setTimer(() => {
				timer = null;
				dispatch(request);
			}, delay);
		},
		settle() {
			if (timer === null) return;
			clearTimer(timer);
			timer = null;
			currentKey = null;
		},
		cancel() {
			stopPending();
			currentKey = null;
			onUpdate({ key: null, status: 'idle' });
		},
		get currentKey() {
			return currentKey;
		}
	};
}

/** Up to three selectable candidates of the next variable. */
export function possibleValues(page: StagePage | undefined): StageCandidate[] {
	return (page?.candidates ?? [])
		.filter((candidate) => candidate.selectable)
		.slice(0, MAX_POSSIBLE_VALUES);
}

export type PossibleGraphInput = {
	order: string[];
	stage: number;
	bindings: StageBinding[];
	labels: string[];
	previewCandidate: StageCandidate | null;
	previewKey?: string | null;
	preview: PreviewState;
	complete: boolean;
};
export type PossibleGraphView = {
	assignments: Map<string, Assignment>;
	caption: string;
	valueCount: number;
};

/** Assignments and caption of the possible-graph window. */
export function possibleGraphView(
	input: PossibleGraphInput,
	cycleIndex: number,
	nameOf: (name: string) => string = (name) => name
): PossibleGraphView {
	const assignments = new Map<string, Assignment>();
	input.bindings.forEach((binding, index) => {
		assignments.set(binding.variableName, {
			term: binding.term,
			text: input.labels[index],
			state: 'committed'
		});
	});
	const candidate = input.previewCandidate;
	if (!candidate || input.complete) {
		const caption = input.complete
			? 'All variables chosen.'
			: 'Hover or focus an option to preview it.';
		return { assignments, caption, valueCount: 0 };
	}
	const { order, stage, preview } = input;
	const assumedText = candidateText(candidate);
	assignments.set(order[stage], { term: candidate.term, text: assumedText, state: 'assumed' });
	const assumed = `If ${nameOf(order[stage])} = ${assumedText}`;
	const nextName = order[stage + 1];
	const nextLabel = nextName ? nameOf(nextName) : '';
	if (!nextName) return { assignments, caption: `${assumed}.`, valueCount: 0 };
	const current: PreviewState =
		preview.key === input.previewKey ? preview : { key: null, status: 'loading' };
	const values = current.status === 'loaded' ? possibleValues(current.page) : [];
	if (!values.length) {
		const reason =
			current.status === 'error'
				? `the preview failed: ${current.error}`
				: current.status === 'loaded'
					? `${nextLabel} has no values`
					: `loading ${nextLabel}…`;
		return { assignments, caption: `${assumed}, ${reason}.`, valueCount: 0 };
	}
	const index = cycleIndex % values.length;
	const valueText = candidateText(values[index]);
	assignments.set(nextName, { term: values[index].term, text: valueText, state: 'possible' });
	return {
		assignments,
		caption: `${assumed}, ${nextLabel} could be ${valueText} (${index + 1} of ${values.length}).`,
		valueCount: values.length
	};
}

/** A read-only copy of the query graph with assigned variables replaced by their values. */
export function consolidatedGraphElements(
	items: ConsolidationItem[],
	assignments: Map<string, Assignment>,
	nameOf: (name: string) => string = (name) => name
): ConsolidatedElement[] {
	return items.map((item): ConsolidatedElement => {
		const isEdge = Boolean(item.source && item.target);
		const name = isEdge ? item.nodeId : item.value || item.id;
		const isVariable = typeof name === 'string' && variablePattern.test(name);
		const assignment = isVariable ? assignments.get(name as string) : undefined;
		const usable = assignment && !(isEdge && assignment.term.type !== 'iri');
		if (isEdge) {
			const data = {
				id: `edge:${item.id}`,
				source: `node:${item.source}`,
				target: `node:${item.target}`
			};
			if (usable)
				return {
					group: 'edges',
					data: { ...data, label: assignment.text },
					classes: assignment.state
				};
			if (isVariable || !item.nodeId)
				return {
					group: 'edges',
					data: { ...data, label: isVariable ? nameOf(name as string) : name || '?' },
					classes: 'open'
				};
			return {
				group: 'edges',
				data: { ...data, label: item.label || item.nodeId || '' },
				classes: 'fixed'
			};
		}
		const node = {
			group: 'nodes' as const,
			...(item.position ? { position: { ...item.position } } : {})
		};
		const id = `node:${item.id}`;
		if (usable) {
			const kind = assignment.term.type === 'iri' ? 'iri' : 'literal';
			return {
				...node,
				data: { id, label: assignment.text },
				classes: `${assignment.state} ${kind}`
			};
		}
		if (isVariable)
			return { ...node, data: { id, label: nameOf(name as string) }, classes: 'open' };
		const kind = nodeKind(item).kind === 'literal' ? 'literal' : 'iri';
		return {
			...node,
			data: { id, label: item.label || item.value || item.id || '' },
			classes: `fixed ${kind}`
		};
	});
}

function compare(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

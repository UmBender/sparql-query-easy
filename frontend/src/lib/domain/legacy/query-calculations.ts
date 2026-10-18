/**
 * Port of sparql/query-calculations.js (FE-042). Plain graph data used by
 * query calculations; no DOM, Cytoscape or network. Logic and results are
 * unchanged; the ported unit suite (query-calculations.spec.ts) is the oracle.
 */

export type FilterTypeInput = number | string | null | undefined;

export type QueryItem = {
	id?: string;
	value?: string;
	source?: string;
	target?: string;
	nodeId?: string | null;
	sourceValue?: string;
	targetValue?: string;
	filterType?: FilterTypeInput;
	filterValue?: string;
	label?: string;
	type?: string;
};

export type FilterEdge = QueryItem & { source: string; target: string; fallbackPredicate: string };
export type QueryFilter = {
	subject: string;
	predicate: string;
	object: string;
	filterType: number | null;
};
export type VariableFilter = {
	variableName: string;
	filterType: number | null;
	value: string | null;
};

const variablePattern = /^[?$][A-Za-z_][A-Za-z0-9_]*$/;

export function isVariableToken(value: unknown): value is string {
	return typeof value === 'string' && variablePattern.test(value);
}

export function buildFilters(edges: FilterEdge[]): QueryFilter[] {
	return edges.map((edge) => ({
		subject: edge.sourceValue || edge.source,
		predicate: edge.nodeId || edge.fallbackPredicate,
		object: edge.targetValue || edge.target,
		filterType: filterTypeOf(edge.filterType)
	}));
}

/**
 * FE-034: the variable filters a request can carry are those of variables
 * that are the object of one of its where patterns.
 */
export function variableFiltersFor(
	where: QueryFilter[],
	variableFilters: VariableFilter[]
): VariableFilter[] {
	const objects = new Set(where.map((item) => item.object));
	return variableFilters.filter((filter) => objects.has(filter.variableName));
}

/** Adds `variableFilters` only when the request has some. */
export function withVariableFilters<T extends { where: QueryFilter[] }>(
	request: T,
	variableFilters: VariableFilter[]
): T & { variableFilters?: VariableFilter[] } {
	const used = variableFiltersFor(request.where, variableFilters);
	return used.length ? { ...request, variableFilters: used } : request;
}

/** The editor stores "" for an exact match; that is no filter, not 0 (Starts with). */
export function filterTypeOf(filterType: FilterTypeInput): number | null {
	return filterType == null || filterType === '' ? null : +filterType;
}

const numberPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

export function isNumberText(text: string): boolean {
	return numberPattern.test(text);
}

/** Parses a Between value `min..max` (filterType 6); both bounds inclusive. */
export function parseBetween(text: string | null | undefined): { min: number; max: number } | null {
	const bounds = String(text ?? '')
		.split('..')
		.map((bound) => bound.trim());
	if (bounds.length !== 2 || !bounds.every((bound) => numberPattern.test(bound))) return null;
	const [min, max] = bounds.map(Number);
	return min <= max ? { min, max } : null;
}

/** Readable label of a filtered literal node: `≥ 100`, `≤ 80`, `40–80`, MAX, MIN. */
export function filterLabel(filterType: FilterTypeInput, value: string): string {
	switch (filterTypeOf(filterType)) {
		case 0:
			return `starts with ${value}`;
		case 1:
			return `contains ${value}`;
		case 2:
			return `≥ ${value}`;
		case 3:
			return `≤ ${value}`;
		case 4:
			return 'MAX';
		case 5:
			return 'MIN';
		case 6: {
			const range = parseBetween(value);
			return range ? `${range.min}–${range.max}` : value;
		}
		default:
			return value;
	}
}

export type NumericProfileRequest = {
	endpointUrl: string;
	where: QueryFilter[];
	subject: string;
	predicate: string;
	limit: number;
	variableFilters?: VariableFilter[];
};

/**
 * Request for POST /api/query/numeric-profile (BE-003). Null unless exactly one
 * fixed-IRI relation points at the literal node.
 */
export function numericProfileRequest({
	endpointUrl,
	edges,
	literalId,
	limit = 500,
	variableFilters = []
}: {
	endpointUrl: string;
	edges: FilterEdge[];
	literalId: string;
	limit?: number;
	variableFilters?: VariableFilter[];
}): NumericProfileRequest | null {
	const profiled = edges.filter((edge) => edge.target === literalId);
	if (profiled.length !== 1) return null;
	const [edge] = profiled;
	const predicate = edge.nodeId;
	if (!predicate || !predicate.startsWith('<') || predicate.includes('>/<')) return null;
	return withVariableFilters(
		{
			endpointUrl,
			where: buildFilters(edges.filter((item) => item !== edge)),
			subject: edge.sourceValue || edge.source,
			predicate,
			limit
		},
		variableFilters
	);
}

/** Variable that stands for a value node's text in a suggestion request (FE-038). */
const suggestionVariable = '?suggestedValue';

export type StageRequestBody = {
	endpointUrl: string;
	variableName: string;
	where: QueryFilter[];
	bindings: { variableName: string; term: RdfTermLike }[];
	limit: number;
	offset: number;
	variableFilters?: VariableFilter[];
};

export type RdfTermLike = {
	type: string;
	value: string;
	datatype?: string | null;
	language?: string | null;
};

/**
 * Request for POST /api/query/stage listing the text values a filter editor can
 * suggest (FE-038). Null without text or without exactly one fixed relation.
 */
export function textSuggestionRequest({
	endpointUrl,
	edges,
	nodeId,
	text,
	startsWith,
	variableFilters = [],
	limit = 20
}: {
	endpointUrl: string;
	edges: FilterEdge[];
	nodeId: string;
	text: string;
	startsWith: boolean;
	variableFilters?: VariableFilter[];
	limit?: number;
}): (StageRequestBody & { variableFilters: VariableFilter[] }) | null {
	if (!text) return null;
	const incoming = edges.filter((edge) => edge.target === nodeId);
	if (incoming.length !== 1) return null;
	const [edge] = incoming;
	const predicate = edge.nodeId;
	if (!predicate || !predicate.startsWith('<') || predicate.includes('>/<')) return null;
	const object = edge.targetValue || edge.target;
	const ownVariable = variablePattern.test(object);
	const variableName = ownVariable ? object : suggestionVariable;
	const where = buildFilters(
		ownVariable
			? edges
			: edges.map((item) =>
					item === edge
						? {
								...item,
								target: variableName,
								targetValue: variableName,
								filterType: null
							}
						: item
				)
	);
	const others = variableFiltersFor(where, variableFilters).filter(
		(filter) => filter.variableName !== variableName
	);
	return {
		endpointUrl,
		variableName,
		where,
		bindings: [],
		limit,
		offset: 0,
		variableFilters: [...others, { variableName, filterType: startsWith ? 0 : 1, value: text }]
	};
}

/** Distinct literal texts of a stage page, in page order (FE-038). */
export function suggestedTexts(page: {
	candidates: { term: { type: string; value: string } }[];
}): string[] {
	return [
		...new Set(
			page.candidates
				.filter((candidate) => candidate.term.type === 'literal')
				.map((candidate) => candidate.term.value)
		)
	];
}

/** Inclusive numeric range kept by At least, At most and Between; null otherwise. */
export function filterRange(
	filterType: FilterTypeInput,
	value: string
): { min: number; max: number } | null {
	const type = filterTypeOf(filterType);
	if (type === 6) return parseBetween(value);
	const text = String(value ?? '').trim();
	if ((type !== 2 && type !== 3) || !numberPattern.test(text)) return null;
	return type === 2
		? { min: Number(text), max: Infinity }
		: { min: -Infinity, max: Number(text) };
}

/**
 * Request for POST /api/query/relationship-value giving the actual values of a
 * filtered literal node once its subject is a fixed entity (FE-036).
 */
export function actualValueRequest({
	endpointUrl,
	edges,
	literalId
}: {
	endpointUrl: string;
	edges: FilterEdge[];
	literalId: string;
}): { endpointUrl: string; subjectId: string; predicateId: string; isLiteral: true } | null {
	const incoming = edges.filter((edge) => edge.target === literalId);
	if (incoming.length !== 1) return null;
	const [edge] = incoming;
	const subject = edge.sourceValue || edge.source;
	const predicate = edge.nodeId;
	if (
		!subject.startsWith('<') ||
		!predicate ||
		!predicate.startsWith('<') ||
		predicate.includes('>/<')
	)
		return null;
	return { endpointUrl, subjectId: subject, predicateId: predicate, isLiteral: true };
}

/**
 * Whether an entity's actual values pass its kept filter (FE-036). Null when the
 * values alone cannot tell (MAX/MIN) or when there is no filter.
 */
export function filterAccepts(
	filterType: FilterTypeInput,
	filterValue: string,
	values: string[]
): boolean | null {
	const type = filterTypeOf(filterType);
	if (type === 0) return values.some((value) => value.startsWith(filterValue));
	if (type === 1) return values.some((value) => value.includes(filterValue));
	const range = filterRange(type, filterValue);
	if (!range) return null;
	return values.some((value) => {
		const text = value.trim();
		return numberPattern.test(text) && Number(text) >= range.min && Number(text) <= range.max;
	});
}

/** At most this many filter steps are counted by the funnel (FE-028). */
export const MAX_FUNNEL_STEPS = 8;

/** Variables standing in for a relaxed step value. */
const funnelVariablePrefix = '?__funnel';

export type FunnelStep = { key: string; index: number; counted: boolean; extreme: boolean };
export type CountRequest = {
	endpointUrl: string;
	variableName: string;
	where: QueryFilter[];
	variableFilters?: VariableFilter[];
};
export type FunnelPlan = {
	variableName: string;
	steps: FunnelStep[];
	extremes: number;
	requests: (CountRequest | null)[];
};

/** A filter step, an extreme (MAX/MIN) step, or not a step. */
export function funnelStepKind(
	edge: FilterEdge,
	variableFilters: VariableFilter[] = []
): 'step' | 'extreme' | null {
	const predicate = edge.nodeId;
	const object = edge.targetValue || edge.target;
	if (!predicate || !predicate.startsWith('<')) return null;
	let filterType = filterTypeOf(edge.filterType);
	if (/^[?$]/.test(object)) {
		const filter = variableFilters.find((item) => item.variableName === object);
		if (!filter || (filter.filterType === null && filter.value === null)) return null;
		filterType = filterTypeOf(filter.filterType);
	}
	return filterType === 4 || filterType === 5 ? 'extreme' : 'step';
}

/** Count requests of the filter funnel (POST /api/query/count), see the legacy module. */
export function filterFunnelPlan({
	endpointUrl,
	edges,
	variableName,
	disabled = [],
	maxSteps = MAX_FUNNEL_STEPS,
	variableFilters = []
}: {
	endpointUrl: string;
	edges: FilterEdge[];
	variableName: string;
	disabled?: Iterable<string>;
	maxSteps?: number;
	variableFilters?: VariableFilter[];
}): FunnelPlan {
	const off = new Set(disabled);
	const steps: FunnelStep[] = [];
	const stepIndex = new Map<FilterEdge, number>();
	const stepVariables = new Set<string>();
	const kinds = new Map<FilterEdge, 'step' | 'extreme' | null>(
		edges.map((edge) => {
			const object = edge.targetValue || edge.target;
			const kind = stepVariables.has(object) ? null : funnelStepKind(edge, variableFilters);
			if (kind && /^[?$]/.test(object)) stepVariables.add(object);
			return [edge, kind];
		})
	);
	for (const wanted of ['step', 'extreme'] as const) {
		edges.forEach((edge) => {
			if (kinds.get(edge) !== wanted) return;
			stepIndex.set(edge, steps.length);
			steps.push({
				key: funnelStepKey(edge),
				index: steps.length,
				counted: steps.length < maxSteps,
				extreme: wanted === 'extreme'
			});
		});
	}
	const extremes = steps.filter((step) => step.extreme).length;
	const request = (applied: number): CountRequest => {
		const relaxedVariables = new Set<string>();
		const where = buildFilters(
			edges.map((edge, position) => {
				const kind = kinds.get(edge);
				const index = stepIndex.get(edge);
				const keep =
					kind != null &&
					index !== undefined &&
					index < applied &&
					!off.has(steps[index].key);
				if (kind == null || keep) return edge;
				const object = edge.targetValue || edge.target;
				if (/^[?$]/.test(object)) {
					relaxedVariables.add(object);
					return edge;
				}
				return {
					...edge,
					target: `${funnelVariablePrefix}${position}`,
					targetValue: `${funnelVariablePrefix}${position}`,
					filterType: null
				};
			})
		);
		const kept = variableFilters.filter((filter) => !relaxedVariables.has(filter.variableName));
		return withVariableFilters({ endpointUrl, variableName, where }, kept);
	};
	const counted = steps.filter((step) => step.counted);
	const requests = [
		request(0),
		...counted.map((step) => (off.has(step.key) ? null : request(step.index + 1)))
	];
	return { variableName, steps, extremes, requests };
}

/** Stable identity of a step: the relation id when the graph gives one. */
export function funnelStepKey(edge: FilterEdge): string {
	return edge.id || JSON.stringify([edge.source, edge.nodeId, edge.target]);
}

/** Remaining count after each counted step; a disabled step repeats the previous count. */
export function funnelStepCounts(
	requests: FunnelPlan['requests'],
	counts: (number | undefined)[]
): (number | null)[] {
	const result: (number | null)[] = [];
	let previous = counts[0] ?? null;
	for (let index = 1; index < requests.length; index++) {
		const current = requests[index] === null ? previous : (counts[index] ?? null);
		result.push(current);
		previous = current;
	}
	return result;
}

export type RangeScale = { min: number; max: number; step: number; decimals: number };

/** Slider scale for a numeric profile (FE-026). */
export function rangeScale(numbers: number[]): RangeScale | null {
	if (!numbers.length || !numbers.every(Number.isFinite)) return null;
	const dataMin = Math.min(...numbers);
	const dataMax = Math.max(...numbers);
	const exponent = numbers.every(Number.isInteger)
		? 0
		: Math.min(0, Math.floor(Math.log10((dataMax - dataMin) / 100 || 1)));
	const step = 10 ** exponent;
	const decimals = exponent === 0 ? 0 : -exponent;
	const align = (value: number, round: (n: number) => number) =>
		Number((round(Number((value / step).toFixed(6))) * step).toFixed(decimals));
	return { min: align(dataMin, Math.floor), max: align(dataMax, Math.ceil), step, decimals };
}

export type HistogramBin = { from: number; to: number; count: number; kept: number };

/** Equal-width bins over [min, max] with how many values lie inside [lo, hi]. */
export function histogramBins(
	numbers: number[],
	{
		min,
		max,
		lo,
		hi,
		binCount
	}: { min: number; max: number; lo: number; hi: number; binCount: number }
): HistogramBin[] {
	const count = max > min ? Math.max(1, Math.floor(binCount)) : 1;
	const width = (max - min) / count;
	const bins = Array.from({ length: count }, (_, index) => ({
		from: min + index * width,
		to: index === count - 1 ? max : min + (index + 1) * width,
		count: 0,
		kept: 0
	}));
	for (const value of numbers) {
		if (value < min || value > max) continue;
		const bin = bins[width > 0 ? Math.min(count - 1, Math.floor((value - min) / width)) : 0];
		bin.count++;
		if (value >= lo && value <= hi) bin.kept++;
	}
	return bins;
}

export function countInRange(numbers: number[], lo: number, hi: number): number {
	return numbers.filter((value) => value >= lo && value <= hi).length;
}

/** Filter written by the range slider (FE-026). */
export function rangeFilter(
	scale: RangeScale,
	lo: number,
	hi: number
): { filterType: number; value: string } {
	const format = (value: number) => String(Number(value.toFixed(scale.decimals)));
	const lowOpen = lo <= scale.min;
	const highOpen = hi >= scale.max;
	if (!lowOpen && highOpen) return { filterType: 2, value: format(lo) };
	if (lowOpen && !highOpen) return { filterType: 3, value: format(hi) };
	return { filterType: 6, value: `${format(lo)}..${format(hi)}` };
}

/** Slider handles for an editor value. */
export function rangeFromFilter(
	scale: RangeScale,
	filterType: FilterTypeInput,
	value: string
): { lo: number; hi: number } {
	const clamp = (number: number) => Math.min(scale.max, Math.max(scale.min, number));
	const number = numberPattern.test(String(value ?? '').trim()) ? Number(value) : NaN;
	switch (filterTypeOf(filterType)) {
		case 2:
			return Number.isFinite(number)
				? { lo: clamp(number), hi: scale.max }
				: { lo: scale.min, hi: scale.max };
		case 3:
			return Number.isFinite(number)
				? { lo: scale.min, hi: clamp(number) }
				: { lo: scale.min, hi: scale.max };
		case 6: {
			const range = parseBetween(value);
			return range
				? { lo: clamp(range.min), hi: clamp(range.max) }
				: { lo: scale.min, hi: scale.max };
		}
		default:
			return { lo: scale.min, hi: scale.max };
	}
}

export type CycleMode = 'exact' | 'atLeast' | 'atMost' | 'between';

/** Which kind of fixed range a numeric filter type keeps (FE-035). */
export function cycleMode(filterType: FilterTypeInput): CycleMode | null {
	switch (filterTypeOf(filterType)) {
		case null:
			return 'exact';
		case 2:
			return 'atLeast';
		case 3:
			return 'atMost';
		case 6:
			return 'between';
		default:
			return null;
	}
}

export type ProfileValue = {
	entity: unknown;
	label?: string | null;
	value: string;
	number: number;
};
export type KeptEntity = {
	key: string;
	label: string;
	values: { value: string; number: number }[];
};
export type PreviewElement = {
	group: 'nodes' | 'edges';
	data: Record<string, string>;
	position?: { x: number; y: number };
};

/** Distinct entities of the profile rows kept by [lo, hi] (FE-035). */
export function keptEntities(values: ProfileValue[], lo: number, hi: number): KeptEntity[] {
	const entities = new Map<string, KeptEntity>();
	for (const item of values) {
		if (!Number.isFinite(item.number) || item.number < lo || item.number > hi) continue;
		const raw =
			item.entity && typeof item.entity === 'object' && 'value' in item.entity
				? (item.entity as { value: unknown }).value
				: item.entity;
		const key = String(raw ?? '').replace(/^<|>$/g, '');
		const entity = entities.get(key) ?? {
			key,
			label:
				item.label ||
				key.slice(Math.max(key.lastIndexOf('#'), key.lastIndexOf('/')) + 1) ||
				key,
			values: []
		};
		if (
			!entity.values.some(
				(value) => value.number === item.number && value.value === item.value
			)
		) {
			entity.values.push({ value: item.value, number: item.number });
		}
		entities.set(key, entity);
	}
	const list = [...entities.values()];
	list.forEach((entity) => entity.values.sort((a, b) => a.number - b.number));
	return list.sort(
		(a, b) => a.values[0].number - b.values[0].number || a.label.localeCompare(b.label)
	);
}

/** Mini result graph for the entities shown in one cycle step (FE-035). */
export function possibilityGraph(entities: KeptEntity[], relation: string): PreviewElement[] {
	const elements: PreviewElement[] = [];
	let x = 0;
	entities.forEach((entity, index) => {
		const width = Math.max(1, entity.values.length) * 110;
		const entityId = `e${index}`;
		elements.push({
			group: 'nodes',
			data: { id: entityId, kind: 'entity', label: entity.label },
			position: { x: x + (width - 110) / 2, y: 0 }
		});
		entity.values.forEach((value, valueIndex) => {
			const valueId = `${entityId}v${valueIndex}`;
			elements.push({
				group: 'nodes',
				data: { id: valueId, kind: 'value', label: value.value },
				position: { x: x + valueIndex * 110, y: 120 }
			});
			elements.push({
				group: 'edges',
				data: {
					id: `${entityId}-${valueId}`,
					source: entityId,
					target: valueId,
					label: relation
				}
			});
		});
		x += width + 40;
	});
	return elements;
}

export function getQueryVariables(items: QueryItem[]): string[] {
	const variables = new Set<string>();
	for (const item of items) {
		const values = item.source && item.target ? [item.nodeId] : [item.value || item.id];
		for (const value of values) {
			if (typeof value === 'string' && variablePattern.test(value)) variables.add(value);
		}
	}
	return [...variables].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

export function hasParallelPredicateVariables(edges: QueryItem[]): boolean {
	const predicatesByEndpoints = new Map<string, Set<string>>();
	for (const edge of edges) {
		const predicate = edge.nodeId;
		if (!predicate || !variablePattern.test(predicate)) continue;
		const subject = edge.sourceValue || edge.source;
		const object = edge.targetValue || edge.target;
		if (!subject || !object || variablePattern.test(subject) || variablePattern.test(object))
			continue;
		const key = JSON.stringify([subject, object]);
		const predicates = predicatesByEndpoints.get(key) || new Set<string>();
		predicates.add(predicate);
		if (predicates.size > 1) return true;
		predicatesByEndpoints.set(key, predicates);
	}
	return false;
}

/** Visual kind of a relation label, derived from the predicate. */
export function relationLabelKind(edge: {
	nodeId?: string | null;
	type?: string | null;
}): 'filter' | 'variable' | 'fixed' {
	if (edge.type === 'filter') return 'filter';
	if (!edge.nodeId || variablePattern.test(edge.nodeId)) return 'variable';
	return 'fixed';
}

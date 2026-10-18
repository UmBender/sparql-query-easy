/**
 * Port of sparql/graph-model.js (FE-032, FE-042): what a stored node is, and
 * the stored data of new nodes. "Element data" is the legacy Cytoscape data
 * shape (`type`, `value`, `filterType`, …) that the canvas renders and the
 * request mapping reads. Colors moved to the design tokens (FE-041).
 */
import { filterLabel, filterTypeOf, type FilterTypeInput } from './query-calculations.js';

export type NodeKindName =
	'iri' | 'literal' | 'class' | 'variable' | 'many' | 'value-variable' | 'unknown';
export type KindData = {
	type?: string;
	color?: string;
	isLink?: boolean;
	filterType?: FilterTypeInput;
	filterValue?: string;
	value?: string;
	label?: string;
};
export type VariableFilter = {
	variableName: string;
	filterType: number | null;
	value: string | null;
};
export type NodeKind = {
	kind: NodeKindName;
	isLink: boolean;
	legacyFilter: boolean;
	filterType: number | null;
};
export type GraphTerm = {
	type: string;
	value: string;
	datatype?: string | null;
	language?: string | null;
};
export type NodeData = {
	id: string;
	value: string;
	label: string;
	type: string;
	isLink?: boolean;
	href?: string;
	color?: string;
};

export function nodeKind(data: KindData | null | undefined): NodeKind {
	const type = data?.type;
	let kind: NodeKindName = 'unknown';
	if (type === 'variable') kind = data?.color ? 'many' : 'variable';
	else if (type === 'label' || type === 'label-filter') kind = 'literal';
	else if (type === 'default') kind = 'class';
	else if (type === 'node') kind = 'iri';
	else if (type === 'value-variable') kind = 'value-variable';
	return {
		kind,
		isLink: Boolean(data?.isLink),
		legacyFilter: type === 'label-filter',
		filterType: filterTypeOf(data?.filterType)
	};
}

/** A variable node, including an "N results" node. */
export function isVariableNode(data: KindData | null | undefined): boolean {
	const { kind } = nodeKind(data);
	return kind === 'variable' || kind === 'many' || kind === 'value-variable';
}

/** A variable restricted to literal values (FE-034). */
export function isValueVariable(data: KindData | null | undefined): boolean {
	return nodeKind(data).kind === 'value-variable';
}

/** A literal value the editor can change (not the older `label-filter` format). */
export function isEditableValue(data: KindData | null | undefined): boolean {
	const { kind, legacyFilter } = nodeKind(data);
	return kind === 'literal' && !legacyFilter;
}

/** Legacy fill color names (kept for the ported oracle; the canvas uses tokens). */
export function nodeColor(data: KindData): string {
	if (data.color) return '#999999';
	const { kind, legacyFilter } = nodeKind(data);
	if (kind === 'variable' || kind === 'many' || kind === 'value-variable') return '#A9D18E';
	if (kind === 'literal') return legacyFilter ? '#7030A0' : '#F48FB1';
	if (kind === 'class') return '#FDD835';
	return '#4472C4';
}

/** Literal values and value variables are boxes, every other node a circle. */
export function nodeShape(data: KindData): { shape: 'rectangle' | 'ellipse'; height: string } {
	const { kind } = nodeKind(data);
	return kind === 'literal' || kind === 'value-variable'
		? { shape: 'rectangle', height: '50px' }
		: { shape: 'ellipse', height: '120px' };
}

/** A value variable keeps the value box with the value's pink as its border (FE-034). */
export function nodeBorder(data: KindData): { width: number; color: string } {
	return isValueVariable(data) ? { width: 4, color: '#F48FB1' } : { width: 0, color: '#000000' };
}

/** The filter a node holds, for display; null when it has none. */
export function nodeFilter(
	data: KindData | null | undefined
): { filterType: number | null; value: string } | null {
	const { kind, filterType } = nodeKind(data);
	if (kind === 'value-variable') {
		const value = String(data?.filterValue ?? '');
		return filterType === null && value === '' ? null : { filterType, value };
	}
	return filterType === null ? null : { filterType, value: String(data?.value ?? '') };
}

/** Request filter of a value variable (FE-034); null for other nodes. */
export function variableFilterOf(data: KindData | null | undefined): VariableFilter | null {
	if (!isValueVariable(data)) return null;
	const filter = nodeFilter(data);
	return {
		variableName: String(data?.value ?? ''),
		filterType: filter?.filterType ?? null,
		value: filter ? filter.value : null
	};
}

/** Label of a value variable: `?` for any value, otherwise `?` and the filter. */
export function valueVariableLabel(filterType: FilterTypeInput, value: string): string {
	const type = filterTypeOf(filterType);
	if (type === null) return value === '' ? '?' : `? = ${value}`;
	return type === 6 ? `? in ${filterLabel(type, value)}` : `? ${filterLabel(type, value)}`;
}

/** Stored fields of a value variable's filter; an empty value means any value. */
export function valueVariableFilterData(
	filterType: FilterTypeInput,
	value: string
): { filterType: number | null; filterValue: string; label: string } {
	const filterValue = String(value ?? '').trim();
	const type = filterValue === '' ? null : filterTypeOf(filterType);
	return { filterType: type, filterValue, label: valueVariableLabel(type, filterValue) };
}

/** Legacy variable test on element IDs: any `?` in the ID counts. */
export function hasVariableMark(id: string | null | undefined): boolean {
	return typeof id === 'string' && id.includes('?');
}

/** A predicate or variable name written as `?name`. */
export function isVariableName(name: string | null | undefined): name is string {
	return typeof name === 'string' && name.startsWith('?');
}

/** An edge stored as a variable relation (green label until bound). */
export function isVariableEdge(data: { type?: string } | null | undefined): boolean {
	return data?.type === 'variable';
}

/** Value of a term in the graph/query model: IRIs keep angle brackets. */
export function termGraphValue(term: GraphTerm): string {
	return term.type === 'iri' ? `<${term.value}>` : term.value;
}

/** Node for a bound RDF term (Assume, Apply to graph); its ID is its value. */
export function nodeDataForTerm(term: GraphTerm, label: string): NodeData {
	const value = termGraphValue(term);
	return { id: value, value, label, type: term.type === 'iri' ? 'node' : 'label' };
}

export function variableNodeData(id: string): NodeData {
	return { id, value: id, label: '?', type: 'variable' };
}

export function valueVariableNodeData(
	id: string
): NodeData & { filterType: null; filterValue: string } {
	return { id, value: id, label: '?', type: 'value-variable', filterType: null, filterValue: '' };
}

export function iriNodeData(id: string, label: string): NodeData {
	return { id, value: id, label, type: 'node' };
}

export function emptyValueNodeData(id: string): NodeData {
	return { id, value: '', label: '', type: 'label' };
}

/** Node for a chosen legacy query result row (results table). */
export function nodeDataForResult({
	id,
	label,
	propertyType,
	propertyClass
}: {
	id: string;
	label: string;
	propertyType?: string | null;
	propertyClass?: string | null;
}): NodeData {
	if (propertyType === 'default')
		return { id, value: propertyClass as string, label, type: 'default' };
	return {
		id,
		value: id,
		label,
		type: propertyType === 'text' || id === label ? 'label' : 'node'
	};
}

/** Node for a relationship value: `text` literal, `many-results` "N results", else IRI. */
export function nodeDataForRelationValue({
	id,
	text,
	valueType,
	predicateLabel
}: {
	id: string;
	text: string;
	valueType?: string | null;
	predicateLabel?: string | null;
}): NodeData {
	const isLink = predicateLabel === 'image';
	const type =
		valueType === 'text' ? 'label' : valueType === 'many-results' ? 'variable' : 'node';
	return {
		id,
		value: id,
		label: isLink ? 'View image' : text,
		type,
		isLink,
		href: text,
		color: valueType === 'many-results' ? 'gray' : ''
	};
}

/** Data a node keeps when it becomes a variable (QUAL-005, FE-034). */
export function convertedVariableData(
	data: Record<string, unknown>,
	id: string
): Record<string, unknown> {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { filterType, filterValue, isLink, href, color, ...rest } = data;
	const literal = nodeKind(data as KindData).kind === 'literal';
	return { ...rest, ...(literal ? valueVariableNodeData(id) : variableNodeData(id)) };
}

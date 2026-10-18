/**
 * Conversion between typed nodes and the legacy element data shape
 * (`legacy/graph-model.ts`). The request mapping, the ported calculations and
 * the canvas read element data; operations that reuse a legacy data builder
 * convert back with `nodeFromData`.
 */
import type {
	GraphElement,
	Position,
	QueryEdge,
	QueryNode,
	RdfTerm,
	ValueFilter
} from './graph.js';
import { valueVariableLabel, type NodeData } from './legacy/graph-model.js';
import { filterTypeOf } from './legacy/query-calculations.js';

/** Legacy Cytoscape data of a node or edge. */
export type ElementData = {
	id: string;
	value?: string;
	label?: string;
	type?: string;
	source?: string;
	target?: string;
	nodeId?: string;
	filterType?: number | null;
	filterValue?: string;
	isLink?: boolean;
	href?: string;
	color?: string;
};

export function nodeData(node: QueryNode): ElementData {
	switch (node.kind) {
		case 'entity':
			return {
				id: node.id,
				value: node.value,
				label: node.label,
				type: 'node',
				...link(node.link)
			};
		case 'class':
			return { id: node.id, value: node.value, label: node.label, type: 'default' };
		case 'variable':
			return {
				id: node.id,
				value: node.name,
				label: node.label,
				type: 'variable',
				...(node.many ? { color: 'gray' } : {})
			};
		case 'value':
			return {
				id: node.id,
				value: node.term.value,
				label: node.label,
				type: node.legacyFilter ? 'label-filter' : 'label',
				...(node.filter !== null ? { filterType: node.filter } : {}),
				...link(node.link)
			};
		case 'valueVariable':
			return {
				id: node.id,
				value: node.name,
				label: node.label,
				type: 'value-variable',
				filterType: node.filter?.code ?? null,
				filterValue: node.filter?.value ?? ''
			};
	}
}

export function edgeData(edge: QueryEdge): ElementData {
	return {
		id: edge.id,
		source: edge.source,
		target: edge.target,
		...(edge.predicate !== null ? { nodeId: edge.predicate } : {}),
		label: edge.label,
		...(edge.variableMark ? { type: 'variable' } : {})
	};
}

export function elementData(element: GraphElement): ElementData {
	return element.kind === 'relation' ? edgeData(element) : nodeData(element);
}

function link(href: string | undefined): Partial<ElementData> {
	return href !== undefined ? { isLink: true, href } : {};
}

/** A typed node from legacy node data (results, relation values, conversions). */
export function nodeFromData(
	data: NodeData & Partial<ElementData>,
	position?: Position
): QueryNode {
	const base = {
		id: data.id,
		label: String(data.label ?? ''),
		...(position ? { position: { ...position } } : {})
	};
	const href = data.isLink ? { link: String(data.href ?? '') } : {};
	switch (data.type) {
		case 'default':
			return { ...base, kind: 'class', value: data.value };
		case 'variable':
			return {
				...base,
				kind: 'variable',
				name: data.value || data.id,
				...(data.color ? { many: true } : {})
			};
		case 'value-variable': {
			const code = filterTypeOf(data.filterType);
			const value = String(data.filterValue ?? '');
			const filter: ValueFilter | null =
				code === null && value === '' ? null : { code: code as ValueFilter['code'], value };
			return { ...base, kind: 'valueVariable', name: data.value || data.id, filter };
		}
		case 'label':
		case 'label-filter':
			return {
				...base,
				kind: 'value',
				term: { type: 'literal', value: data.value },
				filter: filterTypeOf(data.filterType) as ValueFilter['code'],
				...(data.type === 'label-filter' ? { legacyFilter: true } : {}),
				...href
			};
		default:
			return { ...base, kind: 'entity', value: data.value, ...href };
	}
}

/** Node for a bound RDF term (Assume, Apply): its id is its value; literals keep datatype and language. */
export function nodeForTerm(term: RdfTerm, label: string, position?: Position): QueryNode {
	const pos = position ? { position: { ...position } } : {};
	if (term.type === 'iri') {
		const value = `<${term.value}>`;
		return { kind: 'entity', id: value, value, label, ...pos };
	}
	return { kind: 'value', id: term.value, term: { ...term }, filter: null, label, ...pos };
}

/** Label a value variable shows for its filter. */
export function valueVariableNodeLabel(filter: ValueFilter | null): string {
	return valueVariableLabel(filter?.code ?? null, filter?.value ?? '');
}

/**
 * A drawn query as a proposed-task answer or reference (STUDY-006, DEC-014
 * Q5): the request the server runs is derived here with the same mapping as
 * Run Query (`runQueryDecision`), with the answer variable chosen by the user
 * instead of the last one met. The server sets the endpoint and the limit.
 */
import { nodesOf, type QueryGraph, type VariableNode } from './graph.js';
import {
	PARALLEL_PREDICATES_MESSAGE,
	SEPARATE_VARIABLE_GROUPS_MESSAGE,
	hasParallelPredicateVariables,
	selectQueryComponent,
	variableFilterItems,
	whereOf
} from './query.js';
import {
	withVariableFilters,
	type QueryFilter,
	type VariableFilter
} from './legacy/query-calculations.js';

export type AnswerQuery = {
	variableName: string;
	where: QueryFilter[];
	variableFilters?: VariableFilter[];
};

/**
 * The variables that can be an answer: the entity variables (`?` nodes) of
 * the graph's query component, in graph order. Value variables and predicate
 * variables are not offered: their values are literals or predicates, which
 * the answer query does not list.
 */
export function answerVariables(graph: QueryGraph): string[] {
	const { component, ambiguous } = selectQueryComponent(graph);
	if (ambiguous || !component) return [];
	const ids = new Set(component.map((item) => item.id));
	return nodesOf(graph)
		.filter((node): node is VariableNode => node.kind === 'variable' && ids.has(node.id))
		.map((node) => node.name);
}

/** The request for `variableName` over the graph, or why the graph cannot be an answer. */
export function answerQuery(
	graph: QueryGraph,
	variableName: string,
	now?: () => number
): { query: AnswerQuery } | { message: string } {
	const { component, ambiguous } = selectQueryComponent(graph);
	if (ambiguous) return { message: SEPARATE_VARIABLE_GROUPS_MESSAGE };
	if (!component || !component.some((item) => item.kind === 'relation'))
		return { message: 'Draw at least one relation before submitting.' };
	if (hasParallelPredicateVariables(graph, component))
		return { message: PARALLEL_PREDICATES_MESSAGE };
	if (!answerVariables(graph).includes(variableName))
		return { message: 'Choose the variable that holds the answer.' };
	return {
		query: withVariableFilters(
			{ variableName, where: whereOf(graph, component, now) },
			variableFilterItems(component)
		)
	};
}

/**
 * The 403 message of the study routes that store research data until the
 * participant accepted the current consent text (STUDY-008, DEC-015 Q1).
 */
export const CONSENT_REQUIRED = 'consent_required';

/** The consent text as blocks: paragraphs, and runs of `- ` lines as lists. */
export type TextBlock = { kind: 'paragraph'; text: string } | { kind: 'list'; items: string[] };

export function textBlocks(text: string): TextBlock[] {
	const blocks: TextBlock[] = [];
	for (const chunk of text.split(/\n\s*\n/)) {
		const lines = chunk
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);
		if (lines.length === 0) continue;
		if (lines.every((line) => line.startsWith('- '))) {
			blocks.push({ kind: 'list', items: lines.map((line) => line.slice(2).trim()) });
		} else {
			blocks.push({ kind: 'paragraph', text: lines.join(' ') });
		}
	}
	return blocks;
}

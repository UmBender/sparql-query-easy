/**
 * Validation of a query graph (FE-042): typed problems, never exceptions.
 * Run Query refuses the same cases with the same messages (query.ts).
 */
import { edgesOf, nodeById, nodesOf, type QueryGraph } from './graph.js';
import { parseBetween } from './legacy/query-calculations.js';
import {
	hasParallelPredicateVariables,
	PARALLEL_PREDICATES_MESSAGE,
	selectQueryComponent,
	SEPARATE_VARIABLE_GROUPS_MESSAGE
} from './query.js';
import { buildVariableRegistry } from './legacy/query-stages.js';
import { elementData } from './elements.js';

export type ValidationError =
	| { code: 'empty'; message: string }
	| { code: 'separate-variable-groups'; message: string }
	| { code: 'parallel-predicate-variables'; message: string }
	| { code: 'no-variable'; message: string }
	| { code: 'invalid-between'; message: string; nodeId: string }
	| { code: 'dangling-edge'; message: string; edgeId: string };

export function validate(graph: QueryGraph): ValidationError[] {
	const errors: ValidationError[] = [];
	if (!nodesOf(graph).length)
		return [{ code: 'empty', message: 'Add at least one node before running the query.' }];
	for (const edge of edgesOf(graph)) {
		if (!nodeById(graph, edge.source) || !nodeById(graph, edge.target)) {
			errors.push({
				code: 'dangling-edge',
				message: `Relation ${edge.id} points at a missing node.`,
				edgeId: edge.id
			});
		}
	}
	for (const node of nodesOf(graph)) {
		const between =
			(node.kind === 'value' && node.filter === 6 && node.term.value) ||
			(node.kind === 'valueVariable' && node.filter?.code === 6 && node.filter.value);
		if (typeof between === 'string' && !parseBetween(between)) {
			errors.push({
				code: 'invalid-between',
				message: `${node.label || node.id}: between needs min..max.`,
				nodeId: node.id
			});
		}
	}
	const { component, ambiguous } = selectQueryComponent(graph);
	if (ambiguous)
		errors.push({
			code: 'separate-variable-groups',
			message: SEPARATE_VARIABLE_GROUPS_MESSAGE
		});
	else if (component) {
		if (hasParallelPredicateVariables(graph, component)) {
			errors.push({
				code: 'parallel-predicate-variables',
				message: PARALLEL_PREDICATES_MESSAGE
			});
		}
		if (!buildVariableRegistry(component.map(elementData)).length) {
			errors.push({
				code: 'no-variable',
				message: 'Add at least one variable (?) node before running.'
			});
		}
	}
	return errors;
}

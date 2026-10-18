/**
 * Port of sparql/graph-actions.js (FE-042): which actions a node or an edge
 * offers, and the next free predicate-variable name.
 */
import { isEditableValue, isVariableName, nodeKind, type KindData } from './graph-model.js';

export type NodeActionId =
	| 'open-link'
	| 'explore-relationships'
	| 'explore-default'
	| 'run-query'
	| 'add-value-filter'
	| 'edit-filter'
	| 'toggle-boolean'
	| 'edit-value'
	| 'connect-variable-predicate'
	| 'connect-defined-predicate'
	| 'convert-variable'
	| 'remove';
export type EdgeActionId = 'convert-predicate-variable' | 'remove-relation';
export type MenuAction<T extends string = string> = { id: T; label: string; danger?: boolean };

/** Type-specific action first, then value edits, then the common actions. */
export function nodeActions(
	data: KindData,
	hasVariableSource: boolean
): MenuAction<NodeActionId>[] {
	const actions: MenuAction<NodeActionId>[] = [];
	const { kind, isLink } = nodeKind(data);

	if (isLink) {
		actions.push({ id: 'open-link', label: 'Open link' });
	} else if (kind === 'iri') {
		actions.push({ id: 'explore-relationships', label: 'Explore relationships' });
	} else if (kind === 'class') {
		actions.push({ id: 'explore-default', label: 'Explore values' });
	} else if (kind === 'variable' || kind === 'many') {
		actions.push({ id: 'run-query', label: 'Run query' });
		actions.push({ id: 'add-value-filter', label: 'Add value filter' });
	} else if (kind === 'value-variable') {
		actions.push({ id: 'edit-filter', label: 'Edit filter' });
	}

	if (hasVariableSource && (data.label === 'true' || data.label === 'false')) {
		actions.push({ id: 'toggle-boolean', label: 'Toggle Boolean value' });
	}
	if (hasVariableSource && isEditableValue(data)) {
		actions.push({ id: 'edit-value', label: 'Edit value' });
	}

	actions.push({ id: 'connect-variable-predicate', label: 'Connect with variable predicate' });
	actions.push({ id: 'connect-defined-predicate', label: 'Connect with defined predicate' });
	actions.push({ id: 'convert-variable', label: 'Convert to variable' });
	actions.push({ id: 'remove', label: 'Remove', danger: true });
	return actions;
}

/** A relation whose predicate is already a variable cannot be converted again. */
export function edgeActions(data: { nodeId?: string | null }): MenuAction<EdgeActionId>[] {
	const actions: MenuAction<EdgeActionId>[] = isVariableName(data.nodeId)
		? []
		: [{ id: 'convert-predicate-variable', label: 'Convert relation to variable' }];
	return [...actions, { id: 'remove-relation', label: 'Remove relation', danger: true }];
}

/** First `?predicate_<n>` from `sequence` upward that no graph element uses. */
export function nextPredicateVariableName(
	sequence: number,
	isTaken: (name: string) => boolean
): { name: string; sequence: number } {
	let name;
	do {
		name = `?predicate_${sequence++}`;
	} while (isTaken(name));
	return { name, sequence };
}

/**
 * The filter editor's form (FE-045): which filter types a node offers and the
 * Zod schema Superforms validates before Apply. Messages and rules are the
 * legacy editor's (`getModalReplaceContent`, `changeElementStringValue`,
 * `changeValueVariableFilter`).
 */
import { z } from 'zod';
import { nodeData, type QueryNode } from '#lib/domain/index.js';
import { nodeFilter } from '#lib/domain/legacy/graph-model.js';
import { filterTypeOf, parseBetween } from '#lib/domain/legacy/query-calculations.js';
import { BETWEEN_ERROR, NUMBER_ERROR } from '#lib/domain/operations.js';

/** Radio values: `any` (value variables), `''` exact, then the API codes. */
export type FilterChoice = 'any' | '' | '0' | '1' | '2' | '3' | '4' | '5' | '6';
export type EditorMode = 'variable' | 'numeric' | 'text';

export const FILTER_OPTIONS: Record<EditorMode, { value: FilterChoice; label: string }[]> = {
	variable: [
		{ value: 'any', label: 'Any value' },
		{ value: '', label: 'Exact match' },
		{ value: '0', label: 'Starts with' },
		{ value: '1', label: 'Contains' },
		{ value: '2', label: 'At least (≥)' },
		{ value: '3', label: 'At most (≤)' },
		{ value: '6', label: 'Between (min..max, e.g. 40..80)' }
	],
	text: [
		{ value: '', label: 'Exact match' },
		{ value: '0', label: 'Starts with' },
		{ value: '1', label: 'Contains' }
	],
	numeric: [
		{ value: '', label: 'Exactly Equal' },
		{ value: '2', label: 'At least (≥)' },
		{ value: '3', label: 'At most (≤)' },
		{ value: '6', label: 'Between (min..max, e.g. 40..80)' },
		{ value: '4', label: 'MAX' },
		{ value: '5', label: 'MIN' }
	]
};

/**
 * A value variable offers every type but MAX/MIN; a numeric or MAX/MIN/between value the numeric ones,
 * and so does a value whose stored filter only exists for numbers (≥, ≤, MAX, MIN, between), whatever its
 * text: MAX applied with an empty field must reopen with MAX (BUG-010).
 */
export function editorMode(node: QueryNode, text: string): EditorMode {
	if (node.kind === 'valueVariable') return 'variable';
	const stored = filterTypeOf(nodeData(node).filterType);
	if (stored !== null && stored >= 2) return 'numeric';
	const numericOrSpecial =
		(text !== '' && !Number.isNaN(Number(text))) ||
		text === 'MAX' ||
		text === 'MIN' ||
		parseBetween(text) !== null;
	return numericOrSpecial ? 'numeric' : 'text';
}

/** The editor's starting value and filter type (`editValueVariableFilter`, `changeElementStringValueModal`). */
export function editorStart(
	node: QueryNode,
	seed = ''
): { value: string; filterType: FilterChoice } {
	const data = nodeData(node);
	if (node.kind === 'valueVariable') {
		const filter = nodeFilter(data);
		return {
			value: filter ? filter.value : seed,
			filterType:
				filter === null
					? 'any'
					: filter.filterType === null
						? ''
						: (String(filter.filterType) as FilterChoice)
		};
	}
	const stored = filterTypeOf(data.filterType);
	return {
		value: stored === null ? String(data.label ?? '') : String(data.value ?? ''),
		filterType: stored === null ? '' : (String(stored) as FilterChoice)
	};
}

/** Zod schema of the form; value variables also need numbers for At least/At most. */
export function filterSchema(mode: EditorMode) {
	return z
		.object({
			filterType: z.enum(['any', '', '0', '1', '2', '3', '4', '5', '6']),
			value: z.string()
		})
		.superRefine((form, context) => {
			const any =
				form.filterType === 'any' || (mode === 'variable' && form.value.trim() === '');
			if (any) return;
			if (form.filterType === '6' && !parseBetween(form.value))
				context.addIssue({ code: 'custom', path: ['value'], message: BETWEEN_ERROR });
			if (
				mode === 'variable' &&
				(form.filterType === '2' || form.filterType === '3') &&
				!Number.isFinite(Number(form.value.trim()))
			) {
				context.addIssue({ code: 'custom', path: ['value'], message: NUMBER_ERROR });
			}
		});
}

export type FilterForm = z.infer<ReturnType<typeof filterSchema>>;

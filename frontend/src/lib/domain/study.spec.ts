import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	answerQuery,
	answerVariables,
	emptyGraph,
	loadQuery,
	textBlocks,
	type QueryGraph
} from './index.js';
import fireSpeed from './fixtures/fire-speed-at-least-90.query.json?raw';

function graphOf(text: string): QueryGraph {
	const loaded = loadQuery(text);
	if (!('document' in loaded)) throw new Error(loaded.error.message);
	return loaded.document.graph;
}

/** The captured legacy count request with the speed filter (fixtures/legacy/fire-speed-at-least-90). */
const captured = (
	JSON.parse(
		readFileSync(
			new URL(
				'../../../../fixtures/legacy/fire-speed-at-least-90.request.json',
				import.meta.url
			),
			'utf8'
		)
	) as { path: string; body: Record<string, unknown> }[]
).find((item) => item.path === '/api/query/count' && item.body.variableFilters)!.body;

describe('answer query (STUDY-006, DEC-014 Q5)', () => {
	it('offers the entity variables of the query component, not value variables', () => {
		expect(answerVariables(graphOf(fireSpeed))).toEqual(['?pokemon']);
	});

	it('derives the request Run Query sends for the chosen variable', () => {
		const result = answerQuery(graphOf(fireSpeed), '?pokemon');
		expect(result).toEqual({
			query: {
				variableName: captured.variableName,
				where: captured.where,
				variableFilters: captured.variableFilters
			}
		});
	});

	it('explains why a graph cannot be an answer', () => {
		const graph = graphOf(fireSpeed);
		expect(answerQuery(graph, '?speed')).toEqual({
			message: 'Choose the variable that holds the answer.'
		});
		expect(answerQuery(emptyGraph, '?x')).toEqual({
			message: 'Draw at least one relation before submitting.'
		});
	});
});

describe('consent text blocks (STUDY-008)', () => {
	it('splits paragraphs at blank lines and turns runs of "- " lines into lists', () => {
		expect(
			textBlocks('First line\ncontinues.\n\n- one\n- two\n\n\nLast.\n- not a list')
		).toEqual([
			{ kind: 'paragraph', text: 'First line continues.' },
			{ kind: 'list', items: ['one', 'two'] },
			{ kind: 'paragraph', text: 'Last. - not a list' }
		]);
	});

	it('returns no blocks for blank text', () => {
		expect(textBlocks('  \n\n ')).toEqual([]);
	});
});

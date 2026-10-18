import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	addElements,
	emptyGraph,
	loadQuery,
	saveQueryText,
	serializeQuery,
	type QueryDocument
} from './index.js';

const FIXTURES = new URL('./fixtures/', import.meta.url);

const document: QueryDocument = {
	endpoint: { kind: 'builtIn', id: 'PokemonGen1' },
	limit: 150,
	order: ['?pokemon', '?speed'],
	graph: addElements(emptyGraph, [
		{
			kind: 'variable',
			id: '?pokemon',
			name: '?pokemon',
			label: '?',
			position: { x: 1, y: 2 }
		},
		{ kind: 'entity', id: '<https://e/Fire>', value: '<https://e/Fire>', label: 'Fire' },
		{
			kind: 'valueVariable',
			id: '?speed',
			name: '?speed',
			label: '? ≥ 90',
			filter: { code: 2, value: '90' }
		},
		{
			kind: 'value',
			id: '90',
			term: {
				type: 'literal',
				value: '90',
				datatype: 'http://www.w3.org/2001/XMLSchema#integer',
				language: null
			},
			filter: null,
			label: '90'
		},
		{ kind: 'class', id: 'c', value: '<https://e/Pokemon>', label: 'Pokémon' },
		{ kind: 'variable', id: '?node_1', name: '?node_1', label: '3 results', many: true },
		{
			id: 'type',
			source: '?pokemon',
			target: '<https://e/Fire>',
			predicate: '<https://e/hasType>',
			label: 'has type'
		},
		{
			id: 'speed',
			source: '?pokemon',
			target: '?speed',
			predicate: '<https://e/speed>',
			label: 'speed'
		},
		{
			id: 'rel',
			source: '?pokemon',
			target: 'c',
			predicate: '?p',
			label: '?',
			variableMark: true
		},
		{ id: 'loose', source: '?pokemon', target: '90', predicate: null, label: '?' }
	])
};

describe('saved query format v1', () => {
	it('round-trips losslessly', () => {
		const text = saveQueryText(document);
		const loaded = loadQuery(text);
		if (!('document' in loaded)) throw new Error(loaded.error.message);
		expect(loaded.document).toEqual(document);
		expect(saveQueryText(loaded.document)).toBe(text);
		expect(serializeQuery(document).formatVersion).toBe(1);
	});

	it('every checked-in v1 fixture loads and round-trips', () => {
		const files = readdirSync(FIXTURES).filter((name) => name.endsWith('.query.json'));
		expect(files.length).toBeGreaterThan(0);
		for (const name of files) {
			const text = readFileSync(new URL(name, FIXTURES), 'utf8');
			const loaded = loadQuery(text);
			if (!('document' in loaded)) throw new Error(`${name}: ${loaded.error.message}`);
			expect(saveQueryText(loaded.document), name).toBe(text);
		}
	});

	it('rejects files without a version, unknown versions, broken JSON and invalid content with typed errors', () => {
		const legacyExport = JSON.stringify({ elements: { nodes: [], edges: [] }, zoom: 1 });
		expect(loadQuery(legacyExport)).toMatchObject({ error: { code: 'missing-version' } });
		expect(loadQuery('[]')).toMatchObject({ error: { code: 'missing-version' } });
		expect(loadQuery('{')).toMatchObject({ error: { code: 'not-json' } });
		expect(
			loadQuery(JSON.stringify({ ...serializeQuery(document), formatVersion: 2 }))
		).toMatchObject({
			error: { code: 'unsupported-version', version: 2 }
		});
		expect(
			loadQuery(JSON.stringify({ ...serializeQuery(document), formatVersion: '1' }))
		).toMatchObject({ error: { code: 'unsupported-version' } });
		const bad = loadQuery(JSON.stringify({ ...serializeQuery(document), limit: 0 }));
		expect(bad).toMatchObject({ error: { code: 'invalid' } });
		expect('error' in bad && bad.error.code === 'invalid' && bad.error.issues[0]).toMatch(
			/^limit:/
		);
		const saved = serializeQuery(document);
		expect(
			loadQuery(JSON.stringify({ ...saved, nodes: [...saved.nodes, saved.nodes[0]] }))
		).toMatchObject({ error: { code: 'invalid', issues: ['nodes: duplicate id ?pokemon'] } });
		expect(
			loadQuery(
				JSON.stringify({ ...saved, edges: [{ ...saved.edges[0], target: 'nowhere' }] })
			)
		).toMatchObject({ error: { code: 'invalid' } });
		expect(
			loadQuery(JSON.stringify({ ...saved, edges: [{ ...saved.edges[0], id: '?pokemon' }] }))
		).toMatchObject({ error: { code: 'invalid' } });
		expect(loadQuery(JSON.stringify({ ...saved, extra: true }))).toMatchObject({
			error: { code: 'invalid' }
		});
	});
});

/**
 * The versioned saved-query format (FE-042, D6b, D-T4a). Files carry
 * `formatVersion`; the loader dispatches through a migrator chain (only v1
 * today) and rejects files without a version, such as the legacy
 * `query_exported.json` (`cy.json()`), with a typed error.
 */
import { z } from 'zod';
import {
	addElements,
	edgesOf,
	emptyGraph,
	nodesOf,
	type QueryEdge,
	type QueryGraph,
	type QueryNode
} from './graph.js';
import type { Endpoint } from './endpoint.js';

const position = z.object({ x: z.number(), y: z.number() }).strict();
const term = z
	.object({
		type: z.enum(['iri', 'literal', 'bnode']),
		value: z.string(),
		datatype: z.string().nullable().optional(),
		language: z.string().nullable().optional()
	})
	.strict();
const filterCode = z.union([
	z.literal(0),
	z.literal(1),
	z.literal(2),
	z.literal(3),
	z.literal(4),
	z.literal(5),
	z.literal(6)
]);
const base = { id: z.string().min(1), label: z.string(), position: position.optional() };

const node = z.discriminatedUnion('kind', [
	z
		.object({
			...base,
			kind: z.literal('entity'),
			value: z.string(),
			link: z.string().optional()
		})
		.strict(),
	z.object({ ...base, kind: z.literal('class'), value: z.string() }).strict(),
	z
		.object({
			...base,
			kind: z.literal('variable'),
			name: z.string(),
			many: z.boolean().optional()
		})
		.strict(),
	z
		.object({
			...base,
			kind: z.literal('value'),
			term,
			filter: filterCode.nullable(),
			link: z.string().optional(),
			legacyFilter: z.boolean().optional()
		})
		.strict(),
	z
		.object({
			...base,
			kind: z.literal('valueVariable'),
			name: z.string(),
			filter: z.object({ code: filterCode.nullable(), value: z.string() }).strict().nullable()
		})
		.strict()
]);

const edge = z
	.object({
		id: z.string().min(1),
		source: z.string(),
		target: z.string(),
		predicate: z.string().nullable(),
		label: z.string(),
		variableMark: z.boolean().optional()
	})
	.strict();

const endpoint = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('builtIn'), id: z.string() }).strict(),
	z.object({ kind: z.literal('uploaded'), id: z.string() }).strict(),
	z.object({ kind: z.literal('remote'), url: z.string() }).strict()
]);

export const savedQueryV1 = z
	.object({
		formatVersion: z.literal(1),
		endpoint,
		limit: z.number().int().positive(),
		order: z.array(z.string()),
		nodes: z.array(node),
		edges: z.array(edge)
	})
	.strict();

export type SavedQueryV1 = z.infer<typeof savedQueryV1>;
export const CURRENT_FORMAT_VERSION = 1;

/** What a saved query holds once loaded. */
export type QueryDocument = {
	graph: QueryGraph;
	endpoint: Endpoint;
	limit: number;
	order: string[];
};

export type LoadError =
	| { code: 'not-json'; message: string }
	| { code: 'missing-version'; message: string }
	| { code: 'unsupported-version'; message: string; version: unknown }
	| { code: 'invalid'; message: string; issues: string[] };

/**
 * Upgrades a parsed file of version N to N+1. Only v1 exists; a v2 adds
 * `2: (v1) => v2` here and moves CURRENT_FORMAT_VERSION.
 */
const migrators: Record<number, (input: unknown) => unknown> = {};

export function serializeQuery(document: QueryDocument): SavedQueryV1 {
	return {
		formatVersion: 1,
		endpoint: document.endpoint,
		limit: document.limit,
		order: document.order.slice(),
		nodes: nodesOf(document.graph).map((item) => ({ ...item })) as SavedQueryV1['nodes'],
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		edges: edgesOf(document.graph).map(({ kind, ...item }) => item)
	};
}

/** The file text: keys sorted at every level, two-space indentation, final newline. */
export function saveQueryText(document: QueryDocument): string {
	const sort = (value: unknown): unknown => {
		if (Array.isArray(value)) return value.map(sort);
		if (value && typeof value === 'object') {
			return Object.fromEntries(
				Object.keys(value)
					.sort()
					.map((key) => [key, sort((value as Record<string, unknown>)[key])])
			);
		}
		return value;
	};
	return `${JSON.stringify(sort(serializeQuery(document)), null, 2)}\n`;
}

export function loadQuery(text: string): { document: QueryDocument } | { error: LoadError } {
	let input: unknown;
	try {
		input = JSON.parse(text);
	} catch {
		return { error: { code: 'not-json', message: 'Could not parse the JSON file.' } };
	}
	if (!input || typeof input !== 'object' || !('formatVersion' in input)) {
		return {
			error: {
				code: 'missing-version',
				message:
					'This file has no formatVersion. Files exported by the old page (query_exported.json) cannot be loaded.'
			}
		};
	}
	let version = (input as { formatVersion: unknown }).formatVersion;
	while (
		typeof version === 'number' &&
		version < CURRENT_FORMAT_VERSION &&
		migrators[version + 1]
	) {
		input = migrators[version + 1](input);
		version = (input as { formatVersion: unknown }).formatVersion;
	}
	if (version !== CURRENT_FORMAT_VERSION) {
		return {
			error: {
				code: 'unsupported-version',
				message: `Unsupported formatVersion ${String(version)}.`,
				version
			}
		};
	}
	const parsed = savedQueryV1.safeParse(input);
	if (!parsed.success) {
		return {
			error: {
				code: 'invalid',
				message: 'The query file is not valid.',
				issues: parsed.error.issues.map(
					(issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`
				)
			}
		};
	}
	const { nodes, edges, endpoint: where, limit, order } = parsed.data;
	const nodeIds = new Set<string>();
	for (const item of nodes) {
		if (nodeIds.has(item.id)) return invalid(`nodes: duplicate id ${item.id}`);
		nodeIds.add(item.id);
	}
	for (const item of edges) {
		if (nodeIds.has(item.id)) return invalid(`edges: id ${item.id} is also a node id`);
		if (!nodeIds.has(item.source) || !nodeIds.has(item.target))
			return invalid(`edges: ${item.id} points at a missing node`);
	}
	const graph = addElements(emptyGraph, [
		...(nodes as QueryNode[]),
		...(edges as Omit<QueryEdge, 'kind'>[])
	]);
	return { document: { graph, endpoint: where, limit, order } };
}

function invalid(issue: string): { error: LoadError } {
	return { error: { code: 'invalid', message: 'The query file is not valid.', issues: [issue] } };
}

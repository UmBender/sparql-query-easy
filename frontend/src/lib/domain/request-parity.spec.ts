/**
 * FE-042 parity oracle: for the fixtures/legacy scenarios (QUAL-009) the domain
 * builds the same graph with the same steps and its requests must equal the
 * ones the legacy page sent. `where` and `variableFilters` compare as
 * multisets; Date.now() ids compare after the capture's `<tsN>` normalization.
 */
import { describe, expect, it } from 'vitest';
import {
	addElements,
	addValueFilterVariable,
	applyChoices,
	bindVariable,
	chooseResult,
	convertEdgeToVariable,
	emptyGraph,
	exploreValuesRequest,
	funnelInput,
	nodeById,
	nodeForTerm,
	nodeQueryRequest,
	numericProfileRequestFor,
	refreshVariableOrder,
	initialVariableOrder,
	relationshipsRequest,
	runQueryDecision,
	setValueNodeFilter,
	setValueVariableFilter,
	sparqlRequest,
	stageRequestFor,
	textSuggestionRequestFor,
	wantedFilterBadges,
	actualValueRequestFor,
	relationshipValueRequest,
	type QueryContext,
	type QueryGraph,
	type QueryNode,
	type NewEdge,
	type RdfTerm
} from './index.js';
import { moveItem } from './legacy/query-stages.js';
import { filterLabel, filterTypeOf } from './legacy/query-calculations.js';
import { valueVariableFilterData, isVariableName } from './legacy/graph-model.js';
import { loadFixture } from '#lib/testing/fixtures.js';

const fixture = (name: string) => loadFixture(name).requests;
const responses = (name: string) => loadFixture(name).responses;

const PK = 'http://easyquery.example.org/pokemon#';
const iri = (local: string) => `<${PK}${local}>`;
const RDFS_LABEL = '<http://www.w3.org/2000/01/rdf-schema#label>';
const context: QueryContext = { endpointUrl: 'PokemonGen1', limit: 150 };
const NOW = 1_760_000_000_000;

/** Sorted keys, multiset `where`/`variableFilters`, `<tsN>` for Date.now() suffixes. */
function canonical(value: unknown): string {
	const stamps = new Map<string, string>();
	const text = JSON.stringify(value).replace(/(?<=[_-])\d{13}(?!\d)/g, (stamp) => {
		if (!stamps.has(stamp)) stamps.set(stamp, `<ts${stamps.size + 1}>`);
		return stamps.get(stamp)!;
	});
	const sort = (item: unknown, key?: string): unknown => {
		if (Array.isArray(item)) {
			const items = item.map((entry) => sort(entry));
			return key === 'where' || key === 'variableFilters'
				? items
						.map((entry) => JSON.stringify(entry))
						.sort()
						.map((entry) => JSON.parse(entry))
				: items;
		}
		if (item && typeof item === 'object') {
			return Object.fromEntries(
				Object.keys(item)
					.sort()
					.map((name) => [name, sort((item as Record<string, unknown>)[name], name)])
			);
		}
		return item;
	};
	return JSON.stringify(sort(JSON.parse(text)));
}

function expectSent(name: string, path: string, body: unknown) {
	const sent = fixture(name)
		.filter((request) => request.path === path)
		.map((request) => canonical(request.body));
	expect(sent, `${name}: ${path}`).toContain(canonical(body));
}

type Spec =
	| {
			kind: 'variable' | 'iri' | 'literal' | 'value-variable' | 'class';
			id: string;
			label?: string;
			value?: string;
			filterType?: number | null;
			classIri?: string;
	  }
	| { edge: { id: string; source: string; target: string; nodeId: string; label: string } };

/** The capture's addGraph (frontend-tests/fixtures-capture/capture.spec.mjs) with typed nodes. */
function build(items: Spec[], graph: QueryGraph = emptyGraph): QueryGraph {
	let column = 0;
	const elements = items.map((item): QueryNode | NewEdge => {
		if ('edge' in item) {
			const { id, source, target, nodeId, label } = item.edge;
			return {
				id,
				source,
				target,
				predicate: nodeId,
				label,
				...(isVariableName(nodeId) ? { variableMark: true } : {})
			};
		}
		const position = { x: 150 + (column % 4) * 260, y: 150 + Math.floor(column / 4) * 200 };
		column++;
		const { kind, id, label = '', filterType = null, value = '' } = item;
		if (kind === 'variable') return { kind: 'variable', id, name: id, label: '?', position };
		if (kind === 'iri') return { kind: 'entity', id, value: id, label, position };
		if (kind === 'class') return { kind: 'class', id, value: item.classIri!, label, position };
		if (kind === 'literal') {
			return {
				kind: 'value',
				id,
				term: { type: 'literal', value },
				filter: filterTypeOf(filterType) as never,
				label: filterLabel(filterType, value),
				position
			};
		}
		const data = valueVariableFilterData(filterType, value);
		return {
			kind: 'valueVariable',
			id,
			name: id,
			label: data.label,
			filter:
				data.filterValue === ''
					? null
					: { code: data.filterType as never, value: data.filterValue },
			position
		};
	});
	return addElements(graph, elements);
}

const edge = (id: string, source: string, target: string, nodeId: string, label: string): Spec => ({
	edge: { id, source, target, nodeId, label }
});

function order(graph: QueryGraph, previous = initialVariableOrder) {
	return refreshVariableOrder(previous, graph, context.endpointUrl).state;
}

/** Run Query: the first stage request for the current order. */
function firstStage(graph: QueryGraph, stageOrder: string[]) {
	const decision = runQueryDecision(graph, stageOrder, context);
	if (decision.kind !== 'staged') throw new Error(`expected a staged run, got ${decision.kind}`);
	return { decision, request: stageRequestFor(decision, 0, [], 0, context) };
}

function badgeRequests(graph: QueryGraph, stageOrder: string[]): unknown[] {
	return [...wantedFilterBadges(graph, stageOrder, null, context).values()].flatMap(
		(badge): unknown[] =>
			badge.kind === 'count' ? [badge.before, badge.after] : [badge.request]
	);
}

function sparql(graph: QueryGraph) {
	const result = sparqlRequest(graph, context);
	if (!('request' in result)) throw new Error(result.message);
	return result.request;
}

describe('requests equal the legacy fixtures', () => {
	it('fire-speed-at-least-90: badge counts, stage 1 and View SPARQL', () => {
		const graph = build([
			{ kind: 'variable', id: '?pokemon' },
			{ kind: 'iri', id: iri('FireType'), label: 'Fire' },
			{ kind: 'value-variable', id: '?speed', filterType: 2, value: '90' },
			edge('type', '?pokemon', iri('FireType'), iri('hasType'), 'has type'),
			edge('speed', '?pokemon', '?speed', iri('speed'), 'speed')
		]);
		const stageOrder = order(graph).order;
		expect(stageOrder).toEqual(['?pokemon', '?speed']);
		for (const request of badgeRequests(graph, stageOrder))
			expectSent('fire-speed-at-least-90', '/api/query/count', request);
		expect(badgeRequests(graph, stageOrder)).toHaveLength(2);
		expectSent(
			'fire-speed-at-least-90',
			'/api/query/stage',
			firstStage(graph, stageOrder).request
		);
		expectSent('fire-speed-at-least-90', '/api/query/sparql', sparql(graph));
	});

	it('run-query-two-stage-apply: both stages, Apply, then View SPARQL without a variable', () => {
		const name = 'run-query-two-stage-apply';
		let graph = build([
			{ kind: 'variable', id: '?pokemon' },
			{ kind: 'iri', id: iri('CharmanderFamily'), label: 'Charmander family' },
			{ kind: 'variable', id: '?type' },
			edge(
				'family',
				'?pokemon',
				iri('CharmanderFamily'),
				iri('inEvolutionFamily'),
				'in evolution family'
			),
			edge('type', '?pokemon', '?type', iri('hasType'), 'has type')
		]);
		const state = order(graph);
		const { decision, request } = firstStage(graph, state.order);
		expectSent(name, '/api/query/stage', request);
		const charizard: RdfTerm = {
			type: 'iri',
			value: `${PK}Charizard`,
			datatype: null,
			language: null
		};
		const flying: RdfTerm = {
			type: 'iri',
			value: `${PK}FlyingType`,
			datatype: null,
			language: null
		};
		expectSent(
			name,
			'/api/query/stage',
			stageRequestFor(
				decision,
				1,
				[{ variableName: '?pokemon', term: charizard }],
				0,
				context
			)
		);
		graph = applyChoices(graph, state.registry, [
			{ variableName: '?pokemon', term: charizard, label: 'Charizard' },
			{ variableName: '?type', term: flying, label: 'Flying' }
		]);
		expectSent(name, '/api/query/sparql', sparql(graph));
	});

	it('view-sparql-only and the exact, starts-with, contains value nodes', () => {
		const water = build([
			{ kind: 'variable', id: '?pokemon' },
			{ kind: 'iri', id: iri('WaterType'), label: 'Water' },
			{ kind: 'literal', id: 'speed-value', value: '50', filterType: 3 },
			edge('type', '?pokemon', iri('WaterType'), iri('hasType'), 'has type'),
			edge('speed', '?pokemon', 'speed-value', iri('speed'), 'speed')
		]);
		for (const request of badgeRequests(water, order(water).order))
			expectSent('view-sparql-only', '/api/query/count', request);
		expectSent('view-sparql-only', '/api/query/sparql', sparql(water));

		const exact = build([
			{ kind: 'variable', id: '?pokemon' },
			{ kind: 'iri', id: iri('GrassType'), label: 'Grass' },
			{ kind: 'literal', id: 'stage-value', value: '3' },
			edge('type', '?pokemon', iri('GrassType'), iri('hasType'), 'has type'),
			edge('stage', '?pokemon', 'stage-value', iri('evolutionStage'), 'evolution stage')
		]);
		expectSent(
			'filter-exact-literal',
			'/api/query/stage',
			firstStage(exact, order(exact).order).request
		);
		expectSent('filter-exact-literal', '/api/query/sparql', sparql(exact));

		const starts = build([
			{ kind: 'variable', id: '?pokemon' },
			{ kind: 'literal', id: 'name-value', value: 'Char', filterType: 0 },
			edge('name', '?pokemon', 'name-value', RDFS_LABEL, 'label')
		]);
		expectSent(
			'filter-starts-with',
			'/api/query/stage',
			firstStage(starts, order(starts).order).request
		);

		const contains = build([
			{ kind: 'variable', id: '?pokemon' },
			{ kind: 'literal', id: 'category-value', value: 'Mouse', filterType: 1 },
			edge('category', '?pokemon', 'category-value', iri('category'), 'category')
		]);
		expectSent(
			'filter-contains',
			'/api/query/stage',
			firstStage(contains, order(contains).order).request
		);
	});

	it('numeric-profile-edit-between: histogram, Between applied by Edit value, stage', () => {
		const name = 'numeric-profile-edit-between';
		let graph = build([
			{ kind: 'variable', id: '?pokemon' },
			{ kind: 'iri', id: iri('WaterType'), label: 'Water' },
			{ kind: 'literal', id: 'hp-value', value: '50' },
			edge('type', '?pokemon', iri('WaterType'), iri('hasType'), 'has type'),
			edge('hp', '?pokemon', 'hp-value', iri('hp'), 'hp')
		]);
		expectSent(
			name,
			'/api/query/numeric-profile',
			numericProfileRequestFor(graph, 'hp-value', context)
		);
		expectSent(
			name,
			'/api/query/stage',
			textSuggestionRequestFor(graph, 'hp-value', '80..100', false, context)
		);
		const applied = setValueNodeFilter(graph, 'hp-value', '80..100', '6', NOW);
		if (!applied.graph) throw new Error(applied.error);
		graph = applied.graph;
		expect(nodeById(graph, `node_${NOW}`)?.label).toBe('80–100');
		expectSent(name, '/api/query/stage', firstStage(graph, order(graph).order).request);
		expectSent(name, '/api/query/sparql', sparql(graph));
	});

	it('MAX and MIN ties go through the Run query node action', () => {
		for (const [name, type] of [
			['filter-max-tie', 'Electric'],
			['filter-min-tie', 'Fighting']
		] as const) {
			const graph = build([
				{ kind: 'variable', id: '?pokemon' },
				{ kind: 'iri', id: iri(`${type}Type`), label: type },
				{
					kind: 'literal',
					id: 'attack-value',
					value: name.includes('max') ? 'MAX' : 'MIN',
					filterType: name.includes('max') ? 4 : 5
				},
				edge('type', '?pokemon', iri(`${type}Type`), iri('hasType'), 'has type'),
				edge('attack', '?pokemon', 'attack-value', iri('attack'), 'attack')
			]);
			expectSent(name, '/api/query/stage', firstStage(graph, order(graph).order).request);
			const query = nodeQueryRequest(graph, '?pokemon', context)!;
			expect(query.method).toBe('replaceNodeVariable');
			expectSent(name, '/api/query', query.request);
			expectSent(name, '/api/query/sparql', sparql(graph));
		}
	});

	it('value variables: any value, between and at most reordered, contains reordered', () => {
		const any = build([
			{ kind: 'iri', id: iri('Pikachu'), label: 'Pikachu' },
			{ kind: 'value-variable', id: '?speed' },
			edge('speed', iri('Pikachu'), '?speed', iri('speed'), 'speed')
		]);
		expectSent(
			'value-variable-any',
			'/api/query/stage',
			firstStage(any, order(any).order).request
		);

		const ghosts = build([
			{ kind: 'variable', id: '?pokemon' },
			{ kind: 'iri', id: iri('GhostType'), label: 'Ghost' },
			{ kind: 'value-variable', id: '?weight', filterType: 6, value: '0..1' },
			{ kind: 'value-variable', id: '?hp', filterType: 3, value: '45' },
			edge('type', '?pokemon', iri('GhostType'), iri('hasType'), 'has type'),
			edge('weight', '?pokemon', '?weight', iri('weightKilograms'), 'weight'),
			edge('hp', '?pokemon', '?hp', iri('hp'), 'hp')
		]);
		const ghostOrder = order(ghosts).order;
		expect(ghostOrder).toEqual(['?hp', '?pokemon', '?weight']);
		expectSent(
			'value-variable-between-at-most',
			'/api/query/stage',
			firstStage(ghosts, moveItem(ghostOrder, 1, 0)).request
		);
		for (const request of badgeRequests(ghosts, ghostOrder))
			expectSent('value-variable-between-at-most', '/api/query/count', request);

		const dragons = build([
			{ kind: 'variable', id: '?pokemon' },
			{ kind: 'value-variable', id: '?category', filterType: 1, value: 'Dragon' },
			edge('category', '?pokemon', '?category', iri('category'), 'category')
		]);
		expectSent(
			'value-variable-contains',
			'/api/query/stage',
			firstStage(dragons, moveItem(order(dragons).order, 1, 0)).request
		);
	});

	it('text suggestions: starts with on a value variable, contains with a stand-in variable', () => {
		let psychic = build([
			{ kind: 'variable', id: '?pokemon' },
			{ kind: 'iri', id: iri('PsychicType'), label: 'Psychic' },
			{ kind: 'value-variable', id: '?name' },
			edge('type', '?pokemon', iri('PsychicType'), iri('hasType'), 'has type'),
			edge('name', '?pokemon', '?name', RDFS_LABEL, 'label')
		]);
		expectSent(
			'text-suggestions-starts-with',
			'/api/query/numeric-profile',
			numericProfileRequestFor(psychic, '?name', context)
		);
		expectSent(
			'text-suggestions-starts-with',
			'/api/query/stage',
			textSuggestionRequestFor(psychic, '?name', 'Ka', true, context)
		);
		psychic = setValueVariableFilter(psychic, '?name', 'Kadabra', '').graph!;
		expectSent(
			'text-suggestions-starts-with',
			'/api/query/stage',
			firstStage(psychic, moveItem(order(psychic).order, 1, 0)).request
		);
		expectSent('text-suggestions-starts-with', '/api/query/sparql', sparql(psychic));

		const category = build([
			{ kind: 'variable', id: '?pokemon' },
			{ kind: 'literal', id: 'category-value', value: 'Seed Pokémon' },
			edge('category', '?pokemon', 'category-value', iri('category'), 'category')
		]);
		expectSent(
			'text-suggestions-contains',
			'/api/query/stage',
			textSuggestionRequestFor(category, 'category-value', 'Flame', false, context)
		);
	});

	it('add-value-filter: value relations, profile seed and histogram, then the filtered stage', () => {
		const name = 'add-value-filter';
		let graph = build([
			{ kind: 'variable', id: '?pokemon' },
			{ kind: 'iri', id: iri('FireType'), label: 'Fire' },
			edge('type', '?pokemon', iri('FireType'), iri('hasType'), 'has type')
		]);
		expectSent(
			name,
			'/api/query/relationships',
			relationshipsRequest(graph, '?pokemon', context, { withLimit: true })
		);
		const added = addValueFilterVariable(graph, '?pokemon', iri('speed'), 'Speed', NOW);
		graph = added.graph;
		expectSent(
			name,
			'/api/query/numeric-profile',
			numericProfileRequestFor(graph, added.id, context, 1)
		);
		expectSent(
			name,
			'/api/query/numeric-profile',
			numericProfileRequestFor(graph, added.id, context)
		);
		expectSent(
			name,
			'/api/query/stage',
			textSuggestionRequestFor(graph, added.id, '100', false, context)
		);
		graph = setValueVariableFilter(graph, added.id, '100', '2').graph!;
		for (const request of badgeRequests(graph, order(graph).order))
			expectSent(name, '/api/query/count', request);
		expectSent(name, '/api/query/stage', firstStage(graph, order(graph).order).request);
		expectSent(name, '/api/query/sparql', sparql(graph));
	});

	it('class Explore values: the full rdfs:domain IRI instead of the rejected prefixed name', () => {
		const graph = build([
			{ kind: 'class', id: 'type-class', classIri: iri('Type'), label: 'Type' }
		]);
		const request = exploreValuesRequest(nodeById(graph, 'type-class')!, context, NOW);
		const [legacy] = fixture('class-explore-values').filter(
			(item) => item.path === '/api/query'
		);
		const legacyBody = legacy.body as { where: { predicate: string }[] };
		expect(legacyBody.where[0].predicate).toBe('rdfs:domain');
		expect(
			canonical({
				...request,
				where: request.where.map((item) => ({ ...item, predicate: 'rdfs:domain' }))
			})
		).toBe(canonical(legacy.body));
		expect(request.where[0].predicate).toBe('<http://www.w3.org/2000/01/rdf-schema#domain>');
	});

	it('explore-relationship-value and node-run-query-table', () => {
		const pikachu = build([{ kind: 'iri', id: iri('Pikachu'), label: 'Pikachu' }]);
		expectSent(
			'explore-relationship-value',
			'/api/query/relationships',
			relationshipsRequest(pikachu, iri('Pikachu'), context, { withLimit: false })
		);
		const rows = (
			responses('explore-relationship-value')[0].body as {
				data: { propertyId: string; propertyLabel: string; propertyType: string }[];
			}
		).data;
		const speed = rows.find((row) => row.propertyLabel === 'Speed')!;
		expectSent(
			'explore-relationship-value',
			'/api/query/relationship-value',
			relationshipValueRequest(iri('Pikachu'), speed, context)
		);

		let raichu = build([
			{ kind: 'variable', id: '?pokemon' },
			{ kind: 'iri', id: iri('Raichu'), label: 'Raichu' },
			edge('evolves', '?pokemon', iri('Raichu'), iri('evolvesInto'), 'evolves into')
		]);
		expectSent(
			'node-run-query-table',
			'/api/query',
			nodeQueryRequest(raichu, '?pokemon', context)!.request
		);
		const chosen = chooseResult(raichu, '?pokemon', {
			id: iri('Pikachu'),
			label: 'Pikachu',
			propertyType: 'objetoClasse'
		});
		raichu = chosen.graph;
		expect(chosen.refetch).toHaveLength(1);
		const [relation] = chosen.refetch;
		expectSent('node-run-query-table', '/api/query/relationship-value', {
			endpointUrl: context.endpointUrl,
			subjectId: iri('Pikachu'),
			predicateId: relation.predicateId,
			isLiteral: !relation.targetIsIri
		});
		expect(raichu.elements.some((element) => element.id === iri('Pikachu'))).toBe(true);
	});

	it('predicate-variable-edge and the three-variable reordered run with Assume', () => {
		let pikachu = build([
			{ kind: 'iri', id: iri('Pikachu'), label: 'Pikachu' },
			{ kind: 'iri', id: iri('ElectricType'), label: 'Electric' },
			edge('relation', iri('Pikachu'), iri('ElectricType'), iri('hasType'), 'has type')
		]);
		pikachu = convertEdgeToVariable(pikachu, 'relation', '?predicate_1');
		expectSent(
			'predicate-variable-edge',
			'/api/query/stage',
			firstStage(pikachu, order(pikachu).order).request
		);

		const name = 'run-query-three-reordered-assume';
		let graph = build([
			{ kind: 'variable', id: '?pokemon' },
			{ kind: 'variable', id: '?next' },
			{ kind: 'variable', id: '?type' },
			edge('evolves', '?pokemon', '?next', iri('evolvesInto'), 'evolves into'),
			edge('type', '?next', '?type', iri('hasType'), 'has type')
		]);
		let state = order(graph);
		const reordered = moveItem(moveItem(state.order, 2, 1), 1, 0);
		expect(reordered).toEqual(['?type', '?next', '?pokemon']);
		expectSent(name, '/api/query/stage', firstStage(graph, reordered).request);
		const fire: RdfTerm = {
			type: 'iri',
			value: `${PK}FireType`,
			datatype: null,
			language: null
		};
		graph = applyChoices(graph, state.registry, [
			{ variableName: '?type', term: fire, label: 'Fire' }
		]);
		state = order(graph, state);
		const remaining = ['?next', '?pokemon'];
		const { decision, request } = firstStage(graph, remaining);
		expectSent(name, '/api/query/stage', request);
		const charizard: RdfTerm = {
			type: 'iri',
			value: `${PK}Charizard`,
			datatype: null,
			language: null
		};
		expectSent(
			name,
			'/api/query/stage',
			stageRequestFor(decision, 1, [{ variableName: '?next', term: charizard }], 0, context)
		);
		graph = applyChoices(graph, state.registry, [
			{ variableName: '?next', term: charizard, label: 'Charizard' },
			{
				variableName: '?pokemon',
				term: { type: 'iri', value: `${PK}Charmeleon` },
				label: 'Charmeleon'
			}
		]);
		expectSent(name, '/api/query/sparql', sparql(graph));
	});

	it('funnel counts with a step switched off, value-variable steps and the actual-value lookup', () => {
		const water = build([
			{ kind: 'variable', id: '?pokemon' },
			{ kind: 'iri', id: iri('WaterType'), label: 'Water' },
			{ kind: 'literal', id: 'speed-value', value: '80', filterType: 2 },
			{ kind: 'literal', id: 'attack-value', value: 'MAX', filterType: 4 },
			edge('type', '?pokemon', iri('WaterType'), iri('hasType'), 'has type'),
			edge('speed', '?pokemon', 'speed-value', iri('speed'), 'speed'),
			edge('attack', '?pokemon', 'attack-value', iri('attack'), 'attack')
		]);
		const stageOrder = order(water).order;
		const all = funnelInput(water, { order: stageOrder, variable: null }, context);
		const off = funnelInput(
			water,
			{ order: stageOrder, variable: null, disabled: ['speed'] },
			context
		);
		expect(all.plan && all.labels).toEqual(['has type = Water', 'speed ≥ 80', 'attack MAX']);
		for (const request of [...all.plan!.requests, ...off.plan!.requests]) {
			if (request) expectSent('funnel-step-off', '/api/query/count', request);
		}

		const grass = build([
			{ kind: 'variable', id: '?pokemon' },
			{ kind: 'iri', id: iri('GrassType'), label: 'Grass' },
			{ kind: 'value-variable', id: '?hp', filterType: 2, value: '80' },
			edge('type', '?pokemon', iri('GrassType'), iri('hasType'), 'has type'),
			edge('hp', '?pokemon', '?hp', iri('hp'), 'hp')
		]);
		const grassFunnel = funnelInput(
			grass,
			{ order: order(grass).order, variable: null },
			context
		);
		expect(grassFunnel.plan!.variableName).toBe('?pokemon');
		for (const request of grassFunnel.plan!.requests)
			if (request) expectSent('funnel-value-variable', '/api/query/count', request);

		const fixed = build([
			{ kind: 'iri', id: iri('Pikachu'), label: 'Pikachu' },
			{ kind: 'literal', id: 'speed-value', value: '100', filterType: 2 },
			{ kind: 'variable', id: '?type' },
			edge('speed', iri('Pikachu'), 'speed-value', iri('speed'), 'speed'),
			edge('type', iri('Pikachu'), '?type', iri('hasType'), 'has type')
		]);
		expectSent(
			'actual-value-check',
			'/api/query/relationship-value',
			actualValueRequestFor(fixed, 'speed-value', context)
		);
		expect(badgeRequests(fixed, order(fixed).order)).toHaveLength(1);
	});

	it('upload-local-graph: the stage runs on the uploaded graph id', () => {
		const graph = build([
			{ kind: 'variable', id: '?pokemon' },
			{ kind: 'iri', id: iri('FireType'), label: 'Fire' },
			edge('type', '?pokemon', iri('FireType'), iri('hasType'), 'has type')
		]);
		const decision = runQueryDecision(graph, ['?pokemon'], context);
		if (decision.kind !== 'staged') throw new Error('expected staged');
		expectSent(
			'upload-local-graph',
			'/api/query/stage',
			stageRequestFor(decision, 0, [], 0, { ...context, endpointUrl: '<uploaded-graph>' })
		);
	});

	it('a bound literal keeps its datatype in the graph but sends its lexical form', () => {
		const graph = build([
			{ kind: 'iri', id: iri('Pikachu'), label: 'Pikachu' },
			{ kind: 'variable', id: '?speed' },
			edge('speed', iri('Pikachu'), '?speed', iri('speed'), 'speed')
		]);
		const term: RdfTerm = {
			type: 'literal',
			value: '90',
			datatype: 'http://www.w3.org/2001/XMLSchema#integer',
			language: null
		};
		const bound = bindVariable(graph, '?speed', nodeForTerm(term, '90')).graph;
		const node = nodeById(bound, '90');
		expect(node).toMatchObject({ kind: 'value', term });
		expect(sparqlRequest(bound, context)).toMatchObject({
			request: { where: [{ object: '90' }] }
		});
	});
});

describe('the parity oracle', () => {
	it('rejects a request that differs from every captured one', () => {
		const graph = build([
			{ kind: 'variable', id: '?pokemon' },
			{ kind: 'iri', id: iri('FireType'), label: 'Fire' },
			{ kind: 'value-variable', id: '?speed', filterType: 2, value: '90' },
			edge('type', '?pokemon', iri('FireType'), iri('hasType'), 'has type'),
			edge('speed', '?pokemon', '?speed', iri('speed'), 'speed')
		]);
		const { request } = firstStage(graph, ['?pokemon', '?speed']);
		expect(() =>
			expectSent('fire-speed-at-least-90', '/api/query/stage', { ...request, limit: 49 })
		).toThrow();
		expect(() =>
			expectSent('fire-speed-at-least-90', '/api/query/stage', {
				...request,
				variableFilters: [{ variableName: '?speed', filterType: 2, value: '91' }]
			})
		).toThrow();
		expect(() =>
			expectSent('fire-speed-at-least-90', '/api/query/stage', {
				...request,
				where: [...request.where].reverse()
			})
		).not.toThrow();
	});
});

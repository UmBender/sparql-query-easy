// @ts-nocheck -- ported oracle (frontend-tests/query-calculations.unit.mjs, FE-042): loose legacy data on purpose.
import assert from './oracle-assert.js';
import { test } from 'vitest';
import {
	actualValueRequest,
	buildFilters,
	countInRange,
	cycleMode,
	filterAccepts,
	filterFunnelPlan,
	filterLabel,
	filterRange,
	filterTypeOf,
	funnelStepCounts,
	funnelStepKind,
	getQueryVariables,
	variableFiltersFor,
	withVariableFilters,
	textSuggestionRequest,
	suggestedTexts,
	hasParallelPredicateVariables,
	histogramBins,
	numericProfileRequest,
	parseBetween,
	rangeFilter,
	rangeFromFilter,
	rangeScale,
	keptEntities,
	possibilityGraph,
	relationLabelKind
} from './query-calculations.js';

test('filters preserve edge order, fixed RDF terms, and numeric filterType zero', () => {
	assert.deepEqual(
		buildFilters([
			{
				source: '?node',
				target: 'target',
				sourceValue: '?node',
				targetValue: '<https://example.test/item>',
				nodeId: '<https://example.test/relation>',
				filterType: '0',
				fallbackPredicate: '<https://example.test/relation>'
			},
			{
				source: 'target',
				target: '?next',
				sourceValue: '<https://example.test/item>',
				targetValue: '?next',
				nodeId: '?predicate',
				filterType: null,
				fallbackPredicate: '?predicate'
			}
		]),
		[
			{
				subject: '?node',
				predicate: '<https://example.test/relation>',
				object: '<https://example.test/item>',
				filterType: 0
			},
			{
				subject: '<https://example.test/item>',
				predicate: '?predicate',
				object: '?next',
				filterType: null
			}
		]
	);
});

test('missing predicate uses the adapter-provided fallback without inventing an ID', () => {
	assert.deepEqual(
		buildFilters([{ source: 'a', target: 'b', fallbackPredicate: '?empty_123' }]),
		[{ subject: 'a', predicate: '?empty_123', object: 'b', filterType: null }]
	);
});

test('query variables are distinct, sorted and require an entire valid variable token', () => {
	assert.deepEqual(
		getQueryVariables([
			{ id: '?zeta', value: '?zeta' },
			{ id: '?alpha', value: '?alpha' },
			{ source: '?zeta', target: '?alpha', nodeId: '?predicate' },
			{ source: '?zeta', target: '?alpha', nodeId: '<https://example.test/relation?ghost>' },
			{ id: '?alpha-bad', value: '?alpha-bad' },
			{ id: '?zeta', value: '?zeta' }
		]),
		['?alpha', '?predicate', '?zeta']
	);
});

test('parallel predicate alternatives differ from repeated bindings and a chain', () => {
	const first = {
		source: 'a',
		target: 'b',
		sourceValue: '<a>',
		targetValue: '<b>',
		nodeId: '?p1'
	};
	assert.equal(hasParallelPredicateVariables([first, { ...first, nodeId: '?p2' }]), true);
	assert.equal(hasParallelPredicateVariables([first, { ...first }]), false);
	assert.equal(
		hasParallelPredicateVariables([
			first,
			{
				...first,
				source: 'b',
				target: 'c',
				sourceValue: '<b>',
				targetValue: '<c>',
				nodeId: '?p2'
			}
		]),
		false
	);
	assert.equal(
		hasParallelPredicateVariables([
			{ ...first, sourceValue: '?subject' },
			{ ...first, sourceValue: '?subject', nodeId: '?p2' }
		]),
		false
	);
});

test('relation label kind follows the predicate, not a stored type flag', () => {
	assert.equal(relationLabelKind({ nodeId: '?predicate_1' }), 'variable');
	assert.equal(relationLabelKind({ nodeId: '?predicate_1', type: 'variable' }), 'variable');
	assert.equal(relationLabelKind({ label: '?' }), 'variable');
	assert.equal(relationLabelKind({ nodeId: '<https://example.test/p>' }), 'fixed');
	assert.equal(
		relationLabelKind({ nodeId: '<https://example.test/p>', type: 'variable' }),
		'fixed'
	);
	assert.equal(relationLabelKind({ nodeId: '<https://example.test/p?ghost>' }), 'fixed');
	assert.equal(relationLabelKind({ nodeId: '?predicate', type: 'filter' }), 'filter');
});

test('an exact match stored as an empty filter type sends no filter', () => {
	assert.equal(filterTypeOf(''), null);
	assert.equal(filterTypeOf(null), null);
	assert.equal(filterTypeOf('0'), 0);
	assert.equal(
		buildFilters([
			{
				source: '?p',
				target: 'n',
				targetValue: '45',
				nodeId: '<https://example.test/speed>',
				filterType: '',
				fallbackPredicate: ''
			}
		])[0].filterType,
		null
	);
});

test('between values need two ordered numbers', () => {
	assert.deepEqual(parseBetween('40..80'), { min: 40, max: 80 });
	assert.deepEqual(parseBetween(' -1.5 .. 2e1 '), { min: -1.5, max: 20 });
	for (const invalid of ['80..40', '40', '40..', 'a..b', '1..2..3', '', null])
		assert.equal(parseBetween(invalid), null);
});

test('filtered literal labels are readable', () => {
	assert.deepEqual(
		[
			[null, '45'],
			['', '45'],
			['0', 'Pi'],
			[1, 'chu'],
			['2', '100'],
			[3, '80'],
			[4, '1'],
			[5, '1'],
			[6, '40..80'],
			[6, 'bad']
		].map(([type, value]) => filterLabel(type, value)),
		[
			'45',
			'45',
			'starts with Pi',
			'contains chu',
			'\u2265 100',
			'\u2264 80',
			'MAX',
			'MIN',
			'40\u201380',
			'bad'
		]
	);
});

test('the numeric profile request leaves out the profiled relation and keeps the rest', () => {
	const edges = [
		{
			source: '?p',
			target: 'fire',
			sourceValue: '?p',
			targetValue: '<https://example.test/Fire>',
			nodeId: '<https://example.test/type>',
			fallbackPredicate: ''
		},
		{
			source: '?p',
			target: 'n1',
			sourceValue: '?p',
			targetValue: '90..100',
			nodeId: '<https://example.test/speed>',
			filterType: '6',
			fallbackPredicate: ''
		}
	];
	assert.deepEqual(
		numericProfileRequest({ endpointUrl: 'PokemonGen1', edges, literalId: 'n1' }),
		{
			endpointUrl: 'PokemonGen1',
			where: [
				{
					subject: '?p',
					predicate: '<https://example.test/type>',
					object: '<https://example.test/Fire>',
					filterType: null
				}
			],
			subject: '?p',
			predicate: '<https://example.test/speed>',
			limit: 500
		}
	);
	assert.equal(numericProfileRequest({ endpointUrl: 'g', edges, literalId: 'missing' }), null);
	assert.equal(
		numericProfileRequest({
			endpointUrl: 'g',
			edges: [{ ...edges[1], nodeId: '?pred' }],
			literalId: 'n1'
		}),
		null
	);
	assert.equal(
		numericProfileRequest({
			endpointUrl: 'g',
			edges: [edges[1], { ...edges[1] }],
			literalId: 'n1'
		}),
		null
	);
});

// FE-028: filter funnel plan.
const pk = 'https://example.test/';
const funnelEdges = [
	{
		id: 'type',
		source: '?p',
		target: 'fire',
		sourceValue: '?p',
		targetValue: `<${pk}Fire>`,
		nodeId: `<${pk}type>`,
		fallbackPredicate: ''
	},
	{
		id: 'evo',
		source: '?p',
		target: '?e',
		sourceValue: '?p',
		targetValue: '?e',
		nodeId: `<${pk}evolvesTo>`,
		fallbackPredicate: ''
	},
	{
		id: 'speed',
		source: '?p',
		target: 'n1',
		sourceValue: '?p',
		targetValue: '90',
		nodeId: `<${pk}speed>`,
		filterType: 2,
		fallbackPredicate: ''
	},
	{
		id: 'hp',
		source: '?p',
		target: 'n2',
		sourceValue: '?p',
		targetValue: '1',
		nodeId: `<${pk}hp>`,
		filterType: '4',
		fallbackPredicate: ''
	}
];
const typeFire = {
	subject: '?p',
	predicate: `<${pk}type>`,
	object: `<${pk}Fire>`,
	filterType: null
};
const typeAny = { subject: '?p', predicate: `<${pk}type>`, object: '?__funnel0', filterType: null };
const evolves = { subject: '?p', predicate: `<${pk}evolvesTo>`, object: '?e', filterType: null };
const speedFast = { subject: '?p', predicate: `<${pk}speed>`, object: '90', filterType: 2 };
const speedAny = {
	subject: '?p',
	predicate: `<${pk}speed>`,
	object: '?__funnel2',
	filterType: null
};
const hpAny = { subject: '?p', predicate: `<${pk}hp>`, object: '?__funnel3', filterType: null };
const hpMax = { subject: '?p', predicate: `<${pk}hp>`, object: '1', filterType: 4 };

test('funnel steps are fixed-value relations; MAX/MIN are extreme steps and variables are structure', () => {
	assert.deepEqual(
		funnelEdges.map((edge) => funnelStepKind(edge)),
		['step', null, 'step', 'extreme']
	);
	assert.equal(funnelStepKind({ ...funnelEdges[0], nodeId: '?pred' }), null);
});

test('the funnel relaxes every step for the base and applies them cumulatively', () => {
	const plan = filterFunnelPlan({
		endpointUrl: 'PokemonGen1',
		edges: funnelEdges,
		variableName: '?p'
	});
	assert.deepEqual(plan.steps, [
		{ key: 'type', index: 0, counted: true, extreme: false },
		{ key: 'speed', index: 1, counted: true, extreme: false },
		{ key: 'hp', index: 2, counted: true, extreme: true }
	]);
	assert.equal(plan.extremes, 1);
	assert.deepEqual(
		plan.requests.map((request) => request?.where),
		[
			[typeAny, evolves, speedAny, hpAny],
			[typeFire, evolves, speedAny, hpAny],
			[typeFire, evolves, speedFast, hpAny],
			[typeFire, evolves, speedFast, hpMax]
		]
	);
	assert.deepEqual(plan.requests[0], {
		endpointUrl: 'PokemonGen1',
		variableName: '?p',
		where: [typeAny, evolves, speedAny, hpAny]
	});
});

test('a disabled step changes later counts only and repeats the previous count', () => {
	const plan = filterFunnelPlan({
		endpointUrl: 'g',
		edges: funnelEdges,
		variableName: '?p',
		disabled: ['type']
	});
	assert.equal(plan.requests[1], null);
	assert.deepEqual(plan.requests[2]?.where, [typeAny, evolves, speedFast, hpAny]);
	assert.deepEqual(plan.requests[3]?.where, [typeAny, evolves, speedFast, hpMax]);
	assert.deepEqual(funnelStepCounts(plan.requests, [151, undefined, 40, 2]), [151, 40, 2]);
	assert.deepEqual(
		funnelStepCounts(plan.requests, [undefined, undefined, undefined, undefined]),
		[null, null, null]
	);
});

test('steps beyond the cap stay relaxed and are not counted', () => {
	const plan = filterFunnelPlan({
		endpointUrl: 'g',
		edges: funnelEdges,
		variableName: '?p',
		maxSteps: 1
	});
	assert.deepEqual(
		plan.steps.map((step) => step.counted),
		[true, false, false]
	);
	assert.equal(plan.requests.length, 2);
	assert.deepEqual(plan.requests[1]?.where, [typeFire, evolves, speedAny, hpAny]);
});

test('the range slider scale steps whole numbers by one and decimals by a fraction of the span', () => {
	assert.deepEqual(rangeScale([45, 90, 130]), { min: 45, max: 130, step: 1, decimals: 0 });
	assert.deepEqual(rangeScale([0.137, 0.9]), { min: 0.137, max: 0.9, step: 0.001, decimals: 3 });
	assert.deepEqual(rangeScale([1.25, 2.5]), { min: 1.25, max: 2.5, step: 0.01, decimals: 2 });
	assert.deepEqual(rangeScale([7]), { min: 7, max: 7, step: 1, decimals: 0 });
	assert.equal(rangeScale([]), null);
	assert.equal(rangeScale([1, NaN]), null);
});

test('histogram bins count every value once and how many the range keeps', () => {
	const bins = histogramBins([0, 1, 4, 5, 9, 10], { min: 0, max: 10, lo: 4, hi: 9, binCount: 2 });
	assert.deepEqual(bins, [
		{ from: 0, to: 5, count: 3, kept: 1 },
		{ from: 5, to: 10, count: 3, kept: 2 }
	]);
	assert.deepEqual(histogramBins([3, 3], { min: 3, max: 3, lo: 3, hi: 3, binCount: 20 }), [
		{ from: 3, to: 3, count: 2, kept: 2 }
	]);
	assert.equal(countInRange([0, 1, 4, 5, 9, 10], 4, 9), 3);
});

test('the range slider writes at least, at most or between and reads them back', () => {
	const scale = rangeScale([20, 150]);
	assert.deepEqual(rangeFilter(scale, 40, 80), { filterType: 6, value: '40..80' });
	assert.deepEqual(rangeFilter(scale, 40, 150), { filterType: 2, value: '40' });
	assert.deepEqual(rangeFilter(scale, 20, 80), { filterType: 3, value: '80' });
	assert.deepEqual(rangeFilter(scale, 20, 150), { filterType: 6, value: '20..150' });
	assert.deepEqual(rangeFilter(rangeScale([0.1, 0.9]), 0.30000000000000004, 0.5), {
		filterType: 6,
		value: '0.3..0.5'
	});
	assert.deepEqual(rangeFromFilter(scale, 6, '40..80'), { lo: 40, hi: 80 });
	assert.deepEqual(rangeFromFilter(scale, '2', '100'), { lo: 100, hi: 150 });
	assert.deepEqual(rangeFromFilter(scale, 3, '500'), { lo: 20, hi: 150 });
	assert.deepEqual(rangeFromFilter(scale, null, '45'), { lo: 20, hi: 150 });
	assert.deepEqual(rangeFromFilter(scale, 2, 'abc'), { lo: 20, hi: 150 });
});

test('only range filters have a fixed set of kept entities to cycle over', () => {
	assert.deepEqual([null, '', 2, '3', 6, 4, 5, 0, 1].map(cycleMode), [
		'exact',
		'exact',
		'atLeast',
		'atMost',
		'between',
		null,
		null,
		null,
		null
	]);
});

test('kept entities are distinct, carry all their kept values and are ordered by value then label', () => {
	const values = [
		{
			entity: { type: 'iri', value: 'https://e/Pikachu' },
			label: 'Pikachu',
			value: '35',
			number: 35
		},
		{ entity: '<https://e/Bulbasaur>', label: null, value: '45', number: 45 },
		{ entity: '<https://e/Abra>', label: 'Abra', value: '25', number: 25 },
		{ entity: '<https://e/Abra>', label: 'Abra', value: '25', number: 25 },
		{ entity: '<https://e/Abra>', label: 'Abra', value: '40', number: 40 },
		{ entity: '<https://e/Arbok>', label: 'Arbok', value: '60', number: 60 },
		{ entity: '<https://e/Pikachu>', label: 'Pikachu', value: '25', number: 25 }
	];
	assert.deepEqual(keptEntities(values, 25, 45), [
		{
			key: 'https://e/Abra',
			label: 'Abra',
			values: [
				{ value: '25', number: 25 },
				{ value: '40', number: 40 }
			]
		},
		{
			key: 'https://e/Pikachu',
			label: 'Pikachu',
			values: [
				{ value: '25', number: 25 },
				{ value: '35', number: 35 }
			]
		},
		{ key: 'https://e/Bulbasaur', label: 'Bulbasaur', values: [{ value: '45', number: 45 }] }
	]);
	assert.deepEqual(keptEntities(values, 70, 80), []);
});

test('the possibility graph puts each shown entity above its values, linked by the relation', () => {
	const elements = possibilityGraph(
		[
			{
				key: 'a',
				label: 'Abra',
				values: [
					{ value: '25', number: 25 },
					{ value: '40', number: 40 }
				]
			},
			{ key: 'p', label: 'Pikachu', values: [{ value: '35', number: 35 }] }
		],
		'HP'
	);
	assert.deepEqual(
		elements.map((item) => [item.data.id, item.data.label, item.position]),
		[
			['e0', 'Abra', { x: 55, y: 0 }],
			['e0v0', '25', { x: 0, y: 120 }],
			['e0-e0v0', 'HP', undefined],
			['e0v1', '40', { x: 110, y: 120 }],
			['e0-e0v1', 'HP', undefined],
			['e1', 'Pikachu', { x: 260, y: 0 }],
			['e1v0', '35', { x: 260, y: 120 }],
			['e1-e1v0', 'HP', undefined]
		]
	);
	assert.deepEqual(possibilityGraph([], 'HP'), []);
});

test('FE-036: only at least, at most and between filters have a numeric range', () => {
	assert.deepEqual(filterRange(2, '100'), { min: 100, max: Infinity });
	assert.deepEqual(filterRange('3', ' 80 '), { min: -Infinity, max: 80 });
	assert.deepEqual(filterRange(6, '40..80'), { min: 40, max: 80 });
	assert.equal(filterRange(6, '80..40'), null);
	assert.equal(filterRange(2, 'abc'), null);
	for (const type of [null, '', 0, 1, 4, 5]) assert.equal(filterRange(type, '45'), null);
});

test('FE-036: an actual value is looked up only for a fixed entity through one fixed relation', () => {
	const edge = {
		source: '<https://e/Pikachu>',
		target: 'n1',
		sourceValue: '<https://e/Pikachu>',
		targetValue: '90',
		nodeId: '<https://e/speed>',
		fallbackPredicate: '?x'
	};
	assert.deepEqual(actualValueRequest({ endpointUrl: 'g', edges: [edge], literalId: 'n1' }), {
		endpointUrl: 'g',
		subjectId: '<https://e/Pikachu>',
		predicateId: '<https://e/speed>',
		isLiteral: true
	});
	assert.equal(
		actualValueRequest({
			endpointUrl: 'g',
			edges: [{ ...edge, source: '?p', sourceValue: '?p' }],
			literalId: 'n1'
		}),
		null
	);
	assert.equal(
		actualValueRequest({
			endpointUrl: 'g',
			edges: [{ ...edge, nodeId: '?pred' }],
			literalId: 'n1'
		}),
		null
	);
	assert.equal(
		actualValueRequest({
			endpointUrl: 'g',
			edges: [{ ...edge, nodeId: '<https://e/a>/<https://e/b>' }],
			literalId: 'n1'
		}),
		null
	);
	assert.equal(
		actualValueRequest({ endpointUrl: 'g', edges: [edge, { ...edge }], literalId: 'n1' }),
		null
	);
	assert.equal(actualValueRequest({ endpointUrl: 'g', edges: [edge], literalId: 'other' }), null);
});

test('FE-036: actual values pass a filter when any of them does', () => {
	assert.equal(filterAccepts(2, '90', ['90']), true);
	assert.equal(filterAccepts(2, '90', ['85']), false);
	assert.equal(filterAccepts(3, '50', ['85', '45']), true);
	assert.equal(filterAccepts(6, '40..80', ['80']), true);
	assert.equal(filterAccepts(6, '40..80', ['not a number']), false);
	assert.equal(filterAccepts(0, 'Pika', ['Pikachu']), true);
	assert.equal(filterAccepts(1, 'chu', ['PIKACHU']), false);
	for (const type of [null, 4, 5]) assert.equal(filterAccepts(type, '90', ['90']), null);
	assert.equal(filterAccepts(6, '80..40', ['60']), null);
});

// FE-034: value-variable filters travel beside where, only for variables it uses.
const hpEdge = {
	id: 'hp',
	source: '?mon',
	target: '?hp',
	targetValue: '?hp',
	nodeId: '<https://e/hp>',
	fallbackPredicate: '?f'
};
const speedEdge = {
	id: 'speed',
	source: '?mon',
	target: '?speed',
	targetValue: '?speed',
	nodeId: '<https://e/speed>',
	fallbackPredicate: '?f'
};
const hpFilter = { variableName: '?hp', filterType: 2, value: '90' };
const speedFilter = { variableName: '?speed', filterType: null, value: null };

test('variable filters are sent only for object variables of the request and only when present', () => {
	const where = buildFilters([hpEdge]);
	assert.deepEqual(variableFiltersFor(where, [hpFilter, speedFilter]), [hpFilter]);
	assert.deepEqual(withVariableFilters({ where }, [hpFilter, speedFilter]), {
		where,
		variableFilters: [hpFilter]
	});
	assert.deepEqual(withVariableFilters({ where }, [speedFilter]), { where });
	assert.deepEqual(withVariableFilters({ where }, []), { where });
});

test('a profile of a value variable leaves out its own filter and keeps the others', () => {
	const request = numericProfileRequest({
		endpointUrl: 'g',
		edges: [hpEdge, speedEdge],
		literalId: '?hp',
		limit: 5,
		variableFilters: [hpFilter, speedFilter]
	});
	assert.deepEqual(request, {
		endpointUrl: 'g',
		where: buildFilters([speedEdge]),
		subject: '?mon',
		predicate: '<https://e/hp>',
		limit: 5,
		variableFilters: [speedFilter]
	});
	assert.equal(
		'variableFilters' in
			numericProfileRequest({ endpointUrl: 'g', edges: [hpEdge], literalId: '?hp' }),
		false
	);
});

test('FE-039: a value-variable filter is a funnel step whose relaxed form keeps the relation without the filter', () => {
	const fixed = {
		id: 'type',
		source: '?mon',
		target: '<https://e/Fire>',
		nodeId: '<https://e/type>',
		fallbackPredicate: '?f'
	};
	const anyFilter = { variableName: '?speed', filterType: null, value: null };
	assert.equal(funnelStepKind(hpEdge, [hpFilter]), 'step');
	assert.equal(funnelStepKind(hpEdge), null);
	assert.equal(funnelStepKind(speedEdge, [anyFilter]), null);
	assert.equal(
		funnelStepKind(hpEdge, [{ variableName: '?hp', filterType: null, value: '45' }]),
		'step'
	);
	assert.equal(funnelStepKind({ ...hpEdge, nodeId: '?pred' }, [hpFilter]), null);

	const plan = filterFunnelPlan({
		endpointUrl: 'g',
		edges: [fixed, hpEdge, speedEdge],
		variableName: '?mon',
		variableFilters: [hpFilter, anyFilter]
	});
	assert.deepEqual(
		plan.steps.map((step) => step.key),
		['type', 'hp']
	);
	const where = buildFilters([fixed, hpEdge, speedEdge]);
	const typeAnyWhere = [{ ...where[0], object: '?__funnel0' }, where[1], where[2]];
	assert.deepEqual(plan.requests, [
		{
			endpointUrl: 'g',
			variableName: '?mon',
			where: typeAnyWhere,
			variableFilters: [anyFilter]
		},
		{ endpointUrl: 'g', variableName: '?mon', where, variableFilters: [anyFilter] },
		{ endpointUrl: 'g', variableName: '?mon', where, variableFilters: [hpFilter, anyFilter] }
	]);
	// Disabling the value-variable step previews the result without its filter.
	const off = filterFunnelPlan({
		endpointUrl: 'g',
		edges: [hpEdge, fixed],
		variableName: '?mon',
		variableFilters: [hpFilter],
		disabled: ['hp']
	});
	assert.equal(off.requests[1], null);
	assert.deepEqual(off.requests[2], {
		endpointUrl: 'g',
		variableName: '?mon',
		where: buildFilters([hpEdge, fixed])
	});
});

test('FE-039: a value variable reached by two relations is one step, on the first relation', () => {
	const second = { ...hpEdge, id: 'hp2', source: '?other' };
	const plan = filterFunnelPlan({
		endpointUrl: 'g',
		edges: [hpEdge, second],
		variableName: '?mon',
		variableFilters: [hpFilter]
	});
	assert.deepEqual(
		plan.steps.map((step) => step.key),
		['hp']
	);
});

// FE-038: text suggestions for a filter editor go through the stage route.
test('a value variable suggests its own values under the rest of the query, without its own filter', () => {
	const nameEdge = {
		id: 'name',
		source: '?mon',
		target: '?name',
		targetValue: '?name',
		nodeId: '<https://e/name>',
		fallbackPredicate: '?f'
	};
	const request = textSuggestionRequest({
		endpointUrl: 'g',
		edges: [nameEdge, hpEdge],
		nodeId: '?name',
		text: 'Pi',
		startsWith: true,
		variableFilters: [hpFilter, { variableName: '?name', filterType: 1, value: 'old' }]
	});
	assert.deepEqual(request, {
		endpointUrl: 'g',
		variableName: '?name',
		where: buildFilters([nameEdge, hpEdge]),
		bindings: [],
		limit: 20,
		offset: 0,
		variableFilters: [hpFilter, { variableName: '?name', filterType: 0, value: 'Pi' }]
	});
	assert.equal(
		textSuggestionRequest({
			endpointUrl: 'g',
			edges: [nameEdge],
			nodeId: '?name',
			text: 'ka',
			startsWith: false
		}).variableFilters[0].filterType,
		1
	);
});

test('a value node is replaced by a stand-in variable that keeps no old filter', () => {
	const literal = {
		id: 'name',
		source: '?mon',
		target: 'n1',
		targetValue: 'Pi',
		nodeId: '<https://e/name>',
		filterType: 0,
		fallbackPredicate: '?f'
	};
	const request = textSuggestionRequest({
		endpointUrl: 'g',
		edges: [literal],
		nodeId: 'n1',
		text: 'Pik',
		startsWith: false
	});
	assert.equal(request.variableName, '?suggestedValue');
	assert.deepEqual(request.where, [
		{
			subject: '?mon',
			predicate: '<https://e/name>',
			object: '?suggestedValue',
			filterType: null
		}
	]);
	assert.deepEqual(request.variableFilters, [
		{ variableName: '?suggestedValue', filterType: 1, value: 'Pik' }
	]);
});

test('no suggestion request without text or without one fixed relation', () => {
	const edge = {
		id: 'e',
		source: '?mon',
		target: '?v',
		targetValue: '?v',
		nodeId: '<https://e/name>',
		fallbackPredicate: '?f'
	};
	assert.equal(
		textSuggestionRequest({
			endpointUrl: 'g',
			edges: [edge],
			nodeId: '?v',
			text: '',
			startsWith: false
		}),
		null
	);
	assert.equal(
		textSuggestionRequest({
			endpointUrl: 'g',
			edges: [],
			nodeId: '?v',
			text: 'a',
			startsWith: false
		}),
		null
	);
	assert.equal(
		textSuggestionRequest({
			endpointUrl: 'g',
			edges: [{ ...edge, nodeId: '?p' }],
			nodeId: '?v',
			text: 'a',
			startsWith: false
		}),
		null
	);
	assert.equal(
		textSuggestionRequest({
			endpointUrl: 'g',
			edges: [edge, { ...edge, id: 'f', source: '?x' }],
			nodeId: '?v',
			text: 'a',
			startsWith: false
		}),
		null
	);
});

test('suggested texts are the distinct literal values of a stage page', () => {
	const literal = (value) => ({ term: { type: 'literal', value } });
	assert.deepEqual(
		suggestedTexts({
			candidates: [
				literal('Pikachu'),
				{ term: { type: 'iri', value: 'https://e/x' } },
				literal('Pidgey'),
				literal('Pikachu')
			]
		}),
		['Pikachu', 'Pidgey']
	);
});

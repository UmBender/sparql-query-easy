import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFilters, filterFunnelPlan, filterLabel, filterTypeOf, funnelStepCounts, funnelStepKind, getQueryVariables, hasParallelPredicateVariables, numericProfileRequest, parseBetween, relationLabelKind } from '../sparql/query-calculations.js';

test('filters preserve edge order, fixed RDF terms, and numeric filterType zero', () => {
  assert.deepEqual(buildFilters([
    { source: '?node', target: 'target', sourceValue: '?node', targetValue: '<https://example.test/item>', nodeId: '<https://example.test/relation>', filterType: '0', fallbackPredicate: '<https://example.test/relation>' },
    { source: 'target', target: '?next', sourceValue: '<https://example.test/item>', targetValue: '?next', nodeId: '?predicate', filterType: null, fallbackPredicate: '?predicate' },
  ]), [
    { subject: '?node', predicate: '<https://example.test/relation>', object: '<https://example.test/item>', filterType: 0 },
    { subject: '<https://example.test/item>', predicate: '?predicate', object: '?next', filterType: null },
  ]);
});

test('missing predicate uses the adapter-provided fallback without inventing an ID', () => {
  assert.deepEqual(buildFilters([{ source: 'a', target: 'b', fallbackPredicate: '?empty_123' }]), [
    { subject: 'a', predicate: '?empty_123', object: 'b', filterType: null },
  ]);
});

test('query variables are distinct, sorted and require an entire valid variable token', () => {
  assert.deepEqual(getQueryVariables([
    { id: '?zeta', value: '?zeta' },
    { id: '?alpha', value: '?alpha' },
    { source: '?zeta', target: '?alpha', nodeId: '?predicate' },
    { source: '?zeta', target: '?alpha', nodeId: '<https://example.test/relation?ghost>' },
    { id: '?alpha-bad', value: '?alpha-bad' },
    { id: '?zeta', value: '?zeta' },
  ]), ['?alpha', '?predicate', '?zeta']);
});

test('parallel predicate alternatives differ from repeated bindings and a chain', () => {
  const first = { source: 'a', target: 'b', sourceValue: '<a>', targetValue: '<b>', nodeId: '?p1' };
  assert.equal(hasParallelPredicateVariables([first, { ...first, nodeId: '?p2' }]), true);
  assert.equal(hasParallelPredicateVariables([first, { ...first }]), false);
  assert.equal(hasParallelPredicateVariables([first, { ...first, source: 'b', target: 'c', sourceValue: '<b>', targetValue: '<c>', nodeId: '?p2' }]), false);
  assert.equal(hasParallelPredicateVariables([{ ...first, sourceValue: '?subject' }, { ...first, sourceValue: '?subject', nodeId: '?p2' }]), false);
});

test('relation label kind follows the predicate, not a stored type flag', () => {
  assert.equal(relationLabelKind({ nodeId: '?predicate_1' }), 'variable');
  assert.equal(relationLabelKind({ nodeId: '?predicate_1', type: 'variable' }), 'variable');
  assert.equal(relationLabelKind({ label: '?' }), 'variable');
  assert.equal(relationLabelKind({ nodeId: '<https://example.test/p>' }), 'fixed');
  assert.equal(relationLabelKind({ nodeId: '<https://example.test/p>', type: 'variable' }), 'fixed');
  assert.equal(relationLabelKind({ nodeId: '<https://example.test/p?ghost>' }), 'fixed');
  assert.equal(relationLabelKind({ nodeId: '?predicate', type: 'filter' }), 'filter');
});

test('an exact match stored as an empty filter type sends no filter', () => {
  assert.equal(filterTypeOf(''), null);
  assert.equal(filterTypeOf(null), null);
  assert.equal(filterTypeOf('0'), 0);
  assert.equal(buildFilters([{ source: '?p', target: 'n', targetValue: '45', nodeId: '<https://example.test/speed>', filterType: '', fallbackPredicate: '' }])[0].filterType, null);
});

test('between values need two ordered numbers', () => {
  assert.deepEqual(parseBetween('40..80'), { min: 40, max: 80 });
  assert.deepEqual(parseBetween(' -1.5 .. 2e1 '), { min: -1.5, max: 20 });
  for (const invalid of ['80..40', '40', '40..', 'a..b', '1..2..3', '', null]) assert.equal(parseBetween(invalid), null);
});

test('filtered literal labels are readable', () => {
  assert.deepEqual(
    [[null, '45'], ['', '45'], ['0', 'Pi'], [1, 'chu'], ['2', '100'], [3, '80'], [4, '1'], [5, '1'], [6, '40..80'], [6, 'bad']].map(([type, value]) => filterLabel(type, value)),
    ['45', '45', 'starts with Pi', 'contains chu', '\u2265 100', '\u2264 80', 'MAX', 'MIN', '40\u201380', 'bad'],
  );
});

test('the numeric profile request leaves out the profiled relation and keeps the rest', () => {
  const edges = [
    { source: '?p', target: 'fire', sourceValue: '?p', targetValue: '<https://example.test/Fire>', nodeId: '<https://example.test/type>', fallbackPredicate: '' },
    { source: '?p', target: 'n1', sourceValue: '?p', targetValue: '90..100', nodeId: '<https://example.test/speed>', filterType: '6', fallbackPredicate: '' },
  ];
  assert.deepEqual(numericProfileRequest({ endpointUrl: 'PokemonGen1', edges, literalId: 'n1' }), {
    endpointUrl: 'PokemonGen1',
    where: [{ subject: '?p', predicate: '<https://example.test/type>', object: '<https://example.test/Fire>', filterType: null }],
    subject: '?p',
    predicate: '<https://example.test/speed>',
    limit: 500,
  });
  assert.equal(numericProfileRequest({ endpointUrl: 'g', edges, literalId: 'missing' }), null);
  assert.equal(numericProfileRequest({ endpointUrl: 'g', edges: [{ ...edges[1], nodeId: '?pred' }], literalId: 'n1' }), null);
  assert.equal(numericProfileRequest({ endpointUrl: 'g', edges: [edges[1], { ...edges[1] }], literalId: 'n1' }), null);
});

// FE-028: filter funnel plan.
const pk = 'https://example.test/';
const funnelEdges = [
  { id: 'type', source: '?p', target: 'fire', sourceValue: '?p', targetValue: `<${pk}Fire>`, nodeId: `<${pk}type>`, fallbackPredicate: '' },
  { id: 'evo', source: '?p', target: '?e', sourceValue: '?p', targetValue: '?e', nodeId: `<${pk}evolvesTo>`, fallbackPredicate: '' },
  { id: 'speed', source: '?p', target: 'n1', sourceValue: '?p', targetValue: '90', nodeId: `<${pk}speed>`, filterType: 2, fallbackPredicate: '' },
  { id: 'hp', source: '?p', target: 'n2', sourceValue: '?p', targetValue: '1', nodeId: `<${pk}hp>`, filterType: '4', fallbackPredicate: '' },
];
const typeFire = { subject: '?p', predicate: `<${pk}type>`, object: `<${pk}Fire>`, filterType: null };
const typeAny = { subject: '?p', predicate: `<${pk}type>`, object: '?__funnel0', filterType: null };
const evolves = { subject: '?p', predicate: `<${pk}evolvesTo>`, object: '?e', filterType: null };
const speedFast = { subject: '?p', predicate: `<${pk}speed>`, object: '90', filterType: 2 };
const speedAny = { subject: '?p', predicate: `<${pk}speed>`, object: '?__funnel2', filterType: null };
const hpAny = { subject: '?p', predicate: `<${pk}hp>`, object: '?__funnel3', filterType: null };

test('funnel steps are fixed-value relations; MAX/MIN only order and variables are structure', () => {
  assert.deepEqual(funnelEdges.map(funnelStepKind), ['step', null, 'step', 'ordering']);
  assert.equal(funnelStepKind({ ...funnelEdges[0], nodeId: '?pred' }), null);
});

test('the funnel relaxes every step for the base and applies them cumulatively', () => {
  const plan = filterFunnelPlan({ endpointUrl: 'PokemonGen1', edges: funnelEdges, variableName: '?p' });
  assert.deepEqual(plan.steps, [{ key: 'type', index: 0, counted: true }, { key: 'speed', index: 1, counted: true }]);
  assert.equal(plan.orderingOnly, 1);
  assert.deepEqual(plan.requests.map(request => request?.where), [
    [typeAny, evolves, speedAny, hpAny],
    [typeFire, evolves, speedAny, hpAny],
    [typeFire, evolves, speedFast, hpAny],
  ]);
  assert.deepEqual(plan.requests[0], { endpointUrl: 'PokemonGen1', variableName: '?p', where: [typeAny, evolves, speedAny, hpAny] });
});

test('a disabled step changes later counts only and repeats the previous count', () => {
  const plan = filterFunnelPlan({ endpointUrl: 'g', edges: funnelEdges, variableName: '?p', disabled: ['type'] });
  assert.equal(plan.requests[1], null);
  assert.deepEqual(plan.requests[2]?.where, [typeAny, evolves, speedFast, hpAny]);
  assert.deepEqual(funnelStepCounts(plan.requests, [151, undefined, 40]), [151, 40]);
  assert.deepEqual(funnelStepCounts(plan.requests, [undefined, undefined, undefined]), [null, null]);
});

test('steps beyond the cap stay relaxed and are not counted', () => {
  const plan = filterFunnelPlan({ endpointUrl: 'g', edges: funnelEdges, variableName: '?p', maxSteps: 1 });
  assert.deepEqual(plan.steps.map(step => step.counted), [true, false]);
  assert.equal(plan.requests.length, 2);
  assert.deepEqual(plan.requests[1]?.where, [typeFire, evolves, speedAny, hpAny]);
});

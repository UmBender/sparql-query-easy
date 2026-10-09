import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFilters, countInRange, cycleMode, cycleStep, filterLabel, filterTypeOf, getQueryVariables, hasParallelPredicateVariables, histogramBins, numericProfileRequest, parseBetween, rangeFilter, rangeFromFilter, rangeScale, relationLabelKind, resultPreviewGraph } from '../sparql/query-calculations.js';

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
  assert.deepEqual(bins, [{ from: 0, to: 5, count: 3, kept: 1 }, { from: 5, to: 10, count: 3, kept: 2 }]);
  assert.deepEqual(histogramBins([3, 3], { min: 3, max: 3, lo: 3, hi: 3, binCount: 20 }), [{ from: 3, to: 3, count: 2, kept: 2 }]);
  assert.equal(countInRange([0, 1, 4, 5, 9, 10], 4, 9), 3);
});

test('the range slider writes at least, at most or between and reads them back', () => {
  const scale = rangeScale([20, 150]);
  assert.deepEqual(rangeFilter(scale, 40, 80), { filterType: 6, value: '40..80' });
  assert.deepEqual(rangeFilter(scale, 40, 150), { filterType: 2, value: '40' });
  assert.deepEqual(rangeFilter(scale, 20, 80), { filterType: 3, value: '80' });
  assert.deepEqual(rangeFilter(scale, 20, 150), { filterType: 6, value: '20..150' });
  assert.deepEqual(rangeFilter(rangeScale([0.1, 0.9]), 0.30000000000000004, 0.5), { filterType: 6, value: '0.3..0.5' });
  assert.deepEqual(rangeFromFilter(scale, 6, '40..80'), { lo: 40, hi: 80 });
  assert.deepEqual(rangeFromFilter(scale, '2', '100'), { lo: 100, hi: 150 });
  assert.deepEqual(rangeFromFilter(scale, 3, '500'), { lo: 20, hi: 150 });
  assert.deepEqual(rangeFromFilter(scale, null, '45'), { lo: 20, hi: 150 });
  assert.deepEqual(rangeFromFilter(scale, 2, 'abc'), { lo: 20, hi: 150 });
});

test('cycling follows the filter type and wraps at the ends', () => {
  const scale = rangeScale([20, 150]);
  const stops = [20, 45, 60, 90, 150];
  const step = (mode, lo, hi, direction = 1) => cycleStep({ mode, stops, scale, lo, hi, direction });
  assert.deepEqual([null, '', 2, '3', 6, 4, 5, 0, 1].map(cycleMode),
    ['exact', 'exact', 'atLeast', 'atMost', 'between', null, null, null, null]);
  // Exact steps the value, also from a value that is not in the profile.
  assert.deepEqual(step('exact', 45, 45), { filterType: null, value: '60', lo: 60, hi: 60 });
  assert.deepEqual(step('exact', 35, 35), { filterType: null, value: '45', lo: 45, hi: 45 });
  assert.deepEqual(step('exact', 35, 35, -1), { filterType: null, value: '20', lo: 20, hi: 20 });
  assert.deepEqual(step('exact', NaN, NaN), { filterType: null, value: '20', lo: 20, hi: 20 });
  assert.deepEqual(step('exact', 150, 150), { filterType: null, value: '20', lo: 20, hi: 20 });
  assert.deepEqual(step('exact', 20, 20, -1), { filterType: null, value: '150', lo: 150, hi: 150 });
  // Thresholds move one bound.
  assert.deepEqual(step('atLeast', 45, 150), { filterType: 2, value: '60', lo: 60, hi: 150 });
  assert.deepEqual(step('atMost', 20, 60), { filterType: 3, value: '90', lo: 20, hi: 90 });
  assert.deepEqual(step('atMost', 20, 60, -1), { filterType: 3, value: '45', lo: 20, hi: 45 });
  // Between keeps its width; the top stops at the scale end.
  assert.deepEqual(step('between', 40, 80), { filterType: 6, value: '45..85', lo: 45, hi: 85 });
  assert.deepEqual(step('between', 90, 130), { filterType: 6, value: '150..150', lo: 150, hi: 150 });
  assert.deepEqual(cycleStep({ mode: 'atLeast', stops: [0.1, 0.25], scale: rangeScale([0.1, 0.25]), lo: 0.1, hi: 0.25, direction: 1 }),
    { filterType: 2, value: '0.25', lo: 0.25, hi: 0.25 });
});

test('the mini result graph links kept entities to their values in order and caps them', () => {
  const values = [
    { entity: { type: 'iri', value: 'https://e/Pikachu' }, label: 'Pikachu', value: '35', number: 35 },
    { entity: '<https://e/Bulbasaur>', label: null, value: '45', number: 45 },
    { entity: '<https://e/Abra>', label: 'Abra', value: '25', number: 25 },
    { entity: '<https://e/Abra>', label: 'Abra', value: '25', number: 25 },
    { entity: '<https://e/Arbok>', label: 'Arbok', value: '60', number: 60 },
  ];
  const graph = resultPreviewGraph(values, 25, 45);
  assert.equal(graph.kept, 4);
  assert.equal(graph.shown, 4);
  const nodes = graph.elements.filter(item => item.group === 'nodes').map(item => `${item.data.kind}:${item.data.label}`);
  assert.deepEqual(nodes, ['value:25', 'entity:Abra', 'value:35', 'entity:Pikachu', 'value:45', 'entity:Bulbasaur']);
  const edges = graph.elements.filter(item => item.group === 'edges').map(item => item.data.id);
  assert.deepEqual(edges, ['e:https://e/Abra->v:25', 'e:https://e/Pikachu->v:35', 'e:https://e/Bulbasaur->v:45']);

  const capped = resultPreviewGraph(values, 0, 100, { cap: 2 });
  assert.deepEqual([capped.kept, capped.shown], [5, 2]);
  assert.equal(resultPreviewGraph(values, 70, 80).elements.length, 0);

  // Many entities on one value wrap into staggered rows of four above it.
  const many = Array.from({ length: 7 }, (_, index) => ({ entity: `<https://e/p${index}>`, label: `P${index}`, value: '10', number: 10 }));
  const elements = resultPreviewGraph(many, 10, 10).elements;
  const positions = elements.filter(item => item.data.kind === 'entity').map(item => item.position);
  assert.deepEqual(positions.slice(3, 5), [{ x: 150, y: -40 }, { x: 25, y: -80 }]);
  assert.deepEqual(elements.find(item => item.data.kind === 'value').position, { x: 75, y: 0 });
});

// Legacy characterization scenarios on PokemonGen1 (QUAL-008 seeds; QUAL-009
// corpus). Each scenario drives the legacy page through `ctx` (capture.spec.mjs)
// and checks its captured result against an independent oracle read from
// pokemon_gen1.ttl. `covers` feeds the coverage table in fixtures/legacy/README.md.
import { label, number, pk, subjectsWith, values } from './pokemon-oracle.mjs';

const iri = local => `<${pk(local)}>`;
const bare = term => term.replace(/^<|>$/g, '');

/** Exchanges of one path, in capture order. */
export function exchangesOf(capture, path) {
  return capture.exchanges.filter(({ request }) => request.path === path);
}

/** Candidate term values of the stage pages for `variableName` with `bindings` committed bindings. */
export function stageValues(capture, variableName, bindings = 0) {
  return exchangesOf(capture, '/api/query/stage')
    .filter(({ request }) => request.body.variableName === variableName && request.body.bindings.length === bindings)
    .flatMap(({ response }) => response.body.data.candidates.map(candidate => candidate.term.value));
}

function sameSet(expect, actual, expected) {
  expect(new Set(actual).size, 'no duplicate values').toBe(actual.length);
  expect([...actual].sort()).toEqual([...expected].sort());
}

export const scenarios = [
  {
    name: 'fire-speed-at-least-90',
    covers: ['entity', 'variable', 'value variable with filter', 'at least (2)', 'Run Query 1 stage + value variable', 'funnel counts (badge)'],
    description: 'Fire-type Pokémon with speed of at least 90 (value variable filter), staged Run Query.',
    async run(ctx) {
      await ctx.addGraph([
        { kind: 'variable', id: '?pokemon' },
        { kind: 'iri', id: iri('FireType'), label: 'Fire' },
        { kind: 'value-variable', id: '?speed', filterType: 2, value: '90' },
        { edge: { id: 'type', source: '?pokemon', target: iri('FireType'), nodeId: iri('hasType'), label: 'has type' } },
        { edge: { id: 'speed', source: '?pokemon', target: '?speed', nodeId: iri('speed'), label: 'speed' } },
      ]);
      await ctx.runQuery();
    },
    check(capture, expect) {
      const expected = subjectsWith(pk('hasType'), pk('FireType')).filter(subject => number(subject, pk('speed')) >= 90);
      expect(expected.map(label).sort()).toEqual(['Arcanine', 'Charizard', 'Magmar', 'Moltres', 'Ninetales', 'Ponyta', 'Rapidash']);
      sameSet(expect, stageValues(capture, '?pokemon'), expected);
    },
  },
  {
    name: 'two-stage-apply',
    covers: ['entity', 'variable', 'Run Query 2 stages', 'choose and apply to graph', 'query after apply'],
    description: 'Members of the Charmander family and their types; choose Charizard, then Flying, Apply to graph.',
    // With no variable left, View SPARQL sends variableName "" and the backend rejects it.
    expectedErrors: { '/api/query/sparql': 400 },
    async run(ctx) {
      await ctx.addGraph([
        { kind: 'variable', id: '?pokemon' },
        { kind: 'iri', id: iri('CharmanderFamily'), label: 'Charmander family' },
        { kind: 'variable', id: '?type' },
        { edge: { id: 'family', source: '?pokemon', target: iri('CharmanderFamily'), nodeId: iri('inEvolutionFamily'), label: 'in evolution family' } },
        { edge: { id: 'type', source: '?pokemon', target: '?type', nodeId: iri('hasType'), label: 'has type' } },
      ]);
      await ctx.runQuery();
      await ctx.choose('Charizard');
      await ctx.choose('Flying');
      await ctx.apply();
    },
    check(capture, expect) {
      const family = subjectsWith(pk('inEvolutionFamily'), pk('CharmanderFamily'));
      sameSet(expect, stageValues(capture, '?pokemon'), family);
      sameSet(expect, stageValues(capture, '?type', 1), values(pk('Charizard'), pk('hasType')).map(item => item.value));
      const [sparql] = exchangesOf(capture, '/api/query/sparql');
      const subjects = sparql.request.body.where.map(item => item.subject);
      expect(new Set(subjects)).toEqual(new Set([iri('Charizard')]));
      expect(sparql.request.body.where.map(item => item.object).sort()).toEqual([iri('CharmanderFamily'), iri('FlyingType')].sort());
      expect(sparql.request.body.variableName).toBe('');
      expect(sparql.response.status).toBe(400);
      expect(capture.sparql).toBe('Could not generate query. Please try again.');
    },
  },
  {
    name: 'view-sparql-only',
    covers: ['entity', 'variable', 'value node with filter', 'at most (3)', 'View SPARQL', 'funnel counts (badge)'],
    description: 'Water-type Pokémon with speed at most 50 as a filtered value node; only View SPARQL.',
    async run(ctx) {
      await ctx.addGraph([
        { kind: 'variable', id: '?pokemon' },
        { kind: 'iri', id: iri('WaterType'), label: 'Water' },
        { kind: 'literal', id: 'speed-value', value: '50', filterType: 3 },
        { edge: { id: 'type', source: '?pokemon', target: iri('WaterType'), nodeId: iri('hasType'), label: 'has type' } },
        { edge: { id: 'speed', source: '?pokemon', target: 'speed-value', nodeId: iri('speed'), label: 'speed' } },
      ]);
    },
    check(capture, expect) {
      const [sparql] = exchangesOf(capture, '/api/query/sparql');
      expect(sparql.request.body.variableName).toBe('?pokemon');
      expect(sparql.request.body.where).toContainEqual({ subject: '?pokemon', predicate: iri('speed'), object: '50', filterType: 3 });
      // The badge counts the filter step: kept = Water-type Pokémon with speed ≤ 50.
      const water = subjectsWith(pk('hasType'), pk('WaterType'));
      const kept = water.filter(subject => number(subject, pk('speed')) <= 50).length;
      const counts = exchangesOf(capture, '/api/query/count').map(({ response }) => response.body.data.count);
      expect(counts).toContain(kept);
      expect(counts).toContain(water.length);
      expect(capture.sparql).toContain('SELECT');
    },
  },
];

export { bare, iri };

// Legacy characterization scenarios on PokemonGen1 (QUAL-008 seeds; QUAL-009
// corpus). Each scenario drives the legacy page through `ctx` (capture.spec.mjs)
// and checks its captured result against an independent oracle read from
// pokemon_gen1.ttl. `covers` feeds the coverage table in fixtures/legacy/README.md.
import { fileURLToPath } from 'node:url';
import { label, loadPokemonGraph, number, pk, subjectsWith, values } from './pokemon-oracle.mjs';

const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label';
const UPLOAD_FILE = new URL('../fixtures/legacy-upload.ttl', import.meta.url);
const pokemon = () => subjectsWith('http://www.w3.org/1999/02/22-rdf-syntax-ns#type', pk('Pokemon'));
const text = (subject, predicate) => values(subject, predicate).map(item => item.value);
const ofType = type => subjectsWith(pk('hasType'), pk(`${type}Type`));

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

/** Result IRIs of the legacy POST /api/query responses (results table). */
export function queryValues(capture) {
  return exchangesOf(capture, '/api/query').flatMap(({ response }) => response.body.data.map(item => bare(item.propertyId)));
}

function sameSet(expect, actual, expected) {
  expect(new Set(actual).size, 'no duplicate values').toBe(actual.length);
  expect([...actual].sort()).toEqual([...expected].sort());
}

export const scenarios = [
  {
    name: 'fire-speed-at-least-90',
    export: true,
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
    name: 'run-query-two-stage-apply',
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
  {
    name: 'filter-exact-literal',
    covers: ['value node exact (no filterType)', 'Run Query 1 stage'],
    description: 'Grass-type Pokémon at evolution stage 3, the stage as an exact value node.',
    async run(ctx) {
      await ctx.addGraph([
        { kind: 'variable', id: '?pokemon' },
        { kind: 'iri', id: iri('GrassType'), label: 'Grass' },
        { kind: 'literal', id: 'stage-value', value: '3' },
        { edge: { id: 'type', source: '?pokemon', target: iri('GrassType'), nodeId: iri('hasType'), label: 'has type' } },
        { edge: { id: 'stage', source: '?pokemon', target: 'stage-value', nodeId: iri('evolutionStage'), label: 'evolution stage' } },
      ]);
      await ctx.runQuery();
    },
    check(capture, expect) {
      const [stage] = exchangesOf(capture, '/api/query/stage');
      expect(stage.request.body.where).toContainEqual({ subject: '?pokemon', predicate: iri('evolutionStage'), object: '3', filterType: null });
      sameSet(expect, stageValues(capture, '?pokemon'), ofType('Grass').filter(subject => number(subject, pk('evolutionStage')) === 3));
    },
  },
  {
    name: 'filter-starts-with',
    covers: ['value node starts with (0)', 'Run Query 1 stage'],
    description: 'Pokémon whose label starts with "Char".',
    async run(ctx) {
      await ctx.addGraph([
        { kind: 'variable', id: '?pokemon' },
        { kind: 'literal', id: 'name-value', value: 'Char', filterType: 0 },
        { edge: { id: 'name', source: '?pokemon', target: 'name-value', nodeId: `<${RDFS_LABEL}>`, label: 'label' } },
      ]);
      await ctx.runQuery();
    },
    check(capture, expect) {
      // The query has no type constraint: every labelled resource counts, the family included.
      const labelled = [...loadPokemonGraph().keys()].filter(subject => label(subject)?.startsWith('Char'));
      expect(labelled.map(label)).toContain('Charmander family');
      sameSet(expect, stageValues(capture, '?pokemon'), labelled);
    },
  },
  {
    name: 'filter-contains',
    covers: ['value node contains (1)', 'Run Query 1 stage'],
    description: 'Pokémon whose category contains "Mouse".',
    async run(ctx) {
      await ctx.addGraph([
        { kind: 'variable', id: '?pokemon' },
        { kind: 'literal', id: 'category-value', value: 'Mouse', filterType: 1 },
        { edge: { id: 'category', source: '?pokemon', target: 'category-value', nodeId: iri('category'), label: 'category' } },
      ]);
      await ctx.runQuery();
    },
    check(capture, expect) {
      sameSet(expect, stageValues(capture, '?pokemon'), pokemon().filter(subject => text(subject, pk('category')).some(value => value.includes('Mouse'))));
    },
  },
  {
    name: 'numeric-profile-edit-between',
    covers: ['value node between (6)', 'Edit value', 'histogram (numeric-profile)', 'Run Query 1 stage'],
    description: 'Water-type Pokémon with HP 80..100, set through Edit value and its histogram editor.',
    async run(ctx) {
      await ctx.addGraph([
        { kind: 'variable', id: '?pokemon' },
        { kind: 'iri', id: iri('WaterType'), label: 'Water' },
        { kind: 'literal', id: 'hp-value', value: '50' },
        { edge: { id: 'type', source: '?pokemon', target: iri('WaterType'), nodeId: iri('hasType'), label: 'has type' } },
        { edge: { id: 'hp', source: '?pokemon', target: 'hp-value', nodeId: iri('hp'), label: 'hp' } },
      ]);
      await ctx.nodeAction('hp-value', 'Edit value');
      await ctx.editor({ filterType: '6', value: '80..100' });
      await ctx.editorApply();
      await ctx.runQuery();
    },
    check(capture, expect) {
      const water = ofType('Water');
      const [profile] = exchangesOf(capture, '/api/query/numeric-profile');
      expect(profile.request.body.predicate).toBe(iri('hp'));
      sameSet(expect, profile.response.body.data.values.map(item => item.entity.value), water);
      sameSet(expect, stageValues(capture, '?pokemon'), water.filter(subject => number(subject, pk('hp')) >= 80 && number(subject, pk('hp')) <= 100));
    },
  },
  {
    name: 'filter-max-tie',
    covers: ['value node MAX (4)', 'MAX tie (BE-004)', 'staged Run Query rejects MAX (400)', 'Run query node action (legacy /api/query)'],
    expectedErrors: { '/api/query/stage': 400 },
    description: 'Electric-type Pokémon with the highest attack: Raichu and Zapdos tie at 90.',
    async run(ctx) {
      await ctx.addGraph([
        { kind: 'variable', id: '?pokemon' },
        { kind: 'iri', id: iri('ElectricType'), label: 'Electric' },
        { kind: 'literal', id: 'attack-value', value: 'MAX', filterType: 4 },
        { edge: { id: 'type', source: '?pokemon', target: iri('ElectricType'), nodeId: iri('hasType'), label: 'has type' } },
        { edge: { id: 'attack', source: '?pokemon', target: 'attack-value', nodeId: iri('attack'), label: 'attack' } },
      ]);
      // Staged Run Query rejects MAX; the variable's Run query action uses /api/query (BE-004).
      await ctx.runQuery();
      await ctx.nodeAction('?pokemon', 'Run query');
      return { rows: await ctx.rowLabels() };
    },
    check(capture, expect) {
      const electric = ofType('Electric');
      const max = Math.max(...electric.map(subject => number(subject, pk('attack'))));
      const tied = electric.filter(subject => number(subject, pk('attack')) === max);
      expect(tied.map(label).sort()).toEqual(['Raichu', 'Zapdos']);
      sameSet(expect, queryValues(capture), tied);
      sameSet(expect, capture.notes.rows, tied.map(label));
    },
  },
  {
    name: 'filter-min-tie',
    covers: ['value node MIN (5)', 'MIN tie (BE-004)', 'staged Run Query rejects MIN (400)', 'Run query node action (legacy /api/query)'],
    expectedErrors: { '/api/query/stage': 400 },
    description: 'Fighting-type Pokémon with the lowest attack: Mankey and Machop tie at 80.',
    async run(ctx) {
      await ctx.addGraph([
        { kind: 'variable', id: '?pokemon' },
        { kind: 'iri', id: iri('FightingType'), label: 'Fighting' },
        { kind: 'literal', id: 'attack-value', value: 'MIN', filterType: 5 },
        { edge: { id: 'type', source: '?pokemon', target: iri('FightingType'), nodeId: iri('hasType'), label: 'has type' } },
        { edge: { id: 'attack', source: '?pokemon', target: 'attack-value', nodeId: iri('attack'), label: 'attack' } },
      ]);
      // Staged Run Query rejects MIN; the variable's Run query action uses /api/query (BE-004).
      await ctx.runQuery();
      await ctx.nodeAction('?pokemon', 'Run query');
      return { rows: await ctx.rowLabels() };
    },
    check(capture, expect) {
      const fighting = ofType('Fighting');
      const min = Math.min(...fighting.map(subject => number(subject, pk('attack'))));
      const tied = fighting.filter(subject => number(subject, pk('attack')) === min);
      expect(tied.map(label).sort()).toEqual(['Machop', 'Mankey']);
      sameSet(expect, queryValues(capture), tied);
      sameSet(expect, capture.notes.rows, tied.map(label));
    },
  },
  {
    name: 'value-variable-any',
    covers: ['entity', 'value variable without filter', 'Run Query 1 variable (literal)'],
    description: "Pikachu's speed through a value variable that keeps any value.",
    async run(ctx) {
      await ctx.addGraph([
        { kind: 'iri', id: iri('Pikachu'), label: 'Pikachu' },
        { kind: 'value-variable', id: '?speed' },
        { edge: { id: 'speed', source: iri('Pikachu'), target: '?speed', nodeId: iri('speed'), label: 'speed' } },
      ]);
      await ctx.runQuery();
    },
    check(capture, expect) {
      const [stage] = exchangesOf(capture, '/api/query/stage');
      expect(stage.request.body.variableFilters).toEqual([{ variableName: '?speed', filterType: null, value: null }]);
      sameSet(expect, stageValues(capture, '?speed'), text(pk('Pikachu'), pk('speed')));
    },
  },
  {
    name: 'value-variable-between-at-most',
    covers: ['value variable between (6)', 'value variable at most (3)', 'Run Query 3 variables reordered'],
    description: 'Ghost-type Pokémon weighing 0..1 kg with HP at most 45, both as value-variable filters.',
    async run(ctx) {
      await ctx.addGraph([
        { kind: 'variable', id: '?pokemon' },
        { kind: 'iri', id: iri('GhostType'), label: 'Ghost' },
        { kind: 'value-variable', id: '?weight', filterType: 6, value: '0..1' },
        { kind: 'value-variable', id: '?hp', filterType: 3, value: '45' },
        { edge: { id: 'type', source: '?pokemon', target: iri('GhostType'), nodeId: iri('hasType'), label: 'has type' } },
        { edge: { id: 'weight', source: '?pokemon', target: '?weight', nodeId: iri('weightKilograms'), label: 'weight' } },
        { edge: { id: 'hp', source: '?pokemon', target: '?hp', nodeId: iri('hp'), label: 'hp' } },
      ]);
      await ctx.moveEarlier('?pokemon');
      await ctx.runQuery();
    },
    check(capture, expect) {
      const expected = ofType('Ghost').filter(subject => number(subject, pk('weightKilograms')) <= 1 && number(subject, pk('hp')) <= 45);
      sameSet(expect, stageValues(capture, '?pokemon'), expected);
    },
  },
  {
    name: 'value-variable-contains',
    covers: ['value variable contains (1)', 'Run Query 1 stage'],
    description: 'Pokémon whose category contains "Dragon", as a value-variable filter.',
    async run(ctx) {
      await ctx.addGraph([
        { kind: 'variable', id: '?pokemon' },
        { kind: 'value-variable', id: '?category', filterType: 1, value: 'Dragon' },
        { edge: { id: 'category', source: '?pokemon', target: '?category', nodeId: iri('category'), label: 'category' } },
      ]);
      await ctx.moveEarlier('?pokemon');
      await ctx.runQuery();
    },
    check(capture, expect) {
      sameSet(expect, stageValues(capture, '?pokemon'), pokemon().filter(subject => text(subject, pk('category')).some(value => value.includes('Dragon'))));
    },
  },
  {
    name: 'text-suggestions-starts-with',
    covers: ['value variable starts with (0)', 'Edit filter', 'text suggestions (stage)', 'suggestion becomes exact', 'Run Query 1 stage'],
    description: 'Psychic-type Pokémon named through a value variable: Starts with "Ka", pick the suggestion Kadabra.',
    async run(ctx) {
      await ctx.addGraph([
        { kind: 'variable', id: '?pokemon' },
        { kind: 'iri', id: iri('PsychicType'), label: 'Psychic' },
        { kind: 'value-variable', id: '?name' },
        { edge: { id: 'type', source: '?pokemon', target: iri('PsychicType'), nodeId: iri('hasType'), label: 'has type' } },
        { edge: { id: 'name', source: '?pokemon', target: '?name', nodeId: `<${RDFS_LABEL}>`, label: 'label' } },
      ]);
      await ctx.nodeAction('?name', 'Edit filter');
      await ctx.editor({ filterType: '0', value: 'Ka' });
      const suggestions = await ctx.suggestions();
      await ctx.chooseSuggestion('Kadabra');
      await ctx.editorApply();
      await ctx.moveEarlier('?pokemon');
      await ctx.runQuery();
      return { suggestions };
    },
    check(capture, expect) {
      const psychic = ofType('Psychic');
      sameSet(expect, capture.notes.suggestions, psychic.map(label).filter(name => name.startsWith('Ka')));
      const suggestion = exchangesOf(capture, '/api/query/stage').find(({ request }) => request.body.variableName === '?name');
      expect(suggestion.request.body.variableFilters).toContainEqual({ variableName: '?name', filterType: 0, value: 'Ka' });
      sameSet(expect, stageValues(capture, '?pokemon'), psychic.filter(subject => label(subject) === 'Kadabra'));
    },
  },
  {
    name: 'text-suggestions-contains',
    covers: ['value node contains (1)', 'Edit value', 'text suggestions with a stand-in variable', 'Run Query 1 stage'],
    description: 'A category value node edited to Contains "Flame"; suggestions use a stand-in variable.',
    async run(ctx) {
      await ctx.addGraph([
        { kind: 'variable', id: '?pokemon' },
        { kind: 'literal', id: 'category-value', value: 'Seed Pokémon' },
        { edge: { id: 'category', source: '?pokemon', target: 'category-value', nodeId: iri('category'), label: 'category' } },
      ]);
      await ctx.nodeAction('category-value', 'Edit value');
      await ctx.editor({ filterType: '1', value: 'Flame' });
      const suggestions = await ctx.suggestions();
      await ctx.editorApply();
      await ctx.runQuery();
      return { suggestions };
    },
    check(capture, expect) {
      const flame = pokemon().filter(subject => text(subject, pk('category')).some(value => value.includes('Flame')));
      sameSet(expect, capture.notes.suggestions, [...new Set(flame.flatMap(subject => text(subject, pk('category'))))]);
      const suggestion = exchangesOf(capture, '/api/query/stage').find(({ request }) => request.body.variableName === '?suggestedValue');
      expect(suggestion.request.body.variableFilters).toEqual([{ variableName: '?suggestedValue', filterType: 1, value: 'Flame' }]);
      sameSet(expect, stageValues(capture, '?pokemon'), flame);
    },
  },
  {
    name: 'add-value-filter',
    covers: ['Add value filter', 'value relations list (relationships)', 'profile seed and histogram (numeric-profile)', 'value variable at least (2)', 'Run Query 1 stage + value variable'],
    description: 'Add value filter on a Fire-type variable: choose speed, set at least 100.',
    async run(ctx) {
      await ctx.addGraph([
        { kind: 'variable', id: '?pokemon' },
        { kind: 'iri', id: iri('FireType'), label: 'Fire' },
        { edge: { id: 'type', source: '?pokemon', target: iri('FireType'), nodeId: iri('hasType'), label: 'has type' } },
      ]);
      await ctx.nodeAction('?pokemon', 'Add value filter');
      await ctx.nodeAction('?pokemon', 'Speed');
      await ctx.editor({ filterType: '2', value: '100' });
      await ctx.editorApply();
      await ctx.runQuery();
      return { graph: await ctx.graph() };
    },
    check(capture, expect) {
      const fire = ofType('Fire');
      const profiles = exchangesOf(capture, '/api/query/numeric-profile');
      expect(profiles.map(({ request }) => request.body.limit)).toEqual([1, 500]);
      expect(profiles[0].response.body.data.min).toBe(Math.min(...fire.map(subject => number(subject, pk('speed')))));
      const valueNode = capture.notes.graph.nodes.find(([, type]) => type === 'value-variable');
      expect(valueNode[2]).toBe('? \u2265 100');
      sameSet(expect, stageValues(capture, '?pokemon'), fire.filter(subject => number(subject, pk('speed')) >= 100));
    },
  },
  {
    name: 'class-explore-values',
    covers: ['class', 'Explore values (legacy /api/query)'],
    description: 'Explore values of the Type class: properties whose domain is Type.',
    // Legacy defect: the page sends the prefixed predicate rdfs:domain, which Ktor rejects.
    expectedErrors: { '/api/query': 400, '/api/query/sparql': 400 },
    async run(ctx) {
      await ctx.addGraph([{ kind: 'class', id: 'type-class', classIri: iri('Type'), label: 'Type' }]);
      await ctx.nodeAction('type-class', 'Explore values');
      return { rows: await ctx.rowLabels() };
    },
    check(capture, expect) {
      const [query] = exchangesOf(capture, '/api/query');
      expect(query.request.body.where[0]).toMatchObject({ predicate: 'rdfs:domain', object: iri('Type') });
      expect(query.response).toEqual({ status: 400, body: { error: 'where.predicate must be an IRI, property path, or SPARQL variable' } });
      // What the action means to list (the full rdfs:domain IRI would return these).
      const domain = [...loadPokemonGraph().keys()].filter(subject => text(subject, 'http://www.w3.org/2000/01/rdf-schema#domain').includes(pk('Type')));
      expect(domain.map(label).sort()).toEqual(['no effect against', 'not very effective against', 'super effective against']);
      expect(capture.notes.rows).toEqual(['No results yet.'].slice(0, capture.notes.rows.length));
    },
  },
  {
    name: 'explore-relationship-value',
    covers: ['entity', 'Explore relationships', 'relationship value node'],
    description: "Explore Pikachu's relationships and add its speed value.",
    expectedErrors: { '/api/query/sparql': 400 },
    async run(ctx) {
      await ctx.addGraph([{ kind: 'iri', id: iri('Pikachu'), label: 'Pikachu' }]);
      await ctx.nodeAction(iri('Pikachu'), 'Explore relationships');
      await ctx.clickRow('Speed');
      return { graph: await ctx.graph() };
    },
    check(capture, expect) {
      const [relationships] = exchangesOf(capture, '/api/query/relationships');
      const predicates = [...loadPokemonGraph().get(pk('Pikachu')).keys()];
      expect(relationships.response.body.data.map(item => bare(item.propertyId))).toEqual(expect.arrayContaining([pk('speed'), pk('hasType')]));
      expect(relationships.response.body.data.every(item => predicates.includes(bare(item.propertyId)))).toBe(true);
      const [value] = exchangesOf(capture, '/api/query/relationship-value');
      expect(value.request.body).toMatchObject({ subjectId: iri('Pikachu'), predicateId: iri('speed'), isLiteral: true });
      expect(capture.notes.graph.nodes).toContainEqual(['90', 'label', '90']);
      expect(capture.notes.graph.edges).toEqual([[iri('Pikachu'), iri('speed'), '90']]);
    },
  },
  {
    name: 'node-run-query-table',
    covers: ['variable', 'Run query node action (legacy /api/query)', 'results-table choice binds and refetches'],
    description: 'Run query on the variable that evolves into Raichu, then choose Pikachu.',
    expectedErrors: { '/api/query/sparql': 400 },
    async run(ctx) {
      await ctx.addGraph([
        { kind: 'variable', id: '?pokemon' },
        { kind: 'iri', id: iri('Raichu'), label: 'Raichu' },
        { edge: { id: 'evolves', source: '?pokemon', target: iri('Raichu'), nodeId: iri('evolvesInto'), label: 'evolves into' } },
      ]);
      await ctx.nodeAction('?pokemon', 'Run query');
      const rows = await ctx.rowLabels();
      await ctx.clickRow('Pikachu');
      return { rows, graph: await ctx.graph() };
    },
    check(capture, expect) {
      const expected = subjectsWith(pk('evolvesInto'), pk('Raichu'));
      sameSet(expect, capture.notes.rows, expected.map(label));
      const [value] = exchangesOf(capture, '/api/query/relationship-value');
      expect(value.request.body).toMatchObject({ subjectId: iri('Pikachu'), predicateId: iri('evolvesInto'), isLiteral: false });
      expect(capture.notes.graph.edges).toEqual([[iri('Pikachu'), iri('evolvesInto'), iri('Raichu')]]);
    },
  },
  {
    name: 'predicate-variable-edge',
    export: true,
    covers: ['entity', 'predicate variable edge (FE-003)', 'Convert relation to variable', 'Run Query 1 stage (predicate)'],
    description: 'Convert the Pikachu → Electric relation to a predicate variable and run it.',
    async run(ctx) {
      await ctx.addGraph([
        { kind: 'iri', id: iri('Pikachu'), label: 'Pikachu' },
        { kind: 'iri', id: iri('ElectricType'), label: 'Electric' },
        { edge: { id: 'relation', source: iri('Pikachu'), target: iri('ElectricType'), nodeId: iri('hasType'), label: 'has type' } },
      ]);
      await ctx.edgeAction('relation', 'Convert relation to variable');
      await ctx.runQuery();
    },
    check(capture, expect) {
      const graph = loadPokemonGraph();
      const expected = [...graph.get(pk('Pikachu'))].filter(([, items]) => items.some(item => item.value === pk('ElectricType'))).map(([predicate]) => predicate);
      sameSet(expect, stageValues(capture, '?predicate_1'), expected);
    },
  },
  {
    name: 'run-query-three-reordered-assume',
    export: true,
    covers: ['Run Query 3 variables reordered', 'Assume', 'next query after Assume', 'choose and apply to graph'],
    description: 'Order ?type, ?next, ?pokemon; Assume ?type = Fire, then choose Charizard and Charmeleon and Apply.',
    expectedErrors: { '/api/query/sparql': 400 },
    async run(ctx) {
      await ctx.addGraph([
        { kind: 'variable', id: '?pokemon' },
        { kind: 'variable', id: '?next' },
        { kind: 'variable', id: '?type' },
        { edge: { id: 'evolves', source: '?pokemon', target: '?next', nodeId: iri('evolvesInto'), label: 'evolves into' } },
        { edge: { id: 'type', source: '?next', target: '?type', nodeId: iri('hasType'), label: 'has type' } },
      ]);
      await ctx.moveEarlier('?type');
      await ctx.moveEarlier('?type');
      await ctx.runQuery();
      await ctx.assume('?type', 'Fire');
      await ctx.choose('Charizard');
      await ctx.choose('Charmeleon');
      await ctx.apply();
      return { graph: await ctx.graph() };
    },
    check(capture, expect) {
      const evolved = pokemon().filter(subject => values(subject, pk('evolvesFrom')).length);
      sameSet(expect, stageValues(capture, '?type'), [...new Set(evolved.flatMap(subject => text(subject, pk('hasType'))))]);
      sameSet(expect, stageValues(capture, '?next'), evolved.filter(subject => text(subject, pk('hasType')).includes(pk('FireType'))));
      sameSet(expect, stageValues(capture, '?pokemon', 1), subjectsWith(pk('evolvesInto'), pk('Charizard')));
      expect(capture.notes.graph.edges).toEqual([
        [iri('Charizard'), iri('hasType'), iri('FireType')],
        [iri('Charmeleon'), iri('evolvesInto'), iri('Charizard')],
      ]);
    },
  },
  {
    name: 'funnel-step-off',
    export: true,
    covers: ['funnel counts (count)', 'funnel step switched off', 'MAX after the other steps'],
    description: 'Water type, speed ≥ 80 and MAX attack as funnel steps; untick the speed step.',
    async run(ctx) {
      await ctx.addGraph([
        { kind: 'variable', id: '?pokemon' },
        { kind: 'iri', id: iri('WaterType'), label: 'Water' },
        { kind: 'literal', id: 'speed-value', value: '80', filterType: 2 },
        { kind: 'literal', id: 'attack-value', value: 'MAX', filterType: 4 },
        { edge: { id: 'type', source: '?pokemon', target: iri('WaterType'), nodeId: iri('hasType'), label: 'has type' } },
        { edge: { id: 'speed', source: '?pokemon', target: 'speed-value', nodeId: iri('speed'), label: 'speed' } },
        { edge: { id: 'attack', source: '?pokemon', target: 'attack-value', nodeId: iri('attack'), label: 'attack' } },
      ]);
      await ctx.openFunnel();
      const before = await ctx.funnelRows();
      await ctx.toggleFunnelStep('speed ≥ 80');
      const after = await ctx.funnelRows();
      return { before, after };
    },
    check(capture, expect) {
      const all = pokemon().length;
      const water = ofType('Water');
      const fast = water.filter(subject => number(subject, pk('speed')) >= 80);
      const top = list => list.filter(subject => number(subject, pk('attack')) === Math.max(...list.map(item => number(item, pk('attack')))));
      expect(capture.notes.before.map(row => row.count)).toEqual([all, water.length, fast.length, top(fast).length].map(String));
      expect(capture.notes.after.map(row => row.count)).toEqual([all, water.length, `${water.length} (off)`, top(water).length].map(String));
      expect(capture.notes.before.map(row => row.label)).toEqual(['With these relations, any value', 'has type = Water', 'speed ≥ 80', 'attack MAX']);
    },
  },
  {
    name: 'funnel-value-variable',
    covers: ['value-variable filter as funnel step (FE-039)', 'funnel counts (count)', 'badge counts'],
    description: 'Grass type and a value variable HP ≥ 80 as funnel steps on ?pokemon.',
    async run(ctx) {
      await ctx.addGraph([
        { kind: 'variable', id: '?pokemon' },
        { kind: 'iri', id: iri('GrassType'), label: 'Grass' },
        { kind: 'value-variable', id: '?hp', filterType: 2, value: '80' },
        { edge: { id: 'type', source: '?pokemon', target: iri('GrassType'), nodeId: iri('hasType'), label: 'has type' } },
        { edge: { id: 'hp', source: '?pokemon', target: '?hp', nodeId: iri('hp'), label: 'hp' } },
      ]);
      await ctx.openFunnel();
      return { rows: await ctx.funnelRows(), badges: await ctx.badges() };
    },
    check(capture, expect) {
      const grass = ofType('Grass');
      const strong = grass.filter(subject => number(subject, pk('hp')) >= 80);
      expect(capture.notes.rows.map(row => row.count)).toEqual([pokemon().length, grass.length, strong.length].map(String));
      expect(capture.notes.badges).toContainEqual({ node: '?hp', kind: 'filter-badge', text: `${strong.length} / ${grass.length}` });
    },
  },
  {
    name: 'actual-value-check',
    covers: ['fixed-entity subject: actual value chip and pass/fail badge (relationship-value)'],
    description: "Pikachu's speed filtered at least 100 shows the actual value 90 and ✗.",
    async run(ctx) {
      await ctx.addGraph([
        { kind: 'iri', id: iri('Pikachu'), label: 'Pikachu' },
        { kind: 'literal', id: 'speed-value', value: '100', filterType: 2 },
        { kind: 'variable', id: '?type' },
        { edge: { id: 'speed', source: iri('Pikachu'), target: 'speed-value', nodeId: iri('speed'), label: 'speed' } },
        { edge: { id: 'type', source: iri('Pikachu'), target: '?type', nodeId: iri('hasType'), label: 'has type' } },
      ]);
      return { badges: await ctx.badges() };
    },
    check(capture, expect) {
      const speed = text(pk('Pikachu'), pk('speed'));
      const [value] = exchangesOf(capture, '/api/query/relationship-value');
      expect(value.request.body).toMatchObject({ subjectId: iri('Pikachu'), predicateId: iri('speed'), isLiteral: true });
      expect(capture.notes.badges).toEqual(expect.arrayContaining([
        { node: 'speed-value', kind: 'filter-actual-value', text: speed.join(', ') },
        { node: 'speed-value', kind: 'filter-badge', text: Number(speed[0]) >= 100 ? '✓' : '✗' },
      ]));
    },
  },
  {
    name: 'upload-local-graph',
    covers: ['Turtle upload (local-database)', 'query on the uploaded graph'],
    description: 'Upload a three-Pokémon Turtle file, then stage the Fire-type ones.',
    async run(ctx) {
      await ctx.upload(fileURLToPath(UPLOAD_FILE));
      await ctx.addGraph([
        { kind: 'variable', id: '?pokemon' },
        { kind: 'iri', id: iri('FireType'), label: 'Fire' },
        { edge: { id: 'type', source: '?pokemon', target: iri('FireType'), nodeId: iri('hasType'), label: 'has type' } },
      ]);
      await ctx.runQuery();
    },
    check(capture, expect) {
      const [upload] = exchangesOf(capture, '/api/local-database');
      expect(upload.request.body).toEqual({ multipart: [{ name: 'ttlFile', filename: 'legacy-upload.ttl' }] });
      const [stage] = exchangesOf(capture, '/api/query/stage');
      expect(stage.request.body.endpointUrl).toBe('<uploaded-graph>');
      const graph = loadPokemonGraph(UPLOAD_FILE);
      const fire = [...graph.keys()].filter(subject => (graph.get(subject).get(pk('hasType')) ?? []).some(item => item.value === pk('FireType')));
      sameSet(expect, stageValues(capture, '?pokemon'), fire);
    },
  },
];

export { bare, iri };

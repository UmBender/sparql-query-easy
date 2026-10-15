---
title: Query Types Proposal
updated: 2026-10-15
---

# Query types proposal

Proposal only (INV-003). Nothing here is approved or implemented; each idea
needs its own card, and the ones marked **decision** need a product choice
before work starts. Examples use the built-in `PokemonGen1` graph (`pk:`) and
Wikidata so they can be tried offline first.

## What the tool can ask today

Evidence: `wikidata/query/WikidataQueryGenerator.kt`, [[../09 - Decisions/Current Contracts]].

- **Conjunctive patterns**: nodes, variable nodes and predicate variables
  joined by triple patterns (one connected component, BUG-004).
- **Literal filters**: exact, starts with, contains, ≥, ≤, between, and
  MAX/MIN with every tie (BE-003, BE-004); value variables carry a filter
  (FE-034).
- **Counting**: distinct count of one variable after each filter step
  (FE-028 funnel, `POST /api/query/count`).
- **Ordered exploration**: bounded staged candidates per variable (DEC-008).
- **Sequence paths**: `PropertyPath` / `IriSequencePath` render `p1/p2`, but
  the graph never builds them.

Every query is therefore "find things that have *all* of these relations".
The gaps below are the common questions a user cannot express.

## Proposed query types

Ranked by value for a non-expert user versus cost. "Shape" is the SPARQL
the generator would add; "In the graph" is a possible notation.

### 1. Optional relation (show it if it exists)

- **Question**: "All Fire Pokémon, and their evolution if they have one."
  Today a missing relation removes the row.
- **Shape**: `OPTIONAL { ?p pk:evolvesInto ?next }`; result rows may leave
  `?next` unbound (binding presence must be preserved, as already required).
- **In the graph**: a relation marked optional (dashed edge, menu action
  *Make optional*).
- **Cost**: low–medium. Generator + one edge flag; staged exploration must
  allow an "(none)" candidate. **Decision**: whether an optional variable
  takes part in the stage order.

### 2. Negation (things that do *not* have a relation)

- **Question**: "Pokémon that are not weak to Water", "players with no
  club", "Pokémon that do not evolve".
- **Shape**: `FILTER NOT EXISTS { ?p pk:weakTo pk:WaterType }` (preferred
  over `MINUS` because it is clearer with variables).
- **In the graph**: red crossed edge, action *Must not have this relation*.
- **Cost**: low–medium. One of the most asked-for features in visual query
  builders and cheap to generate. **Decision**: whether a negated
  relation may point to a variable (then the variable must not be projected).

### 3. Alternatives (either relation or value)

- **Question**: "Pokémon of type Fire **or** Dragon"; "born in São Paulo or
  Rio".
- **Shape**: value alternatives `VALUES ?t { pk:FireType pk:DragonType }`
  (simple); relation alternatives `{ … } UNION { … }` or `(p1|p2)` paths.
- **In the graph**: a node holding several values (chips), like a value
  variable with an *any of* filter.
- **Cost**: value list is low; relation alternatives are higher and were
  explicitly rejected for staged exploration ("parallel predicate
  alternatives are rejected"), so **decision** needed before that part.

### 4. Grouped counts and aggregates

- **Question**: "How many Pokémon per type?", "average attack per type",
  "which club has the most players?".
- **Shape**: `SELECT ?t (COUNT(DISTINCT ?p) AS ?n) … GROUP BY ?t ORDER BY
  DESC(?n)`; also `AVG`, `SUM`, `MIN`, `MAX` over a value variable.
- **In the graph**: pick a variable as *group by* and another as *count* or
  *average*; result shown as a sorted table or bar chart. Extends the
  existing count endpoint rather than the node graph.
- **Cost**: medium. New result shape (not graph nodes), so it needs an API
  contract slice like API-002. High value for data exploration in the thesis.

### 5. Count conditions (HAVING)

- **Question**: "Pokémon weak to at least 3 types", "players who played
  for more than 2 clubs".
- **Shape**: subquery with `GROUP BY ?p HAVING (COUNT(?t) >= 3)`.
- **In the graph**: a numeric filter on an edge (*at least N of these*),
  reusing the ≥/≤/between editor.
- **Cost**: medium; builds on 4.

### 6. Sort and top N

- **Question**: "The 10 fastest Pokémon", "top 5 by attack among Water
  types". MAX/MIN only gives the single extreme (with ties).
- **Shape**: `ORDER BY DESC(?speed) LIMIT 10` (order must be preserved, per
  the RDF/compatibility contract).
- **In the graph**: on a value variable, *Sort descending / ascending* plus
  *Keep top N*; a natural extension of the MAX/MIN editor.
- **Cost**: low–medium. Interacts with staged exploration ordering
  (`ORDER BY $variable` today) — **decision**: does a sort replace the
  candidate order of that stage.

### 7. Comparing two variables

- **Question**: "Pokémon whose attack is greater than their defense",
  "two Pokémon of the same type that are different Pokémon".
- **Shape**: `FILTER (?atk > ?def)`, `FILTER (?a != ?b)`.
- **In the graph**: an edge between two value variables labelled `>`, `<`,
  `=`, `≠` (a comparison edge, not an RDF predicate).
- **Cost**: medium. New edge kind; must go through the checked node/edge
  kind module (FE-032) to avoid the value-node regressions of QUAL-005.

### 8. Transitive and chained paths

- **Question**: "Every later evolution of Bulbasaur" (not just the next
  one), "all subclasses of human" on Wikidata (`P279*`), "instance of city
  or any subclass" (`wdt:P31/wdt:P279*`).
- **Shape**: `pk:evolvesInto+`, `wdt:P31/wdt:P279*`. The `/` sequence already
  exists in the model; `*`/`+` are new.
- **In the graph**: edge toggle *Follow repeatedly* (shown as `p+`).
- **Cost**: low in the generator, but on Wikidata `*` paths can time out;
  needs the bounded limits used by stage requests. Very useful for
  Wikidata class hierarchies.

### 9. Path between two entities

- **Question**: "How is Pikachu connected to Charizard?", "how are these
  two players related?" — discover, not specify, the relation.
- **Shape**: bounded 1–3 hop search, one query per length:
  `?a ?p1 ?x . ?x ?p2 ?b` with both ends fixed, `LIMIT` small.
- **In the graph**: select two nodes → *Find connections* → candidate paths
  are previewed like the possible-graph window (FE-017) and applied on
  choice.
- **Cost**: medium–high and expensive on Wikidata; good for local graphs
  first. Strong demonstration value.

### 10. Text and language options

- **Question**: case-insensitive search ("pika" finds "Pikachu"), labels in
  Portuguese, ends with, whole word.
- **Shape**: `CONTAINS(LCASE(str(?v)), LCASE("pika"))`, `REGEX(…, "i")`,
  `lang(?l) = "pt"`. Today filters are case-sensitive (FE-038) and labels
  are fixed to `en`.
- **In the graph**: *Ignore case* checkbox in the filter editor; a global
  label-language selector.
- **Cost**: low. Language choice is a **decision** (thesis audience is
  Brazilian; football data is `@en`).

### 11. Date and year filters

- **Question**: "players born after 1990", "events in 2014", "people born
  in the 1980s".
- **Shape**: `FILTER (?d >= "1990-01-01"^^xsd:date)`, `YEAR(?d) = 2014`.
  Numeric filters do not apply to dates today.
- **In the graph**: the range/histogram editor (FE-026) with a date axis.
- **Cost**: medium. Little local test data (one `xsd:dateTime` in the
  football graph); mainly a Wikidata feature, so recorded fixtures are
  needed (QUAL-001 pattern).

### 12. Yes/no questions and "does any exist"

- **Question**: "Is there a Pokémon faster than 150?", "is Pikachu weak to
  Ground?".
- **Shape**: `ASK { … }`.
- **In the graph**: *Check* button that answers Yes/No with the example
  that proves it.
- **Cost**: low; mostly UX. Lower priority because a count of 0/≥1 already
  answers it.

### 13. Class-aware start ("all things of a type")

- **Question**: "Start from all Pokémon / all clubs / all humans".
- **Shape**: `?x rdf:type pk:Pokemon` or `?x wdt:P31 wd:Q5`, with class
  suggestions from the data (`SELECT ?c (COUNT(?x) AS ?n) … GROUP BY ?c`).
- **In the graph**: *Add variable of type…* in the toolbar, suggesting
  classes like Search nodes.
- **Cost**: low; it is a normal pattern but a big discoverability gain.

## Recommended order

1. **Negation (2)** and **optional (1)** — the largest expressiveness gain;
   both are single-pattern changes in the generator plus an edge mode.
2. **Sort/top N (6)** and **value alternatives (3, `VALUES` only)** — reuse
   the existing filter editor.
3. **Grouped counts (4)**, then **count conditions (5)** — need a new
   result shape and API contract.
4. **Transitive paths (8)** and **class-aware start (13)** — mostly for
   Wikidata.
5. **Variable comparison (7)**, **path discovery (9)**, **dates (11)**,
   **text options (10)**, **ASK (12)** as demand appears.

## Constraints for any slice

- Keep typed RDF terms and binding presence; unbound OPTIONAL values are not
  empty strings. Compare rows as multisets unless the query has ORDER BY.
- New syntax goes through the application query model and the syntax
  validator, never through raw user SPARQL.
- Offline tests use the built-in graphs or recorded Wikidata fixtures; no
  live calls in ordinary gates.
- New node/edge kinds go through the checked kind module (FE-032) and get
  the node-kind × action regression coverage (QUAL-005).
- Expensive shapes (paths, aggregates on Wikidata) need explicit limits and
  the approved 502 mapping for upstream timeouts.

## Source files

- `src/main/kotlin/com/example/sparqlqueryeasy/wikidata/query/WikidataQueryGenerator.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/application/query/StageQueryService.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/application/query/ResultCountService.kt`
- `src/main/resources/pokemon_gen1.ttl`
- `src/main/resources/futebol_completo.ttl`

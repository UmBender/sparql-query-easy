# Migration Instructions

## Scope and target

- The migration target is Kotlin/JVM with Ktor.
- Apache Jena is the initial replacement candidate for dotNetRDF.
- Preserve observable behavior unless a change is explicitly documented and
  approved.
- Avoid unrelated refactoring during the migration.

## Migration workflow

- Migrate one functional slice at a time.
- Port or create tests together with every migrated component.
- Run compilation, formatting, and the relevant tests after every change.
- Stop a phase if its compatibility tests fail; investigate and resolve the
  failure before continuing.
- Update `MIGRATION.md` after every completed phase.
- Do not update golden test results merely to make failing tests pass. First
  determine whether the implementation or the compatibility expectation is
  wrong; document and explicitly approve any intentional behavior change.

## Boundaries and contracts

- Do not expose Apache Jena types outside the RDF infrastructure package.
- Use application-owned domain types for RDF values and SPARQL results.
- Do not change HTTP, serialization, or SPARQL contracts silently. Document,
  review, and approve any change to routes, status codes, request/response
  shapes, JSON defaults, query text, filtering, ordering, or error behavior.
- Do not assume RDF serialization order or SPARQL result order is stable unless
  the contract explicitly defines that order.
- Document every known difference between dotNetRDF and Apache Jena, including
  parser behavior, IRI/base resolution, blank-node identity, literal handling,
  query semantics, result bindings, ordering, and error behavior.

## External services and tests

- Do not contact live Wikidata in ordinary unit tests. Use recorded fixtures,
  deterministic fakes, or a local test server. Live integration tests must be
  separately identified, opt-in, and never required for normal validation.
- Preserve the existing Wikidata entity/property identifier and label behavior
  unless an approved contract change says otherwise.
- Compatibility tests must cover user-controlled SPARQL values, Turtle parsing,
  RDF node formatting, unbound variables, duplicate results, `DISTINCT`,
  `OPTIONAL`, `FILTER`, property paths, and ordering where relevant.

## Change discipline

- Do not modify production code when the task is documentation, analysis, or
  migration planning only.
- Keep each phase independently reviewable and verifiable.
- Record failed compatibility checks and their cause in the phase notes or
  `MIGRATION.md`; do not conceal failures by weakening assertions.

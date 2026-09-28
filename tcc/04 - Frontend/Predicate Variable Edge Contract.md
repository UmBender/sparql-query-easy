# Predicate Variable Edge Contract

Status: **Approved feature direction — 2026-09-27**

## Current behavior

**Confirmed:** The general-query HTTP contract accepts a SPARQL variable in a
triple pattern's `predicate`, and the Kotlin query generator renders that
variable unchanged. Thus a request such as `?subject ?predicate ?object` can
project the predicate selected by `variableName`.

**Confirmed:** `index2.html` already uses this capability internally when it
checks whether a newly selected node is connected to an existing one. The
`verifyAlreadyExistsNodeAndAdd` helper submits fixed subject and object values,
`predicate: "?predicate"`, and `variableName: "?predicate"`. This is not a
user-visible way to turn an existing graph relation into a query variable.

## Approved interaction

The frontend will let a user left-click an existing edge and open an
edge-specific action list. Choosing **Convert relation to variable** replaces
that edge's predicate value (`nodeId`) with a generated valid SPARQL variable,
displays it as `?`, and preserves the edge's source, target, identifier, and
other metadata.

When the graph query runs, the frontend must recognize a variable held by an
edge predicate as a candidate projected variable. With fixed subject and object
nodes, it must submit the resulting triple pattern in this form:

```json
{
  "subject": "<https://example.test/subject>",
  "predicate": "?predicate_…",
  "object": "<https://example.test/object>"
}
```

and use that same variable as `variableName`. The existing general-query
endpoint then queries the predicate without a new HTTP route.

Selecting a predicate-query result binds the queried edge in place: its
`nodeId` and visible label become the returned predicate identifier and label,
and its temporary `variable` type is cleared. Source, target, edge identity,
other metadata, and all nodes remain intact. Result rows retain their queried
edge IDs; if an edge was removed or its predicate changed before selection,
that stale result does not recreate it or create a node.

## Relation display and removal (FE-013, 2026-09-28)

The relation label style follows the predicate, not a stored `type` flag
(`relationLabelKind` in `sparql/query-calculations.js`, rendered by
`edgeLabelHtml`). A whole valid variable `nodeId`, or no `nodeId` (queried
through a fallback variable), shows the green variable box. A fixed predicate
shows the plain label, even with a stale `type: 'variable'`. `type: 'filter'`
keeps the filter box. Node conversion and result-table replacement rebuild
edges with all their data (including `type` and `filterType`).

Every relation's action list offers **Remove relation**. It removes only
that edge; both nodes and other edges, including parallel ones, remain.
Variable relations offer only this action; fixed ones also offer **Convert
relation to variable**.

## Boundaries

- This is a frontend interaction extension; it does not change C# parity,
  RDF/Jena abstractions, the general-query request shape, or SPARQL escaping.
- The existing node menu remains node-specific. A click on graph background
  dismisses an open action list; selecting an edge must not trigger node
  actions.
- Normal browser tests must use local mocked API responses only.
- The behavior of a graph containing multiple projectable variables is outside
  this slice unless the implementation needs a deterministic refinement to
  avoid choosing the wrong variable.

## Source files

- `sparql/index2.html`
- `sparql/query-calculations.js`
- `src/main/kotlin/com/example/sparqlqueryeasy/http/QueryHttpModels.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/application/query/GeneralQueryService.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/wikidata/query/WikidataQueryGenerator.kt`
- `frontend-tests/index2.spec.mjs`

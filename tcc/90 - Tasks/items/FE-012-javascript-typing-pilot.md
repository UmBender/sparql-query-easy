---
id: FE-012
title: Pilot checked JavaScript for extracted query calculations
status: DONE
priority: P1
type: quality
depends_on: [FE-011]
human_gate: false
created: 2026-09-28
updated: 2026-09-28
---
# Evaluate a limited JavaScript type-checking pilot

## Objective and main skill

Add a narrow checked-JavaScript pilot to the extracted query module, as approved
by the 2026-09-28 user request for incremental Option B. Use `tcc-refactor`.

## Evidence and scope

Confirmed entry points: `package.json; extracted query module from FE-011; frontend-tests; build.gradle.kts`.

Use TypeScript 5.9.3 in `checkJs`/`noEmit` mode against the extracted module only.
JSDoc describes graph-data inputs and filter outputs. Run the checker and pure
tests independently; do not convert the inline page, add Vite, or alter the API.

See [[../../04 - Frontend/Frontend Evolution Audit]] for reasoning and
[[../../09 - Decisions/Current Contracts]] for preserved behavior.

## Acceptance criteria

- [x] `npm run check:frontend-types` catches type mismatches in the extracted
      module without emitting browser assets.
- [x] Checked boundary, caught error class, current unchecked code, and future
      extension cost are documented.
- [x] Pure tests, browser suite and distribution packaging still pass.

## Validation

```sh
npm run check:frontend-types
npm run test:query
npm run test:browser
git diff --check
```

Apply the final area gate from [[../../06 - Development/Operational Map]].
The pure-test command is introduced by FE-011.

## Dependencies and documentation

Depends on FE-011. Update this card, TASKS.md and the affected audit,
quality or frontend note only. No automatic implementation of later cards.

## Risks

Static typing does not solve stale responses or graph lifecycle automatically.
The inline Cytoscape adapter remains unchecked; widening `checkJs` to the whole
page would require a separate task and graph/API type declarations.

## Execution log

- 2026-09-28: Created by DEV-001 frontend audit; not started.
- 2026-09-28: User selected incremental Option B and deferred full port. Scope
  changed from evaluation-only to this bounded implementation pilot.
- 2026-09-28: Added TypeScript 5.9.3, JSDoc `FilterEdge`/`QueryFilter` and
  `tsconfig.frontend.json` with `allowJs`, `checkJs`, `strict` and `noEmit`.
  The checker now rejects incompatible required filter-edge fields and output
  types in the pure module; the inline adapter remains outside its include
  set. `npm run check:frontend-types`, `npm run test:query`, browser 23/23,
  Kotlin quality/distribution gate and packaged module HTTP smoke passed.
  Updated audit, operational map, package files, this card and task index.

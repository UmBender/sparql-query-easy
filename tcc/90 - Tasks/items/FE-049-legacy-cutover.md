---
id: FE-049
title: Make the SvelteKit app the authoritative frontend and retire index2.html
status: REVIEW
priority: P1
type: frontend
depends_on: [FE-044, FE-045, FE-046, FE-047, FE-048, AUTH-003, QUAL-006, QUAL-007, OPS-006]
human_gate: true
created: 2026-10-16
updated: 2026-10-18
---
# Make the SvelteKit app the authoritative frontend and retire index2.html

## Objective

T12. Human-gated: the user approves the parity evidence before removal.
Precedent: MIG-002 (C# retirement). Skill: `tcc-fullstack`.

## Scope

- Evidence: every QUAL-006 row passes on the new app.
- Then: `GET /` and static serving point to the new app (or only `web`
  serves it); remove `sparql/` page/scripts, `login.html`, legacy browser
  suite, `processResources` includes and `StaticFrontendRoutesTest` cases.
- Update `AGENTS.md`, Operational Map, Current Contracts, Frontend
  Architecture; mark open legacy-only cards superseded.

## Acceptance criteria

- [ ] User approves the parity report.
- [ ] All remaining gates pass; no reference to `index2.html` remains outside history.

## Parity report (for the user's approval, 2026-10-18)

- Dependencies done: FE-044–FE-048, AUTH-001, AUTH-003, QUAL-006, OPS-006;
  QUAL-007 is in REVIEW only for its first GitHub run (the CI commands pass
  locally).
- [[../../04 - Frontend/Frontend Parity Checklist]]: all 50 rows (P, G, F, E,
  B) are `new`, each with the new-app test named in the row. P-17 was the last
  one (`frontend/tests/smoke.e2e.ts`).
- Request parity: `request-parity.spec.ts` requires the new app's requests to
  equal the 24 `fixtures/legacy/` scenarios (multiset where/filters); the
  real-stack suite reproduces the captured PokemonGen1 stage answer.
- Gates at the last commits: new frontend `npm test` (162 Vitest server with
  domain coverage ≥ 90%, 4 component, 78 Playwright incl. screenshots and axe)
  and `test:stack` (8, Ktor + embedded PostgreSQL); legacy `test:query` 70,
  `check:frontend-types`, `test:browser` 132, `test:e2e` 4; Kotlin
  `ktlintCheck detekt test` (206).
- Intended differences (already approved or recorded on their cards): saved
  queries use the versioned format only and old `query_exported.json` files
  are refused with an explanation (D6b, FE-042/FE-048); the guided tour shows
  on the first visit, not on every load (FE-048); class "Explore values" sends
  the full `rdfs:domain` IRI where the legacy prefixed name got 400 (G-05,
  FE-042); search probes skip edge ids (FE-042); accounts use `/login` in the
  SPA instead of `login.html` (AUTH-003).
- On approval this card will: serve the SPA at `GET /` (redirect target and
  OpenAPI text updated) or leave `/` to the `web` service; remove
  `sparql/` (page, scripts, `login.html`), the legacy browser suite and
  capture harness under `frontend-tests/`, the root Playwright/legacy npm
  scripts that only serve them, the `processResources` legacy includes, the
  legacy cases of `StaticFrontendRoutesTest` and the Caddy legacy paths;
  vendor what still needs legacy code (`order.spec.ts` uses
  `sparql/cytoscape.min.js`; the `domain/legacy` ports stay as the domain's
  oracles); update AGENTS.md, Operational Map, Current Contracts, Frontend
  Architecture and the CI workflow; mark legacy-only cards superseded. The
  `fixtures/legacy/` corpus stays as the request-parity oracle.
- Waiting for: the user's approval of this report (human gate).

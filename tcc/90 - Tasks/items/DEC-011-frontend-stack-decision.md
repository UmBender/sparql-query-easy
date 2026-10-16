---
id: DEC-011
title: Build a SvelteKit frontend in frontend/ beside index2.html, then cut over
status: DONE
priority: P0
type: decision
depends_on: []
human_gate: true
created: 2026-10-16
updated: 2026-10-16
---
# Build a SvelteKit frontend in frontend/ beside index2.html, then cut over

## Decision

User decision (2026-10-16, answer D1 of
[[../../05 - Migration/Frontend Migration Conflict Report]]): "build
sveltkit, and use frontend". A new SvelteKit application lives in the
top-level `frontend/` directory. `sparql/index2.html` stays the authoritative,
tested frontend until the cutover card FE-049 is approved.

This revises the 2026-09-28 Option B direction and the "Option C stays
rejected" conclusion of FE-018/FE-031 in
[[../../04 - Frontend/Frontend Evolution Audit]]; those cards stay DONE as
history.

## Approved stack (the contract new cards cite)

- SvelteKit with adapter-static in SPA mode, Svelte 5 runes, strict
  TypeScript, Vite.
- Tailwind CSS + shadcn-svelte (Bits UI), driven by design tokens defined once
  and shared with the Cytoscape stylesheet.
- A pure TypeScript domain model (`QueryGraph` and pure operations) owned by
  one rune-based store in a `.svelte.ts` module. Cytoscape is a view only: it
  renders from the store and turns gestures into store actions.
- Server data: @tanstack/svelte-query over a typed API client; types generated
  from the Ktor OpenAPI document where possible.
- Forms: Superforms + Zod.
- Tests: Vitest (unit), Vitest browser mode (components), MSW (mocked API),
  contract tests, Playwright e2e on the real stack with PokemonGen1,
  Playwright screenshots, @axe-core/playwright.
- Same origin with the API: Vite dev server proxies to Ktor on 8080; in
  production the `web` service serves the SPA and proxies the API (DEC-003).

## Conditions carried into the backlog

1. The first product slice is the framework-free TypeScript domain (FE-042),
   ported from the checked modules (`graph-model.js`, `graph-binding.js`,
   `query-calculations.js`, `query-stages.js`, `graph-actions.js`) with their
   unit tests as the oracle.
2. Each legacy feature is a vertical card with a parity check from QUAL-006;
   the legacy page is not modified for the new app.
3. Cutover (FE-049) is a separate human-gated card.
4. Done legacy cards stay DONE and act as the specification (D3); only open
   legacy cards are superseded (AUTH-002).

## Execution log

- 2026-10-16: Recorded the user's answer; planned FE-040–FE-049, QUAL-006,
  QUAL-007. No product code changed.

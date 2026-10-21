---
id: FE-055
title: Open the editor on the PokemonGen1 dataset by default
status: DONE
priority: P2
type: frontend
depends_on: []
human_gate: false
created: 2026-10-21
updated: 2026-10-21
---
# Open the editor on the PokemonGen1 dataset by default

## Objective

User request (2026-10-21): the endpoint field starts on `PokemonGen1`, the
example dataset the guided tour, the `/help` guide and the study tasks use,
instead of the legacy `CampeonatoBrasileiro2023`. Skill: `tcc-frontend`.

## Scope and acceptance

- `DEFAULT_ENDPOINT` (`frontend/src/lib/domain/endpoint.ts`) is
  `{ kind: 'builtIn', id: 'PokemonGen1' }`; every request from a fresh editor
  sends `endpointUrl: 'PokemonGen1'`. The backend has no default and is
  unchanged; the built-in list keeps both datasets.
- Tests that change the endpoint now switch to `CampeonatoBrasileiro2023`, so
  they still prove a change (store specs, P-04 P-05, the B-04 badge test).
- Editor screen baselines refreshed: only the endpoint text differs.

## Conclusion

- Commands: `npm --prefix frontend run check`, `run lint`, `test` (Playwright
  116 pass), `run test:screens` (22 pass after refreshing the two editor
  baselines).
- Limitation: a saved query still loads with its own endpoint; only a new
  editor starts on PokemonGen1.

---
id: DEC-018
title: Decide how the T12 brief changes the cutover done by FE-049
status: BLOCKED
priority: P1
type: decision
depends_on: [FE-049]
human_gate: true
created: 2026-10-20
updated: 2026-10-20
---
# Decide how the T12 brief changes the cutover done by FE-049

## Objective

The T12 brief (2026-10-20, legacy cutover and cleanup) restates FE-049
(DONE 2026-10-18: SvelteKit app is the only frontend, `index2.html`,
`login.html` and the legacy suites removed). Most of the brief is already
covered. The rest is either missing (user guide, tour text, an enforced
"no jQuery" check) or differs from what FE-049 did (no hidden legacy path).
Nothing changes until the user answers.

## Already decided, not reopened

- DEC-011: SvelteKit in `frontend/`; cutover is the human-gated FE-049.
  Condition 4 (answer D3 of
  [[../../05 - Migration/Frontend Migration Conflict Report]]): done legacy
  cards stay DONE as the specification; only open legacy cards are superseded.
- FE-049 parity report: all 50 rows of
  [[../../04 - Frontend/Frontend Parity Checklist]] are `new`;
  `request-parity.spec.ts` matches the 24 `fixtures/legacy/` scenarios (the
  T2 corpus, QUAL-008/QUAL-009). Approval recorded on FE-049 (2026-10-18).
- Current Contracts frontend row: Ktor serves the API only; `/` and the old
  files are 404 (`ApiOnlyRoutesTest`).

## Coverage of the T12 brief (evidence 2026-10-20)

| Brief item | Status | Evidence / follow-up |
|---|---|---|
| Parity: legacy feature list | Covered | FE-049 parity report; 50/50 checklist rows `new` |
| Parity: T2 sample queries | Covered | 24 scenarios in `fixtures/legacy/`, `request-parity.spec.ts`, real-stack stage answer |
| Serve the new frontend | Covered | `web` (Caddy) serves the SPA; Ktor API only (FE-049, OPS-006) |
| Legacy page at a hidden path for one release, then removed | Contradicted | FE-049 removed it at once; no release tag exists yet → Q1 |
| Remove jQuery, legacy JS and CSS | Covered, with kept oracles | `git ls-files` has no `sparql/`, no jQuery dependency; tracked CSS only under `frontend/src`. Kept on purpose: `frontend/src/lib/domain/legacy/*` (TS ports + oracle specs), `domain/legacy/vendor/cytoscape-3.29.1.min.js` (the retired page's build, used by `order.spec.ts`), `fixtures/legacy/`, `scripts/check-legacy-fixture-fields.mjs` → Q2 |
| Remove backend code that only served it | Covered | `GET /` redirect, static serving, `processResources` includes removed (FE-049) |
| Mark legacy tasks superseded | Covered by D3 | No open card targets the legacy page; AUTH-002 and OPS-003 already CANCELLED with a "Superseded by" line → Q3 |
| README | Partly | Frontend line updated by FE-049; "Current status" still says no hosting target or deployment is chosen (stale since DEC-003/DEC-017) → DOC-007 |
| Architecture overview | Covered | [[../../04 - Frontend/Frontend Architecture]], System Architecture (FE-049) |
| User guide screenshots | Missing | No user guide exists in the repository or vault → Q4, DOC-006 |
| Demo tour text | Partly | `tour-steps.ts` keeps the legacy Intro.js texts (9 steps, no filters, funnel, Run Query stages, View SPARQL, export); last step links the legacy demo video `youtu.be/6vh7bccR-Ow` → Q5, FE-054 |
| AC: no jQuery or legacy CSS left | Holds, not enforced | Only history notes mention jQuery; nothing stops it coming back → QUAL-018 |
| AC: all test layers green after removal | Held on 2026-10-18 | FE-049 log; re-run on the final state by QUAL-018 |

## Conflicts and open questions

| # | T12 brief | Current record | Affects if changed |
|---|---|---|---|
| Q1 | Keep the legacy page at a hidden path for one release, then remove it | FE-049 removed it in `d4b5efa`; `ApiOnlyRoutesTest` asserts 404; no git tag or release exists yet (DEC-017 Q5: releases are git tags, none cut) | Caddyfile, Dockerfile/`web` image, `ApiOnlyRoutesTest`, Current Contracts, the "no jQuery" acceptance until removal |
| Q2 | "Remove the legacy JS"; "no jQuery or legacy CSS left" | Kept test oracles listed above; none is jQuery or CSS, none is served | `order.spec.ts`, ESLint/Prettier ignores, raw-color allow-list |
| Q3 | Mark tasks that targeted the legacy frontend as superseded | D3: done legacy cards stay DONE as spec; no open legacy card remains | FE-002…FE-039, BUG-003…BUG-006 headers |
| Q4 | Update user guide screenshots | No user guide exists | New document, its location and how screenshots are made |
| Q5 | Update the demo tour text | Tour is a port of the legacy texts and video | `tour-steps.ts`, `editor-toolbar.svelte` demo link, `utilities.e2e.ts` P-12, screenshots |

## Options and recommendation

- **Q1 hidden legacy path.** A: keep FE-049's immediate removal; the retired
  page stays recoverable from Git (`57e1514`, last commit with `sparql/`),
  and a `legacy-final` tag can point at it (recommended: parity is proven,
  no release has been cut so "one release" has no anchor, and restoring it
  would bring jQuery back and contradict the brief's own acceptance).
  B: restore `sparql/` at a hidden path (e.g. `/legacy/` served by Caddy,
  not linked) for the first tagged release, then remove it in a second card
  (two cards: FE-055 restore, FE-056 remove; the "no jQuery" acceptance only
  holds after FE-056).
- **Q2 kept legacy oracles.** A: keep them; they are test oracles, not
  shipped code, and "legacy JS" means the served page (recommended).
  B: also drop the vendored Cytoscape 3.29.1 build and run `order.spec.ts`
  on the npm `cytoscape` (`^3.33.1`) after checking the order results match
  (one small refactor card; the TS ports stay).
- **Q3 superseded marks.** A: nothing to mark, D3 stands (recommended).
  B: reopen D3 and add a "Superseded by FE-049" line to each done legacy
  card, status unchanged (the pipeline has no SUPERSEDED status; its
  equivalent is CANCELLED plus that line, which is wrong for done work).
- **Q4 user guide.** A: `docs/user-guide.md` linked from the README, with
  screenshots made by one Playwright script on PokemonGen1 so they can be
  regenerated (recommended: participants and the IT can read it without the
  vault; screenshots never drift by hand). B: a note in the vault
  (`tcc/01 - Project/User Guide.md`) with the same script. C: an in-app
  `/help` route (product change, more tests).
- **Q5 tour text and video.** A: rewrite the tour for the current editor
  (add filters and the funnel, Run Query stages, View SPARQL, export and
  load) and drop the video step until a new video is recorded (recommended:
  the video shows the old UI). B: rewrite the texts and keep the video link.
  C: keep the legacy texts, fix wording only.

## Effects once answered

- FE-054 (tour), DOC-006 (user guide), QUAL-018 (enforced acceptance) stay
  BACKLOG until this card is DONE. DOC-007 (README) needs no answer.
- Q1 B adds FE-055/FE-056; Q2 B adds a small refactor card; Q3 B edits done
  card headers. None is created before the answer.
- Proposed amendment, applied only after the answer: LEARN-001 (REVIEW) line
  85 curls `/index2.html`, now 404; replace it with `/health` and a dated
  note.
- Proposed amendment (DUPLICATE, rule 1): FE-049 lacks the brief's "no
  jQuery or legacy CSS left" criterion. FE-049 stays as it is; QUAL-018
  carries the criterion instead (recommended), or it is added to FE-049 as a
  dated note.

## Execution log

- 2026-10-20: Created from the T12 brief with the coverage table above.
  Stops for the user's answers to Q1–Q5.

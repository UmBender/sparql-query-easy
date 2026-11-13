---
id: STUDY-019
title: Show the approved research terms on the consent screen and require the adult declaration
status: REVIEW
priority: P1
type: fullstack
depends_on: [STUDY-008]
human_gate: true
created: 2026-11-12
updated: 2026-11-12
---
# Show the approved research terms on the consent screen and require the adult declaration

## Objective

The consent screen (STUDY-008) still shows `consent/v1.md`, a placeholder
marked "not for participants". Replace it with the real text from
[[../../01 - Project/Termos de Uso da Pesquisa]] (the TCLE items 1–8 plus the
terms of use T1–T7) and make accepting require the declaration "Declaro ter
18 anos ou mais". Decisions (user, 2026-11-12): no protocol number; online
acceptance counts as consent; adults only; records kept until 2026-12-31.
Skill: `tcc-fullstack`. Contract: Current Contracts row "Study".

## Scope

- New `src/main/resources/study/consent/v2.md` in Portuguese with the text of
  the terms note (headings, items 1–8, T1–T7, contacts), without the
  checkbox lines (the screen draws them). `study.json` points `consent` to
  version 2; v1 stays on disk so earlier acceptances keep their version.
- `consent-screen.svelte`: a required "Declaro ter 18 anos ou mais" checkbox
  that enables *Accept*; the existing decline path is unchanged. The adult
  declaration is a UI gate only: the server still stores user, version and
  time (the terms promise nothing more).
- Accepting v2 is asked again of users who accepted only v1 (existing
  versioning behavior, STUDY-008).
- Frontend and server tests updated for the new version and the checkbox.

Excluded: withdrawal and deletion of data; storing the age declaration;
deleting records on 2026-12-31 (see decision below).

## Pending decision (does not block the text)

T6 says the records are kept until the end of 2026 but not what happens then:
delete or anonymize (TCLE item 7 speaks of anonymization). Ask the user;
until answered, T6 states only the date.

## Acceptance criteria

- [ ] `/study` shows the v2 text (no "PLACEHOLDER") to a user without v2
      consent, and *Accept* stays disabled until the 18+ box is checked.
- [ ] Accepting stores one row with version 2; a user with only v1 sees the
      screen again; *Decline* stores nothing.
- [ ] The text matches the terms note: no drift in items 1–8, T1–T7 and the
      contacts.

## Validation

Focused: `consent-screen.svelte.spec.ts`, the consent route test, and the
stack spec `tests-stack/study-questionnaires.e2e.ts` (consent step; update
`tests-stack/support.ts` if it accepts a fixed version). Closing: Kotlin gate
(resource and `study.json` change), frontend gate, `test:stack`. Human gate:
the user reads the shown text once.

## Conclusion

Implemented: `consent/v2.md` (items 1–8, T1–T7, declaration, contacts; no checkbox lines, no bold markers because the screen renders only paragraphs and `- ` lists; T6 states only the date), `study.json` -> version 2 (`v1.md` kept), `consent-screen.svelte` with the required "Declaro ter 18 anos ou mais" checkbox gating *Accept*, updated `StudyConsentRoutesTest`, `consent-screen.svelte.spec.ts` and the stack specs (`study-participant`, `study-questionnaires`, `auth`). `support.ts` needed no change (reads the current version).

Validation (after the owner fixed permissions and Firefox): `./gradlew ktlintCheck detekt test --no-daemon` green after two pinned consent versions were updated (`AdminFormExportRoutesTest` consent_version cell 1 -> 2, `StudyFormResponseRoutesTest` stored row "profile 2 2"; cause: the version bump, not the oracle); `npm --prefix frontend test` green (components, 135 e2e); `npm --prefix frontend run test:stack` green (23 passed).

Remaining (human gate): read the rendered text at `/study` once and confirm the T6 wording (date only; delete vs anonymize still undecided).

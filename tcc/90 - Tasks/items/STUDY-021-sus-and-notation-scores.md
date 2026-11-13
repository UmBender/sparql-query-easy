---
id: STUDY-021
title: Compute the SUS score (0-100) and the notation score (0-20) in the questionnaire CSV
status: DONE
priority: P1
type: backend
depends_on: [STUDY-020]
human_gate: false
created: 2026-11-12
updated: 2026-11-13
---
# Compute the SUS score (0-100) and the notation score (0-20) in the questionnaire CSV

## Objective

The admin CSV (`FormResponsesCsv`, STUDY-011/015) appends `usability_score`
and `notation_score` for the dissertation questionnaire through
`DissertationScores`. Do the same for the v3 questionnaire of STUDY-020, with
the formulas of the note's §4 "Pontuação". Skill: `tcc-backend`.

## Scope

- Scoring for v3 beside `DissertationScores` (new object or extension;
  keep the older formulas unchanged for v1/v2 data):
  - `sus_score` = 2,5 · (Σ(S1,S3,S5,S7,S9)(q−1) + Σ(S2,S4,S6,S8,S10)(5−q)),
    0–100, empty if any S answer is missing.
  - `notation_score` = Σ(N1..N5)(q−1), 0–20, empty if any N answer is missing.
  - `sus7_score` (optional, decide when implementing): the 7-item score of
    2025 from S3,S4,S5,S6,S7,S9,S10, 0–70, to compare with the dissertation's
    57/70.
- CSV header and cells follow the existing rule: computed columns only when
  the questionnaire versions hold the v3 ids; empty cell for an incomplete
  response.
- Document the formulas in [[../../03 - Backend/API v1]] next to the
  existing export description.

Excluded: score display for participants (they never see results);
per-principle averages (done in analysis, not in the export).

## Acceptance criteria

- [x] A response with all S answers = 5 on positive items and 1 on negative
      items scores 100; all 3s score 50; the reverse extreme scores 0.
- [x] N all 5 scores 20, all 1 scores 0.
- [x] Incomplete S or N answers give an empty cell, not 0.
- [x] CSV of a mixed v1/v2/v3 export keeps the earlier columns intact.

## Validation

Focused: extend `FormResponsesCsvTest` (extremes, mid-point, missing answer,
mixed versions) plus a test with the oracle computed by hand in the card.
Closing: Kotlin gate.

## Conclusion

`SusScores` and `ScoreColumns` in `FormResponsesCsv.kt` add `sus_score` and a
shared `notation_score`; `usability_score` and the v1/v2 behavior are
unchanged. `sus7_score` was left out (optional; can be derived in analysis).
Tests: `FormResponsesCsvTest` (extremes 100/50/0, notation 20/10/0, hand
oracle 77.5, missing answers, mixed v2/v3 export) and `FormDefinitionsTest`.
Formulas documented in [[../../03 - Backend/API v1]].
Validation: `./gradlew ktlintCheck detekt test --no-daemon` passed.

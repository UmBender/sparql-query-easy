---
id: STUDY-015
title: Replace the placeholder questionnaires with the dissertation's evaluation questionnaire
status: READY
priority: P1
type: fullstack
depends_on: []
human_gate: true
created: 2026-10-27
updated: 2026-10-27
---
# Replace the placeholder questionnaires with the dissertation's evaluation questionnaire

## Objective

User request (2026-10-27): use the same questionnaire as the dissertation
(`tcc/PDF/Dissertação Corrigida - Versao Deposito Biblioteca Digital.pdf`,
local only, §4.5 "Questionário de Avaliação", p. 63–65). The current
`profile.v1.json` and `usability.v1.json` in
`src/main/resources/study/forms/` are PLACEHOLDER texts (DEC-015, STUDY-009).
Skills: `tcc-fullstack`. Contract: Current Contracts row "Study";
[[../../03 - Backend/API v1#Questionnaires (participant, STUDY-009)]].

## The dissertation questionnaire (verbatim, Likert 1–5)

1. Qual é o seu nível de conhecimento sobre SPARQL/RDF?
2. Qual foi a quantidade de consultas que você conseguiu realizar?
3. (+) Quão fácil foi usar a ferramenta para a construção de uma consulta SPARQL?
4. Quão útil foi o video de demonstração para aprender a usar a ferramenta SPARQL EasyQuery?
5. (–) Como você avaliaria a afirmação de que você precisaria de suporte técnico para conseguir usar plenamente o sistema?
6. (+) Como você avaliaria a afirmação de que as diferentes funcionalidades do sistema estão bem integradas?
7. (–) Como você avaliaria a afirmação de que existem muitas inconsistências no sistema?
8. (+) Como você avaliaria a afirmação de que a maioria das pessoas aprenderia a usar este sistema rapidamente?
9. (+) Como você avaliaria a afirmação de que você se sentiu muito confiante usando o sistema?
10. (–) Como você avaliaria a afirmação de que você precisou aprender muitas coisas antes de começar a usar o sistema?
11. (+) Como você avaliaria a afirmação de que os símbolos gráficos são claros e distintos entre si?
12. (+) Como você avaliaria a afirmação de que a aparência dos símbolos gráficos é intuitiva e sugere o significado esperado?
13. (+) Você acredita que a quantidade de símbolos gráficos utilizados é adequada e não torna a visualização sobrecarregada?
14. (+) Você acredita que a notação para a construção de uma consulta é consistente e não apresenta redundância ou ambiguidade?
15. (+) Você acredita que o suporte à disposição automática/manual dos elementos gráficos facilita a compreensão de uma consulta construída?

Scores (dissertation): usability = 2.5 · (Σ_{5,7,10}(5 − q) + Σ_{3,6,8,9}(q − 1)),
0–70, acceptable ≥ 47.6; notation = Σ_{11–15}(q − 1), 0–20, acceptable > 10.
Questions 1, 2 and 4 are context only.

## Defaults (reversible; confirm in REVIEW)

- Texts verbatim in Portuguese, five-point Likert with the end labels the
  dissertation implies (e.g. "1 – Muito baixo/Discordo totalmente" …
  "5 – Muito alto/Concordo totalmente"; pick per question wording, record
  them).
- Placement: question 1 in the profile form (before the tasks); questions
  2–15 in the usability form (after the final submission), same order and
  numbering. No other placeholder question kept.
- New form versions (`profile.v2.json`, `usability.v2.json`) through the
  existing versioning, so v1 responses stay readable/exportable; the CSV
  export includes the new questions. Optionally add the two scores to the
  admin CSV export if it fits the existing export cleanly; otherwise record
  as a follow-up.
- Remove "PLACEHOLDER" from the Current Contracts row once replaced.

## Validation

- `FormDefinitionsTest`, `FormAnswerValidatorTest`, the shared
  `domain/fixtures/forms/parity.json` and `forms.spec.ts`, the stack
  questionnaire spec (`tests-stack/study-questionnaires.e2e.ts`) and
  `tests-stack/support.ts` `PROFILE_ANSWERS` updated to the new forms.
- Closing: Kotlin gate, frontend gate, `test:stack`, `test:screens` if the
  questionnaire screens are captured.

## Conclusion

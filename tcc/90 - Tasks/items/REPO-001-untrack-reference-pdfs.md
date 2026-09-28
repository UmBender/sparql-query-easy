---
id: REPO-001
title: Stop tracking thesis reference PDFs
status: READY
priority: P0
type: repository
depends_on: [DEC-001]
human_gate: false
created: 2026-09-21
updated: 2026-09-21
---
# Stop tracking thesis reference PDFs

## Objective

Apply the approved repository boundary: keep the Markdown Obsidian knowledge
base in Git, but remove thesis/reference PDF binaries from current tracking and
prevent accidental re-addition.

## Evidence and relevant files

`git ls-files tcc/PDF` confirms three tracked PDFs, introduced by commit
`f1bcf5a`. Together they are approximately 7.7 MB. `.gitignore` does not ignore
them. No Markdown note links to these paths; the local Obsidian workspace may
remember an open PDF and must not be used as repository content evidence.

## Exact scope

- Add a repository-root ignore rule for `tcc/PDF/*.pdf` (case-insensitive
  extension coverage if required by the retained local files).
- Remove the three PDF paths from the Git index while preserving the user's
  local copies during the task.
- Update inventory/decision notes to state that vault Markdown is versioned but
  PDF binaries are external local references.
- Document how a contributor obtains reference PDFs outside Git without
  embedding private URLs or credentials.

## Explicitly out of scope

- Rewriting published Git history. That is destructive, changes commit IDs,
  and requires separate explicit approval plus coordination with every clone.
- Deleting the user's local PDF files.
- Removing the Markdown vault or Obsidian configuration.

## Dependencies

- `DEC-001` records the approved PDF boundary.

## Acceptance criteria

- [ ] `git ls-files 'tcc/PDF/*.pdf'` returns no paths.
- [ ] All three local files still exist immediately after index removal.
- [ ] `git check-ignore` proves future PDF files under `tcc/PDF/` are ignored.
- [ ] No tracked Markdown/JSON link falsely promises that a PDF is present in a
      clean checkout.
- [ ] No history rewrite is performed without a separate approval.

## Verification commands

```sh
git ls-files 'tcc/PDF/*.pdf'
find tcc/PDF -maxdepth 1 -type f -iname '*.pdf' -print
git check-ignore -v tcc/PDF/*.pdf
rg -n 'PDF/|\.pdf' tcc --glob '*.md' --glob '*.json'
git diff --check
```

## Expected documentation updates

`tcc/01 - Project/Workspace Inventory.md`;
`tcc/09 - Decisions/Open Decisions.md`; contributor/development instructions
if an external reference-download process is later selected.

## Risks

Removing files from current tracking does not remove them from existing Git
history. The local-preservation step must be verified before committing the
index deletion.

## Execution log

- 2026-09-21: Created after confirming all three PDFs are currently tracked,
  their sizes, their introduction commit, the absence of ignore rules, and the
  absence of Markdown links to them.

Checked-in saved queries in the versioned format (FE-042, `formatVersion: 1`).
`saved-format.spec.ts` loads each `*.query.json` and requires that saving it
again reproduces the file byte for byte.

-- STUDY-016 (DEC-020): a saved answer may have no variables and carries an admin-only automatic check: its
-- drawn triples against the reference's (C1) or each checked variable's values against the expected ones (C2).
-- For new rows correct is that check's result, and answer_variable, sparql and result_summary describe the
-- matched variable, else the first one; all three are null for an answer without variables.
ALTER TABLE study_submission ALTER COLUMN answer_variable DROP NOT NULL;

-- The whole check as JSON ({"kind":"structural",…} or {"kind":"variables",…}); null on rows saved before it.
ALTER TABLE study_submission ADD COLUMN auto_check JSONB;

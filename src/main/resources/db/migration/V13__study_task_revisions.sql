-- STUDY-017 (DEC-020 C3): every revision of a task, so a saved answer is reviewed against the reference of the
-- revision it was saved for. The store writes the current revision on every create and update; an update that
-- keeps the revision (a title or layout change) replaces that revision's row.
CREATE TABLE study_task_revision (
    task_id           BIGINT       NOT NULL REFERENCES study_task (id),
    revision          INTEGER      NOT NULL,
    title             VARCHAR(200) NOT NULL,
    statement         TEXT         NOT NULL,
    endpoint          VARCHAR(64)  NOT NULL,
    reference_graph   JSONB        NOT NULL,
    reference_request JSONB        NOT NULL,
    reference_sparql  TEXT         NOT NULL,
    expected_result   JSONB        NOT NULL,
    comparison        VARCHAR(16)  NOT NULL,
    max_results       INTEGER      NOT NULL,
    saved_at          TIMESTAMPTZ  NOT NULL,
    PRIMARY KEY (task_id, revision)
);

-- Existing tasks keep only their current revision: older ones were overwritten before this table existed.
INSERT INTO study_task_revision (task_id, revision, title, statement, endpoint, reference_graph, reference_request,
                                 reference_sparql, expected_result, comparison, max_results, saved_at)
SELECT id, revision, title, statement, endpoint, reference_graph, reference_request, reference_sparql,
       expected_result, comparison, max_results, updated_at
FROM study_task;

-- STUDY-004: every attempt at a proposed task (DEC-014 Q1: unlimited until the final submission). The server
-- ran the client-derived request and decided correctness; nothing here comes from a client verdict.
CREATE TABLE study_submission (
    id              BIGSERIAL   PRIMARY KEY,
    user_id         BIGINT      NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    task_id         BIGINT      NOT NULL REFERENCES study_task (id),
    -- The task revision (STUDY-006) the attempt was checked against.
    task_revision   INTEGER     NOT NULL,
    graph           JSONB       NOT NULL,
    request         JSONB       NOT NULL,
    -- Null when no query could be built from the request.
    sparql          TEXT,
    answer_variable VARCHAR(64) NOT NULL,
    -- Counts and the answer variable's typed terms; null for an invalid attempt.
    result_summary  JSONB,
    correct         BOOLEAN     NOT NULL,
    feedback        TEXT        NOT NULL,
    -- The query failed to build or run.
    invalid         BOOLEAN     NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL,
    -- Since the user's first open of the task (study_task_open), measured on the server.
    time_spent_ms   BIGINT      NOT NULL
);

CREATE INDEX study_submission_user_task ON study_submission (user_id, task_id, created_at);

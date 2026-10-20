-- STUDY-005: a user's final submission (D6, 2026-10-16); afterwards the proposed queries are closed to them.
CREATE TABLE study_completion (
    user_id     BIGINT      PRIMARY KEY REFERENCES app_user (id) ON DELETE CASCADE,
    finished_at TIMESTAMPTZ NOT NULL
);

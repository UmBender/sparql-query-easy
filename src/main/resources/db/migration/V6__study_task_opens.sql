-- STUDY-003: when a user first opened a task; STUDY-004 measures time spent from it on the server.
CREATE TABLE study_task_open (
    user_id   BIGINT      NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    task_id   BIGINT      NOT NULL REFERENCES study_task (id),
    opened_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, task_id)
);

-- STUDY-007: participant groups, each with its own ordered tasks; a participant is in at most one group.
CREATE TABLE study_group (
    id         BIGSERIAL    PRIMARY KEY,
    name       VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ  NOT NULL,
    updated_at TIMESTAMPTZ  NOT NULL
);

CREATE TABLE study_group_task (
    group_id BIGINT  NOT NULL REFERENCES study_group (id) ON DELETE CASCADE,
    task_id  BIGINT  NOT NULL REFERENCES study_task (id),
    position INTEGER NOT NULL,
    PRIMARY KEY (group_id, task_id),
    UNIQUE (group_id, position)
);

-- The primary key on user_id keeps one group per user; assigning again moves the user.
CREATE TABLE study_group_member (
    user_id     BIGINT      PRIMARY KEY REFERENCES app_user (id) ON DELETE CASCADE,
    group_id    BIGINT      NOT NULL REFERENCES study_group (id),
    assigned_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX study_group_member_group ON study_group_member (group_id);

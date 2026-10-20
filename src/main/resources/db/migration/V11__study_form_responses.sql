-- STUDY-010 (DEC-015 Q6): one response per user per questionnaire, whatever its version; answers hold only
-- question id -> value as checked on the server. The consent version the user had accepted is kept with it.
CREATE TABLE study_form_response (
    id              BIGSERIAL   PRIMARY KEY,
    user_id         BIGINT      NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    form_id         BIGINT      NOT NULL REFERENCES study_form (id),
    form_slug       VARCHAR(40) NOT NULL,
    form_version    INTEGER     NOT NULL,
    consent_version INTEGER     NOT NULL,
    answers         JSONB       NOT NULL,
    submitted_at    TIMESTAMPTZ NOT NULL,
    UNIQUE (user_id, form_slug)
);

CREATE INDEX study_form_response_form ON study_form_response (form_slug, submitted_at);

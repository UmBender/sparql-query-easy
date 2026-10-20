-- STUDY-008 (DEC-015 Q1): a participant's research consent to one version of the consent text. Nothing else
-- about the acceptance is stored (no IP address, no user agent).
CREATE TABLE study_consent (
    user_id         BIGINT      NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    consent_version INTEGER     NOT NULL,
    accepted_at     TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, consent_version)
);

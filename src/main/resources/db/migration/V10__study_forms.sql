-- STUDY-009 (DEC-015 Q2): the questionnaire definitions. The versioned files in src/main/resources/study/forms/
-- are the source; a version is stored here on first use so responses (STUDY-010) can reference it.
CREATE TABLE study_form (
    id         BIGSERIAL   PRIMARY KEY,
    slug       VARCHAR(40) NOT NULL,
    version    INTEGER     NOT NULL,
    definition JSONB       NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE (slug, version)
);

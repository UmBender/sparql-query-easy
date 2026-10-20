-- STUDY-006: proposed tasks managed by admins (DEC-014 Q3 = B). The server stores the reference query's result.
CREATE TABLE study_task (
    id                BIGSERIAL    PRIMARY KEY,
    task_key          VARCHAR(64)  NOT NULL UNIQUE,
    title             VARCHAR(200) NOT NULL,
    statement         TEXT         NOT NULL,
    endpoint          VARCHAR(64)  NOT NULL,
    -- Saved queries in the FE-042 format (formatVersion 1).
    starting_graph    JSONB,
    reference_graph   JSONB        NOT NULL,
    -- The request the client derived from reference_graph, and the SPARQL the server generated from it.
    reference_request JSONB        NOT NULL,
    reference_sparql  TEXT         NOT NULL,
    -- Typed RDF terms of the answer variable, one per result row, in result order.
    expected_result   JSONB        NOT NULL,
    comparison        VARCHAR(16)  NOT NULL CHECK (comparison IN ('set', 'multiset')),
    max_results       INTEGER      NOT NULL DEFAULT 1000 CHECK (max_results > 0),
    revision          INTEGER      NOT NULL DEFAULT 1,
    active            BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ  NOT NULL,
    updated_at        TIMESTAMPTZ  NOT NULL
);

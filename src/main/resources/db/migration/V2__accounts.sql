-- AUTH-001: self-registered users and their server-side sessions.
CREATE TABLE app_user (
    id            BIGSERIAL PRIMARY KEY,
    username      VARCHAR(32)  NOT NULL,
    username_key  VARCHAR(32)  NOT NULL UNIQUE,
    password_hash VARCHAR(256) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL
);

-- Only the SHA-256 digest of the opaque cookie token is stored.
CREATE TABLE user_session (
    token_digest CHAR(64)    PRIMARY KEY,
    user_id      BIGINT      NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL
);

CREATE INDEX user_session_expires_at ON user_session (expires_at);

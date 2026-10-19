-- AUTH-005: participant or admin. Admins come only from EASYQUERY_ADMIN_USERNAMES (DEC-014).
ALTER TABLE app_user
    ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'participant'
        CHECK (role IN ('participant', 'admin'));

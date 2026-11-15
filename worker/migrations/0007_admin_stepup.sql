-- Fleet console PR 2: when a session last confirmed with a fresh passkey tap.
-- Dangerous admin actions need one within the last 5 minutes.
ALTER TABLE sessions ADD COLUMN stepup_at INTEGER;

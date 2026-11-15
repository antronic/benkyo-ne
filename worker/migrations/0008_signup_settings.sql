-- Fleet console PR 3: invite codes for the closed beta.
-- While sign-ups are closed in the console, a valid invite code still lets
-- someone create an account. SIGNUP_MODE=closed on the Worker stops both.

CREATE TABLE IF NOT EXISTS invite_codes (
  code       TEXT    PRIMARY KEY,                  -- e.g. BK-7KQ2-MX9D (admin-only, low value: it only opens sign-up)
  label      TEXT,                                 -- who it's for
  max_uses   INTEGER NOT NULL DEFAULT 1,
  uses       INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  created_by INTEGER,                              -- accounts.id of the admin
  revoked_at INTEGER
);

-- which invite an account signed up with
ALTER TABLE accounts ADD COLUMN invite_code TEXT;
-- a sign-up challenge carries the invite until the passkey verifies
ALTER TABLE auth_challenges ADD COLUMN invite_code TEXT;

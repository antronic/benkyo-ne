-- Sign in with Apple, beside passkeys (worker/auth/apple.ts).
--
-- An account can have one Apple ID linked. Apple sessions are bound to that
-- link (sessions.apple_sub), so disconnecting Apple ends them, the same way
-- removing a passkey ends its sessions.

CREATE TABLE IF NOT EXISTS apple_identities (
  sub          TEXT    PRIMARY KEY,               -- Apple's stable user id for this Services ID
  user_id      INTEGER NOT NULL UNIQUE,           -- one Apple ID per account
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER
);

-- One row per started Apple sign-in; single use, 10 minutes.
CREATE TABLE IF NOT EXISTS apple_states (
  state_hash TEXT    PRIMARY KEY,                 -- SHA-256 hex of the state (also in the bk_apple cookie)
  nonce      TEXT    NOT NULL,                    -- must come back inside the id_token
  user_id    INTEGER,                             -- set when a signed-in account is connecting Apple
  expires_at INTEGER NOT NULL
);

-- sessions.kind gains 'apple'; SQLite can't alter a CHECK, so rebuild the table.
CREATE TABLE sessions_v2 (
  token_hash TEXT    PRIMARY KEY,
  passkey_id TEXT,                                -- passkey sessions only
  apple_sub  TEXT,                                -- apple sessions only
  kind       TEXT    NOT NULL DEFAULT 'passkey' CHECK (kind IN ('passkey', 'recovery', 'apple')),
  user_id    INTEGER,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
INSERT INTO sessions_v2 (token_hash, passkey_id, kind, user_id, created_at, expires_at)
SELECT token_hash, passkey_id, kind, user_id, created_at, expires_at FROM sessions;
DROP TABLE sessions;
ALTER TABLE sessions_v2 RENAME TO sessions;
CREATE INDEX IF NOT EXISTS sessions_expires ON sessions (expires_at);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);

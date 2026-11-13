-- AI features (docs/AI-PLAN.md §5): passkey auth, encrypted provider keys,
-- model prices, per-feature models, spend ledger + cap, rate limit, and
-- user card content synced alongside the review log.

-- ------------------------------------------------------------------ auth --

CREATE TABLE IF NOT EXISTS passkeys (
  id           TEXT    PRIMARY KEY,               -- credential id (base64url)
  public_key   TEXT    NOT NULL,                  -- COSE public key (base64url)
  sign_count   INTEGER NOT NULL DEFAULT 0,
  transports   TEXT,                              -- JSON array
  device_type  TEXT,
  backed_up    INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE TABLE IF NOT EXISTS auth_challenges (
  challenge  TEXT    PRIMARY KEY,                 -- base64url, single use
  kind       TEXT    NOT NULL CHECK (kind IN ('register', 'login')),
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT    PRIMARY KEY,                 -- SHA-256 hex of the cookie token
  passkey_id TEXT,                                -- NULL for recovery sessions
  kind       TEXT    NOT NULL DEFAULT 'passkey' CHECK (kind IN ('passkey', 'recovery')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expires ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS recovery_codes (
  code_hash  TEXT    PRIMARY KEY,                 -- SHA-256 hex of the normalised code
  created_at INTEGER NOT NULL,
  used_at    INTEGER
);

-- -------------------------------------------------------------------- AI --

CREATE TABLE IF NOT EXISTS ai_credentials (      -- write-only from the app
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  provider   TEXT    NOT NULL CHECK (provider IN ('anthropic', 'openai-compatible')),
  base_url   TEXT,
  label      TEXT    NOT NULL,
  key_cipher TEXT    NOT NULL,                    -- AES-GCM ciphertext (base64)
  key_iv     TEXT    NOT NULL,                    -- 12-byte IV (base64)
  key_last4  TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_model_prices (     -- manual prices (D15 step 3)
  provider     TEXT NOT NULL,
  model        TEXT NOT NULL,
  input_per_m  REAL NOT NULL,
  output_per_m REAL NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (provider, model)
);

CREATE TABLE IF NOT EXISTS ai_feature_models (
  feature       TEXT    PRIMARY KEY CHECK (feature IN ('fill', 'propose', 'vision')),
  credential_id INTEGER NOT NULL,
  model         TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_settings (         -- key/value: cap_usd, webauthn_user_id
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_ledger (           -- spend tracking for the hard cap
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  at                 INTEGER NOT NULL,
  feature            TEXT    NOT NULL,
  provider           TEXT    NOT NULL,
  model              TEXT    NOT NULL,
  status             TEXT    NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'done', 'failed')),
  input_tokens       INTEGER,
  cached_tokens      INTEGER,                     -- cache reads
  cache_write_tokens INTEGER,
  output_tokens      INTEGER,
  cost_usd           REAL    NOT NULL             -- worst case while reserved, actual once done
);
CREATE INDEX IF NOT EXISTS ai_ledger_at ON ai_ledger (at);

CREATE TABLE IF NOT EXISTS ai_rate (             -- calls per session per minute
  bucket TEXT    NOT NULL,
  minute INTEGER NOT NULL,
  count  INTEGER NOT NULL,
  PRIMARY KEY (bucket, minute)
);

-- ----------------------------------------------------------- user cards --
-- Card content for word/phrase cards (contract UserCard). Scheduling stays in
-- the review log. Last-write-wins by updated_at; `rev` is the pull cursor.

CREATE TABLE IF NOT EXISTS user_cards (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id      TEXT    NOT NULL,
  kind         TEXT    NOT NULL CHECK (kind IN ('word', 'phrase')),
  front        TEXT    NOT NULL,
  kanji        TEXT,
  gloss        TEXT    NOT NULL,
  gloss2       TEXT,
  usage_json   TEXT,
  hook_json    TEXT,
  example_json TEXT,
  verified     INTEGER NOT NULL,
  source       TEXT    NOT NULL CHECK (source IN ('user', 'pack', 'scenario')),
  tags_json    TEXT    NOT NULL DEFAULT '[]',
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  deleted      INTEGER NOT NULL DEFAULT 0,
  rev          INTEGER NOT NULL,
  PRIMARY KEY (user_id, card_id)
);
CREATE INDEX IF NOT EXISTS user_cards_rev ON user_cards (user_id, rev);

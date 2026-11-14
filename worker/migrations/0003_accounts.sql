-- Multi-user, phase A (docs/AI-PLAN.md "Wave 2"): passkey accounts with
-- bring-your-own-key AI. Every AI row belongs to one account; the Worker
-- always takes the account from the session, never from the request.
--
-- Existing single-owner data becomes account 1 (admin). Rows that can't be
-- attributed are deleted, so a new sign-up can never inherit them.

CREATE TABLE IF NOT EXISTS accounts (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT    NOT NULL,
  webauthn_user_id TEXT    NOT NULL UNIQUE,         -- base64url user handle given to authenticators
  cap_usd          REAL    NOT NULL DEFAULT 5,      -- monthly AI spending cap
  is_admin         INTEGER NOT NULL DEFAULT 0,
  disabled         INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL,
  last_seen_at     INTEGER
);

INSERT INTO accounts (id, name, webauthn_user_id, cap_usd, is_admin, created_at)
SELECT 1,
       'Owner',
       COALESCE((SELECT value FROM ai_settings WHERE key = 'webauthn_user_id'), 'legacy-' || lower(hex(randomblob(16)))),
       COALESCE((SELECT CAST(value AS REAL) FROM ai_settings WHERE key = 'cap_usd'), 5),
       1,
       CAST(strftime('%s', 'now') AS INTEGER) * 1000
 WHERE EXISTS (SELECT 1 FROM passkeys)
    OR EXISTS (SELECT 1 FROM ai_credentials)
    OR EXISTS (SELECT 1 FROM ai_ledger)
    OR EXISTS (SELECT 1 FROM ai_model_prices)
    OR EXISTS (SELECT 1 FROM ai_feature_models);

-- --------------------------------------------------------------- auth ----

ALTER TABLE passkeys ADD COLUMN user_id INTEGER;
ALTER TABLE passkeys ADD COLUMN name TEXT;           -- e.g. "iPhone", shown in the passkey list
UPDATE passkeys SET user_id = 1 WHERE EXISTS (SELECT 1 FROM accounts WHERE id = 1);
DELETE FROM passkeys WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS passkeys_user ON passkeys (user_id);

ALTER TABLE sessions ADD COLUMN user_id INTEGER;
UPDATE sessions SET user_id = 1 WHERE EXISTS (SELECT 1 FROM accounts WHERE id = 1);
DELETE FROM sessions WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);

ALTER TABLE recovery_codes ADD COLUMN user_id INTEGER;
UPDATE recovery_codes SET user_id = 1 WHERE EXISTS (SELECT 1 FROM accounts WHERE id = 1);
DELETE FROM recovery_codes WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS recovery_codes_user ON recovery_codes (user_id);

-- registration challenges carry the account they are for
ALTER TABLE auth_challenges ADD COLUMN user_id INTEGER;      -- adding a passkey to an existing account
ALTER TABLE auth_challenges ADD COLUMN user_handle TEXT;     -- sign-up: the new account's WebAuthn user id
ALTER TABLE auth_challenges ADD COLUMN signup_name TEXT;     -- sign-up: display name

-- ----------------------------------------------------------------- AI ----

ALTER TABLE ai_credentials ADD COLUMN user_id INTEGER;
-- 1: AAD = provider + base URL (single-owner rows); 2: AAD also binds user_id
ALTER TABLE ai_credentials ADD COLUMN aad_version INTEGER NOT NULL DEFAULT 1;
UPDATE ai_credentials SET user_id = 1 WHERE EXISTS (SELECT 1 FROM accounts WHERE id = 1);
DELETE FROM ai_credentials WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS ai_credentials_user ON ai_credentials (user_id);

ALTER TABLE ai_ledger ADD COLUMN user_id INTEGER;
UPDATE ai_ledger SET user_id = 1 WHERE EXISTS (SELECT 1 FROM accounts WHERE id = 1);
DELETE FROM ai_ledger WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS ai_ledger_user_at ON ai_ledger (user_id, at);

CREATE TABLE ai_model_prices_v2 (
  user_id      INTEGER NOT NULL,
  provider     TEXT    NOT NULL,
  model        TEXT    NOT NULL,
  input_per_m  REAL    NOT NULL,
  output_per_m REAL    NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, provider, model)
);
INSERT INTO ai_model_prices_v2 (user_id, provider, model, input_per_m, output_per_m, updated_at)
SELECT 1, provider, model, input_per_m, output_per_m, updated_at FROM ai_model_prices
 WHERE EXISTS (SELECT 1 FROM accounts WHERE id = 1);
DROP TABLE ai_model_prices;
ALTER TABLE ai_model_prices_v2 RENAME TO ai_model_prices;

CREATE TABLE ai_feature_models_v2 (
  user_id       INTEGER NOT NULL,
  feature       TEXT    NOT NULL CHECK (feature IN ('fill', 'propose', 'vision')),
  credential_id INTEGER NOT NULL,
  model         TEXT    NOT NULL,
  PRIMARY KEY (user_id, feature)
);
INSERT INTO ai_feature_models_v2 (user_id, feature, credential_id, model)
SELECT 1, feature, credential_id, model FROM ai_feature_models
 WHERE EXISTS (SELECT 1 FROM accounts WHERE id = 1);
DROP TABLE ai_feature_models;
ALTER TABLE ai_feature_models_v2 RENAME TO ai_feature_models;

-- the owner-wide settings now live on the account row
DELETE FROM ai_settings WHERE key IN ('cap_usd', 'webauthn_user_id');

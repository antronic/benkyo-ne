-- Beta consent and usage data (docs/BETA-DATA.md).
--
-- Numbered 0005 so it never collides with 0004 (Sign in with Apple, PR #2);
-- D1 applies whatever hasn't run yet in name order, so the gap is harmless.
--
-- Every row belongs to one account and is deleted with it. Usage rows
-- (beta_events, beta_ai_calls) are also deleted RETENTION_DAYS after they
-- arrive by the daily cron (worker/beta/routes.ts purgeOld).

-- One row per agreement. Current consent = newest row with withdrawn_at NULL.
CREATE TABLE IF NOT EXISTS beta_consents (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  version      INTEGER NOT NULL,
  accepted_at  INTEGER NOT NULL,
  withdrawn_at INTEGER,
  user_agent   TEXT                              -- browser that agreed, as evidence of consent
);
CREATE INDEX IF NOT EXISTS beta_consents_user ON beta_consents (user_id, accepted_at);

-- App usage events: progress, screens/features, errors, device snapshots.
CREATE TABLE IF NOT EXISTS beta_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  at          INTEGER NOT NULL,                  -- device clock
  app_session TEXT,                              -- random id per app launch
  kind        TEXT    NOT NULL CHECK (kind IN ('progress', 'event', 'error', 'device')),
  name        TEXT    NOT NULL,
  route       TEXT,
  app_version TEXT,
  country     TEXT,                              -- Cloudflare's country guess, never the IP
  data_json   TEXT
);
CREATE INDEX IF NOT EXISTS beta_events_user_at ON beta_events (user_id, at);
CREATE INDEX IF NOT EXISTS beta_events_received ON beta_events (received_at);
CREATE INDEX IF NOT EXISTS beta_events_kind_name ON beta_events (kind, name, at);

-- AI calls, recorded by the Worker: what was asked, the prompt, the reply.
-- Attached images are not stored, only their type and size. API keys never
-- reach this table (they are decrypted only to call the provider).
CREATE TABLE IF NOT EXISTS beta_ai_calls (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL,
  at             INTEGER NOT NULL,
  kind           TEXT    NOT NULL,               -- propose | fill | lesson | ask | ask_stream
  feature        TEXT,                           -- model slot: fill | propose | vision
  provider       TEXT,
  model          TEXT,
  status         TEXT    NOT NULL,               -- done | failed | invalid | stopped
  error          TEXT,
  latency_ms     INTEGER,
  input_tokens   INTEGER,
  output_tokens  INTEGER,
  cost_usd       REAL,
  request_json   TEXT,                           -- what the app sent (image replaced by its size)
  prompt_system  TEXT,
  prompt_user    TEXT,
  output_text    TEXT,                           -- the model's raw reply
  result_json    TEXT                            -- the validated reply the app received
);
CREATE INDEX IF NOT EXISTS beta_ai_calls_user_at ON beta_ai_calls (user_id, at);
CREATE INDEX IF NOT EXISTS beta_ai_calls_at ON beta_ai_calls (at);

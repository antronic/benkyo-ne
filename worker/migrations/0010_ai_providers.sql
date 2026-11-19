-- Fleet console: platform AI providers and the models each package includes.
-- These are the operator's own provider keys (for managed AI in paid
-- packages), separate from the keys learners bring themselves
-- (ai_credentials). Keys are AES-GCM encrypted with AI_MASTER_KEY and never
-- read back; only the last four characters are shown.

CREATE TABLE IF NOT EXISTS ai_providers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kind        TEXT    NOT NULL,              -- 'anthropic' | 'openai-compatible'
  preset      TEXT    NOT NULL,              -- 'anthropic' | 'openai' | 'openrouter' | 'gemini' | ... | 'custom'
  label       TEXT    NOT NULL,
  base_url    TEXT,                          -- openai-compatible only
  key_cipher  TEXT    NOT NULL,
  key_iv      TEXT    NOT NULL,
  key_last4   TEXT    NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  model_count INTEGER,                       -- models the provider listed at the last check
  checked_at  INTEGER,                       -- last time the model list was fetched
  check_error TEXT,                          -- last fetch error, NULL when it worked
  created_at  INTEGER NOT NULL,
  created_by  INTEGER,                       -- accounts.id of the admin
  updated_at  INTEGER NOT NULL
);

-- Which models a package includes, and which app features each one serves.
-- Prices are copied from the provider's list when the model is added, so the
-- console can show margins without calling the provider.
CREATE TABLE IF NOT EXISTS plan_models (
  plan_id     TEXT    NOT NULL REFERENCES plans (id),
  provider_id INTEGER NOT NULL REFERENCES ai_providers (id),
  model       TEXT    NOT NULL,
  label       TEXT    NOT NULL,
  features    TEXT    NOT NULL DEFAULT '',   -- comma list of fill, propose, vision
  input_per_m  REAL,                         -- USD per million tokens, NULL when unknown
  output_per_m REAL,
  position    INTEGER NOT NULL,
  added_at    INTEGER NOT NULL,
  PRIMARY KEY (plan_id, provider_id, model)
);
CREATE INDEX IF NOT EXISTS plan_models_provider ON plan_models (provider_id);

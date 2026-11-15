-- Fleet console PR 5: packages (Free / Plus / Pro) and manual grants.
-- Prices and the monthly AI allowance are edited in the console. Grants are
-- how an account gets a paid package today (comp or trial); checkout and
-- payment webhooks will add kind 'subscription' rows later.

CREATE TABLE IF NOT EXISTS plans (
  id               TEXT    PRIMARY KEY,           -- 'free' | 'plus' | 'pro'
  rank             INTEGER NOT NULL,              -- higher wins when grants overlap
  name             TEXT    NOT NULL,
  price_month_usd  REAL    NOT NULL,
  price_year_usd   REAL    NOT NULL,
  ai_allowance_usd REAL    NOT NULL,              -- managed AI model cost included per month
  blurb            TEXT    NOT NULL DEFAULT '',
  available        INTEGER NOT NULL DEFAULT 1,    -- offered to new people
  updated_at       INTEGER NOT NULL,
  updated_by       INTEGER                         -- accounts.id of the admin
);

-- Starting point: the pricing proposal in docs/AI-PLAN.md.
INSERT OR IGNORE INTO plans (id, rank, name, price_month_usd, price_year_usd, ai_allowance_usd, blurb, updated_at) VALUES
  ('free', 0, 'Free', 0, 0, 0, 'All lessons, reviews, dictionary cards and sync. AI with your own key.', 0),
  ('plus', 1, 'Plus', 4.99, 39, 1.5, 'Managed AI: hooks, examples, bilingual content, scenario mode.', 0),
  ('pro', 2, 'Pro', 9.99, 79, 3.5, 'More managed AI, photo mode, mistake tutor, new features first.', 0);

CREATE TABLE IF NOT EXISTS plan_grants (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  plan_id    TEXT    NOT NULL REFERENCES plans (id),
  kind       TEXT    NOT NULL,                    -- 'comp' | 'trial' (later 'subscription')
  note       TEXT,
  starts_at  INTEGER NOT NULL,
  ends_at    INTEGER,                             -- NULL: until ended
  created_at INTEGER NOT NULL,
  created_by INTEGER,                             -- accounts.id of the admin
  ended_at   INTEGER                              -- ended early from the console
);
CREATE INDEX IF NOT EXISTS plan_grants_account ON plan_grants (account_id, ended_at);

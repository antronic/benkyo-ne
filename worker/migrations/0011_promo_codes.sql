-- Promo codes: made in the fleet console, redeemed by a signed-in learner in
-- Settings. A redemption gives the account a package for a while, as an
-- ordinary plan_grants row (kind 'trial' or 'comp', note 'Promo <code>').
-- Numbered 0011 because PR #30 holds 0010_ai_providers.sql.

CREATE TABLE IF NOT EXISTS promo_codes (
  code        TEXT    PRIMARY KEY,                 -- upper-case letters and digits, e.g. SONGKRAN27 or 7KQ2MX9DPA
  label       TEXT,                                -- what it's for (admin only)
  plan_id     TEXT    NOT NULL REFERENCES plans (id),
  kind        TEXT    NOT NULL,                    -- 'trial' | 'comp': the kind of grant it makes
  days        INTEGER,                             -- how long the grant lasts; NULL: until ended (comp only)
  max_uses    INTEGER,                             -- NULL: no limit
  uses        INTEGER NOT NULL DEFAULT 0,
  expires_at  INTEGER,                             -- last moment it can be redeemed; NULL: never
  disabled_at INTEGER,                             -- switched off in the console
  created_at  INTEGER NOT NULL,
  created_by  INTEGER                              -- accounts.id of the admin
);

CREATE TABLE IF NOT EXISTS promo_redemptions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT    NOT NULL REFERENCES promo_codes (code),
  account_id  INTEGER NOT NULL,
  grant_id    INTEGER,                             -- plan_grants.id it made
  redeemed_at INTEGER NOT NULL,
  UNIQUE (code, account_id)                        -- once per account
);
CREATE INDEX IF NOT EXISTS promo_redemptions_code ON promo_redemptions (code, redeemed_at);

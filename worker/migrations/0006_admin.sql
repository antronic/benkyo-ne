-- Fleet console (operator console at /admin), PR 1 of the plan.
-- Runtime settings the console can change, and an audit log of every admin
-- action. Numbered 0006 to stay clear of the 0004/0005 migrations in other
-- open branches.

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT    PRIMARY KEY,
  value      TEXT    NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by INTEGER                               -- accounts.id of the admin
);

CREATE TABLE IF NOT EXISTS admin_audit (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          INTEGER NOT NULL,
  actor_id    INTEGER NOT NULL,                    -- accounts.id of the admin
  actor_email TEXT,                                -- Cloudflare Access identity
  action      TEXT    NOT NULL,                    -- e.g. 'account.disable'
  target_id   INTEGER,                             -- accounts.id acted on, if any
  detail_json TEXT
);
CREATE INDEX IF NOT EXISTS admin_audit_at ON admin_audit (at);

CREATE INDEX IF NOT EXISTS accounts_created_at ON accounts (created_at);
CREATE INDEX IF NOT EXISTS accounts_last_seen_at ON accounts (last_seen_at);

-- Benkyo D1 schema. The review log is append-only; card state is derived
-- from it on the device (docs/PLAN.md §8.3).

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_key_hash TEXT    NOT NULL UNIQUE,          -- SHA-256 of the device's sync key
  created_at    INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS review_log (
  seq          INTEGER PRIMARY KEY AUTOINCREMENT, -- server cursor for pulls
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id           TEXT    NOT NULL,                  -- client-generated log id
  card_id      TEXT    NOT NULL,
  grade        INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 4),
  reviewed_at  INTEGER NOT NULL,
  elapsed_days REAL    NOT NULL,
  duration_ms  INTEGER NOT NULL,
  UNIQUE (user_id, id)
);

CREATE INDEX IF NOT EXISTS review_log_user_seq ON review_log (user_id, seq);

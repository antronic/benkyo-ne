-- Personal notes (docs/NOTES.md): one private note per study item, synced
-- like user_cards. `subject` is the item's id: word:/phrase: card ids,
-- kana:<char>, kanji:<char>, unit:<course>/<unit>, pack:<id>, lesson:<id>.
-- Last-write-wins by updated_at; `rev` (per store, monotonic) is the pull
-- cursor; a deleted note keeps a tombstone so the delete reaches other devices.

CREATE TABLE IF NOT EXISTS user_notes (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject    TEXT    NOT NULL,
  label      TEXT    NOT NULL DEFAULT '',   -- what the item is called, for the Notes list
  body       TEXT    NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  rev        INTEGER NOT NULL,
  PRIMARY KEY (user_id, subject)
);
CREATE INDEX IF NOT EXISTS user_notes_rev ON user_notes (user_id, rev);

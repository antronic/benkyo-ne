-- Community, phase 2 (docs/COMMUNITY.md): shared notes on study items, replies, likes,
-- reports and blocks. Everything is keyed by the account from the session.

-- A public handle, separate from the private account name. Made the first time you share.
CREATE TABLE IF NOT EXISTS community_profiles (
  account_id          INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  handle              TEXT    NOT NULL COLLATE NOCASE UNIQUE,
  guidelines_version  INTEGER NOT NULL,
  status              TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'muted', 'banned')),
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);

-- Everything shared is a post. Phase 2 only makes 'note' posts (a copy of your private note).
CREATE TABLE IF NOT EXISTS community_posts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id     INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type          TEXT    NOT NULL CHECK (type IN ('note', 'pack', 'tip', 'blog')),
  subject       TEXT,
  label         TEXT    NOT NULL DEFAULT '',
  title         TEXT    NOT NULL DEFAULT '',
  body          TEXT    NOT NULL,
  lang          TEXT    NOT NULL CHECK (lang IN ('en', 'th', 'ja')),
  status        TEXT    NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'removed')),
  like_count    INTEGER NOT NULL DEFAULT 0,
  reply_count   INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  edited_at     INTEGER,
  removed_at    INTEGER
);
-- one shared note per person per item
CREATE UNIQUE INDEX IF NOT EXISTS community_posts_note ON community_posts (author_id, subject) WHERE type = 'note';
CREATE INDEX IF NOT EXISTS community_posts_subject ON community_posts (subject, status, like_count);
CREATE INDEX IF NOT EXISTS community_posts_created ON community_posts (created_at);

-- One level of replies.
CREATE TABLE IF NOT EXISTS community_replies (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id     INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_id   INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  body        TEXT    NOT NULL,
  lang        TEXT    NOT NULL CHECK (lang IN ('en', 'th', 'ja')),
  status      TEXT    NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'removed')),
  like_count  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  removed_at  INTEGER
);
CREATE INDEX IF NOT EXISTS community_replies_post ON community_replies (post_id, created_at);
CREATE INDEX IF NOT EXISTS community_replies_created ON community_replies (created_at);

-- A single heart per person on a post or reply; counts are kept on the post or reply.
CREATE TABLE IF NOT EXISTS community_likes (
  target_kind  TEXT    NOT NULL CHECK (target_kind IN ('post', 'reply')),
  target_id    INTEGER NOT NULL,
  account_id   INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (target_kind, target_id, account_id)
);

-- Reports feed the Community screen in the fleet console.
CREATE TABLE IF NOT EXISTS community_reports (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  target_kind  TEXT    NOT NULL CHECK (target_kind IN ('post', 'reply')),
  target_id    INTEGER NOT NULL,
  reporter_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  reason       TEXT    NOT NULL CHECK (reason IN ('spam', 'harassment', 'wrong', 'sexual', 'other')),
  detail       TEXT    NOT NULL DEFAULT '',
  status       TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'dismissed')),
  created_at   INTEGER NOT NULL,
  handled_at   INTEGER,
  handled_by   INTEGER,
  UNIQUE (target_kind, target_id, reporter_id)
);
CREATE INDEX IF NOT EXISTS community_reports_open ON community_reports (status, created_at);

-- Blocking a person hides their posts and replies from you only.
CREATE TABLE IF NOT EXISTS community_blocks (
  account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  blocked_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (account_id, blocked_id)
);

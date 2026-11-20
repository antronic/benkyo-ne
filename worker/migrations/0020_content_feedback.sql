-- Content feedback (docs/FEEDBACK.md): a thumb up or down, and reports, on
-- lessons, units, grammar points, kanji and words. One vote per account per
-- subject; a report stays open until Job marks it fixed or dismissed in Fleet.
CREATE TABLE content_votes (
	subject TEXT NOT NULL,
	account_id INTEGER NOT NULL REFERENCES accounts(id),
	vote INTEGER NOT NULL CHECK (vote IN (-1, 1)),
	label TEXT NOT NULL DEFAULT '',
	updated_at INTEGER NOT NULL,
	PRIMARY KEY (subject, account_id)
);
CREATE INDEX content_votes_account ON content_votes (account_id);

CREATE TABLE content_reports (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	subject TEXT NOT NULL,
	label TEXT NOT NULL DEFAULT '',
	account_id INTEGER NOT NULL REFERENCES accounts(id),
	reason TEXT NOT NULL,
	detail TEXT NOT NULL DEFAULT '',
	locale TEXT NOT NULL DEFAULT '',
	status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'fixed', 'dismissed')),
	created_at INTEGER NOT NULL,
	handled_at INTEGER
);
CREATE INDEX content_reports_open ON content_reports (status, created_at);
CREATE INDEX content_reports_subject ON content_reports (subject, account_id, status);

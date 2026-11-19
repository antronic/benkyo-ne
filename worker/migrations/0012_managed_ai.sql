-- Managed AI: a learner on a paid package runs AI through the operator's
-- provider keys (ai_providers) on the models the package assigns
-- (plan_models), counted against the package's monthly ai_allowance_usd.
--
-- ai_ledger.source says whose money a call spent: 'own' (the learner's key,
-- counted against accounts.cap_usd) or 'package' (the operator's key,
-- counted against the package allowance). plan_id is the package a
-- 'package' call was billed to, so Fleet can show usage per package.
ALTER TABLE ai_ledger ADD COLUMN source TEXT NOT NULL DEFAULT 'own';
ALTER TABLE ai_ledger ADD COLUMN plan_id TEXT;
CREATE INDEX IF NOT EXISTS ai_ledger_user_source_at ON ai_ledger (user_id, source, at);

-- Which AI the learner prefers when both exist: 'package' (default) or 'own'.
ALTER TABLE accounts ADD COLUMN ai_source TEXT NOT NULL DEFAULT 'package';

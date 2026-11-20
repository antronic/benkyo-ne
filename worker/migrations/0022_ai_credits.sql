-- AI credits: a package's managed AI is counted in credits instead of USD.
--
-- plans.ai_credits is what a package gives each month. model_credit_rates is
-- what each model costs in credits, set in the fleet console: input and
-- output credits per `unit` tokens (1, 1000 or 1000000). A model without a
-- rate costs its USD price at 1000 credits per dollar (src/lib/ai/credits.ts),
-- so existing packages start at their USD allowance x 1000 and behave as
-- before until a rate is set.
--
-- ai_ledger.credits is what a 'package' row spent (0 for 'own' rows, which
-- stay in USD against the learner's own cap). cost_usd is still recorded for
-- every row: it's what the operator's provider charged.

ALTER TABLE plans ADD COLUMN ai_credits REAL NOT NULL DEFAULT 0;
UPDATE plans SET ai_credits = ROUND(ai_allowance_usd * 1000);

CREATE TABLE IF NOT EXISTS model_credit_rates (
  provider_id    INTEGER NOT NULL REFERENCES ai_providers (id),
  model          TEXT    NOT NULL,
  unit           INTEGER NOT NULL,           -- 1 | 1000 | 1000000 tokens
  input_credits  REAL    NOT NULL,           -- credits per `unit` input tokens
  output_credits REAL    NOT NULL,           -- credits per `unit` output tokens
  updated_at     INTEGER NOT NULL,
  updated_by     INTEGER,                    -- accounts.id of the admin
  PRIMARY KEY (provider_id, model)
);

ALTER TABLE ai_ledger ADD COLUMN credits REAL NOT NULL DEFAULT 0;
-- this month's managed AI so far, at the default exchange, so nobody's allowance resets mid-month
UPDATE ai_ledger SET credits = cost_usd * 1000 WHERE source = 'package';

-- Sync follows the signed-in account (docs/AI-PLAN.md phase A, "Sync moves
-- from the sync key to the signed-in account").
--
-- `users` stays the sync store that review_log and user_cards hang off. A
-- store now belongs either to a sync key (as before) or to an account. An
-- account's store uses the placeholder sync_key_hash 'account:<id>', which can
-- never equal a SHA-256 hex digest.
--
-- The first time a device that still has an old sync key syncs while signed
-- in, the key's data moves into the account's store and the key store is
-- marked claimed. A claimed key can't be used for sync any more.

ALTER TABLE users ADD COLUMN account_id INTEGER;   -- set for an account's store
ALTER TABLE users ADD COLUMN claimed_by INTEGER;   -- set when a key store moved into this account
CREATE UNIQUE INDEX IF NOT EXISTS users_account ON users (account_id) WHERE account_id IS NOT NULL;

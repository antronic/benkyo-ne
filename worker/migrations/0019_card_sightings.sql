-- Personal phrasebook (docs/EVERYDAY.md): how often a card has come up in the
-- learner's life (photos, look-ups, the Writing helper) and the last few
-- places. JSON {"count": n, "recent": [{"at", "via", "ctx"}]}, null when never seen.
ALTER TABLE user_cards ADD COLUMN seen_json TEXT;

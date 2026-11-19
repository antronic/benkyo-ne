-- VIP invite cards (Job, 2026-11-19): a named invite can carry a note, who it's
-- from and handwriting (JSON, src/lib/ui/ink.ts). Opening /invite/<name> shows
-- them as a card before sign-up. All three are optional.
ALTER TABLE invite_codes ADD COLUMN card_note TEXT;
ALTER TABLE invite_codes ADD COLUMN card_from TEXT;
ALTER TABLE invite_codes ADD COLUMN card_ink TEXT;

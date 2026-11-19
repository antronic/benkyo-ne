-- Delete in Fleet hides an invite (VIP or code) or a promo code without
-- removing its row: redemptions, grants made from it, accounts.invite_code and
-- the audit log keep pointing at it. A deleted one can't be used, isn't listed,
-- and its name stays taken.
ALTER TABLE invite_codes ADD COLUMN deleted_at INTEGER;
ALTER TABLE promo_codes ADD COLUMN deleted_at INTEGER;

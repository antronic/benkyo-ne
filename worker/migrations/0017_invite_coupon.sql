-- A VIP invite (Fleet → Invitations) can carry a promo code: /invite/<vip> then
-- uses it without ?coupon= in the link (a ?coupon= still wins). The code as
-- promo_codes stores it; checked when the link opens, so a code that is later
-- switched off or used up simply gives no perk.
ALTER TABLE invite_codes ADD COLUMN coupon TEXT;

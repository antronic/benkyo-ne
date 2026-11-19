/**
 * Invite cards: shared shapes between the app (src/routes/invite/[code]), the
 * fleet console (Invitations → VIP invites) and the Worker (worker/invite.ts).
 * Change both sides in the same PR.
 */
import type { Ink } from '../ui/ink.ts';

export const CARD_NOTE_MAX = 280;
export const CARD_FROM_MAX = 40;

export interface InviteCardData {
	note: string;
	from: string;
	/** handwriting played back on the card; null: none */
	ink: Ink | null;
}

/** GET /api/auth/invite/:code[?coupon=CODE], signed out. 404 unless the invite is live and has a card. */
export interface InviteCardResponse {
	code: string;
	card: InviteCardData;
	/** what the coupon in the link gives, when it can still be redeemed */
	perk: { planName: string; kind: 'comp' | 'trial'; days: number | null } | null;
	/** the promo code the link uses (?coupon= or the VIP's own), as stored; save it for after sign-up. null: none that can be redeemed */
	coupon: string | null;
}

/** PATCH /api/admin/invites/:code: change a VIP's card and/or its promo code; null clears, left out keeps. */
export interface AdminInvitePatch {
	card?: InviteCardData | null;
	/** a promo code from Fleet → Promo codes; null: none */
	coupon?: string | null;
}

/**
 * Promo codes: shared shapes between the app, the fleet console and the
 * Worker (worker/promo.ts, worker/admin/promos.ts). Change both sides in
 * the same PR.
 */

/** Why a code couldn't be redeemed. The app shows its own words for each. */
export type PromoProblem = 'invalid' | 'disabled' | 'expired' | 'used_up' | 'already_redeemed' | 'already_on_plan' | 'rate_limited';

/** Error body for POST /api/promo/redeem. */
export interface PromoError {
	error: 'bad_request' | 'rate_limited' | 'unauthorized';
	message: string;
	problem?: PromoProblem;
}

/** GET /api/promo: the package the signed-in account is on now. */
export interface PromoStatus {
	plan: string;
	planName: string;
	/** the live grant behind it; null on Free */
	grant: { kind: 'comp' | 'trial'; endsAt: number | null; promoCode: string | null } | null;
}

/** POST /api/promo/redeem {code} */
export interface PromoRedeemed extends PromoStatus {
	code: string;
}

// ------------------------------------------------------------ fleet ----

export interface AdminPromo {
	code: string;
	label: string | null;
	plan: string;
	kind: 'comp' | 'trial';
	/** grant length; null: until ended */
	days: number | null;
	/** null: no limit */
	maxUses: number | null;
	uses: number;
	expiresAt: number | null;
	disabledAt: number | null;
	createdAt: number;
	/** 'live' | 'disabled' | 'expired' | 'used_up' */
	state: 'live' | 'disabled' | 'expired' | 'used_up';
}

export interface AdminPromoRedemption {
	accountId: number;
	accountName: string | null;
	redeemedAt: number;
	grantId: number | null;
	/** that grant is still live */
	live: boolean;
}

/** GET /api/admin/promos */
export interface AdminPromoList {
	promos: AdminPromo[];
	/** packages a code can give (not Free) */
	plans: { id: string; name: string }[];
}

/** GET /api/admin/promos/:code */
export interface AdminPromoDetail extends AdminPromo {
	redemptions: AdminPromoRedemption[];
}

/** POST /api/admin/promos. Leave `code` out for a random one. */
export interface AdminPromoInput {
	code?: string;
	label?: string;
	plan: string;
	kind: 'comp' | 'trial';
	days: number | null;
	maxUses: number | null;
	expiresInDays: number | null;
}

/** PATCH /api/admin/promos/:code */
export interface AdminPromoPatch {
	disabled: boolean;
}

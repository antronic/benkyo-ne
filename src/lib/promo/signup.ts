/**
 * After a sign-up: the server already redeemed the link's promo code (or the invite's own,
 * worker/promo.ts signupPromo), so the saved code is done with and the package shows at once.
 * When it gave nothing, the saved code stays and the root layout tries it later and says why.
 */
import { t } from '#lib/i18n/index.svelte.ts';
import { toast } from '#lib/ios/overlay.svelte.ts';
import { plan } from '#lib/state/plan.svelte.ts';
import type { PromoRedeemed } from './contract.ts';
import { clearPendingPromo, pendingPromo } from './link.ts';

/** The promo code to send with a sign-up: the one saved from a link, if any. */
export const signupCoupon = () => pendingPromo()?.code;

export function promoAtSignup(promo: PromoRedeemed | null | undefined) {
	if (!promo) return;
	clearPendingPromo();
	plan.set(promo);
	toast(t('promo.linkRedeemed', { plan: promo.planName }), '🎉', 3200);
}

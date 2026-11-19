/** Browser client for invite cards (worker/invite.ts). null when there is no card or it can't be fetched; 'ended' when the invite was deleted, revoked, used up or expired. */
import type { InviteCardResponse } from './contract.ts';

export async function fetchInviteCard(code: string, coupon: string | null, timeoutMs = 4000): Promise<InviteCardResponse | 'ended' | 'full' | null> {
	if (typeof navigator !== 'undefined' && !navigator.onLine) return null;
	const ctl = new AbortController();
	const timer = setTimeout(() => ctl.abort(), timeoutMs);
	try {
		const q = coupon ? `?coupon=${encodeURIComponent(coupon)}` : '';
		const res = await fetch(`/api/auth/invite/${encodeURIComponent(code)}${q}`, { credentials: 'same-origin', signal: ctl.signal });
		if (res.status === 410) {
			const body = (await res.json().catch(() => null)) as { reason?: string } | null;
			return body?.reason === 'full' ? 'full' : 'ended';
		}
		return res.ok ? ((await res.json()) as InviteCardResponse) : null;
	} catch {
		return null; // offline or slow: sign-up still works without the card
	} finally {
		clearTimeout(timer);
	}
}

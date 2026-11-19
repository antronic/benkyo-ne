/**
 * The package the signed-in account is on (Free, Plus, Pro or a console
 * package), for the Today badge. Comes from GET /api/promo (worker/promo.ts),
 * which reads the live plan_grants row, so Fleet grants and promo codes both
 * show. The last answer is kept in localStorage (`benkyo.plan`) per account,
 * so the badge shows straight away and offline; a fresh answer replaces it.
 */
import { promoStatus } from '#lib/promo/client.ts';
import type { PromoStatus } from '#lib/promo/contract.ts';

const KEY = 'benkyo.plan';

export interface PlanInfo {
	plan: string;
	planName: string;
}

interface Cached extends PlanInfo {
	accountId: number;
}

function readCache(accountId: number): PlanInfo | null {
	try {
		const c = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Cached | null;
		return c && c.accountId === accountId && typeof c.plan === 'string' ? { plan: c.plan, planName: c.planName } : null;
	} catch {
		return null;
	}
}

function writeCache(accountId: number, p: PlanInfo) {
	try {
		localStorage.setItem(KEY, JSON.stringify({ accountId, plan: p.plan, planName: p.planName } satisfies Cached));
	} catch {
		// storage full or blocked: the badge just loads again next time
	}
}

class Plan {
	/** the package, or null while unknown (signed out, or not loaded yet) */
	value = $state<PlanInfo | null>(null);
	/** a request is out and nothing is known yet: show a skeleton */
	loading = $state(false);
	#account: number | null = null;

	/** Load for this account (null: signed out). Safe to call on every change. */
	async load(accountId: number | null, fetcher: () => Promise<PromoStatus> = promoStatus) {
		if (accountId === null) {
			this.#account = null;
			this.value = null;
			this.loading = false;
			return;
		}
		if (this.#account !== accountId) {
			this.#account = accountId;
			this.value = readCache(accountId);
		}
		this.loading = this.value === null;
		try {
			const s = await fetcher();
			if (this.#account !== accountId) return;
			this.set(s);
		} catch {
			// offline or the server is unreachable: keep what we had
		} finally {
			if (this.#account === accountId) this.loading = false;
		}
	}

	/** A fresh answer, e.g. right after a promo code is redeemed. */
	set(s: PlanInfo) {
		this.value = { plan: s.plan, planName: s.planName };
		if (this.#account !== null) writeCache(this.#account, this.value);
	}
}

export const plan = new Plan();


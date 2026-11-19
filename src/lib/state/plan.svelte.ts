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
	/** account name, so the greeting works offline */
	name: string;
	/** when a trial or time-limited grant ends (ms); null: no end */
	endsAt: number | null;
}

const FREE: PlanInfo = { plan: 'free', planName: 'Free' };

/** The cached package, or Free once its grant has ended. */
export function fromCache(c: Pick<Cached, 'plan' | 'planName' | 'endsAt'>, now = Date.now()): PlanInfo {
	return c.endsAt !== null && c.endsAt <= now ? FREE : { plan: c.plan, planName: c.planName };
}

function readCache(): Cached | null {
	try {
		const c = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Cached | null;
		return c && typeof c.accountId === 'number' && typeof c.plan === 'string' ? { ...c, endsAt: c.endsAt ?? null, name: c.name ?? '' } : null;
	} catch {
		return null;
	}
}

function writeCache(c: Cached | null) {
	try {
		if (c) localStorage.setItem(KEY, JSON.stringify(c));
		else localStorage.removeItem(KEY);
	} catch {
		// storage full or blocked: the badge just loads again next time
	}
}

class Plan {
	/** the package, or null while unknown (signed out, or not loaded yet) */
	value = $state<PlanInfo | null>(null);
	/** the account name from the last time we were signed in (for offline launches) */
	name = $state('');
	/** a request is out and nothing is known yet: show a skeleton */
	loading = $state(false);
	#account: number | null = null;
	#name = '';

	/**
	 * Not known yet whether anyone is signed in (offline launch, or /api/auth/me
	 * still out): show the last known package and name on this device.
	 */
	restore() {
		if (this.#account !== null || this.value) return;
		const c = readCache();
		if (!c) return;
		this.value = fromCache(c);
		this.name = c.name;
	}

	/** Load for this account (null: signed out, which forgets the cache). Safe to call on every change. */
	async load(accountId: number | null, name = '', fetcher: () => Promise<PromoStatus> = promoStatus) {
		if (accountId === null) {
			this.#account = null;
			this.value = null;
			this.name = '';
			this.loading = false;
			writeCache(null);
			return;
		}
		this.#name = name;
		this.name = name;
		if (this.#account !== accountId) {
			this.#account = accountId;
			const c = readCache();
			this.value = c && c.accountId === accountId ? fromCache(c) : null;
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
	set(s: PromoStatus) {
		this.value = { plan: s.plan, planName: s.planName };
		if (this.#account !== null) {
			writeCache({ accountId: this.#account, name: this.#name, plan: s.plan, planName: s.planName, endsAt: s.grant?.endsAt ?? null });
		}
	}
}

export const plan = new Plan();

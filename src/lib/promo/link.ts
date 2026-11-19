/**
 * Promo links: https://benkyo.jirachai.me/?ref=CODE (or ?coupon=CODE), and
 * sign-up links /invite/INVITE?coupon=CODE (src/routes/invite/[code]) that
 * also fill in the invite on the sign-up screen. The root layout takes the
 * code off the address when the app opens and keeps it on this device
 * (localStorage `benkyo.promoLink`) through the intro, sign-up and consent;
 * once someone is signed in it redeems it once and forgets it. Fleet copies
 * the link for each code (`promoLink`).
 */

const KEY = 'benkyo.promoLink';
/** a saved code is dropped after this long without anyone signing in */
export const LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** " songkran-27 " → "SONGKRAN27"; null when it can't be a code (the server has the final say). */
export function cleanRef(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const s = raw.toUpperCase().replace(/[\s\-.]/g, '');
	return /^[0-9A-Z][0-9A-Z_]{2,22}[0-9A-Z]$/.test(s) ? s : null;
}

const PARAMS = ['ref', 'coupon'];

/** The code in `?ref=` or `?coupon=`, and the address without them (null when nothing to take). */
export function takeRef(url: URL): { code: string | null; rest: string } | null {
	const key = PARAMS.find((k) => url.searchParams.has(k));
	if (!key) return null;
	const code = cleanRef(url.searchParams.get(key));
	const u = new URL(url);
	for (const k of PARAMS) u.searchParams.delete(k);
	return { code, rest: u.pathname + u.search + u.hash };
}

/** An invite as worker/auth/signup.ts normalizeInvite reads it: "bk 7kq2 mx9d" → "BK-7KQ2-MX9D", "vip" → "VIP"; null when it can't be one. */
export function cleanInvite(raw: string | null | undefined): string | null {
	if (!raw || raw.length > 64) return null;
	const s = raw.toUpperCase();
	if (!s.includes('_')) {
		const alnum = s.replace(/[^0-9A-Z]/g, '');
		const body = alnum.startsWith('BK') && alnum.length === 10 ? alnum.slice(2) : alnum;
		if (/^[0-9A-Z]{8}$/.test(body)) return `BK-${body.slice(0, 4)}-${body.slice(4)}`;
	}
	const named = s.replace(/[\s\-.]/g, '');
	return /^[0-9A-Z][0-9A-Z_]{1,18}[0-9A-Z]$/.test(named) ? named : null;
}

const base = (origin: string) => origin.replace(/\/$/, '');

/** The shareable link for a code: the app (`/?ref=`), or sign-up with an invite (`/invite/INVITE?coupon=`). */
export const promoLink = (code: string, origin: string, invite?: string | null) =>
	invite ? `${base(origin)}/invite/${encodeURIComponent(invite)}?coupon=${encodeURIComponent(code)}` : `${base(origin)}/?ref=${encodeURIComponent(code)}`;

interface Saved {
	code: string;
	at: number;
	/** we already told a signed-out visitor it's saved */
	told?: boolean;
}

function read(): Saved | null {
	try {
		const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null;
		return s && typeof s.code === 'string' && typeof s.at === 'number' ? s : null;
	} catch {
		return null;
	}
}

function write(s: Saved | null) {
	try {
		if (s) localStorage.setItem(KEY, JSON.stringify(s));
		else localStorage.removeItem(KEY);
	} catch {
		// storage blocked: the code can still be typed in Settings
	}
}

export const savePendingPromo = (code: string, now = Date.now()) => write({ code, at: now });

/** The saved code, or null (none, or too old). */
export function pendingPromo(now = Date.now()): Saved | null {
	const s = read();
	if (s && now - s.at > LINK_TTL_MS) {
		write(null);
		return null;
	}
	return s;
}

export function markPendingTold() {
	const s = read();
	if (s) write({ ...s, told: true });
}

export const clearPendingPromo = () => write(null);

// The invite from a sign-up link, for the Welcome sheet's invite field.
const INVITE_KEY = 'benkyo.inviteLink';
export function savePendingInvite(code: string) {
	try {
		sessionStorage.setItem(INVITE_KEY, code);
	} catch {
		// storage blocked: the invite can still be typed
	}
}
export function pendingInvite(): string | null {
	try {
		return sessionStorage.getItem(INVITE_KEY);
	} catch {
		return null;
	}
}
export function clearPendingInvite() {
	try {
		sessionStorage.removeItem(INVITE_KEY);
	} catch {
		// nothing to clear
	}
}

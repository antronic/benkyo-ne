/**
 * Promo links: https://benkyo.jirachai.me/?ref=CODE. The root layout takes the
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

/** The code in `?ref=`, and the address without it (null when nothing to take). */
export function takeRef(url: URL): { code: string | null; rest: string } | null {
	if (!url.searchParams.has('ref')) return null;
	const code = cleanRef(url.searchParams.get('ref'));
	const u = new URL(url);
	u.searchParams.delete('ref');
	return { code, rest: u.pathname + u.search + u.hash };
}

/** The shareable link for a code. */
export const promoLink = (code: string, origin: string) => `${origin.replace(/\/$/, '')}/?ref=${encodeURIComponent(code)}`;

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

/**
 * Interface language.
 *
 * English is the source language: `en.ts` holds every UI string and defines
 * the keys. Other languages (`th.ts`) may leave keys out; a missing key falls
 * back to English, so a half-translated screen still works.
 *
 * The choice is a per-device setting kept in localStorage ('auto' follows
 * the browser language). It is not synced, because it describes the device
 * and its user, not the learning progress.
 */
import { en, type MessageKey } from './en.ts';
import { th } from './th.ts';

export type Locale = 'en' | 'th';
export type LocalePref = 'auto' | Locale;
export type { MessageKey };

/** Languages offered in Settings, named in their own language. */
export const LOCALES: { code: Locale; name: string }[] = [
	{ code: 'en', name: 'English' },
	{ code: 'th', name: 'ไทย' }
];

const DICTS: Record<Locale, Partial<Record<MessageKey, string>>> = { en, th };
const STORE = 'benkyo.locale';

/** Best supported language for a list of BCP 47 tags (e.g. navigator.languages). */
export function matchLocale(tags: readonly string[] | undefined): Locale {
	for (const tag of tags ?? []) {
		const base = tag.toLowerCase().split(/[-_]/)[0];
		if (base === 'th') return 'th';
		if (base === 'en') return 'en';
	}
	return 'en';
}

function readPref(): LocalePref {
	try {
		const v = localStorage.getItem(STORE);
		return v === 'en' || v === 'th' ? v : 'auto';
	} catch {
		return 'auto';
	}
}

const browserLocale = () =>
	typeof navigator === 'undefined' ? 'en' : matchLocale(navigator.languages?.length ? navigator.languages : [navigator.language]);

const state = $state<{ pref: LocalePref; browser: Locale }>({
	pref: typeof window === 'undefined' ? 'auto' : readPref(),
	browser: browserLocale()
});

if (typeof window !== 'undefined') {
	addEventListener('languagechange', () => (state.browser = browserLocale()));
}

export const i18n = {
	/** what the user picked in Settings */
	get pref(): LocalePref {
		return state.pref;
	},
	/** the language in use */
	get locale(): Locale {
		return state.pref === 'auto' ? state.browser : state.pref;
	},
	/** BCP 47 tag for Intl / toLocale*String */
	get tag(): string {
		return this.locale === 'th' ? 'th-TH' : 'en';
	},
	setPref(p: LocalePref) {
		state.pref = p;
		try {
			if (p === 'auto') localStorage.removeItem(STORE);
			else localStorage.setItem(STORE, p);
		} catch {}
	}
};

type Params = Record<string, string | number>;

function fill(s: string, params?: Params) {
	return params ? s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m)) : s;
}

/** Look up a message in a given language (falls back to English, then the key). */
export function translate(locale: Locale, key: MessageKey, params?: Params): string {
	return fill(DICTS[locale][key] ?? en[key] ?? key, params);
}

/**
 * Translate a UI string. `{name}` placeholders are filled from params.
 * Reactive: reading it inside markup or $derived re-renders on a language change.
 */
export function t(key: MessageKey, params?: Params): string {
	return translate(i18n.locale, key, params);
}

/**
 * Plural-aware lookup: uses `<key>_one` / `<key>_other` (Intl.PluralRules),
 * with `{n}` filled in. Thai has a single form, so it only needs `_other`.
 */
export function tn(key: string, n: number, params?: Params): string {
	const cat = new Intl.PluralRules(i18n.tag).select(n) === 'one' ? 'one' : 'other';
	const k = (`${key}_${cat}` in en ? `${key}_${cat}` : `${key}_other`) as MessageKey;
	const own = DICTS[i18n.locale][k] ?? DICTS[i18n.locale][`${key}_other` as MessageKey];
	return fill(own ?? en[k], { n, ...params });
}

/** Locale-aware date formatting that follows the interface language. */
export const fmtDate = (d: Date | number, opts?: Intl.DateTimeFormatOptions) =>
	new Date(d).toLocaleDateString(i18n.tag, opts);
export const fmtDateTime = (d: Date | number, opts?: Intl.DateTimeFormatOptions) =>
	new Date(d).toLocaleString(i18n.tag, opts);
export const fmtTime = (d: Date | number, opts?: Intl.DateTimeFormatOptions) =>
	new Date(d).toLocaleTimeString(i18n.tag, opts);

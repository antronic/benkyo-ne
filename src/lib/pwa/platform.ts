/**
 * Which "add to Home Screen / install" guide fits this device.
 *
 * Pure functions over the user agent, so they can be tested without a
 * browser. iPadOS 13+ reports itself as a Mac; a Mac with touch points is an
 * iPad.
 */
export type GuideId = 'iphone' | 'ipad' | 'android' | 'desktop' | 'mac' | 'firefox';

/** Guides in the order they're offered (the detected one moves to the front). */
export const GUIDES: GuideId[] = ['iphone', 'ipad', 'android', 'desktop', 'mac', 'firefox'];

export type Env = {
	os: 'ios' | 'ipados' | 'android' | 'mac' | 'windows' | 'linux' | 'chromeos' | 'other';
	browser: 'safari' | 'chrome' | 'edge' | 'firefox' | 'samsung' | 'inapp' | 'other';
};

/** In-app browsers (LINE, Facebook, Instagram, …) can't add to the Home Screen. */
const IN_APP = /\bLine\/|FBAN|FBAV|FB_IAB|Instagram|Twitter|MicroMessenger|TikTok|musical_ly|KAKAOTALK/i;

export function detectEnv(ua: string, maxTouchPoints = 0): Env {
	const os: Env['os'] = /iPhone|iPod/.test(ua)
		? 'ios'
		: /iPad/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)
			? 'ipados'
			: /Android/.test(ua)
				? 'android'
				: /CrOS/.test(ua)
					? 'chromeos'
					: /Macintosh|Mac OS X/.test(ua)
						? 'mac'
						: /Windows/.test(ua)
							? 'windows'
							: /Linux/.test(ua)
								? 'linux'
								: 'other';
	const browser: Env['browser'] = IN_APP.test(ua)
		? 'inapp'
		: /Firefox|FxiOS/.test(ua)
			? 'firefox'
			: /SamsungBrowser/.test(ua)
				? 'samsung'
				: /Edg(e|A|iOS)?\//.test(ua)
					? 'edge'
					: /Chrome|CriOS|Chromium/.test(ua)
						? 'chrome'
						: /Safari/.test(ua)
							? 'safari'
							: 'other';
	return { os, browser };
}

/** The guide to show first. */
export function guideFor(env: Env): GuideId {
	if (env.os === 'ios') return 'iphone';
	if (env.os === 'ipados') return 'ipad';
	if (env.browser === 'firefox') return 'firefox';
	if (env.os === 'android') return 'android';
	if (env.os === 'mac' && env.browser === 'safari') return 'mac';
	return 'desktop';
}

/** All guides, the detected one first. */
export function orderedGuides(first: GuideId): GuideId[] {
	return [first, ...GUIDES.filter((g) => g !== first)];
}

/**
 * Something about this browser worth saying before the steps:
 *   inapp      opened inside LINE / Facebook / …: open it in the real browser first
 *   ios-other  Chrome, Edge or Firefox on iPhone/iPad: works on iOS 16.4+, else use Safari
 *   samsung    Samsung Internet has its own menu wording
 */
export type EnvNote = 'inapp' | 'ios-other' | 'samsung' | null;

export function noteFor(env: Env): EnvNote {
	if (env.browser === 'inapp') return 'inapp';
	if ((env.os === 'ios' || env.os === 'ipados') && env.browser !== 'safari') return 'ios-other';
	if (env.browser === 'samsung') return 'samsung';
	return null;
}

/**
 * Safari 26 and later (iOS/iPadOS 26+) moved Share behind the page menu (☰)
 * at the left end of the address bar. The OS version in the user agent is
 * frozen, but Safari's own `Version/NN` still moves, so that decides which
 * iPhone/iPad steps to show. Not Safari, or no version: assume the new one.
 */
export function oldSafariToolbar(ua: string, env: Env): boolean {
	if (env.browser !== 'safari' || (env.os !== 'ios' && env.os !== 'ipados')) return false;
	const v = /Version\/(\d+)/.exec(ua);
	return !!v && Number(v[1]) < 26;
}

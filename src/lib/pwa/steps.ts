/**
 * The install steps for each guide: a title, a short explanation, and the
 * illustration to show. Strings are i18n keys (install.* in en.ts / th.ts).
 */
import type { MessageKey } from '#lib/i18n/index.svelte.ts';
import type { ArtKind } from '#lib/components/InstallArt.svelte';
import type { GuideId } from './platform.ts';

export type InstallStep = { art: ArtKind; title: MessageKey; body?: MessageKey; artLabel?: MessageKey };

export const GUIDE_NAME: Record<GuideId, MessageKey> = {
	iphone: 'install.os.iphone',
	ipad: 'install.os.ipad',
	android: 'install.os.android',
	desktop: 'install.os.desktop',
	mac: 'install.os.mac',
	firefox: 'install.os.firefox'
};

/** Safari before 26: Share button in the bottom toolbar. */
export const IPHONE_OLD_SAFARI: InstallStep[] = [
	{ art: 'ios-share', title: 'install.ios.share', body: 'install.ios.shareBody' },
	{ art: 'ios-add', title: 'install.ios.add', body: 'install.ios.addBody' },
	{ art: 'ios-confirm', title: 'install.ios.confirm', body: 'install.ios.confirmBody' },
	{ art: 'phone-home', title: 'install.ios.open', body: 'install.openBody' }
];

/** iPad Safari before 26: Share button at the top right. */
export const IPAD_OLD_SAFARI: InstallStep[] = [
	{ art: 'ipad-share', title: 'install.ios.share', body: 'install.ipad.shareBody' },
	{ art: 'ios-add', title: 'install.ios.add', body: 'install.ios.addBody' },
	{ art: 'ios-confirm', title: 'install.ios.confirm', body: 'install.ios.confirmBody' },
	{ art: 'tablet-home', title: 'install.ios.open', body: 'install.openBody' }
];

export const STEPS: Record<GuideId, InstallStep[]> = {
	// Safari 26+: Share lives in the page menu (☰) at the left of the address bar
	iphone: [
		{ art: 'ios-menu', title: 'install.ios.menu', body: 'install.ios.menuBody' },
		{ art: 'ios-menu-share', title: 'install.ios.share', body: 'install.ios.menuShareBody' },
		{ art: 'ios-add', title: 'install.ios.add', body: 'install.ios.addBody' },
		{ art: 'ios-confirm', title: 'install.ios.confirm', body: 'install.ios.confirmBody' },
		{ art: 'phone-home', title: 'install.ios.open', body: 'install.openBody' }
	],
	// iPad (and iPhones showing the desktop site, which report as iPad): same page menu
	ipad: [
		{ art: 'ios-menu', title: 'install.ios.menu', body: 'install.ios.menuBody' },
		{ art: 'ios-menu-share', title: 'install.ios.share', body: 'install.ios.menuShareBody' },
		{ art: 'ios-add', title: 'install.ios.add', body: 'install.ios.addBody' },
		{ art: 'ios-confirm', title: 'install.ios.confirm', body: 'install.ios.confirmBody' },
		{ art: 'tablet-home', title: 'install.ios.open', body: 'install.openBody' }
	],
	android: [
		{ art: 'android-menu', title: 'install.android.menu', body: 'install.android.menuBody' },
		{ art: 'android-install', title: 'install.android.add', body: 'install.android.addBody' },
		{ art: 'android-confirm', title: 'install.android.confirm' },
		{ art: 'phone-home', title: 'install.android.open', body: 'install.openBody' }
	],
	desktop: [
		{ art: 'desktop-icon', title: 'install.desktop.icon', body: 'install.desktop.iconBody' },
		{ art: 'desktop-confirm', title: 'install.desktop.confirm' },
		{ art: 'desktop-window', title: 'install.desktop.open', body: 'install.desktop.openBody' }
	],
	mac: [
		{ art: 'mac-file', title: 'install.mac.file', body: 'install.mac.fileBody' },
		{ art: 'mac-confirm', title: 'install.mac.confirm' },
		{ art: 'mac-dock', title: 'install.mac.open', body: 'install.mac.openBody' }
	],
	// Firefox: Android can install from the menu; desktop gets a note instead (see InstallGuide)
	firefox: [
		{ art: 'android-menu', title: 'install.android.menu', body: 'install.firefox.menuBody' },
		{ art: 'android-install', title: 'install.firefox.add', body: 'install.firefox.addBody', artLabel: 'install.art.install' },
		{ art: 'phone-home', title: 'install.android.open', body: 'install.openBody' }
	]
};

/** Steps for a guide; `oldSafari` swaps in the Share-button steps of Safari before 26. */
export const stepsFor = (g: GuideId, oldSafari: boolean): InstallStep[] =>
	oldSafari && g === 'iphone' ? IPHONE_OLD_SAFARI : oldSafari && g === 'ipad' ? IPAD_OLD_SAFARI : STEPS[g];

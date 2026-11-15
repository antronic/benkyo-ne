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

export const STEPS: Record<GuideId, InstallStep[]> = {
	iphone: [
		{ art: 'ios-share', title: 'install.ios.share', body: 'install.ios.shareBody' },
		{ art: 'ios-add', title: 'install.ios.add', body: 'install.ios.addBody' },
		{ art: 'ios-confirm', title: 'install.ios.confirm', body: 'install.ios.confirmBody' },
		{ art: 'phone-home', title: 'install.ios.open', body: 'install.openBody' }
	],
	ipad: [
		{ art: 'ipad-share', title: 'install.ios.share', body: 'install.ipad.shareBody' },
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

/**
 * Installing Benkyo as an app.
 *
 *   installed   running from the Home Screen / Dock / its own window
 *   canPrompt   Chrome, Edge and Android offered their own install dialog
 *               (beforeinstallprompt), so a single button can do it
 *   prompt()    show that dialog; resolves true if the user accepted
 *   showGuide   the step-by-step sheet (Today card and Settings open it)
 *   cardHidden  the Today card was dismissed on this device
 *   needsSafari iPhone/iPad outside Safari (LINE, Instagram, Chrome, …): only
 *               Safari can install Benkyo there, so OpenInSafari offers to
 *               move this page to Safari (never once installed)
 *   safariHidden "Continue here" was chosen in this tab (sessionStorage)
 *
 * The beforeinstallprompt listener is added when this module loads (the
 * layout imports it), because Chrome can fire it before any screen mounts.
 */
import { appName, detectEnv, guideFor, needsSafari, noteFor, oldSafariToolbar, type Env } from './platform.ts';

type InstallPromptEvent = Event & {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const CARD_KEY = 'benkyo.installCard';
const SAFARI_KEY = 'benkyo.safariPrompt';

function runningInstalled() {
	if (typeof window === 'undefined') return false;
	for (const m of ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'])
		if (matchMedia(`(display-mode: ${m})`).matches) return true;
	return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function readHidden() {
	try {
		return localStorage.getItem(CARD_KEY) === 'hidden';
	} catch {
		return false;
	}
}

function readSafariHidden() {
	try {
		return sessionStorage.getItem(SAFARI_KEY) === 'hidden';
	} catch {
		return false;
	}
}

class Install {
	installed = $state(runningInstalled());
	/** installed during this visit (the tab stays a tab, the app is on the device now) */
	justInstalled = $state(false);
	showGuide = $state(false);
	cardHidden = $state(typeof window === 'undefined' ? true : readHidden());
	private deferred = $state<InstallPromptEvent | null>(null);

	readonly env: Env =
		typeof navigator === 'undefined' ? { os: 'other', browser: 'other' } : detectEnv(navigator.userAgent, navigator.maxTouchPoints);
	readonly guide = guideFor(this.env);
	readonly note = noteFor(this.env);
	/** Safari before 26 keeps Share in the toolbar (newer: page menu ☰ in the address bar) */
	readonly oldSafari = typeof navigator !== 'undefined' && oldSafariToolbar(navigator.userAgent, this.env);

	readonly needsSafari = needsSafari(this.env);
	/** "LINE", "Chrome", … (a proper name, not translated); null when unknown */
	readonly appName = typeof navigator === 'undefined' ? null : appName(navigator.userAgent);
	safariHidden = $state(typeof window === 'undefined' ? true : readSafariHidden());

	get canPrompt() {
		return this.deferred !== null;
	}

	constructor() {
		if (typeof window === 'undefined') return;
		addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault(); // we show our own card and button instead of the mini-infobar
			this.deferred = e as InstallPromptEvent;
		});
		addEventListener('appinstalled', () => {
			this.deferred = null;
			this.justInstalled = true;
		});
		matchMedia('(display-mode: standalone)').addEventListener?.('change', () => (this.installed = runningInstalled()));
	}

	async prompt(): Promise<boolean> {
		const e = this.deferred;
		if (!e) return false;
		this.deferred = null; // each event can only be used once
		await e.prompt();
		const { outcome } = await e.userChoice;
		if (outcome === 'accepted') this.justInstalled = true;
		return outcome === 'accepted';
	}

	/** "Continue here": not again in this tab (a new visit asks again). */
	hideSafari() {
		this.safariHidden = true;
		try {
			sessionStorage.setItem(SAFARI_KEY, 'hidden');
		} catch {}
	}

	hideCard() {
		this.cardHidden = true;
		try {
			localStorage.setItem(CARD_KEY, 'hidden');
		} catch {}
	}
}

export const install = new Install();

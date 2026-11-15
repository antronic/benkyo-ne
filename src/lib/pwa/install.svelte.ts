/**
 * Installing Benkyo as an app.
 *
 *   installed   running from the Home Screen / Dock / its own window
 *   canPrompt   Chrome, Edge and Android offered their own install dialog
 *               (beforeinstallprompt), so a single button can do it
 *   prompt()    show that dialog; resolves true if the user accepted
 *   showGuide   the step-by-step sheet (Today card and Settings open it)
 *   cardHidden  the Today card was dismissed on this device
 *
 * The beforeinstallprompt listener is added when this module loads (the
 * layout imports it), because Chrome can fire it before any screen mounts.
 */
import { detectEnv, guideFor, noteFor, type Env } from './platform.ts';

type InstallPromptEvent = Event & {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const CARD_KEY = 'benkyo.installCard';

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

	hideCard() {
		this.cardHidden = true;
		try {
			localStorage.setItem(CARD_KEY, 'hidden');
		} catch {}
	}
}

export const install = new Install();

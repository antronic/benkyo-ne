/**
 * App updates (PWA). New versions download in the background; the user is
 * told and decides when to restart into them.
 *
 *   check: on launch, when the app comes back to the foreground, every 30 min
 *   ready: a new service worker is installed and waiting
 *   restart(): activate it, then reload once it has taken control
 * If the banner is ignored, the update applies on the next cold start.
 */
const CHECK_EVERY = 30 * 60_000;

class Updater {
	ready = $state(false);
	dismissed = $state(false);
	private reg: ServiceWorkerRegistration | null = null;
	private reloading = false;

	async start() {
		if (!('serviceWorker' in navigator)) return;
		const reg = await navigator.serviceWorker.ready; // resolves once the SW is registered & active
		this.reg = reg;

		const markIfWaiting = () => {
			if (reg.waiting && navigator.serviceWorker.controller) {
				this.ready = true;
				this.dismissed = false;
			}
		};
		markIfWaiting();
		reg.addEventListener('updatefound', () => {
			const sw = reg.installing;
			sw?.addEventListener('statechange', () => sw.state === 'installed' && markIfWaiting());
		});
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			if (this.reloading) location.reload();
		});

		const check = () => void reg.update().catch(() => {});
		document.addEventListener('visibilitychange', () => !document.hidden && check());
		addEventListener('online', check);
		setInterval(check, CHECK_EVERY);
		check();
	}

	restart() {
		const waiting = this.reg?.waiting;
		if (!waiting) return location.reload();
		this.reloading = true;
		waiting.postMessage({ type: 'SKIP_WAITING' });
		setTimeout(() => location.reload(), 3000); // safety net if controllerchange never fires
	}
}

export const updater = new Updater();

/**
 * Beta usage data from the app (docs/BETA-DATA.md): progress, screens and
 * features, errors and a device snapshot. AI prompts and replies are recorded
 * by the Worker, not here.
 *
 * Nothing is queued or sent until the signed-in account has agreed to the
 * current consent version (`telemetry.enabled`, set by lib/state/ai.svelte.ts).
 * Events are batched and sent every 30 s, when the app is hidden, and when the
 * queue fills; a small queue survives restarts in IndexedDB. Every event is
 * scrubbed of secret-looking fields and key-like text before it is queued.
 */
import { version } from '$app/env';
import { get, put } from '#lib/db/idb.ts';
import { MAX_EVENTS_PER_BATCH, takeBatch, type BetaEvent, type EventKind } from './contract.ts';
import { scrub } from './scrub.ts';

const FLUSH_MS = 30_000;
const MAX_QUEUE = 1000;
const QUEUE_KEY = 'betaQueue';
const DEVICE_KEY = 'betaDeviceSent';

const sid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random()).slice(2);

class Telemetry {
	enabled = $state(false);
	private queue: BetaEvent[] = [];
	private timer: ReturnType<typeof setInterval> | null = null;
	private sending = false;
	private started = false;
	private route: string | null = null;
	/** the account the queue belongs to; a saved queue from another account is discarded */
	private account: number | null = null;
	private inflight: Promise<void> | null = null;

	/** Called by the AI state whenever sign-in or consent changes. */
	setEnabled(on: boolean, account: number | null = null) {
		if (on && this.enabled && account !== this.account) {
			// switched accounts: never carry one account's queue into another's
			this.enabled = false;
			this.stop();
		}
		if (on === this.enabled) return;
		this.enabled = on;
		this.account = on ? account : null;
		if (on) void this.start();
		else this.stop();
	}

	/**
	 * Drop everything not yet uploaded and wait for an upload in flight, so a
	 * server-side delete that follows really removes everything collected so far.
	 */
	async discard() {
		this.queue = [];
		await this.inflight?.catch(() => {});
		this.queue = [];
		await this.persist();
	}

	track(kind: EventKind, name: string, data?: Record<string, unknown>) {
		if (!this.enabled) return;
		this.queue.push({
			at: Date.now(),
			kind,
			name,
			sid,
			route: this.route,
			appVersion: version,
			data: data ? (scrub(data) as Record<string, unknown>) : null
		});
		if (this.queue.length > MAX_QUEUE) this.queue.splice(0, this.queue.length - MAX_QUEUE);
		if (this.queue.length >= MAX_EVENTS_PER_BATCH) void this.flush();
		else this.save();
	}

	screen(path: string) {
		if (path === this.route) return;
		this.route = path;
		this.track('event', 'screen', { path });
	}

	error(name: string, e: unknown, extra?: Record<string, unknown>) {
		const err = e instanceof Error ? e : null;
		this.track('error', name, {
			message: (err?.message ?? String(e)).slice(0, 500),
			type: err?.name ?? typeof e,
			stack: err?.stack?.slice(0, 2000) ?? null,
			...extra
		});
	}

	/** Send queued events. `beacon` for the last send before the page is hidden. */
	async flush(beacon = false) {
		if (!this.enabled || this.sending || !this.queue.length) return;
		if (typeof navigator !== 'undefined' && !navigator.onLine) return void this.save();
		const batch = takeBatch(this.queue);
		const body = JSON.stringify({ events: batch });
		this.sending = true;
		let done!: () => void;
		this.inflight = new Promise((r) => (done = r));
		try {
			const res = await fetch('/api/beta/events', {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'content-type': 'application/json' },
				body,
				keepalive: beacon && body.length < 60_000
			});
			// 4xx: the server won't take these (signed out, consent withdrawn, bad data); drop them
			if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) this.dropSent(batch);
		} catch {
			/* offline or dropped: keep for the next try */
		} finally {
			this.sending = false;
			this.inflight = null;
			done();
			this.save();
		}
	}

	/** Remove the sent events (the queue may have been cleared meanwhile). */
	private dropSent(batch: BetaEvent[]) {
		const sent = new Set(batch);
		this.queue = this.queue.filter((e) => !sent.has(e));
	}

	private saveTimer: ReturnType<typeof setTimeout> | null = null;
	private save() {
		if (this.saveTimer) return;
		this.saveTimer = setTimeout(() => {
			this.saveTimer = null;
			void this.persist();
		}, 1000);
	}
	private persist() {
		const saved: SavedQueue = { account: this.account, events: this.enabled ? this.queue.slice(-MAX_QUEUE) : [] };
		return put('meta', saved, QUEUE_KEY).catch(() => {});
	}

	private async start() {
		const saved = await get<SavedQueue | BetaEvent[]>('meta', QUEUE_KEY).catch(() => undefined);
		// only this account's events; older builds saved a bare array with no owner, so drop those
		const mine = saved && !Array.isArray(saved) && saved.account === this.account ? saved.events : [];
		this.queue = [...mine, ...this.queue].slice(-MAX_QUEUE);
		this.listen();
		this.timer ??= setInterval(() => void this.flush(), FLUSH_MS);
		await this.sendDevice();
		void this.flush();
	}

	private stop() {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
		this.queue = [];
		void put('meta', { account: null, events: [] } satisfies SavedQueue, QUEUE_KEY).catch(() => {});
	}

	/** Global error hooks and page-hide flush; added once per launch. */
	private listen() {
		if (this.started || typeof window === 'undefined') return;
		this.started = true;
		addEventListener('error', (e) => {
			if (e.error || e.message) this.error('window_error', e.error ?? e.message, { source: e.filename?.slice(0, 200), line: e.lineno, col: e.colno });
		});
		addEventListener('unhandledrejection', (e) => this.error('unhandled_rejection', e.reason));
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'hidden') {
				this.track('event', 'app_hidden');
				void this.flush(true);
			} else this.track('event', 'app_visible');
		});
		addEventListener('online', () => void this.flush());
		this.track('event', 'app_open', { standalone: displayMode() !== 'browser' });
	}

	/** Device snapshot: once per launch, and whenever it changes. */
	private async sendDevice() {
		const info = await deviceInfo();
		const fingerprint = JSON.stringify({ ...info, storage: undefined, connection: undefined, online: undefined, viewport: undefined });
		const last = await get<string>('meta', DEVICE_KEY).catch(() => undefined);
		this.track('device', last === fingerprint ? 'device_launch' : 'device', info);
		void put('meta', fingerprint, DEVICE_KEY).catch(() => {});
	}
}

export const telemetry = new Telemetry();

interface SavedQueue {
	account: number | null;
	events: BetaEvent[];
}


// ------------------------------------------------------------------ device --

function displayMode(): 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser' {
	if (typeof matchMedia === 'undefined') return 'browser';
	for (const m of ['fullscreen', 'standalone', 'minimal-ui'] as const) if (matchMedia(`(display-mode: ${m})`).matches) return m;
	// iOS Home Screen apps report navigator.standalone
	return (navigator as Navigator & { standalone?: boolean }).standalone ? 'standalone' : 'browser';
}

const mq = (q: string) => (typeof matchMedia === 'undefined' ? null : matchMedia(q).matches);

interface UaData {
	brands?: { brand: string; version: string }[];
	mobile?: boolean;
	platform?: string;
	getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>;
}

/** What the browser tells any web page about the device; nothing that needs a permission prompt. */
export async function deviceInfo(): Promise<Record<string, unknown>> {
	const n = navigator as Navigator & {
		userAgentData?: UaData;
		deviceMemory?: number;
		connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
	};
	let uaHints: Record<string, unknown> | null = null;
	try {
		uaHints = (await n.userAgentData?.getHighEntropyValues?.(['platformVersion', 'model', 'architecture', 'bitness', 'fullVersionList'])) ?? null;
	} catch {
		/* not offered */
	}
	let storage: { usage?: number; quota?: number; persisted?: boolean } | null = null;
	try {
		const est = await navigator.storage?.estimate?.();
		storage = est ? { usage: est.usage, quota: est.quota, persisted: await navigator.storage.persisted?.() } : null;
	} catch {
		/* not offered */
	}
	return {
		userAgent: n.userAgent,
		uaBrands: n.userAgentData?.brands ?? null,
		uaMobile: n.userAgentData?.mobile ?? null,
		uaPlatform: n.userAgentData?.platform ?? null,
		uaHints,
		platform: n.platform || null,
		languages: [...(n.languages ?? [n.language])],
		timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		screen: { width: screen.width, height: screen.height, availWidth: screen.availWidth, availHeight: screen.availHeight, colorDepth: screen.colorDepth },
		viewport: { width: innerWidth, height: innerHeight },
		pixelRatio: devicePixelRatio,
		orientation: screen.orientation?.type ?? null,
		touchPoints: n.maxTouchPoints ?? 0,
		hardwareConcurrency: n.hardwareConcurrency ?? null,
		deviceMemoryGb: n.deviceMemory ?? null,
		connection: n.connection ? { type: n.connection.effectiveType, downlinkMbps: n.connection.downlink, rttMs: n.connection.rtt, saveData: n.connection.saveData } : null,
		displayMode: displayMode(),
		installed: displayMode() !== 'browser',
		serviceWorker: !!navigator.serviceWorker?.controller,
		colorScheme: mq('(prefers-color-scheme: dark)') ? 'dark' : 'light',
		reducedMotion: mq('(prefers-reduced-motion: reduce)'),
		contrastMore: mq('(prefers-contrast: more)'),
		passkeys: typeof window !== 'undefined' && 'PublicKeyCredential' in window,
		online: n.onLine,
		storage,
		appVersion: version
	};
}

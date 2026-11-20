/**
 * Error capture and debugging for the app (docs/DEBUGGING.md).
 *
 * Every error the app catches gets a short id ("E-7F3K2Q") made on the device,
 * so it exists offline too. The id is shown on error screens and, when the
 * signed-in account has agreed to the beta terms, sent to the Worker as a beta
 * `error` event with the build number, the screen, and the last few steps
 * (breadcrumbs: screens opened, API calls with their status, console errors).
 * Fleet → Errors lists them. Without consent nothing leaves the device: the
 * last errors stay in localStorage (Settings → Debugging) and "Copy details"
 * lets the learner send them by hand.
 *
 * Debug mode (`?debug=1`, or the switch in Settings) prints every breadcrumb
 * and error to the console. `window.__benkyo` exposes the log either way.
 *
 * Breadcrumbs never hold what the learner typed: API calls keep the method,
 * path (no query string) and status; screens keep the path.
 */
import { version } from '$app/env';
import { telemetry } from '#lib/beta/telemetry.svelte.ts';
import { scrubText } from '#lib/beta/scrub.ts';

const LOG_KEY = 'benkyo.errors';
const DEBUG_KEY = 'benkyo.debug';
const MAX_CRUMBS = 30;
const MAX_LOG = 20;
/** errors sent per app launch, so a render loop can't flood the queue */
const MAX_REPORTS = 50;
/** the same message again within this window is counted, not reported again */
const REPEAT_MS = 2000;

export type CrumbKind = 'nav' | 'api' | 'console' | 'error' | 'note';

export interface Crumb {
	at: number;
	kind: CrumbKind;
	text: string;
}

/** One caught error, as kept on the device and sent to Fleet. */
export interface ErrorRecord {
	id: string;
	at: number;
	/** where it was caught: kit (SvelteKit), screen_crash, window_error, unhandled_rejection, api_error, … */
	name: string;
	message: string;
	type: string;
	stack: string | null;
	route: string | null;
	build: string;
	/** HTTP status, for API errors and SvelteKit errors */
	status?: number;
	/** the Worker's request id (x-request-id) for API errors */
	requestId?: string | null;
}

export interface ReportOptions {
	/** default "error" */
	name?: string;
	status?: number;
	requestId?: string | null;
	route?: string | null;
	/** extra fields for the Fleet record; scrubbed like all beta data */
	extra?: Record<string, unknown>;
}

// ------------------------------------------------------------------ ids ----

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32: no I, L, O, U

/** "E-" and six Crockford base32 characters, e.g. "E-7F3K2Q". */
export function newErrorId(rand: (n: number) => Uint8Array = randomBytes): string {
	const bytes = rand(6);
	let s = '';
	for (const b of bytes) s += ALPHABET[b & 31];
	return `E-${s}`;
}
export const ERROR_ID_RE = /^E-[0-9A-HJKMNP-TV-Z]{6}$/;

function randomBytes(n: number) {
	const out = new Uint8Array(n);
	if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(out);
	else for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
	return out;
}

/** The build number shown in Settings → Version (ms timestamp of the build). */
export const buildNumber = (): string => version;

// ---------------------------------------------------------------- state ----

class DebugState {
	/** verbose console output (Settings → Debugging, or ?debug=1) */
	on = $state(false);
	/** errors kept on this device, newest first */
	log = $state<ErrorRecord[]>([]);
	lastId = $state<string | null>(null);
}
export const debug = new DebugState();

const crumbs: Crumb[] = [];
let route: string | null = null;
let reports = 0;
let last: { message: string; at: number; id: string } | null = null;

const storage = (): Storage | null => {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
};

function loadLog() {
	try {
		const raw = storage()?.getItem(LOG_KEY);
		const list = raw ? (JSON.parse(raw) as ErrorRecord[]) : [];
		debug.log = Array.isArray(list) ? list.slice(0, MAX_LOG) : [];
	} catch {
		debug.log = [];
	}
	debug.lastId = debug.log[0]?.id ?? null;
}
function saveLog() {
	try {
		storage()?.setItem(LOG_KEY, JSON.stringify(debug.log));
	} catch {
		/* full or blocked: the in-memory log still works */
	}
}

/** Turn debug mode on or off (kept on this device). */
export function setDebug(on: boolean) {
	debug.on = on;
	try {
		if (on) storage()?.setItem(DEBUG_KEY, '1');
		else storage()?.removeItem(DEBUG_KEY);
	} catch {
		/* blocked storage: on for this launch only */
	}
	if (on) console.info('[benkyo] debug mode on. Build', buildNumber(), '· window.__benkyo has the error log and breadcrumbs');
}

/** Forget the errors kept on this device. */
export function clearLog() {
	debug.log = [];
	debug.lastId = null;
	saveLog();
}

// ---------------------------------------------------------- breadcrumbs ----

export function crumb(kind: CrumbKind, text: string) {
	const c = { at: Date.now(), kind, text: scrubText(text).slice(0, 200) };
	crumbs.push(c);
	if (crumbs.length > MAX_CRUMBS) crumbs.splice(0, crumbs.length - MAX_CRUMBS);
	if (debug.on) console.debug(`[benkyo] ${kind}`, c.text);
}

export const breadcrumbs = (): Crumb[] => crumbs.slice();

/** The screen the learner is on (called on every navigation). */
export function setRoute(path: string) {
	if (path === route) return;
	route = path;
	crumb('nav', path);
}

// ---------------------------------------------------------------- report ----

function describe(e: unknown): { message: string; type: string; stack: string | null } {
	if (e instanceof Error) return { message: e.message || e.name, type: e.name, stack: e.stack ?? null };
	if (e && typeof e === 'object' && 'message' in e) return { message: String((e as { message: unknown }).message), type: 'object', stack: null };
	return { message: String(e), type: typeof e, stack: null };
}

/**
 * Record an error: give it an id, keep it on the device, print it in debug
 * mode, and send it to Fleet when the account allows beta data. Never throws.
 * Returns the error id to show the learner.
 */
export function reportError(e: unknown, opts: ReportOptions = {}): string {
	try {
		const d = describe(e);
		const message = scrubText(d.message).slice(0, 500);
		const now = Date.now();
		if (last && last.message === message && now - last.at < REPEAT_MS) {
			last.at = now;
			return last.id; // the same failure again (a render loop): one record is enough
		}
		const rec: ErrorRecord = {
			id: newErrorId(),
			at: now,
			name: opts.name ?? 'error',
			message,
			type: d.type,
			stack: d.stack ? scrubText(d.stack).slice(0, 2000) : null,
			route: opts.route ?? route ?? (typeof location === 'undefined' ? null : location.pathname),
			build: buildNumber(),
			...(opts.status !== undefined ? { status: opts.status } : {}),
			...(opts.requestId ? { requestId: opts.requestId } : {})
		};
		last = { message, at: now, id: rec.id };
		const trail = breadcrumbs();
		crumb('error', `${rec.id} ${rec.name}: ${message}`);
		debug.log = [rec, ...debug.log].slice(0, MAX_LOG);
		debug.lastId = rec.id;
		saveLog();
		if (debug.on) {
			console.groupCollapsed(`[benkyo] ${rec.id} ${rec.name}: ${message}`);
			console.error(e);
			console.table(trail.map((c) => ({ ...c, at: new Date(c.at).toISOString().slice(11, 23) })));
			console.groupEnd();
		}
		if (telemetry.enabled && reports < MAX_REPORTS) {
			reports++;
			telemetry.track('error', rec.name, {
				errorId: rec.id,
				message: rec.message,
				type: rec.type,
				stack: rec.stack,
				status: rec.status ?? null,
				requestId: rec.requestId ?? null,
				online: typeof navigator === 'undefined' ? null : navigator.onLine,
				viewport: typeof innerWidth === 'undefined' ? null : `${innerWidth}x${innerHeight}`,
				debug: debug.on,
				breadcrumbs: trail.map((c) => ({ at: c.at, kind: c.kind, text: c.text })),
				...opts.extra
			});
			void telemetry.flush();
		}
		return rec.id;
	} catch {
		return newErrorId();
	}
}

/** The id of the newest error on this device, for error screens. */
export const lastErrorId = (): string | null => debug.lastId;

/**
 * A plain-text block for "Copy details": error id, build, time, screen,
 * message and browser. Without an id: the newest error.
 */
export function errorDetails(errorId?: string | null): string {
	const rec = (errorId ? debug.log.find((r) => r.id === errorId) : debug.log[0]) ?? null;
	const lines = [
		`Error: ${rec?.id ?? errorId ?? 'none'}`,
		`Build: ${buildNumber()}${rec && rec.build !== buildNumber() ? ` (error was in ${rec.build})` : ''}`,
		`Time: ${new Date(rec?.at ?? Date.now()).toISOString()}`,
		`Screen: ${rec?.route ?? (typeof location === 'undefined' ? '' : location.pathname)}`
	];
	if (rec) {
		lines.push(`Message: ${rec.name}: ${rec.message}`);
		if (rec.status) lines.push(`Status: ${rec.status}`);
		if (rec.requestId) lines.push(`Request: ${rec.requestId}`);
	}
	if (typeof navigator !== 'undefined') lines.push(`Browser: ${navigator.userAgent}`);
	if (rec?.stack) lines.push('', rec.stack.split('\n').slice(0, 8).join('\n'));
	return lines.join('\n');
}

/**
 * Attach the learner's own words to an error ("what were you doing?").
 * Sent as a beta `error_note` event; false when the account doesn't allow
 * beta data (signed out or no consent), so the screen can offer Copy instead.
 */
export async function sendErrorNote(errorId: string, note: string): Promise<boolean> {
	if (!telemetry.enabled || !ERROR_ID_RE.test(errorId)) return false;
	crumb('note', `note for ${errorId}`);
	telemetry.track('error', 'error_note', { errorId, note: note.slice(0, 2000) });
	await telemetry.flush();
	return true;
}

// ------------------------------------------------------------ listeners ----

/** API paths not logged as breadcrumbs (the upload of the log itself) */
const QUIET = new Set(['/api/beta/events']);

/** Wrap fetch: every /api/ call becomes a breadcrumb; a 5xx answer is reported as an error. */
export function instrumentFetch(target: { fetch: typeof fetch } = globalThis) {
	const original = target.fetch;
	if (!original || (original as { __benkyo?: true }).__benkyo) return;
	const wrapped = async function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
		let path = '';
		let method = 'GET';
		try {
			const url = new URL(input instanceof Request ? input.url : String(input), typeof location === 'undefined' ? 'http://localhost' : location.href);
			if (typeof location === 'undefined' || url.origin === location.origin) path = url.pathname;
			method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
		} catch {
			/* not a URL we log */
		}
		const api = path.startsWith('/api/') && !QUIET.has(path);
		const started = Date.now();
		try {
			const res = await original.call(this, input, init);
			if (api) {
				const requestId = res.headers?.get?.('x-request-id') ?? null;
				crumb('api', `${method} ${path} → ${res.status} in ${Date.now() - started} ms${requestId ? ` (${requestId})` : ''}`);
				if (res.status >= 500)
					reportError(new Error(`${method} ${path} answered ${res.status}`), { name: 'api_error', status: res.status, requestId, extra: { method, path } });
			}
			return res;
		} catch (e) {
			// offline is a normal state: a breadcrumb, not an error
			if (api) crumb('api', `${method} ${path} → failed (${e instanceof Error ? e.name : 'error'}) after ${Date.now() - started} ms`);
			throw e;
		}
	} as typeof fetch & { __benkyo?: true };
	wrapped.__benkyo = true;
	target.fetch = wrapped;
}

let installed = false;

/** Start capturing (once per launch): window errors, rejections, console errors, fetch. */
export function installDebug() {
	if (installed || typeof window === 'undefined') return;
	installed = true;
	loadLog();
	const param = new URL(location.href).searchParams.get('debug');
	if (param === '1' || param === '0') setDebug(param === '1');
	else debug.on = storage()?.getItem(DEBUG_KEY) === '1';
	if (debug.on) console.info('[benkyo] debug mode on. Build', buildNumber());
	addEventListener('error', (e) => {
		// a failed <script>/<img> load has no error object and no message
		if (e.error || e.message) reportError(e.error ?? e.message, { name: 'window_error', extra: { source: e.filename?.slice(0, 200) ?? null, line: e.lineno, col: e.colno } });
	});
	addEventListener('unhandledrejection', (e) => reportError(e.reason, { name: 'unhandled_rejection' }));
	addEventListener('offline', () => crumb('nav', 'went offline'));
	addEventListener('online', () => crumb('nav', 'back online'));
	for (const level of ['error', 'warn'] as const) {
		const orig = console[level].bind(console);
		console[level] = (...args: unknown[]) => {
			try {
				crumb('console', `${level}: ${args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : safeJson(a))).join(' ')}`);
			} catch {
				/* never break logging */
			}
			orig(...args);
		};
	}
	instrumentFetch(window);
	(window as Window & { __benkyo?: unknown }).__benkyo = {
		build: buildNumber(),
		errors: () => debug.log.slice(),
		breadcrumbs,
		details: errorDetails,
		debug: setDebug
	};
}

function safeJson(v: unknown) {
	try {
		return JSON.stringify(v)?.slice(0, 200) ?? String(v);
	} catch {
		return String(v);
	}
}

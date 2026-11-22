/**
 * Startup safety. One feature failing must never keep the app on the splash.
 *
 *   withTimeout()   give a startup step a deadline, so a storage call that never
 *                   answers (seen in Safari) can't hold the splash forever
 *   attempt()       run an optional startup step; log and carry on if it throws
 *   safeMode        true when the last launches never finished starting (the tab
 *                   crashed or was reloaded on the splash). Heavy extras such as
 *                   Kuri's 3D renderer and sounds stay off for this visit.
 *   bootDone()      call once the app is up; clears the crash counter a little later
 *                   (or when the app goes to the background), and ends safe mode's
 *                   hold on Kuri for this visit (STABLE_EVENT)
 *   reloadOnStaleChunk()  after a deploy, an old page can ask for app files that no
 *                   longer exist: reload once to pick up the new version
 */

const KEY = 'benkyo.boot';
const RELOAD_KEY = 'benkyo.chunkReload';
/** launches in a row that never finished starting before safe mode turns on */
const CRASHES_FOR_SAFE_MODE = 2;
/** how long the app must stay up before a launch counts as good */
const STABLE_MS = 12_000;

function read(key: string, store: 'local' | 'session' = 'local'): string | null {
	try {
		return (store === 'local' ? localStorage : sessionStorage).getItem(key);
	} catch {
		return null; // storage blocked: no counter, no safe mode
	}
}
function write(key: string, value: string | null, store: 'local' | 'session' = 'local') {
	try {
		const s = store === 'local' ? localStorage : sessionStorage;
		if (value === null) s.removeItem(key);
		else s.setItem(key, value);
	} catch {}
}

/** Count this launch as started; returns how many before it never finished. */
function countLaunch(): number {
	if (typeof window === 'undefined') return 0;
	const failed = Number(read(KEY)) || 0;
	write(KEY, String(failed + 1));
	return failed;
}

const unfinished = countLaunch();
export const safeMode = unfinished >= CRASHES_FOR_SAFE_MODE;
if (safeMode) console.warn(`[boot] ${unfinished} launches did not finish starting; safe mode is on for this visit`);

let doneTimer: ReturnType<typeof setTimeout> | null = null;
let stable = false;
/** True once this visit has stayed up long enough to count as good (safe mode can end then). */
export const isStable = () => stable;
/** Fired on window when this visit counts as good: features that safe mode held back can start. */
export const STABLE_EVENT = 'benkyo:stable';
export function bootDone() {
	if (doneTimer) return;
	const good = () => {
		write(KEY, '0');
		write(RELOAD_KEY, null, 'session');
	};
	doneTimer = setTimeout(() => {
		good();
		stable = true;
		if (typeof dispatchEvent === 'function') dispatchEvent(new Event(STABLE_EVENT));
	}, STABLE_MS);
	// leaving normally after the app was up is a good launch too (a crash fires no pagehide).
	// On iPhone and iPad a home-screen app that is switched away from is often frozen and
	// later killed without a pagehide, so going to the background counts as well; without
	// this, two quick looks at the app turned safe mode on and Kuri vanished.
	addEventListener('pagehide', good, { once: true });
	if (typeof document !== 'undefined')
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'hidden') good();
		});
}

export function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const t = setTimeout(() => reject(new Error(`${what} timed out after ${ms} ms`)), ms);
		p.then(
			(v) => (clearTimeout(t), resolve(v)),
			(e) => (clearTimeout(t), reject(e))
		);
	});
}

/** Run an optional startup step; a failure is reported and the app carries on. */
export function attempt<T>(what: string, fn: () => T, report?: (name: string, e: unknown) => void): T | undefined {
	try {
		const r = fn();
		if (r instanceof Promise) r.catch((e) => fail(what, e, report));
		return r;
	} catch (e) {
		fail(what, e, report);
		return undefined;
	}
}
function fail(what: string, e: unknown, report?: (name: string, e: unknown) => void) {
	console.error(`[boot] ${what} failed`, e);
	try {
		report?.(`boot_${what}`, e);
	} catch {}
}

/** A reload for a new deploy within this long of the last one is not tried again (a real 404). */
const RELOAD_GAP_MS = 60_000;

/**
 * Reload when an app file from an older deploy can't be loaded (each deploy removes the old
 * files, so a page left open across a deploy can't load the lazy parts it has not used yet,
 * such as Kuri's renderer). At most once a minute, so a file that is really missing doesn't
 * loop. The reload is not a crash: it doesn't count toward safe mode.
 */
export function reloadOnStaleChunk() {
	if (typeof window === 'undefined') return;
	addEventListener('vite:preloadError', (e) => {
		if (!staleReload()) return; // just tried: let the caller's own fallback run
		e.preventDefault();
	});
}

/** Reload for a newer deploy unless one was just tried; true when it reloads. */
export function staleReload(): boolean {
	if (typeof window === 'undefined') return false;
	const last = Number(read(RELOAD_KEY, 'session')) || 0;
	if (Date.now() - last < RELOAD_GAP_MS) return false;
	write(RELOAD_KEY, String(Date.now()), 'session');
	write(KEY, String(unfinished)); // this launch is not a failed one
	location.reload();
	return true;
}

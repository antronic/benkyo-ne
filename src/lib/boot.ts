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
export function bootDone() {
	if (doneTimer) return;
	const good = () => {
		write(KEY, '0');
		write(RELOAD_KEY, null, 'session');
	};
	doneTimer = setTimeout(good, STABLE_MS);
	// leaving normally after the app was up is a good launch too (a crash fires no pagehide)
	addEventListener('pagehide', good, { once: true });
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

/** Reload once (per tab) when an app file from an older deploy can't be loaded. */
export function reloadOnStaleChunk() {
	if (typeof window === 'undefined') return;
	addEventListener('vite:preloadError', (e) => {
		if (read(RELOAD_KEY, 'session')) return; // already tried: let the caller's own fallback run
		write(RELOAD_KEY, '1', 'session');
		e.preventDefault();
		location.reload();
	});
}

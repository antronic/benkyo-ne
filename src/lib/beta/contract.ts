/**
 * Beta consent + usage data (docs/BETA-DATA.md). Shared by the PWA and the
 * Worker; keep it dependency-free apart from ./scrub.ts.
 *
 * Bump CONSENT_VERSION whenever the consent text or the data list changes in
 * a way people should see again: every account is then asked to agree to the
 * new version before it can use account features.
 */
import { scrub } from './scrub.ts';

export const CONSENT_VERSION = 1;
/** Date the current version's text was written (shown on the screen). */
export const CONSENT_DATE = '2026-11-15';
/** Usage data (events and AI calls) is deleted this many days after it arrives. */
export const RETENTION_DAYS = 180;

export interface BetaStatus {
	/** the version the app must have agreed to */
	version: number;
	/** the version this account agreed to (null: never, or withdrawn) */
	acceptedVersion: number | null;
	acceptedAt: number | null;
	retentionDays: number;
}

export type EventKind = 'progress' | 'event' | 'error' | 'device';
export const EVENT_KINDS: readonly EventKind[] = ['progress', 'event', 'error', 'device'];

/** One usage event sent by the app (POST /api/beta/events {events}). */
export interface BetaEvent {
	/** client time, epoch ms */
	at: number;
	kind: EventKind;
	/** e.g. "review", "lesson_complete", "screen", "settings", "window_error" */
	name: string;
	/** random id for one app launch, to group events */
	sid: string;
	route?: string | null;
	appVersion?: string | null;
	data?: Record<string, unknown> | null;
}

export const MAX_EVENTS_PER_BATCH = 100;
export const MAX_EVENT_DATA_CHARS = 8 * 1024;

const NAME_RE = /^[a-z][a-z0-9_.:-]{0,63}$/;

/** Validate and clean a batch from the app. Bad events are dropped, not fatal. */
export function parseEvents(body: unknown, now = Date.now()): BetaEvent[] {
	const list = body && typeof body === 'object' ? (body as { events?: unknown }).events : undefined;
	if (!Array.isArray(list)) return [];
	const out: BetaEvent[] = [];
	for (const raw of list.slice(0, MAX_EVENTS_PER_BATCH)) {
		if (!raw || typeof raw !== 'object') continue;
		const e = raw as Record<string, unknown>;
		if (typeof e.kind !== 'string' || !EVENT_KINDS.includes(e.kind as EventKind)) continue;
		if (typeof e.name !== 'string' || !NAME_RE.test(e.name)) continue;
		// clock skew is fine; nonsense times are not (a week ahead, or before 2025)
		const at = typeof e.at === 'number' && Number.isFinite(e.at) && e.at > 1_735_689_600_000 && e.at < now + 7 * 86_400_000 ? Math.round(e.at) : now;
		const sid = typeof e.sid === 'string' ? e.sid.slice(0, 64) : '';
		const route = typeof e.route === 'string' ? e.route.slice(0, 200) : null;
		const appVersion = typeof e.appVersion === 'string' ? e.appVersion.slice(0, 40) : null;
		let data: Record<string, unknown> | null = null;
		if (e.data && typeof e.data === 'object' && !Array.isArray(e.data)) {
			data = scrub(e.data) as Record<string, unknown>;
			if (JSON.stringify(data).length > MAX_EVENT_DATA_CHARS) data = { truncated: true };
		}
		out.push({ at, kind: e.kind as EventKind, name: e.name, sid, route, appVersion, data });
	}
	return out;
}

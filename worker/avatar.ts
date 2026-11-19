/**
 * The account's avatar (docs/AVATAR.md).
 *
 *   PUT /api/auth/avatar {avatar: Person | null}   save the parts (or remove the avatar)
 *   PUT /api/auth/avatar {later: true}             "Not now" on the one-time prompt
 *
 * Both answer with Me (GET /api/auth/me), which carries account.avatar and account.avatarAsked.
 * Only part ids from src/lib/avatar/person.ts are stored, compacted to the changes from the
 * defaults. Photos never reach the Worker: the selfie is read on the phone.
 */
import { cleanPerson, compactPerson, type Person } from '../src/lib/avatar/person.ts';
import type { Env } from './env.ts';
import { httpError, json, readJson } from './http.ts';
import { getSession, meOf } from './auth/passkey.ts';

/** A stored avatar column back to the parts, or null (missing, or not an object). */
export function parseAvatar(raw: string | null | undefined): Partial<Person> | null {
	if (!raw) return null;
	try {
		const p = cleanPerson(JSON.parse(raw));
		return p ? compactPerson(p) : null;
	} catch {
		return null;
	}
}

export async function putAvatar(req: Request, env: Env): Promise<Response> {
	const s = await getSession(req, env);
	if (!s) throw httpError(401, 'unauthorized', 'Sign in first');
	const body = (await readJson(req)) as { avatar?: unknown; later?: unknown } | null;
	const now = Date.now();
	if (body?.later === true) {
		await env.DB.prepare(`UPDATE accounts SET avatar_asked_at = COALESCE(avatar_asked_at, ?1) WHERE id = ?2`).bind(now, s.userId).run();
		return json(await meOf({ ...s, avatarAskedAt: s.avatarAskedAt ?? now }, env));
	}
	if (!body || !('avatar' in body)) throw httpError(400, 'bad_request', 'avatar is missing');
	let stored: string | null = null;
	if (body.avatar !== null) {
		const p = cleanPerson(body.avatar);
		if (!p) throw httpError(400, 'bad_request', 'avatar must be an object of parts');
		stored = JSON.stringify(compactPerson(p));
	}
	await env.DB.prepare(`UPDATE accounts SET avatar = ?1, avatar_asked_at = COALESCE(avatar_asked_at, ?2) WHERE id = ?3`)
		.bind(stored, now, s.userId)
		.run();
	return json(await meOf({ ...s, avatar: stored, avatarAskedAt: s.avatarAskedAt ?? now }, env));
}

/**
 * User card content sync (contract UserCard), piggybacking on POST /api/sync.
 * Last-write-wins by updatedAt; `rev` (per user, monotonic) is the pull cursor.
 */
import { SEEN_RECENT, SIGHTING_VIAS, type Bi, type Seen, type UserCard } from '../src/lib/ai/contract.ts';

export const MAX_CARDS_PUSH = 500;
export const MAX_CARDS_PULL = 1000;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);
const strOrNull = (v: unknown, max: number) => v === null || v === undefined || (typeof v === 'string' && v.length <= max);
const isStr = (v: unknown, max: number, min = 0) => typeof v === 'string' && v.length >= min && v.length <= max;
const isBiOrNull = (v: unknown) => v === null || v === undefined || (isRec(v) && isStr(v.en, 500) && strOrNull(v.second, 500));
const isExampleOrNull = (v: unknown) =>
	v === null ||
	v === undefined ||
	(isRec(v) && isStr(v.jp, 500) && isStr(v.reading, 1000) && isStr(v.en, 500) && strOrNull(v.second, 500));
const isTime = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e15;
const isSeenOrNull = (v: unknown) =>
	v === null ||
	v === undefined ||
	(isRec(v) &&
		Number.isInteger(v.count) &&
		(v.count as number) >= 0 &&
		(v.count as number) <= 1e6 &&
		Array.isArray(v.recent) &&
		v.recent.length <= SEEN_RECENT &&
		v.recent.every((s) => isRec(s) && isTime(s.at) && SIGHTING_VIAS.includes(s.via as never) && strOrNull(s.ctx, 300)));

export function validCard(c: unknown): c is UserCard {
	if (!isRec(c)) return false;
	return (
		isStr(c.id, 128, 1) &&
		/^(word|phrase):/.test(c.id as string) &&
		(c.kind === 'word' || c.kind === 'phrase') &&
		isStr(c.front, 200, 1) &&
		strOrNull(c.kanji, 200) &&
		isStr(c.gloss, 500) &&
		strOrNull(c.gloss2, 500) &&
		isBiOrNull(c.usage) &&
		isBiOrNull(c.hook) &&
		isExampleOrNull(c.example) &&
		typeof c.verified === 'boolean' &&
		(c.source === 'user' || c.source === 'pack' || c.source === 'scenario') &&
		Array.isArray(c.tags) &&
		c.tags.length <= 30 &&
		c.tags.every((t) => isStr(t, 60, 1)) &&
		isTime(c.createdAt) &&
		isTime(c.updatedAt) &&
		typeof c.deleted === 'boolean' &&
		isSeenOrNull(c.seen)
	);
}

const pickSeen = (s: Seen | null | undefined) =>
	s ? JSON.stringify({ count: s.count, recent: s.recent.map((x) => ({ at: Math.round(x.at), via: x.via, ctx: x.ctx ?? null })) }) : null;

const pickBi = (b: Bi | null | undefined) => (b ? JSON.stringify({ en: b.en, second: b.second ?? null }) : null);

export function upsertCardStatements(db: D1Database, userId: number, cards: UserCard[]): D1PreparedStatement[] {
	const stmt = db.prepare(
		`INSERT INTO user_cards (user_id, card_id, kind, front, kanji, gloss, gloss2, usage_json, hook_json, example_json,
		                         verified, source, tags_json, created_at, updated_at, deleted, seen_json, rev)
		 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17,
		         (SELECT COALESCE(MAX(rev), 0) + 1 FROM user_cards WHERE user_id = ?1))
		 ON CONFLICT (user_id, card_id) DO UPDATE SET
		   kind = excluded.kind, front = excluded.front, kanji = excluded.kanji, gloss = excluded.gloss,
		   gloss2 = excluded.gloss2, usage_json = excluded.usage_json, hook_json = excluded.hook_json,
		   example_json = excluded.example_json, verified = excluded.verified, source = excluded.source,
		   tags_json = excluded.tags_json, created_at = excluded.created_at, updated_at = excluded.updated_at,
		   deleted = excluded.deleted, seen_json = COALESCE(excluded.seen_json, user_cards.seen_json), rev = excluded.rev
		 WHERE excluded.updated_at > user_cards.updated_at`
	);
	return cards.map((c) =>
		stmt.bind(
			userId,
			c.id,
			c.kind,
			c.front,
			c.kanji ?? null,
			c.gloss,
			c.gloss2 ?? null,
			pickBi(c.usage),
			pickBi(c.hook),
			c.example
				? JSON.stringify({ jp: c.example.jp, reading: c.example.reading, en: c.example.en, second: c.example.second ?? null })
				: null,
			c.verified ? 1 : 0,
			c.source,
			JSON.stringify([...new Set(c.tags)]),
			Math.round(c.createdAt),
			Math.round(c.updatedAt),
			c.deleted ? 1 : 0,
			pickSeen(c.seen)
		)
	);
}

interface CardRow {
	card_id: string;
	kind: UserCard['kind'];
	front: string;
	kanji: string | null;
	gloss: string;
	gloss2: string | null;
	usage_json: string | null;
	hook_json: string | null;
	example_json: string | null;
	verified: number;
	source: UserCard['source'];
	tags_json: string;
	created_at: number;
	updated_at: number;
	deleted: number;
	seen_json: string | null;
	rev: number;
}

const parse = <T>(s: string | null, fallback: T): T => {
	if (!s) return fallback;
	try {
		return JSON.parse(s) as T;
	} catch {
		return fallback;
	}
};

export function rowToCard(r: CardRow): UserCard {
	return {
		id: r.card_id,
		kind: r.kind,
		front: r.front,
		kanji: r.kanji,
		gloss: r.gloss,
		gloss2: r.gloss2,
		usage: parse(r.usage_json, null),
		hook: parse(r.hook_json, null),
		example: parse(r.example_json, null),
		verified: !!r.verified,
		source: r.source,
		tags: parse(r.tags_json, [] as string[]),
		createdAt: r.created_at,
		updatedAt: r.updated_at,
		deleted: !!r.deleted,
		seen: parse<Seen | null>(r.seen_json, null)
	};
}

export async function pullCards(db: D1Database, userId: number, cursor: number) {
	const { results } = await db
		.prepare(`SELECT * FROM user_cards WHERE user_id = ?1 AND rev > ?2 ORDER BY rev LIMIT ?3`)
		.bind(userId, cursor, MAX_CARDS_PULL)
		.all<CardRow>();
	const next = results.length ? results[results.length - 1].rev : cursor;
	return { cards: results.map(rowToCard), cardsCursor: next };
}

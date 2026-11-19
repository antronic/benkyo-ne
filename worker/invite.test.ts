import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { d1, migratedDb } from './test/d1.ts';
import { handleInviteCard, inviteCard, parseInk } from './invite.ts';

let db: DatabaseSync;
let env: Record<string, unknown>;
const NOW = Date.now();
const INK = { aspect: 2.4, strokes: [[[0.1, 0.2, 0], [0.9, 0.2, 200]]] };

beforeEach(() => {
	db = migratedDb();
	env = { DB: d1(db) };
	db.exec(`INSERT INTO invite_codes (code, max_uses, uses, created_at, card_note, card_from, card_ink) VALUES
		('VIP', 5, 0, ${NOW}, 'Saved you a seat', 'Job', '${JSON.stringify(INK)}'),
		('PLAIN', 5, 0, ${NOW}, NULL, NULL, NULL),
		('FULL', 1, 1, ${NOW}, 'Hi', 'Job', NULL)`);
	db.exec(`INSERT INTO promo_codes (code, plan_id, kind, days, max_uses, uses, created_at) VALUES ('VIP_WELCOME', 'plus', 'trial', 14, NULL, 0, ${NOW})`);
});

describe('invite cards', () => {
	it('shows a live invite’s card, with what the coupon gives', async () => {
		const r = await inviteCard(env as never, 'vip', 'vip-welcome');
		expect(r).toEqual({
			code: 'VIP',
			card: { note: 'Saved you a seat', from: 'Job', ink: INK },
			perk: { planName: 'Plus', kind: 'trial', days: 14 }
		});
		expect((await inviteCard(env as never, 'vip', 'NOPE123'))?.perk).toBeNull();
		expect((await inviteCard(env as never, 'vip', null))?.perk).toBeNull();
	});

	it('says nothing for an invite without a card, used up, or unknown', async () => {
		expect(await inviteCard(env as never, 'plain', null)).toBeNull();
		expect(await inviteCard(env as never, 'full', null)).toBeNull();
		expect(await inviteCard(env as never, 'nobody', null)).toBeNull();
		const res = await handleInviteCard(new Request('http://x/api/auth/invite/nobody'), env as never, new URL('http://x/api/auth/invite/nobody')).catch((e) => e);
		expect(res.status).toBe(404);
	});

	it('checks handwriting', () => {
		expect(parseInk(null)).toBeNull();
		expect(parseInk({ aspect: 2, strokes: [] })).toBeNull();
		expect(parseInk({ aspect: 2, strokes: [[[0.12345, 0.5, 10.6]]] })).toEqual({ aspect: 2, strokes: [[[0.123, 0.5, 11]]] });
		expect(() => parseInk({ aspect: 9, strokes: [] })).toThrow();
		expect(() => parseInk({ aspect: 2, strokes: [[[0, 0]]] })).toThrow();
		expect(() => parseInk({ aspect: 2, strokes: [Array(4001).fill([0, 0, 0])] })).toThrow();
	});
});

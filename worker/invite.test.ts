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
	db.exec(`INSERT INTO invite_codes (code, max_uses, uses, created_at, card_note, coupon) VALUES ('NEWYEAR', 50, 0, ${NOW}, 'Happy new year', 'VIP_WELCOME')`);
	db.exec(`INSERT INTO promo_codes (code, plan_id, kind, days, max_uses, uses, created_at) VALUES ('VIP_WELCOME', 'plus', 'trial', 14, NULL, 0, ${NOW})`);
});

describe('invite cards', () => {
	it('shows a live invite’s card, with what the coupon gives', async () => {
		const r = await inviteCard(env as never, 'vip', 'vip-welcome');
		expect(r).toEqual({
			code: 'VIP',
			card: { note: 'Saved you a seat', from: 'Job', ink: INK },
			perk: { planName: 'Plus', kind: 'trial', days: 14 },
			coupon: 'VIP_WELCOME'
		});
		expect((await inviteCard(env as never, 'vip', 'NOPE123'))?.perk).toBeNull();
		expect((await inviteCard(env as never, 'vip', null))?.perk).toBeNull();
	});

	it('uses the VIP’s own promo code unless the link has ?coupon=', async () => {
		db.exec(`INSERT INTO promo_codes (code, plan_id, kind, days, max_uses, uses, created_at) VALUES ('PRO30', 'pro', 'comp', 30, NULL, 0, ${NOW})`);
		const own = await inviteCard(env as never, 'newyear', null);
		expect(own?.coupon).toBe('VIP_WELCOME');
		expect(own?.perk?.planName).toBe('Plus');
		const over = await inviteCard(env as never, 'newyear', 'pro30');
		expect(over?.coupon).toBe('PRO30');
		expect(over?.perk?.kind).toBe('comp');
		// a bound code that was switched off gives no perk and nothing to save
		db.exec(`UPDATE promo_codes SET disabled_at = ${NOW} WHERE code = 'VIP_WELCOME'`);
		expect(await inviteCard(env as never, 'newyear', null)).toMatchObject({ perk: null, coupon: null });
	});

	it('says a deleted or used-up invite has ended (410), and a plain one has no card (404)', async () => {
		db.exec(`UPDATE invite_codes SET deleted_at = ${NOW} WHERE code = 'VIP'`);
		expect(await inviteCard(env as never, 'vip', null)).toBeNull();
		const at = (c: string) => handleInviteCard(new Request(`http://x/api/auth/invite/${c}`), env as never, new URL(`http://x/api/auth/invite/${c}`)).catch((e) => e);
		expect((await at('vip')).status).toBe(410);
		expect((await at('full')).status).toBe(410);
		expect((await at('plain')).status).toBe(404);
	});

	it('turns a VIP off once its quota is used: its own uses or its promo code’s, and says it is full', async () => {
		const at = (c: string) => handleInviteCard(new Request(`http://x/api/auth/invite/${c}`), env as never, new URL(`http://x/api/auth/invite/${c}`)).catch((e) => e);
		expect((await at('full')).body).toMatchObject({ reason: 'full', message: 'That invite is full' });
		// NEWYEAR has uses left, but its promo code's last redemption is gone
		expect(await inviteCard(env as never, 'newyear', null)).not.toBeNull();
		db.exec(`UPDATE promo_codes SET max_uses = 3, uses = 3 WHERE code = 'VIP_WELCOME'`);
		expect(await inviteCard(env as never, 'newyear', null)).toBeNull();
		const r = await at('newyear');
		expect(r.status).toBe(410);
		expect(r.body.reason).toBe('full');
		// raising the code's limit turns it back on
		db.exec(`UPDATE promo_codes SET max_uses = 10 WHERE code = 'VIP_WELCOME'`);
		expect(await inviteCard(env as never, 'newyear', null)).not.toBeNull();
		// revoked is "ended", not "full"
		db.exec(`UPDATE invite_codes SET revoked_at = ${NOW} WHERE code = 'NEWYEAR'`);
		expect((await at('newyear')).body.reason).toBe('ended');
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

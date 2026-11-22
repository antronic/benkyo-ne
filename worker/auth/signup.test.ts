import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { d1, migratedDb } from '../test/d1.ts';
import { handleAuth } from './passkey.ts';
import { listInvites } from '../admin/settings.ts';
import { signupPromo } from '../promo.ts';
import { _clearSignupCache, consumeInvite, generateInviteCode, normalizeInvite, setSignupMode, signupState } from './signup.ts';

let db: DatabaseSync;
let env: { DB: D1Database; SIGNUP_MODE?: string };
const NOW = Date.now();

beforeEach(() => {
	_clearSignupCache();
	db = migratedDb();
	db.exec(`INSERT INTO invite_codes (code, max_uses, uses, created_at) VALUES
		('BK-AAAA-BBBB', 1, 0, 0), ('BK-USED-UP22', 1, 1, 0)`);
	db.exec(`INSERT INTO invite_codes (code, max_uses, created_at, expires_at) VALUES ('BK-OLDD-CODE', 5, 0, ${NOW - 1})`);
	env = { DB: d1(db) };
});

const close = async () => {
	await (await setSignupMode(env as never, 'closed', 1)).run();
	_clearSignupCache();
};
const options = (body: unknown, ip = '1.1.1.1') =>
	handleAuth(
		new Request('https://benkyo.example/api/auth/register/options', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
			body: JSON.stringify(body)
		}),
		env as never,
		'/api/auth/register/options'
	).then(
		(r) => r!.status,
		(e: { status: number }) => e.status
	);

describe('sign-up state', () => {
	it('is open by default, invite-only when closed in the console, shut by the Worker var', async () => {
		expect(await signupState(env as never)).toMatchObject({ open: true, invite: false });
		await close();
		expect(await signupState(env as never)).toMatchObject({ open: false, invite: true, mode: 'closed' });
		env.SIGNUP_MODE = 'closed';
		expect(await signupState(env as never)).toMatchObject({ open: false, invite: false, hardClosed: true });
	});
});

describe('passkey sign-up with invites', () => {
	it('needs a valid invite while closed', async () => {
		expect(await options({ name: 'A' })).toBe(200);
		await close();
		expect(await options({ name: 'A' })).toBe(403);
		expect(await options({ name: 'A', invite: 'nonsense' })).toBe(403);
		expect(await options({ name: 'A', invite: 'BK-USED-UP22' })).toBe(403);
		expect(await options({ name: 'A', invite: 'BK-OLDD-CODE' })).toBe(403);
		expect(await options({ name: 'A', invite: 'bk aaaa bbbb' })).toBe(200);
		expect(db.prepare(`SELECT invite_code FROM auth_challenges WHERE invite_code IS NOT NULL`).all()).toEqual([
			{ invite_code: 'BK-AAAA-BBBB' }
		]);
	});

	it('refuses invites too when the Worker var closes sign-ups', async () => {
		await close();
		env.SIGNUP_MODE = 'closed';
		expect(await options({ name: 'A', invite: 'BK-AAAA-BBBB' })).toBe(403);
	});

	it('uses up a code exactly max_uses times', async () => {
		expect(await consumeInvite(env as never, 'BK-AAAA-BBBB')).toBe(true);
		expect(await consumeInvite(env as never, 'BK-AAAA-BBBB')).toBe(false);
	});

	it('refuses a VIP whose promo code has no redemptions left', async () => {
		db.exec(`INSERT INTO promo_codes (code, plan_id, kind, days, max_uses, uses, created_at) VALUES ('ONCE', 'plus', 'trial', 7, 1, 1, 0)`);
		db.exec(`INSERT INTO invite_codes (code, max_uses, uses, created_at, card_note, coupon) VALUES ('MEETUP_26', 30, 0, 0, 'Hi', 'ONCE')`);
		expect(await consumeInvite(env as never, 'MEETUP_26')).toBe(false);
		db.exec(`UPDATE promo_codes SET max_uses = 2 WHERE code = 'ONCE'`);
		expect(await consumeInvite(env as never, 'MEETUP_26')).toBe(true);
		expect(await consumeInvite(env as never, 'BK-OLDD-CODE')).toBe(false);
	});
});

describe('invites while sign-up is open', () => {
	it('keeps a valid invite from a link on the challenge, and drops one that ended without refusing', async () => {
		expect(await options({ name: 'A', invite: 'bk aaaa bbbb' })).toBe(200);
		expect(await options({ name: 'B', invite: 'BK-USED-UP22' }, '2.2.2.2')).toBe(200);
		expect(await options({ name: 'C' }, '3.3.3.3')).toBe(200);
		expect(db.prepare(`SELECT signup_name AS n, invite_code AS c FROM auth_challenges ORDER BY n`).all()).toEqual([
			{ n: 'A', c: 'BK-AAAA-BBBB' },
			{ n: 'B', c: null },
			{ n: 'C', c: null }
		]);
	});
});

describe('the promo code of a new account', () => {
	beforeEach(() => {
		db.exec(`INSERT INTO promo_codes (code, plan_id, kind, days, max_uses, uses, created_at) VALUES ('BETAPRO', 'pro', 'comp', 30, NULL, 0, 0), ('PLUS7', 'plus', 'trial', 7, NULL, 0, 0)`);
		db.exec(`INSERT INTO invite_codes (code, max_uses, uses, created_at, card_note, coupon) VALUES ('THE_TAM', 1, 1, 0, 'Hi', 'BETAPRO')`);
		db.exec(`INSERT INTO accounts (id, name, webauthn_user_id, created_at, invite_code) VALUES (1, 'Tam', 'h1', ${NOW}, 'THE_TAM'), (2, 'Mika', 'h2', ${NOW}, NULL)`);
	});
	const grants = (id: number) => db.prepare(`SELECT plan_id AS plan, note FROM plan_grants WHERE account_id = ?`).all(id);

	it('is the invite’s own code, redeemed as the account is made', async () => {
		const r = await signupPromo(env as never, 1, 'THE_TAM', undefined, NOW);
		expect(r).toMatchObject({ code: 'BETAPRO' });
		expect(grants(1)).toEqual([{ plan: 'pro', note: 'Promo BETAPRO' }]);
		expect(db.prepare(`SELECT uses FROM promo_codes WHERE code = 'BETAPRO'`).get()).toEqual({ uses: 1 });
	});

	it('is the link’s code when there is one, and nothing when there is neither or it can’t be used', async () => {
		expect(await signupPromo(env as never, 1, 'THE_TAM', 'plus 7', NOW)).toMatchObject({ code: 'PLUS7' });
		expect(await signupPromo(env as never, 2, null, undefined, NOW)).toBeNull();
		db.exec(`UPDATE promo_codes SET disabled_at = 1 WHERE code = 'BETAPRO'`);
		expect(await signupPromo(env as never, 2, 'THE_TAM', undefined, NOW)).toBeNull();
		expect(grants(2)).toEqual([]);
	});

	it('shows Fleet who signed up with each invite and when', async () => {
		const tam = (await listInvites(env as never)).find((i) => i.code === 'THE_TAM');
		expect(tam?.usedBy).toEqual([{ id: 1, name: 'Tam', at: NOW }]);
		expect((await listInvites(env as never)).find((i) => i.code === 'BK-AAAA-BBBB')?.usedBy).toEqual([]);
	});
});

describe('invite codes', () => {
	it('look like BK-XXXX-XXXX and normalise loosely typed input', () => {
		for (let i = 0; i < 50; i++) expect(generateInviteCode()).toMatch(/^BK-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
		expect(normalizeInvite(' bk-7kq2 mx9d ')).toBe('BK-7KQ2-MX9D');
		expect(normalizeInvite('7KQ2MX9D')).toBe('BK-7KQ2-MX9D');
		expect(normalizeInvite('BKAAAABBBB')).toBe('BK-AAAA-BBBB');
		// named invites (Fleet): letters, digits and underscores
		expect(normalizeInvite(' vip ')).toBe('VIP');
		expect(normalizeInvite('songkran_vip')).toBe('SONGKRAN_VIP');
		expect(normalizeInvite('x')).toBeNull();
		expect(normalizeInvite('_vip')).toBeNull();
		expect(normalizeInvite('a'.repeat(21))).toBeNull();
		expect(normalizeInvite(42)).toBeNull();
	});
});

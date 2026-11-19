import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '../auth/passkey.ts';
import { d1, migratedDb } from '../test/d1.ts';

let session: Session | null = null;
vi.mock('../auth/passkey.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('../auth/passkey.ts')>()),
	getSession: async () => session
}));
const { handleAdmin } = await import('./routes.ts');
const { handlePromo, normalizePromo, generatePromoCode, REDEEM_TRIES_PER_HOUR } = await import('../promo.ts');
const { parsePromoInput } = await import('./promos.ts');
const { planOf } = await import('../plans.ts');
const { accountDataStatements } = await import('../ai/credentials.ts');

let db: DatabaseSync;
let env: Record<string, unknown>;
const DAY = 86_400_000;
const ADMIN: Session = { tokenHash: 't', passkeyId: 'pk1', kind: 'passkey', userId: 1, name: 'Owner', isAdmin: true, appleLinked: false };
const learner = (id: number): Session => ({ tokenHash: `t${id}`, passkeyId: `pk${id}`, kind: 'passkey', userId: id, name: `L${id}`, isAdmin: false, appleLinked: false });

beforeEach(() => {
	db = migratedDb();
	db.exec(`INSERT INTO accounts (id, name, webauthn_user_id, is_admin, created_at) VALUES
		(1, 'Owner', 'h1', 1, 0), (2, 'Mika', 'h2', 0, 0), (3, 'Aoi', 'h3', 0, 0)`);
	db.exec(`INSERT INTO sessions (token_hash, passkey_id, kind, user_id, created_at, expires_at) VALUES ('t', 'pk1', 'passkey', 1, 0, ${Date.now() + 3_600_000})`);
	env = { DB: d1(db), DEV_AUTH_BYPASS: '1' };
	session = ADMIN;
});

async function run(fn: () => Promise<Response | null>) {
	try {
		const res = (await fn())!;
		return { status: res.status, body: (await res.json()) as any };
	} catch (e) {
		const h = e as { status: number; body: unknown };
		if (!h.status) throw e;
		return { status: h.status, body: h.body as any };
	}
}
function admin(method: string, path: string, body?: unknown) {
	const url = new URL(`http://localhost:8787${path}`);
	return run(() => handleAdmin(new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) }), env as never, url));
}
function asLearner(id: number | null, method: string, path: string, body?: unknown) {
	session = id === null ? null : learner(id);
	const url = new URL(`http://localhost:8787${path}`);
	return run(() => handlePromo(new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) }), env as never, path));
}
const stepUp = () => db.exec(`UPDATE sessions SET stepup_at = ${Date.now()} WHERE token_hash = 't'`);
const audit = () => db.prepare(`SELECT action, detail_json AS d FROM admin_audit ORDER BY id`).all() as { action: string; d: string }[];
const make = async (input: Record<string, unknown>) => {
	session = ADMIN;
	stepUp();
	return admin('POST', '/api/admin/promos', input);
};

describe('promo code format', () => {
	it('normalizes what people type', () => {
		expect(normalizePromo(' songkran-2027 ')).toBe('SONGKRAN2027');
		expect(normalizePromo('ab c_d.e')).toBe('ABC_DE');
		expect(normalizePromo('songkran_27')).toBe('SONGKRAN_27');
		expect(normalizePromo('_SONGKRAN')).toBeNull();
		expect(normalizePromo('SONGKRAN_')).toBeNull();
		expect(normalizePromo('abc')).toBeNull();
		expect(normalizePromo('x'.repeat(25))).toBeNull();
		expect(normalizePromo('ฟรี2027')).toBeNull();
		expect(normalizePromo(42)).toBeNull();
	});
	it('makes random codes without look-alike characters', () => {
		for (let i = 0; i < 50; i++) expect(generatePromoCode()).toMatch(/^[2-9A-HJKMNP-Z]{10}$/);
	});
	it('checks the console input', () => {
		expect(() => parsePromoInput({ plan: 'free', kind: 'comp', days: 30 })).toThrow(/paid package/);
		expect(() => parsePromoInput({ plan: 'plus', kind: 'trial', days: null })).toThrow(/trial needs/);
		expect(() => parsePromoInput({ plan: 'plus', kind: 'comp', days: 0 })).toThrow();
		expect(() => parsePromoInput({ plan: 'plus', kind: 'comp', days: 30, maxUses: 0 })).toThrow();
		expect(() => parsePromoInput({ plan: 'plus', kind: 'comp', days: 30, code: 'no' })).toThrow(/6 to 24/);
		expect(() => parsePromoInput({ plan: 'plus', kind: 'comp', days: 30, code: 'SAVE' })).toThrow(/6 to 24/);
		expect(parsePromoInput({ plan: 'pro', kind: 'comp', days: null, code: 'vip-2027', label: ' Friends ' })).toMatchObject({
			code: 'VIP2027',
			label: 'Friends',
			days: null,
			maxUses: null,
			expiresInDays: null
		});
	});
});

describe('fleet: promo codes', () => {
	it('needs a passkey tap to make a code, and logs it', async () => {
		expect((await admin('POST', '/api/admin/promos', { plan: 'plus', kind: 'trial', days: 30 })).status).toBe(428);
		stepUp();
		const r = await admin('POST', '/api/admin/promos', { plan: 'plus', kind: 'trial', days: 30, maxUses: 5, expiresInDays: 14, label: 'Launch' });
		expect(r.status).toBe(200);
		expect(r.body).toMatchObject({ plan: 'plus', kind: 'trial', days: 30, maxUses: 5, uses: 0, label: 'Launch', state: 'live', redemptions: [] });
		expect(r.body.code).toMatch(/^[2-9A-Z]{10}$/);
		expect(r.body.expiresAt).toBeGreaterThan(Date.now() + 13 * DAY);
		expect(audit()).toEqual([{ action: 'promo.create', d: expect.stringContaining(`"code":"${r.body.code}","custom":false`) }]);
	});

	it('takes a custom code once, in any case', async () => {
		expect((await make({ code: 'songkran-27', plan: 'pro', kind: 'comp', days: null })).body.code).toBe('SONGKRAN27');
		const again = await make({ code: 'Songkran27', plan: 'plus', kind: 'comp', days: 7 });
		expect(again.status).toBe(409);
		expect((await make({ plan: 'gold', kind: 'comp', days: 7 })).status).toBe(400);
	});

	it('lists codes with their state and the packages a code can give', async () => {
		await make({ code: 'LIVE01', plan: 'plus', kind: 'comp', days: 7 });
		await make({ code: 'GONE01', plan: 'plus', kind: 'comp', days: 7 });
		db.exec(`UPDATE promo_codes SET expires_at = 1 WHERE code = 'GONE01'`);
		const r = await admin('GET', '/api/admin/promos');
		expect(r.body.plans.map((p: any) => p.id)).toEqual(['plus', 'pro']);
		expect(Object.fromEntries(r.body.promos.map((p: any) => [p.code, p.state]))).toEqual({ LIVE01: 'live', GONE01: 'expired' });
	});

	it('switches a code off and on with a passkey tap', async () => {
		await make({ code: 'TEACHER', plan: 'plus', kind: 'comp', days: 30 });
		db.exec(`UPDATE sessions SET stepup_at = NULL`);
		expect((await admin('PATCH', '/api/admin/promos/TEACHER', { disabled: true })).status).toBe(428);
		stepUp();
		expect((await admin('PATCH', '/api/admin/promos/TEACHER', { disabled: true })).body.state).toBe('disabled');
		expect((await asLearner(2, 'POST', '/api/promo/redeem', { code: 'teacher' })).body.problem).toBe('disabled');
		session = ADMIN;
		expect((await admin('PATCH', '/api/admin/promos/TEACHER', { disabled: false })).body.state).toBe('live');
		expect((await admin('PATCH', '/api/admin/promos/NOPE', { disabled: true })).status).toBe(404);
		expect(audit().map((a) => a.action)).toEqual(['promo.create', 'promo.disable', 'promo.enable']);
	});

	it('is admin only', async () => {
		session = learner(2);
		expect((await admin('GET', '/api/admin/promos')).status).toBe(403);
	});
});

describe('redeeming a code', () => {
	it('gives the package for the code’s length and shows who redeemed it', async () => {
		await make({ code: 'TRYPLUS', plan: 'plus', kind: 'trial', days: 30, maxUses: 10 });
		expect((await asLearner(2, 'GET', '/api/promo')).body).toEqual({ plan: 'free', planName: 'Free', grant: null });
		const r = await asLearner(2, 'POST', '/api/promo/redeem', { code: 'try-plus' });
		expect(r.status).toBe(200);
		expect(r.body).toMatchObject({ code: 'TRYPLUS', plan: 'plus', planName: 'Plus', grant: { kind: 'trial', promoCode: 'TRYPLUS' } });
		expect(r.body.grant.endsAt).toBeGreaterThan(Date.now() + 29 * DAY);
		expect(await planOf(env as never, 2)).toBe('plus');
		expect((await asLearner(2, 'GET', '/api/promo')).body.grant.promoCode).toBe('TRYPLUS');

		session = ADMIN;
		const d = await admin('GET', '/api/admin/promos/TRYPLUS');
		expect(d.body.uses).toBe(1);
		expect(d.body.redemptions).toEqual([expect.objectContaining({ accountId: 2, accountName: 'Mika', live: true })]);
		// a grant like any other: visible on the packages screen
		expect((await admin('GET', '/api/admin/packages')).body.grants[0]).toMatchObject({ accountId: 2, plan: 'plus', note: 'Promo TRYPLUS' });
	});

	it('deletes a code: hidden and no longer redeemable, while given packages and VIPs stay', async () => {
		await make({ code: 'GONE01', plan: 'plus', kind: 'trial', days: 30 });
		expect((await asLearner(2, 'POST', '/api/promo/redeem', { code: 'GONE01' })).status).toBe(200);
		db.exec(`INSERT INTO invite_codes (code, max_uses, uses, created_at, card_note, coupon) VALUES ('VIP', 5, 0, ${Date.now()}, 'Hi', 'GONE01')`);
		session = ADMIN;
		db.exec(`UPDATE sessions SET stepup_at = NULL`);
		expect((await admin('DELETE', '/api/admin/promos/GONE01')).status).toBe(428);
		stepUp();
		expect((await admin('DELETE', '/api/admin/promos/GONE01')).body).toEqual({ ok: true });
		expect(audit().at(-1)).toMatchObject({ action: 'promo.delete' });
		expect(JSON.parse(audit().at(-1)!.d)).toMatchObject({ code: 'GONE01', uses: 1, unboundVips: ['VIP'] });
		expect((await admin('GET', '/api/admin/promos')).body.promos.map((p: { code: string }) => p.code)).not.toContain('GONE01');
		expect((await admin('GET', '/api/admin/promos/GONE01')).status).toBe(404);
		expect((await admin('DELETE', '/api/admin/promos/GONE01')).status).toBe(404);
		// the row, the redemption and the package it gave stay; the VIP drops it
		expect(db.prepare(`SELECT COUNT(*) AS n FROM promo_redemptions WHERE code = 'GONE01'`).get()).toEqual({ n: 1 });
		expect(await planOf(env as never, 2)).toBe('plus');
		expect(db.prepare(`SELECT coupon FROM invite_codes WHERE code = 'VIP'`).get()).toEqual({ coupon: null });
		const r = await asLearner(3, 'POST', '/api/promo/redeem', { code: 'GONE01' });
		expect([r.status, r.body.problem]).toEqual([404, 'invalid']);
		// the name stays taken
		session = ADMIN;
		expect((await make({ code: 'GONE_01', plan: 'plus', kind: 'trial', days: 7 })).status).toBe(409);
	});

	it('works once per account', async () => {
		await make({ code: 'ONCE01', plan: 'plus', kind: 'trial', days: 7 });
		await asLearner(2, 'POST', '/api/promo/redeem', { code: 'ONCE01' });
		const r = await asLearner(2, 'POST', '/api/promo/redeem', { code: 'ONCE01' });
		expect([r.status, r.body.problem]).toEqual([409, 'already_redeemed']);
	});

	it('stops at the use limit', async () => {
		await make({ code: 'ONLY01', plan: 'plus', kind: 'comp', days: 7, maxUses: 1 });
		expect((await asLearner(2, 'POST', '/api/promo/redeem', { code: 'ONLY01' })).status).toBe(200);
		const r = await asLearner(3, 'POST', '/api/promo/redeem', { code: 'ONLY01' });
		expect([r.status, r.body.problem]).toEqual([410, 'used_up']);
		expect(db.prepare(`SELECT uses FROM promo_codes WHERE code = 'ONLY01'`).get()).toEqual({ uses: 1 });
		expect(await planOf(env as never, 3)).toBe('free');
	});

	it('refuses unknown and expired codes', async () => {
		expect((await asLearner(2, 'POST', '/api/promo/redeem', { code: 'NOSUCH' })).body.problem).toBe('invalid');
		expect((await asLearner(2, 'POST', '/api/promo/redeem', { code: '!' })).body.problem).toBe('invalid');
		await make({ code: 'OLD001', plan: 'plus', kind: 'comp', days: 7, expiresInDays: 1 });
		db.exec(`UPDATE promo_codes SET expires_at = ${Date.now() - 1}`);
		expect((await asLearner(2, 'POST', '/api/promo/redeem', { code: 'OLD001' })).body.problem).toBe('expired');
	});

	it('never takes a package away, but upgrades one', async () => {
		await make({ code: 'PLUS07', plan: 'plus', kind: 'trial', days: 7 });
		await make({ code: 'PRO030', plan: 'pro', kind: 'comp', days: 30 });
		expect((await asLearner(2, 'POST', '/api/promo/redeem', { code: 'PLUS07' })).status).toBe(200);
		expect((await asLearner(2, 'POST', '/api/promo/redeem', { code: 'PRO030' })).body.plan).toBe('pro');
		// the Plus grant was replaced, not left running underneath
		expect(db.prepare(`SELECT COUNT(*) AS n FROM plan_grants WHERE account_id = 2 AND ended_at IS NULL`).get()).toEqual({ n: 1 });
		await make({ code: 'PLUS08', plan: 'plus', kind: 'trial', days: 7 });
		const r = await asLearner(2, 'POST', '/api/promo/redeem', { code: 'PLUS08' });
		expect([r.status, r.body.problem]).toEqual([409, 'already_on_plan']);
		expect(db.prepare(`SELECT uses FROM promo_codes WHERE code = 'PLUS08'`).get()).toEqual({ uses: 0 });
	});

	it('needs a signed-in account and limits tries', async () => {
		expect((await asLearner(null, 'POST', '/api/promo/redeem', { code: 'ABCD' })).status).toBe(401);
		expect((await asLearner(null, 'GET', '/api/promo')).status).toBe(401);
		for (let i = 0; i < REDEEM_TRIES_PER_HOUR; i++) expect((await asLearner(3, 'POST', '/api/promo/redeem', { code: `GUESS${i}` })).status).toBe(404);
		const r = await asLearner(3, 'POST', '/api/promo/redeem', { code: 'GUESS99' });
		expect([r.status, r.body.problem]).toEqual([429, 'rate_limited']);
	});

	it('is removed with the account, keeping the use count', async () => {
		await make({ code: 'BYE001', plan: 'plus', kind: 'comp', days: 7 });
		await asLearner(2, 'POST', '/api/promo/redeem', { code: 'BYE001' });
		await (env.DB as any).batch(accountDataStatements(env as never, 2));
		expect(db.prepare(`SELECT COUNT(*) AS n FROM promo_redemptions`).get()).toEqual({ n: 0 });
		expect(db.prepare(`SELECT uses FROM promo_codes WHERE code = 'BYE001'`).get()).toEqual({ uses: 1 });
	});
});

describe('underscores in codes', () => {
	it('keeps the underscore and redeems with or without it', async () => {
		expect((await make({ code: 'songkran_27', plan: 'plus', kind: 'trial', days: 7, maxUses: 5 })).body.code).toBe('SONGKRAN_27');
		expect((await asLearner(2, 'POST', '/api/promo/redeem', { code: 'Songkran_27' })).body.code).toBe('SONGKRAN_27');
		expect((await asLearner(3, 'POST', '/api/promo/redeem', { code: 'songkran27' })).body.code).toBe('SONGKRAN_27');
		session = ADMIN;
		expect((await admin('GET', '/api/admin/promos/SONGKRAN_27')).body.uses).toBe(2);
	});
	it('refuses a code that matches another one with underscores ignored', async () => {
		await make({ code: 'SONGKRAN27', plan: 'plus', kind: 'trial', days: 7 });
		const r = await make({ code: 'SONG_KRAN27', plan: 'plus', kind: 'trial', days: 7 });
		expect([r.status, r.body.message]).toEqual([409, 'That code matches SONGKRAN27, which already exists']);
	});
});

describe('fleet: editing a code', () => {
	it('changes the terms with a passkey tap, logs what changed, and new redemptions use them', async () => {
		await make({ code: 'EDITME', plan: 'plus', kind: 'trial', days: 7, maxUses: 5, label: 'Old' });
		db.exec(`UPDATE sessions SET stepup_at = NULL`);
		expect((await admin('PATCH', '/api/admin/promos/EDITME', { days: 30 })).status).toBe(428);
		stepUp();
		const r = await admin('PATCH', '/api/admin/promos/EDITME', { plan: 'pro', kind: 'comp', days: null, maxUses: null, expiresInDays: 10, label: 'New' });
		expect(r.status).toBe(200);
		expect(r.body).toMatchObject({ code: 'EDITME', plan: 'pro', kind: 'comp', days: null, maxUses: null, label: 'New' });
		expect(r.body.expiresAt).toBeGreaterThan(Date.now() + 9 * DAY);
		const a = audit().at(-1)!;
		expect(a.action).toBe('promo.update');
		expect(JSON.parse(a.d)).toMatchObject({ code: 'EDITME', plan: { from: 'plus', to: 'pro' }, days: { from: 7, to: null }, label: { from: 'Old', to: 'New' } });
		const red = await asLearner(2, 'POST', '/api/promo/redeem', { code: 'EDITME' });
		expect(red.body).toMatchObject({ plan: 'pro', grant: { kind: 'comp', endsAt: null } });
	});

	it('keeps grants already made as they were', async () => {
		await make({ code: 'KEEPTERMS', plan: 'plus', kind: 'trial', days: 7 });
		await asLearner(2, 'POST', '/api/promo/redeem', { code: 'KEEPTERMS' });
		session = ADMIN;
		await admin('PATCH', '/api/admin/promos/KEEPTERMS', { plan: 'pro', days: 90 });
		expect(await planOf(env as never, 2)).toBe('plus');
	});

	it('renames a code only before anyone has used it', async () => {
		await make({ code: 'TYPO_CODE', plan: 'plus', kind: 'trial', days: 7 });
		const r = await admin('PATCH', '/api/admin/promos/TYPO_CODE', { code: 'right-code' });
		expect(r.body.code).toBe('RIGHTCODE');
		expect((await admin('GET', '/api/admin/promos/TYPO_CODE')).status).toBe(404);
		await asLearner(2, 'POST', '/api/promo/redeem', { code: 'RIGHTCODE' });
		session = ADMIN;
		const again = await admin('PATCH', '/api/admin/promos/RIGHTCODE', { code: 'OTHERCODE' });
		expect(again.status).toBe(409);
		await make({ code: 'TAKEN_ONE', plan: 'plus', kind: 'trial', days: 7 });
		await make({ code: 'FRESHONE', plan: 'plus', kind: 'trial', days: 7 });
		expect((await admin('PATCH', '/api/admin/promos/FRESHONE', { code: 'TAKENONE' })).status).toBe(409);
	});

	it('checks the new terms', async () => {
		await make({ code: 'LIMITS', plan: 'plus', kind: 'comp', days: null, maxUses: 5 });
		await asLearner(2, 'POST', '/api/promo/redeem', { code: 'LIMITS' });
		await asLearner(3, 'POST', '/api/promo/redeem', { code: 'LIMITS' });
		session = ADMIN;
		expect((await admin('PATCH', '/api/admin/promos/LIMITS', { maxUses: 1 })).status).toBe(400);
		expect((await admin('PATCH', '/api/admin/promos/LIMITS', { maxUses: 2 })).body.state).toBe('used_up');
		expect((await admin('PATCH', '/api/admin/promos/LIMITS', { kind: 'trial' })).status).toBe(400); // a trial needs days
		expect((await admin('PATCH', '/api/admin/promos/LIMITS', { plan: 'free' })).status).toBe(400);
		expect((await admin('PATCH', '/api/admin/promos/LIMITS', { plan: 'gold' })).status).toBe(400);
		expect((await admin('PATCH', '/api/admin/promos/LIMITS', {})).status).toBe(400);
	});

	it('stops a package from being deleted while a code gives it', async () => {
		stepUp();
		const made = await admin('POST', '/api/admin/packages', { name: 'Teacher', priceMonthUsd: 0, priceYearUsd: 0, aiAllowanceUsd: 0 });
		expect(made.status).toBe(201);
		const id = made.body.created as string;
		await make({ code: 'TEACHERS', plan: id, kind: 'comp', days: 30 });
		const r = await admin('DELETE', `/api/admin/packages/${id}`);
		expect([r.status, r.body.message]).toEqual([400, expect.stringContaining('promo code gives this package')]);
		await admin('PATCH', '/api/admin/promos/TEACHERS', { plan: 'plus' });
		expect((await admin('DELETE', `/api/admin/packages/${id}`)).status).toBe(200);
	});
});

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
		expect(normalizePromo('ab c_d.e')).toBe('ABCDE');
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
		expect(() => parsePromoInput({ plan: 'plus', kind: 'comp', days: 30, code: 'no' })).toThrow(/4 to 24/);
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
		await make({ code: 'LIVE1', plan: 'plus', kind: 'comp', days: 7 });
		await make({ code: 'GONE1', plan: 'plus', kind: 'comp', days: 7 });
		db.exec(`UPDATE promo_codes SET expires_at = 1 WHERE code = 'GONE1'`);
		const r = await admin('GET', '/api/admin/promos');
		expect(r.body.plans.map((p: any) => p.id)).toEqual(['plus', 'pro']);
		expect(Object.fromEntries(r.body.promos.map((p: any) => [p.code, p.state]))).toEqual({ LIVE1: 'live', GONE1: 'expired' });
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

	it('works once per account', async () => {
		await make({ code: 'ONCE', plan: 'plus', kind: 'trial', days: 7 });
		await asLearner(2, 'POST', '/api/promo/redeem', { code: 'ONCE' });
		const r = await asLearner(2, 'POST', '/api/promo/redeem', { code: 'ONCE' });
		expect([r.status, r.body.problem]).toEqual([409, 'already_redeemed']);
	});

	it('stops at the use limit', async () => {
		await make({ code: 'ONLY1', plan: 'plus', kind: 'comp', days: 7, maxUses: 1 });
		expect((await asLearner(2, 'POST', '/api/promo/redeem', { code: 'ONLY1' })).status).toBe(200);
		const r = await asLearner(3, 'POST', '/api/promo/redeem', { code: 'ONLY1' });
		expect([r.status, r.body.problem]).toEqual([410, 'used_up']);
		expect(db.prepare(`SELECT uses FROM promo_codes WHERE code = 'ONLY1'`).get()).toEqual({ uses: 1 });
		expect(await planOf(env as never, 3)).toBe('free');
	});

	it('refuses unknown and expired codes', async () => {
		expect((await asLearner(2, 'POST', '/api/promo/redeem', { code: 'NOSUCH' })).body.problem).toBe('invalid');
		expect((await asLearner(2, 'POST', '/api/promo/redeem', { code: '!' })).body.problem).toBe('invalid');
		await make({ code: 'OLD1', plan: 'plus', kind: 'comp', days: 7, expiresInDays: 1 });
		db.exec(`UPDATE promo_codes SET expires_at = ${Date.now() - 1}`);
		expect((await asLearner(2, 'POST', '/api/promo/redeem', { code: 'OLD1' })).body.problem).toBe('expired');
	});

	it('never takes a package away, but upgrades one', async () => {
		await make({ code: 'PLUS7', plan: 'plus', kind: 'trial', days: 7 });
		await make({ code: 'PRO30', plan: 'pro', kind: 'comp', days: 30 });
		expect((await asLearner(2, 'POST', '/api/promo/redeem', { code: 'PLUS7' })).status).toBe(200);
		expect((await asLearner(2, 'POST', '/api/promo/redeem', { code: 'PRO30' })).body.plan).toBe('pro');
		// the Plus grant was replaced, not left running underneath
		expect(db.prepare(`SELECT COUNT(*) AS n FROM plan_grants WHERE account_id = 2 AND ended_at IS NULL`).get()).toEqual({ n: 1 });
		await make({ code: 'PLUS8', plan: 'plus', kind: 'trial', days: 7 });
		const r = await asLearner(2, 'POST', '/api/promo/redeem', { code: 'PLUS8' });
		expect([r.status, r.body.problem]).toEqual([409, 'already_on_plan']);
		expect(db.prepare(`SELECT uses FROM promo_codes WHERE code = 'PLUS8'`).get()).toEqual({ uses: 0 });
	});

	it('needs a signed-in account and limits tries', async () => {
		expect((await asLearner(null, 'POST', '/api/promo/redeem', { code: 'ABCD' })).status).toBe(401);
		expect((await asLearner(null, 'GET', '/api/promo')).status).toBe(401);
		for (let i = 0; i < REDEEM_TRIES_PER_HOUR; i++) expect((await asLearner(3, 'POST', '/api/promo/redeem', { code: `GUESS${i}` })).status).toBe(404);
		const r = await asLearner(3, 'POST', '/api/promo/redeem', { code: 'GUESS99' });
		expect([r.status, r.body.problem]).toEqual([429, 'rate_limited']);
	});

	it('is removed with the account, keeping the use count', async () => {
		await make({ code: 'BYE1', plan: 'plus', kind: 'comp', days: 7 });
		await asLearner(2, 'POST', '/api/promo/redeem', { code: 'BYE1' });
		await (env.DB as any).batch(accountDataStatements(env as never, 2));
		expect(db.prepare(`SELECT COUNT(*) AS n FROM promo_redemptions`).get()).toEqual({ n: 0 });
		expect(db.prepare(`SELECT uses FROM promo_codes WHERE code = 'BYE1'`).get()).toEqual({ uses: 1 });
	});
});

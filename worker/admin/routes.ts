/**
 * Fleet console API (operator console at /admin). Admin-only.
 *
 *   GET    /api/admin/overview                 accounts, AI spend, sign-up mode at a glance
 *   POST   /api/admin/stepup/options           passkey challenge for a fresh confirmation
 *   POST   /api/admin/stepup/verify            → {at}; dangerous actions need one ≤ 5 min old
 *   GET    /api/admin/accounts?q=&offset=      list (worker/admin/accounts.ts)
 *   GET    /api/admin/accounts/:id             detail
 *   PATCH  /api/admin/accounts/:id             {disabled?, capUsd?}         step-up
 *   POST   /api/admin/accounts/:id/revoke      end all its sessions        step-up
 *   DELETE /api/admin/accounts/:id {confirm}   delete it and all its data  step-up
 *   /api/admin/settings, /api/admin/invites    sign-ups, invites, session lifetime (worker/admin/settings.ts)
 *
 * Three locks, all required (fleet console plan, "Security"):
 *   1. Cloudflare Access at the edge on /admin* and /api/admin/*.
 *   2. This Worker verifies the Access JWT itself (worker/admin/access.ts).
 *      If Access isn't configured the console is closed, not open.
 *   3. A passkey session on an admin account. Recovery-code and Apple
 *      sessions are refused, and dangerous actions need a fresh passkey tap.
 *
 * Every admin write goes through `audited()`, which adds an admin_audit row
 * in the same D1 batch as the change.
 */
import type { AdminOverview } from '../../src/lib/admin/contract.ts';
import { getSession, stepUpAt, stepUpOptions, stepUpVerify, STEPUP_TTL_MS, type Session } from '../auth/passkey.ts';
import type { Env } from '../env.ts';
import { HttpError, httpError, isLocalhost, json } from '../http.ts';
import { STEPUP_REQUIRED } from '../../src/lib/admin/contract.ts';
import { handleAccounts } from './accounts.ts';
import { handleSettings } from './settings.ts';
import { signupState } from '../auth/signup.ts';
import { AccessError, verifyAccessJwt, type AccessIdentity } from './access.ts';

export interface AdminContext {
	session: Session;
	access: AccessIdentity;
}

const DAY = 24 * 60 * 60 * 1000;

const devBypass = (env: Env, url: URL) => env.DEV_AUTH_BYPASS === '1' && isLocalhost(url.hostname);

/** Lock 2: the Access JWT. Throws HttpError 403/503. */
export async function requireAccess(req: Request, env: Env, url: URL): Promise<AccessIdentity> {
	if (devBypass(env, url)) return { email: 'dev@localhost', sub: 'dev' };
	if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD)
		throw httpError(503, 'unauthorized', 'The fleet console is closed until Cloudflare Access is set up');
	const token = req.headers.get('cf-access-jwt-assertion');
	if (!token) throw httpError(403, 'unauthorized', 'Sign in through Cloudflare Access first');
	try {
		return await verifyAccessJwt(token, {
			teamDomain: env.ACCESS_TEAM_DOMAIN,
			aud: env.ACCESS_AUD,
			emails: (env.ADMIN_EMAILS ?? '')
				.split(',')
				.map((e) => e.trim().toLowerCase())
				.filter(Boolean)
		});
	} catch (e) {
		if (e instanceof AccessError) throw httpError(403, 'unauthorized', e.message);
		throw e;
	}
}

/** Lock 3: which sessions may use the console. Pure, so it's easy to test. */
export function adminSessionProblem(session: Session | null): string | null {
	if (!session) return 'Sign in with your passkey first';
	if (session.kind !== 'passkey' && session.kind !== 'dev') return 'Sign in with a passkey to use the fleet console';
	if (!session.isAdmin) return 'This account is not an admin';
	return null;
}

export async function requireAdmin(req: Request, env: Env, url: URL): Promise<AdminContext> {
	const access = await requireAccess(req, env, url);
	const session = await getSession(req, env); // disabled accounts never get a session
	const problem = adminSessionProblem(session);
	if (problem) throw httpError(session ? 403 : 401, 'unauthorized', problem);
	return { session: session!, access };
}

/** Dangerous actions: the session must have confirmed with a passkey in the last 5 minutes. */
export async function requireFresh(env: Env, ctx: AdminContext, now = Date.now()) {
	const at = await stepUpAt(env, ctx.session);
	if (at === null || now - at > STEPUP_TTL_MS)
		throw new HttpError(428, { error: STEPUP_REQUIRED as never, message: 'Confirm with your passkey to continue' });
}

/** Wrap admin writes so each one is logged in the same batch. */
export function audited(
	env: Env,
	ctx: AdminContext,
	action: string,
	targetId: number | null,
	detail: unknown,
	statements: D1PreparedStatement[]
) {
	return env.DB.batch([
		...statements,
		env.DB.prepare(
			`INSERT INTO admin_audit (at, actor_id, actor_email, action, target_id, detail_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
		).bind(Date.now(), ctx.session.userId, ctx.access.email, action, targetId, detail === undefined ? null : JSON.stringify(detail))
	]);
}

export const monthStart = (now: number) => {
	const d = new Date(now);
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
};

async function overview(env: Env): Promise<AdminOverview> {
	const now = Date.now();
	const week = now - 7 * DAY;
	const signup = await signupState(env);
	const [accounts, spend, failed, devices] = await env.DB.batch<Record<string, number | null>>([
		env.DB.prepare(
			`SELECT COUNT(*) AS total,
			        SUM(CASE WHEN last_seen_at >= ?1 THEN 1 ELSE 0 END) AS active7d,
			        SUM(CASE WHEN created_at >= ?1 THEN 1 ELSE 0 END) AS new7d,
			        SUM(CASE WHEN created_at >= ?2 THEN 1 ELSE 0 END) AS new24h,
			        SUM(disabled) AS disabled
			   FROM accounts`
		).bind(week, now - DAY),
		env.DB.prepare(
			`SELECT COALESCE(SUM(cost_usd), 0) AS usd, COUNT(*) AS calls
			   FROM ai_ledger WHERE at >= ?1 AND status = 'done'`
		).bind(monthStart(now)),
		env.DB.prepare(`SELECT COUNT(*) AS n FROM ai_ledger WHERE at >= ?1 AND status = 'failed'`).bind(now - DAY),
		env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE account_id IS NULL`)
	]);
	const a = accounts.results[0] ?? {};
	const s = spend.results[0] ?? {};
	return {
		at: now,
		accounts: {
			total: a.total ?? 0,
			active7d: a.active7d ?? 0,
			new7d: a.new7d ?? 0,
			new24h: a.new24h ?? 0,
			disabled: a.disabled ?? 0
		},
		ai: { monthUsd: s.usd ?? 0, monthCalls: s.calls ?? 0, failed24h: failed.results[0]?.n ?? 0 },
		signupMode: signup.open ? 'open' : signup.invite ? 'invite' : 'closed',
		syncDevices: devices.results[0]?.n ?? 0
	};
}

export async function handleAdmin(req: Request, env: Env, url: URL): Promise<Response> {
	const ctx = await requireAdmin(req, env, url);
	const p = url.pathname;
	if (p === '/api/admin/overview' && req.method === 'GET') return json(await overview(env));
	if (p === '/api/admin/stepup/options' && req.method === 'POST') return json(await stepUpOptions(req, env, ctx.session));
	if (p === '/api/admin/stepup/verify' && req.method === 'POST') return json({ at: await stepUpVerify(req, env, ctx.session) });
	if (p.startsWith('/api/admin/settings') || p.startsWith('/api/admin/invites')) {
		const res = await handleSettings(req, env, url, ctx);
		if (res) return res;
	}
	if (p.startsWith('/api/admin/accounts')) {
		const res = await handleAccounts(req, env, url, ctx);
		if (res) return res;
	}
	return json({ error: 'not found' }, { status: 404 });
}

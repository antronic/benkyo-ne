/**
 * Fleet console: accounts (PR 2 of the fleet console plan).
 *
 * Reads are plain admin calls. Every change needs a fresh passkey tap
 * (requireFresh) and is written to admin_audit in the same batch.
 * Guard rails: an admin can't disable, delete or sign out themselves, and
 * admin accounts can't be disabled or deleted from the console at all
 * (the admin role is managed in D1 by hand).
 * Packages for an account are granted in worker/admin/packages.ts.
 */
import type {
	AdminGrant,
	AdminAccountDetail,
	AdminAccountList,
	AdminAccountPatch,
	AdminAccountRow
} from '../../src/lib/admin/contract.ts';
import { CONSENT_VERSION } from '../../src/lib/beta/contract.ts';
import { accountDataStatements } from '../ai/credentials.ts';
import type { Env } from '../env.ts';
import { httpError, json, readJson } from '../http.ts';
import { liveGrant, planOfSql } from '../plans.ts';
import { audited, monthStart, requireFresh, type AdminContext } from './routes.ts';

export const PAGE_SIZE = 50;
export const MAX_CAP_USD = 1000;

/** Columns shared by the list and the detail. ?1 = month start, ?2 = consent version. */
const ROW_SELECT = `
SELECT a.id, a.name, a.created_at AS createdAt, a.last_seen_at AS lastSeenAt,
       a.is_admin AS isAdmin, a.disabled, a.cap_usd AS capUsd,
       (SELECT COUNT(*) FROM passkeys p WHERE p.user_id = a.id) AS passkeys,
       EXISTS (SELECT 1 FROM apple_identities ap WHERE ap.user_id = a.id) AS appleLinked,
       (SELECT COALESCE(SUM(l.cost_usd), 0) FROM ai_ledger l
         WHERE l.user_id = a.id AND l.at >= ?1 AND l.status = 'done') AS monthUsd,
       EXISTS (SELECT 1 FROM beta_consents c
                WHERE c.user_id = a.id AND c.version >= ?2 AND c.withdrawn_at IS NULL) AS consented,
       ${planOfSql('a.id')} AS plan
  FROM accounts a`;

/** Package grants with the account name; ?1 = now. */
export const GRANT_SELECT = `
SELECT g.id, g.account_id AS accountId, a.name AS accountName, g.plan_id AS plan, g.kind, g.note,
       g.starts_at AS startsAt, g.ends_at AS endsAt, g.created_at AS createdAt, g.ended_at AS endedAt,
       (${liveGrant('?1')}) AS live
  FROM plan_grants g LEFT JOIN accounts a ON a.id = g.account_id`;

export const toGrant = (r: Omit<AdminGrant, 'live'> & { live: number }): AdminGrant => ({ ...r, live: !!r.live });


type RawRow = Omit<AdminAccountRow, 'isAdmin' | 'disabled' | 'appleLinked' | 'consented'> & {
	isAdmin: number;
	disabled: number;
	appleLinked: number;
	consented: number;
};

const toRow = (r: RawRow): AdminAccountRow => ({
	...r,
	isAdmin: !!r.isAdmin,
	disabled: !!r.disabled,
	appleLinked: !!r.appleLinked,
	consented: !!r.consented
});

export async function listAccounts(env: Env, q: string, offset: number): Promise<AdminAccountList> {
	const term = q.trim().slice(0, 40);
	const id = /^#?\d+$/.test(term) ? Number(term.replace('#', '')) : -1;
	const { results } = await env.DB.prepare(
		`${ROW_SELECT}
		  WHERE (?3 = '' OR a.name LIKE '%' || ?3 || '%' ESCAPE '\\' OR a.id = ?4)
		  ORDER BY (a.last_seen_at IS NULL), a.last_seen_at DESC, a.id DESC
		  LIMIT ?5 OFFSET ?6`
	)
		.bind(monthStart(Date.now()), CONSENT_VERSION, term.replace(/[\\%_]/g, (c) => '\\' + c), id, PAGE_SIZE + 1, offset)
		.all<RawRow>();
	return {
		accounts: results.slice(0, PAGE_SIZE).map(toRow),
		next: results.length > PAGE_SIZE ? offset + PAGE_SIZE : null
	};
}

export async function accountDetail(env: Env, id: number): Promise<AdminAccountDetail> {
	const ms = monthStart(Date.now());
	const row = await env.DB.prepare(`${ROW_SELECT} WHERE a.id = ?3`).bind(ms, CONSENT_VERSION, id).first<RawRow>();
	if (!row) throw httpError(404, 'bad_request', 'No such account');
	const [passkeys, sessions, recovery, byModel, recent, consent, grants] = await env.DB.batch([
		env.DB.prepare(
			`SELECT id, name, device_type AS deviceType, created_at AS createdAt, last_used_at AS lastUsedAt
			   FROM passkeys WHERE user_id = ?1 ORDER BY created_at`
		).bind(id),
		// never the token hash
		env.DB.prepare(
			`SELECT kind, created_at AS createdAt, expires_at AS expiresAt
			   FROM sessions WHERE user_id = ?1 AND expires_at > ?2 ORDER BY created_at DESC LIMIT 20`
		).bind(id, Date.now()),
		env.DB.prepare(
			`SELECT SUM(used_at IS NULL) AS unused, COUNT(*) AS total FROM recovery_codes WHERE user_id = ?1`
		).bind(id),
		env.DB.prepare(
			`SELECT feature, provider, model, COUNT(*) AS calls, COALESCE(SUM(cost_usd), 0) AS usd
			   FROM ai_ledger WHERE user_id = ?1 AND at >= ?2 AND status = 'done'
			  GROUP BY feature, provider, model ORDER BY usd DESC`
		).bind(id, ms),
		env.DB.prepare(
			`SELECT at, feature, model, status, cost_usd AS usd FROM ai_ledger WHERE user_id = ?1 ORDER BY at DESC LIMIT 20`
		).bind(id),
		env.DB.prepare(
			`SELECT version, accepted_at AS acceptedAt, withdrawn_at AS withdrawnAt
			   FROM beta_consents WHERE user_id = ?1 ORDER BY accepted_at DESC LIMIT 1`
		).bind(id),
		env.DB.prepare(`${GRANT_SELECT} WHERE g.account_id = ?2 ORDER BY g.id DESC LIMIT 20`).bind(Date.now(), id)
	]);
	const rc = (recovery.results[0] ?? {}) as { unused: number | null; total: number };
	return {
		...toRow(row),
		passkeyList: passkeys.results as AdminAccountDetail['passkeyList'],
		sessions: sessions.results as AdminAccountDetail['sessions'],
		recoveryCode: rc.unused ? 'unused' : rc.total ? 'used' : 'none',
		spendByModel: byModel.results as AdminAccountDetail['spendByModel'],
		recentCalls: recent.results as AdminAccountDetail['recentCalls'],
		consent: (consent.results[0] as AdminAccountDetail['consent']) ?? null,
		grants: (grants.results as Parameters<typeof toGrant>[0][]).map(toGrant)
	};
}

async function target(env: Env, ctx: AdminContext, id: number, action: string) {
	const t = await env.DB.prepare(`SELECT id, name, is_admin AS isAdmin, disabled, cap_usd AS capUsd FROM accounts WHERE id = ?1`)
		.bind(id)
		.first<{ id: number; name: string; isAdmin: number; disabled: number; capUsd: number }>();
	if (!t) throw httpError(404, 'bad_request', 'No such account');
	if (t.id === ctx.session.userId && action !== 'cap') throw httpError(400, 'bad_request', 'You can’t do this to your own account');
	if (t.isAdmin && (action === 'disable' || action === 'delete'))
		throw httpError(400, 'bad_request', 'Admin accounts can’t be disabled or deleted from the console');
	return t;
}

export function parsePatch(body: unknown): AdminAccountPatch {
	const b = (body ?? {}) as Record<string, unknown>;
	const out: AdminAccountPatch = {};
	if (b.disabled !== undefined) {
		if (typeof b.disabled !== 'boolean') throw httpError(400, 'bad_request', '`disabled` must be true or false');
		out.disabled = b.disabled;
	}
	if (b.capUsd !== undefined) {
		const n = b.capUsd;
		if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > MAX_CAP_USD)
			throw httpError(400, 'bad_request', `The cap must be between $0 and $${MAX_CAP_USD}`);
		out.capUsd = Math.round(n * 100) / 100;
	}
	if (out.disabled === undefined && out.capUsd === undefined) throw httpError(400, 'bad_request', 'Nothing to change');
	return out;
}

async function patchAccount(req: Request, env: Env, ctx: AdminContext, id: number) {
	const patch = parsePatch(await readJson(req, 4096));
	await requireFresh(env, ctx);
	if (patch.disabled !== undefined) {
		const t = await target(env, ctx, id, patch.disabled ? 'disable' : 'enable');
		const stmts = [env.DB.prepare(`UPDATE accounts SET disabled = ?1 WHERE id = ?2`).bind(patch.disabled ? 1 : 0, id)];
		// Disabling ends every session at once.
		if (patch.disabled) stmts.push(env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?1`).bind(id));
		await audited(env, ctx, patch.disabled ? 'account.disable' : 'account.enable', id, { was: !!t.disabled }, stmts);
	}
	if (patch.capUsd !== undefined) {
		const t = await target(env, ctx, id, 'cap');
		await audited(env, ctx, 'account.cap', id, { from: t.capUsd, to: patch.capUsd }, [
			env.DB.prepare(`UPDATE accounts SET cap_usd = ?1 WHERE id = ?2`).bind(patch.capUsd, id)
		]);
	}
	return json(await accountDetail(env, id));
}

async function revokeSessions(env: Env, ctx: AdminContext, id: number) {
	await requireFresh(env, ctx);
	await target(env, ctx, id, 'revoke');
	const n = await env.DB.prepare(`SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?1`).bind(id).first<{ n: number }>();
	await audited(env, ctx, 'account.revoke_sessions', id, { sessions: n?.n ?? 0 }, [
		env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?1`).bind(id)
	]);
	return json(await accountDetail(env, id));
}

async function deleteAccount(req: Request, env: Env, ctx: AdminContext, id: number) {
	const body = (await readJson(req, 4096)) as { confirm?: unknown };
	await requireFresh(env, ctx);
	const t = await target(env, ctx, id, 'delete');
	if (body?.confirm !== t.name) throw httpError(400, 'bad_request', 'Type the account’s name exactly to delete it');
	// Same data the person's own "Delete account" removes, plus the audit row.
	await audited(env, ctx, 'account.delete', id, { name: t.name }, accountDataStatements(env, id));
	return json({ ok: true });
}

export async function handleAccounts(req: Request, env: Env, url: URL, ctx: AdminContext): Promise<Response | null> {
	const p = url.pathname;
	const m = req.method;
	if (p === '/api/admin/accounts' && m === 'GET') {
		const offset = Math.max(0, Math.min(1e6, Number(url.searchParams.get('offset')) || 0));
		return json(await listAccounts(env, url.searchParams.get('q') ?? '', Math.floor(offset)));
	}
	const one = /^\/api\/admin\/accounts\/(\d{1,12})(\/revoke)?$/.exec(p);
	if (!one) return null;
	const id = Number(one[1]);
	if (one[2]) return m === 'POST' ? revokeSessions(env, ctx, id) : null;
	if (m === 'GET') return json(await accountDetail(env, id));
	if (m === 'PATCH') return patchAccount(req, env, ctx, id);
	if (m === 'DELETE') return deleteAccount(req, env, ctx, id);
	return null;
}

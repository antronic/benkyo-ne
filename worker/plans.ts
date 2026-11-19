/**
 * Packages (Free / Plus / Pro, plus any made in the console) and which one an account is on.
 *
 * An account is on the highest-ranked package of its live grants, else Free.
 * A grant is live when it has started, hasn't reached ends_at and wasn't
 * ended early. Nothing in the app enforces packages yet: managed AI and
 * checkout come later (docs/AI-PLAN.md, Phase B). The fleet console sets them.
 */
import type { Env } from './env.ts';

/** The packages every install starts with; more can be made in the fleet console. */
export const BUILTIN_PLANS = ['free', 'plus', 'pro'] as const;
/** 'free', 'plus', 'pro' or a package made in the console */
export type PlanId = string;
export const GRANT_KINDS = ['comp', 'trial'] as const;
export type GrantKind = (typeof GRANT_KINDS)[number];

/** SQL condition for a live grant `g` at time `now` (a bound parameter or expression). */
export const liveGrant = (now: string) => `g.ended_at IS NULL AND g.starts_at <= ${now} AND (g.ends_at IS NULL OR g.ends_at > ${now})`;

/** Milliseconds since the epoch on the database's clock. */
const DB_NOW = `CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)`;

/**
 * SQL expression: the package id of account `acc` (a column or parameter) right now.
 * Grants start when they're created, so this skips the starts_at check: a
 * Worker clock a little ahead of the database's can't hide a fresh grant.
 */
export const planOfSql = (acc: string) => `COALESCE((
	SELECT g.plan_id FROM plan_grants g JOIN plans pl ON pl.id = g.plan_id
	 WHERE g.account_id = ${acc} AND g.ended_at IS NULL AND (g.ends_at IS NULL OR g.ends_at > ${DB_NOW})
	 ORDER BY pl.rank DESC LIMIT 1), 'free')`;

export async function planOf(env: Env, accountId: number): Promise<PlanId> {
	const r = await env.DB.prepare(`SELECT ${planOfSql('?1')} AS plan`).bind(accountId).first<{ plan: PlanId }>();
	return r?.plan ?? 'free';
}

/**
 * Spend cap (D12), usage meter and per-session rate limit.
 *
 * Every AI call first *reserves* its worst-case cost with a single
 * conditional INSERT (atomic in D1: the cap check and the reservation can't
 * interleave with another call), then settles the row to the actual cost.
 * Rows count toward the month whatever their status, so a crash mid-call
 * leaves the conservative worst case on the books.
 */
import type { Usage } from '../../src/lib/ai/contract.ts';
import type { TokenUsage } from '../../src/lib/ai/prices.ts';
import type { Env } from '../env.ts';

export const DEFAULT_CAP_USD = 5;
export const RATE_LIMIT_PER_MIN = 30;

export function monthStart(now = Date.now()): number {
	const d = new Date(now);
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}
export const monthLabel = (now = Date.now()) => new Date(now).toISOString().slice(0, 7);

const CAP_SQL = `COALESCE((SELECT CAST(value AS REAL) FROM ai_settings WHERE key = 'cap_usd'), ${DEFAULT_CAP_USD})`;

export async function getUsage(env: Env, now = Date.now()): Promise<Usage> {
	const row = await env.DB.prepare(
		`SELECT COALESCE(SUM(cost_usd), 0) AS spent,
		        COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) AS calls,
		        ${CAP_SQL} AS cap
		   FROM ai_ledger WHERE at >= ?1`
	)
		.bind(monthStart(now))
		.first<{ spent: number; calls: number; cap: number }>();
	return {
		month: monthLabel(now),
		spentUsd: Math.round((row?.spent ?? 0) * 1e6) / 1e6,
		capUsd: row?.cap ?? DEFAULT_CAP_USD,
		calls: row?.calls ?? 0
	};
}

export async function setCap(env: Env, capUsd: number) {
	await env.DB.prepare(
		`INSERT INTO ai_settings (key, value) VALUES ('cap_usd', ?1) ON CONFLICT (key) DO UPDATE SET value = ?1`
	)
		.bind(String(capUsd))
		.run();
}

/** Reserve `worstUsd` if it fits under this month's cap. Returns the ledger id, or null when it doesn't fit. */
export async function reserve(
	env: Env,
	r: { feature: string; provider: string; model: string; worstUsd: number },
	now = Date.now()
): Promise<number | null> {
	const row = await env.DB.prepare(
		`INSERT INTO ai_ledger (at, feature, provider, model, status, cost_usd)
		 SELECT ?1, ?2, ?3, ?4, 'reserved', ?5
		  WHERE (SELECT COALESCE(SUM(cost_usd), 0) FROM ai_ledger WHERE at >= ?6) + ?5 <= ${CAP_SQL} + 1e-9
		 RETURNING id`
	)
		.bind(now, r.feature, r.provider, r.model, r.worstUsd, monthStart(now))
		.first<{ id: number }>();
	return row?.id ?? null;
}

/**
 * Settle reservations: the first row gets the actual totals, the rest are
 * removed. `cost: null` keeps the reserved worst case (outcome unknown).
 */
export async function settle(
	env: Env,
	ids: number[],
	outcome: { status: 'done' | 'failed'; usage: TokenUsage; cost: number | null }
) {
	if (!ids.length) return;
	const [first, ...rest] = ids;
	const u = outcome.usage;
	const stmts = [
		env.DB.prepare(
			`UPDATE ai_ledger SET status = ?1, input_tokens = ?2, cached_tokens = ?3, cache_write_tokens = ?4,
			        output_tokens = ?5, cost_usd = COALESCE(?6, cost_usd) WHERE id = ?7`
		).bind(outcome.status, u.input, u.cacheRead ?? 0, u.cacheWrite ?? 0, u.output, outcome.cost, first)
	];
	if (rest.length && outcome.cost !== null) {
		stmts.push(env.DB.prepare(`DELETE FROM ai_ledger WHERE id IN (${rest.map(() => '?').join(',')})`).bind(...rest));
	}
	await env.DB.batch(stmts);
}

/** Fixed one-minute window per bucket. Returns false when over the limit. */
export async function rateLimit(env: Env, bucket: string, limit = RATE_LIMIT_PER_MIN, now = Date.now()) {
	const minute = Math.floor(now / 60000);
	const [, res] = await env.DB.batch([
		env.DB.prepare(`DELETE FROM ai_rate WHERE minute < ?1`).bind(minute - 5),
		env.DB.prepare(
			`INSERT INTO ai_rate (bucket, minute, count) VALUES (?1, ?2, 1)
			 ON CONFLICT (bucket, minute) DO UPDATE SET count = count + 1 RETURNING count`
		).bind(bucket, minute)
	]);
	const count = (res.results[0] as { count: number } | undefined)?.count ?? 0;
	return count <= limit;
}

/**
 * Managed AI (docs/AI-PLAN.md, Phase B): a learner on a paid package runs AI
 * through the operator's provider keys (ai_providers, sealed with
 * AI_MASTER_KEY) on the model the package assigns to each feature
 * (plan_models), counted in credits against the package's monthly credits
 * (plans.ai_credits) in ai_ledger rows with source 'package'. Each model's
 * credit rate is set in the fleet console (model_credit_rates); a model
 * without one costs its USD price at the default exchange
 * (src/lib/ai/credits.ts).
 *
 * Which AI a call uses (`startCall`):
 *   prefer 'package' (default): the package, then the learner's own key as a fallback
 *                               (feature not in the package, allowance used up, daily limit hit)
 *   prefer 'own':               the learner's own key; the package only when they have no key
 * Learners without a package keep using their own key, exactly as before.
 *
 *   GET /api/ai/managed            → ManagedAi
 *   PUT /api/ai/managed {prefer}   → ManagedAi
 *
 * Provider keys never leave this module: callers get a `key()` function.
 */
import type { AiSource, Feature, ManagedAi, Price, ProviderKind } from '../../src/lib/ai/contract.ts';
import { CREDITS_PER_USD, creditsForTokens, creditsForUsd, isCreditUnit, type CreditRate } from '../../src/lib/ai/credits.ts';
import { builtinPrice } from '../../src/lib/ai/prices.ts';
import { decryptProvider, type ProviderRow } from '../admin/providers.ts';
import type { Env } from '../env.ts';
import { aiError, httpError } from '../http.ts';
import { planOfSql } from '../plans.ts';
import { decryptKey } from './credentials.ts';
import type { Charge } from './cost.ts';
import { getPackageSpend, getUsage, monthLabel, rateLimit, reserve } from './ledger.ts';
import { FEATURES, featureModels, priceFor, resolveFeature } from './models.ts';

const DAY = 86_400_000;
/** Managed AI calls per account per minute and per UTC day (on top of the general AI limits). */
export const PACKAGE_PER_MIN = 15;
export const PACKAGE_PER_DAY = 300;
/** Managed AI calls per minute across every account: protects the operator's provider keys. */
export const PACKAGE_GLOBAL_PER_MIN = 120;

/** Where one call runs. */
export interface AiTarget {
	source: AiSource;
	provider: ProviderKind;
	baseUrl: string | null;
	model: string;
	price: Price;
	/** decrypts the API key just before the call; never stored or returned */
	key: () => Promise<string>;
	/** the package billed, for 'package' */
	planId: string | null;
	/** the package's monthly credits, for 'package' */
	capCredits: number | null;
	/** the model's credit rate, for 'package'; null: its USD price at the default exchange */
	rate: CreditRate | null;
}

interface PlanRow {
	id: string;
	name: string;
	/** monthly credits */
	allowance: number;
	prefer: AiSource | null;
}

type PackageModelRow = ProviderRow & {
	pm_model: string;
	pm_label: string;
	pm_features: string;
	pm_in: number | null;
	pm_out: number | null;
	cr_unit: number | null;
	cr_in: number | null;
	cr_out: number | null;
};

const nextMonth = (now: number) => {
	const d = new Date(now);
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
};

/** The account's live package, its allowance and the learner's preference. */
async function planState(env: Env, userId: number): Promise<PlanRow> {
	const r = await env.DB.prepare(
		`SELECT p.id, p.name, p.ai_credits AS allowance, (SELECT ai_source FROM accounts WHERE id = ?1) AS prefer
		   FROM plans p WHERE p.id = ${planOfSql('?1')}`
	)
		.bind(userId)
		.first<PlanRow>();
	return r ?? { id: 'free', name: 'Free', allowance: 0, prefer: 'package' };
}

/** The package's models on turned-on providers, in the console's order. */
async function packageModels(env: Env, planId: string): Promise<PackageModelRow[]> {
	const { results } = await env.DB.prepare(
		`SELECT pr.*, m.model AS pm_model, m.label AS pm_label, m.features AS pm_features, m.input_per_m AS pm_in, m.output_per_m AS pm_out,
		        r.unit AS cr_unit, r.input_credits AS cr_in, r.output_credits AS cr_out
		   FROM plan_models m JOIN ai_providers pr ON pr.id = m.provider_id
		   LEFT JOIN model_credit_rates r ON r.provider_id = m.provider_id AND r.model = m.model
		  WHERE m.plan_id = ?1 AND pr.enabled = 1 ORDER BY m.position`
	)
		.bind(planId)
		.all<PackageModelRow>();
	return results;
}

const featuresOf = (r: PackageModelRow) => (r.pm_features ? (r.pm_features.split(',') as Feature[]) : []);

/**
 * Price the package pays: the console's snapshot, else the built-in table,
 * else $0. The operator picked the model in Fleet, so an unlisted price (a
 * self-hosted model, say) must not silently send learners to their own key:
 * the call runs, is counted, and the rate limits still apply.
 */
export function packagePrice(r: Pick<PackageModelRow, 'pm_in' | 'pm_out' | 'pm_model'>): Price {
	if (r.pm_in !== null && r.pm_out !== null) return { inputPerM: r.pm_in, outputPerM: r.pm_out };
	return builtinPrice(r.pm_model) ?? { inputPerM: 0, outputPerM: 0 };
}

/** The model's credit rate from the console, or null when none is set. */
export function packageRate(r: Pick<PackageModelRow, 'cr_unit' | 'cr_in' | 'cr_out'>): CreditRate | null {
	if (!isCreditUnit(r.cr_unit) || r.cr_in === null || r.cr_out === null) return null;
	return { unit: r.cr_unit, inputCredits: r.cr_in, outputCredits: r.cr_out };
}

/** Credits for a million input plus a million output tokens: how the cheapest model is picked. */
function creditsPerMillion(m: PackageModelRow) {
	const rate = packageRate(m);
	if (rate) return creditsForTokens(1_000_000, 1_000_000, rate);
	const p = packagePrice(m);
	return creditsForUsd(p.inputPerM + p.outputPerM);
}

/** The package with managed AI: a paid package with an allowance and at least one model with a feature. */
async function livePackage(env: Env, userId: number) {
	const plan = await planState(env, userId);
	const prefer: AiSource = plan.prefer === 'own' ? 'own' : 'package';
	if (plan.id === 'free' || !(plan.allowance > 0)) return { plan: null, models: [] as PackageModelRow[], prefer };
	const models = (await packageModels(env, plan.id)).filter((m) => featuresOf(m).length > 0);
	return { plan: models.length ? plan : null, models, prefer };
}

/**
 * The package model for a feature. Translate falls back to the package's
 * cheapest model when the console didn't assign one.
 */
function packageRow(models: PackageModelRow[], feature: Feature): PackageModelRow | undefined {
	const row = models.find((m) => featuresOf(m).includes(feature));
	if (row || feature !== 'translate') return row;
	return [...models].sort((a, b) => creditsPerMillion(a) - creditsPerMillion(b))[0];
}

function packageTarget(plan: PlanRow, models: PackageModelRow[], feature: Feature, env: Env): AiTarget | null {
	const row = packageRow(models, feature);
	const price = row && packagePrice(row);
	if (!row || !price) return null;
	return {
		source: 'package',
		provider: row.kind,
		baseUrl: row.base_url,
		model: row.pm_model,
		price,
		key: () => decryptProvider(env, row),
		planId: plan.id,
		capCredits: plan.allowance,
		rate: packageRate(row)
	};
}

async function ownTarget(env: Env, ctx: ExecutionContext, userId: number, feature: Feature) {
	const own = await resolveFeature(env, userId, feature);
	if (!own) return { target: null, exists: false, noPrice: null as string | null };
	const priced = await priceFor(env, ctx, own.cred, own.model);
	if (!priced) return { target: null, exists: true, noPrice: own.model };
	const target: AiTarget = {
		source: 'own',
		provider: own.cred.provider,
		baseUrl: own.cred.base_url,
		model: own.model,
		price: priced.price,
		key: () => decryptKey(env, own.cred),
		planId: null,
		capCredits: null,
		rate: null
	};
	return { target, exists: true, noPrice: null };
}

/** The latest paid package that ended in the last 30 days. */
async function endedPackage(env: Env, userId: number, now = Date.now()) {
	return (
		(await env.DB.prepare(
			`SELECT pl.name, COALESCE(g.ended_at, g.ends_at) AS endedAt FROM plan_grants g JOIN plans pl ON pl.id = g.plan_id
			  WHERE g.account_id = ?1 AND pl.id != 'free' AND pl.ai_credits > 0
			    AND COALESCE(g.ended_at, g.ends_at) BETWEEN ?2 AND ?3
			  ORDER BY endedAt DESC LIMIT 1`
		)
			.bind(userId, now - 30 * DAY, now)
			.first<{ name: string; endedAt: number }>()) ?? null
	);
}

/** Reserve the worst case under the target's budget: USD under the own cap, credits under the package's. */
export function reserveFor(env: Env, userId: number, t: AiTarget, feature: Feature, worst: Charge) {
	return reserve(env, userId, {
		feature,
		provider: t.provider,
		model: t.model,
		worstUsd: worst.usd,
		source: t.source,
		planId: t.planId,
		worstCredits: worst.credits,
		capCredits: t.capCredits ?? 0
	});
}

const FEATURE_NAME: Record<Feature, string> = { fill: 'filling in cards', propose: 'suggestions and Ask AI', vision: 'reading photos', translate: 'translating community notes' };
const day = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });

/**
 * Pick the AI for one call, check the managed AI limits, and reserve its
 * worst case. Falls back as described at the top of this file. On failure
 * returns the JSON error response to send.
 */
export async function startCall(
	env: Env,
	ctx: ExecutionContext,
	userId: number,
	feature: Feature,
	worstOf: (t: AiTarget) => Charge,
	now = Date.now()
): Promise<{ ok: true; target: AiTarget; worst: Charge; reservation: number } | { ok: false; res: Response }> {
	const pkg = await livePackage(env, userId);
	const pkgT = pkg.plan ? packageTarget(pkg.plan, pkg.models, feature, env) : null;
	// The own key is looked up only when it may be used: its price lookup can call the learner's provider.
	let own: Awaited<ReturnType<typeof ownTarget>> | null = null;
	const getOwn = async () => (own ??= await ownTarget(env, ctx, userId, feature));
	// preferring their own key: the package is used only when they have no key for this feature
	const order: (() => Promise<AiTarget | null>)[] =
		pkg.prefer === 'own'
			? [async () => (await getOwn()).target, async () => ((await getOwn()).exists ? null : pkgT)]
			: [async () => pkgT, async () => (await getOwn()).target];

	// the last budget that refused is reported: it's the one the learner can act on
	const failures: { why: 'allowance' | 'limit' | 'cap'; worst: Charge }[] = [];
	for (const next of order) {
		const t = await next();
		if (!t) continue;
		if (t.source === 'package') {
			const ok =
				(await rateLimit(env, `pkg:${userId}`, PACKAGE_PER_MIN, now)) &&
				(await rateLimit(env, `pkg-day:${userId}`, PACKAGE_PER_DAY, now, 1440)) &&
				(await rateLimit(env, 'pkg-all', PACKAGE_GLOBAL_PER_MIN, now));
			if (!ok) {
				failures.push({ why: 'limit', worst: { usd: 0, credits: 0 } });
				continue;
			}
		}
		const worst = worstOf(t);
		const id = await reserveFor(env, userId, t, feature, worst);
		if (id !== null) return { ok: true, target: t, worst, reservation: id };
		failures.push({ why: t.source === 'package' ? 'allowance' : 'cap', worst });
	}
	const last = failures.at(-1);
	const first = last?.why ?? null;
	const worstFirst = last?.worst.usd ?? 0;
	const alsoPackage = failures.length > 1 ? ' Your package’s AI can’t be used right now either.' : '';

	if (first === 'limit')
		return {
			ok: false,
			res: aiError(429, 'rate_limited', 'You’ve used your package’s AI a lot just now. Wait a minute and try again (or tomorrow, after many calls today).', {
				'retry-after': '60'
			})
		};
	if (first === 'allowance')
		return {
			ok: false,
			res: aiError(
				402,
				'allowance_reached',
				`This month’s AI in your ${pkg.plan!.name} package is used up. It starts again on ${day(nextMonth(now))}, or add your own API key in Settings to keep going.`
			)
		};
	if (first === 'cap') {
		const u = await getUsage(env, userId, now);
		return {
			ok: false,
			res: aiError(
				402,
				'cap_reached',
				`Monthly AI cap reached ($${u.spentUsd.toFixed(3)} of $${u.capUsd.toFixed(2)} used; this call could cost up to $${worstFirst.toFixed(3)}).${alsoPackage}`
			)
		};
	}
	// nothing to run on
	const o = await getOwn();
	if (o.noPrice) return { ok: false, res: aiError(409, 'no_price', `Set a price for ${o.noPrice} to use it under the spend cap.`) };
	if (pkg.plan)
		return {
			ok: false,
			res: aiError(409, 'no_model', `Your ${pkg.plan.name} package doesn’t include AI for ${FEATURE_NAME[feature]}. Add your own API key in Settings to use it.`)
		};
	const ended = await endedPackage(env, userId, now);
	if (ended)
		return {
			ok: false,
			res: aiError(402, 'package_ended', `Your ${ended.name} package ended on ${day(ended.endedAt)}. Redeem a code or add your own API key in Settings to keep using AI.`)
		};
	return { ok: false, res: aiError(409, 'no_model', `No model is set for "${feature}". Add an API key in Settings.`) };
}

// ------------------------------------------------------------ settings ----

export async function managedStatus(env: Env, userId: number, now = Date.now()): Promise<ManagedAi> {
	const [pkg, spend, ownFeatures] = await Promise.all([livePackage(env, userId), getPackageSpend(env, userId, now), featureModels(env, userId)]);
	let plan: ManagedAi['plan'] = null;
	const models: ManagedAi['models'] = [];
	if (pkg.plan) {
		const g = await env.DB.prepare(
			`SELECT MAX(COALESCE(ends_at, 9e15)) AS endsAt FROM plan_grants
			  WHERE account_id = ?1 AND plan_id = ?2 AND ended_at IS NULL AND (ends_at IS NULL OR ends_at > ?3)`
		)
			.bind(userId, pkg.plan.id, now)
			.first<{ endsAt: number | null }>();
		const endsAt = g?.endsAt == null || g.endsAt >= 9e15 ? null : g.endsAt;
		plan = { id: pkg.plan.id, name: pkg.plan.name, endsAt };
		for (const f of FEATURES) {
			const row = packageRow(pkg.models, f);
			if (row) models.push({ feature: f, label: row.pm_label, model: row.pm_model });
		}
	}
	const allowanceCredits = pkg.plan?.allowance ?? 0;
	const blocked: ManagedAi['blocked'] = plan && spend.spentCredits >= allowanceCredits - 1e-9 ? 'allowance' : null;
	// the order startCall follows, per feature (the own key's price and cap aside)
	const byFeature: ManagedAi['byFeature'] = FEATURES.map((feature) => {
		const ownHas = ownFeatures.some((x) => x.feature === feature);
		const pkgHas = !blocked && models.some((x) => x.feature === feature);
		const source: AiSource | null =
			pkg.prefer === 'own' ? (ownHas ? 'own' : pkgHas ? 'package' : null) : pkgHas ? 'package' : ownHas ? 'own' : null;
		return { feature, source };
	});
	const used = byFeature.map((b) => b.source).filter((x): x is AiSource => !!x);
	const active: ManagedAi['active'] = used.includes(pkg.prefer) ? pkg.prefer : (used[0] ?? null);
	return {
		plan,
		models,
		byFeature,
		month: monthLabel(now),
		allowanceCredits,
		spentCredits: spend.spentCredits,
		// for app versions from before credits: the same numbers at the default exchange
		allowanceUsd: allowanceCredits / CREDITS_PER_USD,
		spentUsd: spend.spentCredits / CREDITS_PER_USD,
		calls: spend.calls,
		resetsAt: nextMonth(now),
		prefer: pkg.prefer,
		active,
		blocked,
		ended: plan ? null : await endedPackage(env, userId, now)
	};
}

export async function setPreference(env: Env, userId: number, body: unknown) {
	const prefer = (body as { prefer?: unknown } | null)?.prefer;
	if (prefer !== 'package' && prefer !== 'own') throw httpError(400, 'bad_request', 'prefer must be "package" or "own"');
	await env.DB.prepare(`UPDATE accounts SET ai_source = ?1 WHERE id = ?2`).bind(prefer, userId).run();
}


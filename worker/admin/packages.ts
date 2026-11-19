/**
 * Fleet console: packages (PR 5 of the fleet console plan).
 *
 *   GET    /api/admin/packages                         every package, how many accounts each, its models, live grants
 *   POST   /api/admin/packages {AdminPlanCreate}       make a new package (after Free, Plus, Pro)        step-up
 *   PUT    /api/admin/packages/:id {AdminPlanPatch}    edit name, prices, AI allowance, blurb, offered   step-up
 *   PUT    /api/admin/packages/:id/models {AdminPlanModelsInput}  the AI models it includes          step-up
 *   DELETE /api/admin/packages/:id                     delete a made package nobody was ever granted    step-up
 *   POST   /api/admin/accounts/:id/grants {AdminGrantInput}  give an account Plus or Pro (replaces its live grant)  step-up
 *   DELETE /api/admin/accounts/:id/grants/:grantId     end a grant now                                   step-up
 *
 * Every change is written to admin_audit. Packages aren't enforced in the app
 * yet (worker/plans.ts); this is where they're defined and handed out.
 * Models come from the platform AI providers (worker/admin/providers.ts) and
 * are checked against the provider's own model list when they're added.
 */
import type {
	AdminFeature,
	AdminGrantInput,
	AdminPackages,
	AdminPlan,
	AdminPlanCreate,
	AdminPlanModel,
	AdminPlanModelsInput,
	AdminPlanPatch
} from '../../src/lib/admin/contract.ts';
import type { Env } from '../env.ts';
import { httpError, json, readJson } from '../http.ts';
import { BUILTIN_PLANS, GRANT_KINDS, liveGrant, planOfSql } from '../plans.ts';
import { accountDetail, GRANT_SELECT, toGrant } from './accounts.ts';
import { modelsOf, providerRow, toAdminModel } from './providers.ts';
import { audited, requireFresh, type AdminContext } from './routes.ts';

const DAY = 24 * 60 * 60 * 1000;
export const MAX_PRICE_USD = 1000;
export const MAX_ALLOWANCE_USD = 100;
export const MAX_GRANT_DAYS = 730;
export const MAX_PACKAGES = 12;
export const MAX_PLAN_MODELS = 20;
export const FEATURES: AdminFeature[] = ['fill', 'propose', 'vision'];

type PlanRow = Omit<AdminPlan, 'available' | 'accounts' | 'builtin' | 'models'> & { available: number };
type PlanModelRow = Omit<AdminPlanModel, 'features'> & { planId: string; features: string };
const PLAN_COLS = `id, name, price_month_usd AS priceMonthUsd, price_year_usd AS priceYearUsd,
	ai_allowance_usd AS aiAllowanceUsd, blurb, available, updated_at AS updatedAt`;

async function packages(env: Env): Promise<AdminPackages> {
	const now = Date.now();
	const [plans, counts, grants, models] = await env.DB.batch<Record<string, never>>([
		env.DB.prepare(`SELECT ${PLAN_COLS} FROM plans ORDER BY rank`),
		env.DB.prepare(`SELECT ${planOfSql('a.id')} AS plan, COUNT(*) AS n FROM accounts a GROUP BY plan`),
		env.DB.prepare(`${GRANT_SELECT} WHERE ${liveGrant('?1')} ORDER BY g.ends_at IS NULL, g.ends_at, g.id DESC LIMIT 200`).bind(now),
		env.DB.prepare(
			`SELECT m.plan_id AS planId, m.provider_id AS providerId, pr.label AS providerLabel, m.model, m.label, m.features,
			        m.input_per_m AS inputPerM, m.output_per_m AS outputPerM
			   FROM plan_models m LEFT JOIN ai_providers pr ON pr.id = m.provider_id ORDER BY m.plan_id, m.position`
		)
	]);
	const byPlan = new Map((counts.results as unknown as { plan: string; n: number }[]).map((c) => [c.plan, c.n]));
	const modelsByPlan = new Map<string, AdminPlanModel[]>();
	for (const { planId, features, ...m } of models.results as unknown as PlanModelRow[])
		modelsByPlan.set(planId, [...(modelsByPlan.get(planId) ?? []), { ...m, features: features ? (features.split(',') as AdminFeature[]) : [] }]);
	return {
		plans: (plans.results as unknown as PlanRow[]).map((p) => ({
			...p,
			available: !!p.available,
			accounts: byPlan.get(p.id) ?? 0,
			builtin: (BUILTIN_PLANS as readonly string[]).includes(p.id),
			models: modelsByPlan.get(p.id) ?? []
		})),
		grants: (grants.results as never as Parameters<typeof toGrant>[0][]).map(toGrant)
	};
}

const money = (v: unknown, max: number, what: string) => {
	if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) throw httpError(400, 'bad_request', `${what} must be $0 to $${max}`);
	return Math.round(v * 100) / 100;
};
const text = (v: unknown, max: number, what: string, allowEmpty = false) => {
	if (typeof v !== 'string') throw httpError(400, 'bad_request', `${what} must be text`);
	const t = v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
	if (!t && !allowEmpty) throw httpError(400, 'bad_request', `${what} can’t be empty`);
	return t;
};

export function parsePlanPatch(id: string, body: unknown): AdminPlanPatch {
	const b = (body ?? {}) as Record<string, unknown>;
	const out: AdminPlanPatch = {};
	if (b.name !== undefined) out.name = text(b.name, 30, 'The name');
	if (b.blurb !== undefined) out.blurb = text(b.blurb, 200, 'The description', true);
	if (b.priceMonthUsd !== undefined) out.priceMonthUsd = money(b.priceMonthUsd, MAX_PRICE_USD, 'The monthly price');
	if (b.priceYearUsd !== undefined) out.priceYearUsd = money(b.priceYearUsd, MAX_PRICE_USD, 'The yearly price');
	if (b.aiAllowanceUsd !== undefined) out.aiAllowanceUsd = money(b.aiAllowanceUsd, MAX_ALLOWANCE_USD, 'The AI allowance');
	if (b.available !== undefined) {
		if (typeof b.available !== 'boolean') throw httpError(400, 'bad_request', '`available` must be true or false');
		out.available = b.available;
	}
	if (!Object.keys(out).length) throw httpError(400, 'bad_request', 'Nothing to change');
	if (id === 'free' && (out.priceMonthUsd || out.priceYearUsd || out.aiAllowanceUsd || out.available === false))
		throw httpError(400, 'bad_request', 'Free stays free, with no managed AI, and is always offered');
	return out;
}

export function parsePlanCreate(body: unknown): AdminPlanCreate {
	const b = (body ?? {}) as Record<string, unknown>;
	return {
		name: text(b.name, 30, 'The name'),
		blurb: b.blurb === undefined ? '' : text(b.blurb, 200, 'The description', true),
		priceMonthUsd: money(b.priceMonthUsd, MAX_PRICE_USD, 'The monthly price'),
		priceYearUsd: money(b.priceYearUsd, MAX_PRICE_USD, 'The yearly price'),
		aiAllowanceUsd: money(b.aiAllowanceUsd, MAX_ALLOWANCE_USD, 'The AI allowance')
	};
}

/** A readable id from the name, with a random tail so two packages never clash. */
export function newPlanId(name: string, rand = crypto.getRandomValues(new Uint8Array(3))) {
	const slug = name
		.normalize('NFKD')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 16)
		.replace(/-+$/, '');
	const tail = [...rand].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 5);
	return `${slug || 'pkg'}-${tail}`;
}

export function parseModelsInput(body: unknown): AdminPlanModelsInput {
	const b = (body ?? {}) as Record<string, unknown>;
	if (!Array.isArray(b.models)) throw httpError(400, 'bad_request', '`models` must be a list');
	if (b.models.length > MAX_PLAN_MODELS) throw httpError(400, 'bad_request', `Up to ${MAX_PLAN_MODELS} models in a package`);
	const seen = new Set<string>();
	const taken = new Set<AdminFeature>();
	const models = b.models.map((raw) => {
		const m = (raw ?? {}) as Record<string, unknown>;
		if (!Number.isInteger(m.providerId) || (m.providerId as number) < 1) throw httpError(400, 'bad_request', 'Each model needs a provider');
		if (typeof m.model !== 'string' || !m.model.trim() || m.model.length > 200) throw httpError(400, 'bad_request', 'Each model needs an id');
		const model = m.model.trim();
		const k = `${m.providerId}\u0000${model}`;
		if (seen.has(k)) throw httpError(400, 'bad_request', `${model} is in the list twice`);
		seen.add(k);
		const features = m.features === undefined ? [] : m.features;
		if (!Array.isArray(features) || features.some((f) => !FEATURES.includes(f as AdminFeature)))
			throw httpError(400, 'bad_request', 'Features are fill, propose and vision');
		for (const f of features as AdminFeature[]) {
			if (taken.has(f)) throw httpError(400, 'bad_request', `Only one model can do “${f}” in a package`);
			taken.add(f);
		}
		return { providerId: m.providerId as number, model, features: FEATURES.filter((f) => (features as string[]).includes(f)) };
	});
	return { models };
}

export function parseGrantInput(body: unknown): AdminGrantInput {
	const b = (body ?? {}) as Record<string, unknown>;
	if (typeof b.plan !== 'string' || !/^[a-z0-9-]{1,32}$/.test(b.plan) || b.plan === 'free')
		throw httpError(400, 'bad_request', 'Grant a paid package');
	if (!(GRANT_KINDS as readonly unknown[]).includes(b.kind)) throw httpError(400, 'bad_request', 'Kind must be comp or trial');
	const days = b.days === null || b.days === undefined ? null : b.days;
	if (days !== null && (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > MAX_GRANT_DAYS))
		throw httpError(400, 'bad_request', `A grant lasts 1 to ${MAX_GRANT_DAYS} days, or until ended`);
	if (b.kind === 'trial' && days === null) throw httpError(400, 'bad_request', 'A trial needs an end date');
	const note = b.note === undefined || b.note === null ? undefined : text(b.note, 120, 'The note', true) || undefined;
	return { plan: b.plan, kind: b.kind as AdminGrantInput['kind'], days, note };
}

async function updatePlan(req: Request, env: Env, ctx: AdminContext, id: string) {
	const patch = parsePlanPatch(id, await readJson(req, 4096));
	await requireFresh(env, ctx);
	const before = await env.DB.prepare(`SELECT ${PLAN_COLS} FROM plans WHERE id = ?1`).bind(id).first<PlanRow>();
	if (!before) throw httpError(404, 'bad_request', 'No such package');
	const cols: Record<keyof AdminPlanPatch, string> = {
		name: 'name',
		blurb: 'blurb',
		priceMonthUsd: 'price_month_usd',
		priceYearUsd: 'price_year_usd',
		aiAllowanceUsd: 'ai_allowance_usd',
		available: 'available'
	};
	const keys = (Object.keys(patch) as (keyof AdminPlanPatch)[]).filter((k) => {
		const was = k === 'available' ? !!before.available : before[k];
		return was !== patch[k];
	});
	if (keys.length) {
		const sets = keys.map((k, i) => `${cols[k]} = ?${i + 1}`).join(', ');
		const values = keys.map((k) => (k === 'available' ? (patch[k] ? 1 : 0) : patch[k]));
		const diff = Object.fromEntries(keys.map((k) => [k, { from: k === 'available' ? !!before.available : before[k], to: patch[k] }]));
		await audited(env, ctx, 'package.update', null, { plan: id, ...diff }, [
			env.DB.prepare(`UPDATE plans SET ${sets}, updated_at = ?${keys.length + 1}, updated_by = ?${keys.length + 2} WHERE id = ?${keys.length + 3}`).bind(
				...values,
				Date.now(),
				ctx.session.userId,
				id
			)
		]);
	}
	return json(await packages(env));
}

async function grant(req: Request, env: Env, ctx: AdminContext, accountId: number) {
	const input = parseGrantInput(await readJson(req, 4096));
	await requireFresh(env, ctx);
	const acc = await env.DB.prepare(`SELECT id FROM accounts WHERE id = ?1`).bind(accountId).first();
	if (!acc) throw httpError(404, 'bad_request', 'No such account');
	if (!(await env.DB.prepare(`SELECT id FROM plans WHERE id = ?1`).bind(input.plan).first()))
		throw httpError(400, 'bad_request', 'No such package');
	const now = Date.now();
	const endsAt = input.days === null ? null : now + input.days * DAY;
	const replaced = await env.DB.prepare(`SELECT g.id FROM plan_grants g WHERE g.account_id = ?2 AND ${liveGrant('?1')}`)
		.bind(now, accountId)
		.all<{ id: number }>();
	await audited(env, ctx, 'package.grant', accountId, { plan: input.plan, kind: input.kind, endsAt, note: input.note ?? null, replaced: replaced.results.map((r) => r.id) }, [
		// one live grant per account: the new one replaces any other
		env.DB.prepare(`UPDATE plan_grants AS g SET ended_at = ?1 WHERE g.account_id = ?2 AND ${liveGrant('?1')}`).bind(now, accountId),
		env.DB.prepare(
			`INSERT INTO plan_grants (account_id, plan_id, kind, note, starts_at, ends_at, created_at, created_by) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?5, ?7)`
		).bind(accountId, input.plan, input.kind, input.note ?? null, now, endsAt, ctx.session.userId)
	]);
	return json(await accountDetail(env, accountId));
}

async function endGrant(env: Env, ctx: AdminContext, accountId: number, grantId: number) {
	await requireFresh(env, ctx);
	const now = Date.now();
	const g = await env.DB.prepare(`SELECT g.plan_id AS plan FROM plan_grants g WHERE g.id = ?2 AND g.account_id = ?3 AND ${liveGrant('?1')}`)
		.bind(now, grantId, accountId)
		.first<{ plan: string }>();
	if (!g) throw httpError(404, 'bad_request', 'No such grant, or it has already ended');
	await audited(env, ctx, 'package.end', accountId, { grant: grantId, plan: g.plan }, [
		env.DB.prepare(`UPDATE plan_grants SET ended_at = ?1 WHERE id = ?2`).bind(now, grantId)
	]);
	return json(await accountDetail(env, accountId));
}

async function createPlan(req: Request, env: Env, ctx: AdminContext) {
	const input = parsePlanCreate(await readJson(req, 4096));
	await requireFresh(env, ctx);
	const stats = await env.DB.prepare(`SELECT COUNT(*) AS n, MAX(rank) AS top FROM plans`).first<{ n: number; top: number }>();
	if ((stats?.n ?? 0) >= MAX_PACKAGES) throw httpError(400, 'bad_request', `Up to ${MAX_PACKAGES} packages`);
	const id = newPlanId(input.name);
	await audited(env, ctx, 'package.create', null, { plan: id, ...input }, [
		env.DB.prepare(
			`INSERT INTO plans (id, rank, name, price_month_usd, price_year_usd, ai_allowance_usd, blurb, available, updated_at, updated_by)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, ?8, ?9)`
		).bind(id, (stats?.top ?? 0) + 1, input.name, input.priceMonthUsd, input.priceYearUsd, input.aiAllowanceUsd, input.blurb ?? '', Date.now(), ctx.session.userId)
	]);
	return json({ ...(await packages(env)), created: id }, { status: 201 });
}

async function deletePlan(env: Env, ctx: AdminContext, id: string) {
	await requireFresh(env, ctx);
	if ((BUILTIN_PLANS as readonly string[]).includes(id)) throw httpError(400, 'bad_request', 'Free, Plus and Pro can’t be deleted; turn off “Offered” instead');
	const plan = await env.DB.prepare(`SELECT name FROM plans WHERE id = ?1`).bind(id).first<{ name: string }>();
	if (!plan) throw httpError(404, 'bad_request', 'No such package');
	const g = await env.DB.prepare(`SELECT COUNT(*) AS n FROM plan_grants WHERE plan_id = ?1`).bind(id).first<{ n: number }>();
	if (g?.n) throw httpError(400, 'bad_request', 'Someone has had this package, so it stays for the record; turn off “Offered” instead');
	const promos = await env.DB.prepare(`SELECT COUNT(*) AS n FROM promo_codes WHERE plan_id = ?1`).bind(id).first<{ n: number }>();
	if (promos?.n)
		throw httpError(400, 'bad_request', `${promos.n} promo code${promos.n === 1 ? ' gives' : 's give'} this package; move them to another package first (edit the code)`);
	await audited(env, ctx, 'package.delete', null, { plan: id, name: plan.name }, [
		env.DB.prepare(`DELETE FROM plan_models WHERE plan_id = ?1`).bind(id),
		env.DB.prepare(`DELETE FROM plans WHERE id = ?1`).bind(id)
	]);
	return json(await packages(env));
}

async function setModels(req: Request, env: Env, ctx: AdminContext, id: string) {
	const input = parseModelsInput(await readJson(req, 32 * 1024));
	await requireFresh(env, ctx);
	const plan = await env.DB.prepare(`SELECT name FROM plans WHERE id = ?1`).bind(id).first<{ name: string }>();
	if (!plan) throw httpError(404, 'bad_request', 'No such package');
	if (id === 'free' && input.models.length) throw httpError(400, 'bad_request', 'Free has no managed AI: learners use their own key');

	// Check every model against its provider's own list (cached for an hour), and take its name and price from there.
	const lists = new Map<number, Map<string, ReturnType<typeof toAdminModel>>>();
	for (const pid of new Set(input.models.map((m) => m.providerId))) {
		const r = await providerRow(env, pid);
		if (!r) throw httpError(400, 'bad_request', 'One of the providers no longer exists');
		if (!r.enabled) throw httpError(400, 'bad_request', `${r.label} is turned off`);
		const { list } = await modelsOf(env, r).catch((e) => {
			throw httpError(400, 'bad_request', (e as Error).message);
		});
		lists.set(pid, new Map(list.map((m) => [m.id, toAdminModel(pid, m)])));
	}
	const now = Date.now();
	const rows = input.models.map((m, i) => {
		const info = lists.get(m.providerId)!.get(m.model);
		if (!info) throw httpError(400, 'bad_request', `The provider doesn’t list ${m.model} any more`);
		return { ...m, label: info.label, inputPerM: info.inputPerM, outputPerM: info.outputPerM, position: i };
	});

	const before = await env.DB.prepare(`SELECT provider_id AS providerId, model FROM plan_models WHERE plan_id = ?1`)
		.bind(id)
		.all<{ providerId: number; model: string }>();
	const key = (m: { providerId: number; model: string }) => `${m.providerId}/${m.model}`;
	const was = new Set(before.results.map(key));
	const now_ = new Set(rows.map(key));
	await audited(
		env,
		ctx,
		'package.models',
		null,
		{
			plan: id,
			added: rows.filter((m) => !was.has(key(m))).map(key),
			removed: before.results.filter((m) => !now_.has(key(m))).map(key),
			features: Object.fromEntries(rows.flatMap((m) => m.features.map((f) => [f, key(m)])))
		},
		[
			env.DB.prepare(`DELETE FROM plan_models WHERE plan_id = ?1`).bind(id),
			...rows.map((m) =>
				env.DB.prepare(
					`INSERT INTO plan_models (plan_id, provider_id, model, label, features, input_per_m, output_per_m, position, added_at)
					 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
				).bind(id, m.providerId, m.model, m.label, m.features.join(','), m.inputPerM, m.outputPerM, m.position, now)
			)
		]
	);
	return json(await packages(env));
}

export async function handlePackages(req: Request, env: Env, url: URL, ctx: AdminContext): Promise<Response | null> {
	const p = url.pathname;
	const m = req.method;
	if (p === '/api/admin/packages' && m === 'GET') return json(await packages(env));
	if (p === '/api/admin/packages' && m === 'POST') return createPlan(req, env, ctx);
	const plan = /^\/api\/admin\/packages\/([a-z0-9-]{1,32})(\/models)?$/.exec(p);
	if (plan && !plan[2] && m === 'PUT') return updatePlan(req, env, ctx, plan[1]);
	if (plan && !plan[2] && m === 'DELETE') return deletePlan(env, ctx, plan[1]);
	if (plan && plan[2] && m === 'PUT') return setModels(req, env, ctx, plan[1]);
	const g = /^\/api\/admin\/accounts\/(\d{1,12})\/grants(?:\/(\d{1,12}))?$/.exec(p);
	if (g && !g[2] && m === 'POST') return grant(req, env, ctx, Number(g[1]));
	if (g && g[2] && m === 'DELETE') return endGrant(env, ctx, Number(g[1]), Number(g[2]));
	return null;
}

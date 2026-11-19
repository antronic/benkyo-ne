/** Shared contract for the fleet console API (/api/admin/*). Dependency-free. */

export interface AdminOverview {
	/** server time the numbers were taken */
	at: number;
	accounts: { total: number; active7d: number; new7d: number; new24h: number; disabled: number };
	/** AI spend this calendar month (UTC), finished calls only */
	ai: { monthUsd: number; monthCalls: number; failed24h: number };
	/** invite: closed in the console, invite codes still work; closed: nobody (Worker var) */
	signupMode: 'open' | 'invite' | 'closed';
	/** devices still syncing with a sync key */
	syncDevices: number;
}

export interface AdminAccountRow {
	id: number;
	name: string;
	createdAt: number;
	lastSeenAt: number | null;
	isAdmin: boolean;
	disabled: boolean;
	capUsd: number;
	passkeys: number;
	appleLinked: boolean;
	/** AI spend this calendar month (UTC), finished calls */
	monthUsd: number;
	/** agreed to the current beta terms and hasn't withdrawn */
	consented: boolean;
	/** package id right now (worker/plans.ts) */
	plan: AdminPlanId;
}

export interface AdminAccountList {
	accounts: AdminAccountRow[];
	/** pass back as `offset` for the next page; null at the end */
	next: number | null;
}

export interface AdminAccountDetail extends AdminAccountRow {
	passkeyList: { id: string; name: string | null; deviceType: string | null; createdAt: number; lastUsedAt: number | null }[];
	sessions: { kind: string; createdAt: number; expiresAt: number }[];
	recoveryCode: 'unused' | 'used' | 'none';
	spendByModel: { feature: string; provider: string; model: string; calls: number; usd: number }[];
	recentCalls: { at: number; feature: string; model: string; status: string; usd: number }[];
	consent: { version: number; acceptedAt: number; withdrawnAt: number | null } | null;
	/** package grants, newest first */
	grants: AdminGrant[];
}

/** PATCH /api/admin/accounts/:id */
export interface AdminAccountPatch {
	disabled?: boolean;
	capUsd?: number;
}

/** Status 428 + this code: confirm with a passkey, then retry. */
export const STEPUP_REQUIRED = 'stepup_required';

export interface AdminInvite {
	code: string;
	label: string | null;
	maxUses: number;
	uses: number;
	expiresAt: number | null;
	createdAt: number;
	revokedAt: number | null;
}

export interface AdminSettings {
	signup: {
		/** what the console set */
		mode: 'open' | 'closed';
		/** SIGNUP_MODE=closed on the Worker: nobody can sign up, invites included */
		hardClosed: boolean;
	};
	session: {
		/** the console setting in days, or null for the default */
		days: number | null;
		/** what applies now (setting, else Worker var, else default) */
		effectiveDays: number;
		defaultDays: number;
	};
	invites: AdminInvite[];
	/** new accounts per UTC day, oldest first, last 30 days including today */
	signupsByDay: { day: string; count: number }[];
}

/** POST /api/admin/invites */
export interface AdminInviteInput {
	/** a name such as VIP (for /invite/vip links); left out: a random BK-XXXX-XXXX */
	code?: string;
	label?: string;
	maxUses?: number;
	expiresInDays?: number | null;
}

/** GET /api/admin/usage?days=7|30|90. Money is USD, finished calls only. */
export interface AdminUsage {
	days: number;
	totals: { usd: number; calls: number; failed: number };
	/** per UTC day, oldest first, zero-filled */
	byDay: { day: string; usd: number; calls: number; failed: number }[];
	byFeature: { feature: string; calls: number; usd: number }[];
	byModel: { provider: string; model: string; calls: number; usd: number; inputTokens: number; outputTokens: number }[];
	topAccounts: { id: number; name: string; calls: number; usd: number }[];
	/** finished calls by whose key paid: the learner's own ('own') or a package's managed AI ('package') */
	bySource: { source: 'own' | 'package'; calls: number; usd: number }[];
	/** managed AI per package: spend on the operator's keys, and how many accounts used it */
	byPackage: { planId: string; name: string; calls: number; usd: number; accounts: number; allowanceUsd: number }[];
	/** the latest failed calls in the window */
	failures: { at: number; feature: string; model: string; accountId: number | null; name: string | null }[];
}

/** GET /api/admin/system */
export interface AdminSystem {
	at: number;
	/** the deployed Worker version (Cloudflare version metadata); null in local dev */
	worker: { id: string; tag: string | null; deployedAt: number | null } | null;
	migrations: {
		/** latest migration recorded in d1_migrations, null if none */
		applied: string | null;
		appliedAt: number | null;
		/** latest migration this Worker was built with */
		expected: string;
		upToDate: boolean;
	};
	checks: { name: string; ok: boolean; detail: string }[];
	ai: {
		/** accounts that saved at least one provider key */
		accountsWithKey: number;
		/** which model each feature uses, and on how many accounts */
		featureModels: { feature: string; model: string; accounts: number }[];
		/** ledger rows still 'reserved' after 10 minutes (a call that never finished) */
		stuckReserved: number;
	};
	tables: { name: string; rows: number }[];
}

export interface AdminAuditEntry {
	id: number;
	at: number;
	actorId: number;
	actorName: string | null;
	actorEmail: string | null;
	action: string;
	targetId: number | null;
	targetName: string | null;
	detail: unknown;
}

/** GET /api/admin/audit?offset=&action= */
export interface AdminAuditList {
	entries: AdminAuditEntry[];
	next: number | null;
	/** every action name in the log, for the filter */
	actions: string[];
}

/** 'free', 'plus', 'pro', or the id of a package made in the console */
export type AdminPlanId = string;

export interface AdminPlan {
	id: AdminPlanId;
	name: string;
	priceMonthUsd: number;
	priceYearUsd: number;
	/** managed AI model cost included per month */
	aiAllowanceUsd: number;
	blurb: string;
	/** offered to new people */
	available: boolean;
	/** accounts on it right now (Free: everyone without a live grant) */
	accounts: number;
	updatedAt: number;
	/** Free, Plus and Pro can't be deleted */
	builtin: boolean;
	/** the managed AI models it includes, in order */
	models: AdminPlanModel[];
}

export type AdminFeature = 'fill' | 'propose' | 'vision' | 'translate';

/** A model included in a package. */
export interface AdminPlanModel {
	providerId: number;
	/** provider label, null if the provider was removed */
	providerLabel: string | null;
	model: string;
	label: string;
	/** app features this model serves in the package (each feature at most once per package) */
	features: AdminFeature[];
	/** USD per million tokens when the model was added; null when unknown */
	inputPerM: number | null;
	outputPerM: number | null;
}

/** PUT /api/admin/packages/:id/models: the whole list, in order. */
export interface AdminPlanModelsInput {
	models: { providerId: number; model: string; features: AdminFeature[] }[];
}

/** POST /api/admin/packages */
export interface AdminPlanCreate {
	name: string;
	blurb?: string;
	priceMonthUsd: number;
	priceYearUsd: number;
	aiAllowanceUsd: number;
}

// ------------------------------------------------------------ AI providers ----

export type AdminProviderKind = 'anthropic' | 'openai-compatible';

/** Known providers; `custom` is any OpenAI-compatible server. */
export interface AdminProviderPreset {
	id: string;
	name: string;
	kind: AdminProviderKind;
	/** fixed for known providers, null for anthropic and custom */
	baseUrl: string | null;
	/** where to make a key */
	keysUrl: string | null;
}

/** A platform AI provider (the operator's own key, for managed AI). */
export interface AdminProvider {
	id: number;
	kind: AdminProviderKind;
	preset: string;
	label: string;
	baseUrl: string | null;
	last4: string;
	enabled: boolean;
	modelCount: number | null;
	checkedAt: number | null;
	checkError: string | null;
	createdAt: number;
	updatedAt: number;
	/** names of packages that include one of its models */
	usedBy: string[];
}

/** GET /api/admin/ai/providers */
export interface AdminProviders {
	providers: AdminProvider[];
	presets: AdminProviderPreset[];
	/** false when AI_MASTER_KEY is missing, so no key can be saved */
	canSaveKeys: boolean;
}

/** POST /api/admin/ai/providers. The key is checked by listing models before it's saved. */
export interface AdminProviderInput {
	preset: string;
	label?: string;
	/** custom only */
	baseUrl?: string;
	apiKey: string;
}

/** PATCH /api/admin/ai/providers/:id */
export interface AdminProviderPatch {
	label?: string;
	enabled?: boolean;
	/** replaces the key after a successful model list */
	apiKey?: string;
}

/** A model as the provider's API lists it. */
export interface AdminModel {
	providerId: number;
	id: string;
	label: string;
	contextTokens: number | null;
	maxOutput: number | null;
	vision: boolean | null;
	structured: boolean | null;
	/** USD per million tokens (provider list or built-in table), null when unknown */
	inputPerM: number | null;
	outputPerM: number | null;
	priceSource: 'provider' | 'builtin' | null;
	/** names of packages that include it */
	inPackages: string[];
}

/** GET /api/admin/ai/providers/:id/models and GET /api/admin/ai/models */
export interface AdminModels {
	models: AdminModel[];
	/** when the list was fetched from the provider (it's cached for an hour) */
	fetchedAt: number;
	/** the providers asked, for labels */
	providers: { id: number; label: string }[];
	/** providers whose list couldn't be fetched */
	errors: { providerId: number; label: string; message: string }[];
}

export interface AdminGrant {
	id: number;
	accountId: number;
	accountName: string | null;
	plan: AdminPlanId;
	kind: 'comp' | 'trial';
	note: string | null;
	startsAt: number;
	endsAt: number | null;
	createdAt: number;
	endedAt: number | null;
	/** started, not past endsAt, not ended early */
	live: boolean;
}

/** GET /api/admin/packages */
export interface AdminPackages {
	plans: AdminPlan[];
	/** live grants, soonest to end first */
	grants: AdminGrant[];
}

/** PUT /api/admin/packages/:id (any subset) */
export interface AdminPlanPatch {
	name?: string;
	priceMonthUsd?: number;
	priceYearUsd?: number;
	aiAllowanceUsd?: number;
	blurb?: string;
	available?: boolean;
}

/** POST /api/admin/accounts/:id/grants. Replaces the account's live grant. */
export interface AdminGrantInput {
	/** any package except Free */
	plan: AdminPlanId;
	kind: 'comp' | 'trial';
	/** null: until ended */
	days: number | null;
	note?: string;
}

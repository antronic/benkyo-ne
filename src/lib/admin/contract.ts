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

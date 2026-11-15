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

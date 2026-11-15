/** Shared contract for the fleet console API (/api/admin/*). Dependency-free. */

export interface AdminOverview {
	/** server time the numbers were taken */
	at: number;
	accounts: { total: number; active7d: number; new7d: number; new24h: number; disabled: number };
	/** AI spend this calendar month (UTC), finished calls only */
	ai: { monthUsd: number; monthCalls: number; failed24h: number };
	signupMode: 'open' | 'closed';
	/** devices still syncing with a sync key */
	syncDevices: number;
}

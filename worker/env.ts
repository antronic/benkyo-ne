export interface Env {
	ASSETS?: Fetcher;
	DB: D1Database;
	CONTENT: KVNamespace;
	/** "open" (default) lets anyone create an account with a passkey; "closed" stops new sign-ups. */
	SIGNUP_MODE?: string;
	/** base64 of 32 random bytes; encrypts provider API keys (wrangler secret). */
	AI_MASTER_KEY?: string;
	/** Cloudflare Access team domain for the fleet console, e.g. "benkyo.cloudflareaccess.com". */
	ACCESS_TEAM_DOMAIN?: string;
	/** Application Audience (AUD) tag of the Access application that guards /admin and /api/admin. */
	ACCESS_AUD?: string;
	/** Optional comma-separated emails allowed into the console, checked on top of the Access policy. */
	ADMIN_EMAILS?: string;
	/** DEV ONLY ("1"): treat localhost requests as signed in. Never set in wrangler configs. */
	DEV_AUTH_BYPASS?: string;
}

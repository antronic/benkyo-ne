export interface Env {
	ASSETS?: Fetcher;
	DB: D1Database;
	CONTENT: KVNamespace;
	/** "open" (default) lets anyone create an account with a passkey; "closed" stops new sign-ups. */
	SIGNUP_MODE?: string;
	/** base64 of 32 random bytes; encrypts provider API keys (wrangler secret). */
	AI_MASTER_KEY?: string;
	/** DEV ONLY ("1"): treat localhost requests as signed in. Never set in wrangler configs. */
	DEV_AUTH_BYPASS?: string;
	/**
	 * How long a sign-in lasts, in days, renewed while the app is used (worker/auth/session.ts).
	 * Default 400 (the longest a browser keeps a cookie), so sign-ins don't expire in practice.
	 * A `session_ttl_days` row in the ai_settings table overrides this without a deploy.
	 */
	SESSION_TTL_DAYS?: string;
}

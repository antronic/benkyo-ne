export interface Env {
	ASSETS?: Fetcher;
	DB: D1Database;
	CONTENT: KVNamespace;
	/** One-time token required for the first passkey registration (wrangler secret). */
	SETUP_TOKEN?: string;
	/** base64 of 32 random bytes; encrypts provider API keys (wrangler secret). */
	AI_MASTER_KEY?: string;
	/** DEV ONLY ("1"): treat localhost requests as signed in. Never set in wrangler configs. */
	DEV_AUTH_BYPASS?: string;
}

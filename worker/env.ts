export interface Env {
	ASSETS?: Fetcher;
	DB: D1Database;
	CONTENT: KVNamespace;
	/** "open" (default) lets anyone create an account (passkey or Apple); "closed" stops new sign-ups. */
	SIGNUP_MODE?: string;
	/**
	 * Sign in with Apple: the Services ID (e.g. "me.jirachai.benkyo.web"). Unset hides the
	 * Apple button. Not a secret: it is sent to Apple in the browser anyway.
	 */
	APPLE_CLIENT_ID?: string;
	/** base64 of 32 random bytes; encrypts provider API keys (wrangler secret). */
	AI_MASTER_KEY?: string;
	/** DEV ONLY ("1"): treat localhost requests as signed in. Never set in wrangler configs. */
	DEV_AUTH_BYPASS?: string;
}

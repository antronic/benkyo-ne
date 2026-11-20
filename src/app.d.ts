// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Error {
			/**
			 * Id of the caught error ("E-7F3K2Q", src/lib/debug/errors.svelte.ts), shown on the
			 * error page; Fleet → Errors finds it. Not set for a page that doesn't exist (404).
			 */
			errorId?: string;
		}
	}
}

export {};

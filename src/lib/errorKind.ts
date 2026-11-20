import type { ErrorKind } from '#lib/ui/index.ts';

/**
 * Which error page to show (src/routes/+error.svelte). Offline wins over the
 * status, because a failed fetch with no network is not a server problem; a
 * missing app file after a deploy means the app updated under the learner.
 */
export function errorKind(status: number, message: string | undefined, online: boolean, fleet: boolean): ErrorKind {
	if (!online) return 'offline';
	if (/dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch dynamically/i.test(message ?? '')) return 'update';
	if (status === 404) return 'not-found';
	if (status === 401) return 'session';
	if (status === 403) return fleet ? 'access' : 'session';
	if (status >= 500 && status !== 500) return 'server';
	// SvelteKit reports a thrown client error as 500 "Internal Error"; a real
	// server answer carries its own message.
	if (status === 500) return message && message !== 'Internal Error' ? 'server' : 'crash';
	return 'crash';
}

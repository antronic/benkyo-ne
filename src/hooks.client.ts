/**
 * SvelteKit client hooks (docs/DEBUGGING.md): start error capture before the
 * first screen, and give every error SvelteKit catches (a load or navigation
 * that throws) an id the error page can show (`page.error.errorId`).
 */
import type { ClientInit, HandleClientError } from '@sveltejs/kit/hooks';
import { installDebug, reportError } from '#lib/debug/errors.svelte.ts';

export const init: ClientInit = () => {
	installDebug();
};

export const handleError: HandleClientError = (caught) => {
	const route = caught.event.url?.pathname ?? null;
	const extra = { routeId: caught.event.route?.id ?? null, kind: caught.kind };
	if (caught.kind === 'framework') {
		// a link to a page that doesn't exist is not a crash: no report
		if (caught.error.status === 404) return {};
		return { errorId: reportError(new Error(caught.error.message), { name: 'kit', status: caught.error.status, route, extra }) };
	}
	if (caught.kind === 'app') {
		const e = caught.error;
		return { errorId: e.errorId ?? reportError(new Error(e.message), { name: 'kit', status: e.status, route, extra }) };
	}
	return { errorId: reportError(caught.error, { name: 'kit', status: 500, route, extra }) };
};

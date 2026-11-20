<!--
	Every route error, learner and Fleet: picks the ErrorState kind from the
	status and the network, and shows the error ID (set by handleError in
	src/hooks.client.ts) with the build number. See docs/DESIGN-SYSTEM.md.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { version } from '$app/env';
	import { ErrorState, type ErrorKind } from '#lib/ui/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { errorKind } from '#lib/errorKind.ts';
	import { errorDetails, sendErrorNote } from '#lib/debug/errors.svelte.ts';

	const fleet = $derived(page.url.pathname.startsWith('/admin'));
	let online = $state(typeof navigator === 'undefined' ? true : navigator.onLine);
	const err = $derived(page.error);
	const kind = $derived<ErrorKind>(errorKind(page.status, err?.message, online, fleet));
</script>

<svelte:window ononline={() => (online = true)} onoffline={() => (online = false)} />
<svelte:head><title>{t('error.tabTitle')} · Benkyo</title></svelte:head>

<div class="page">
	<ErrorState
		{kind}
		status={page.status}
		errorId={err?.errorId}
		build={version}
		message={err?.message}
		details={err?.errorId ? errorDetails(err.errorId) : undefined}
		sendNote={err?.errorId ? (n: string) => sendErrorNote(err.errorId!, n) : undefined}
		home={fleet ? { href: '/admin', label: t('error.goFleet') } : undefined}
	/>
</div>

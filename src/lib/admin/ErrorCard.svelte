<!--
	Fleet console error card: the kit's in-card ErrorState with the right way
	out for each kind of failure, and the server's own message as the body.
-->
<script lang="ts">
	import { ErrorState, type ErrorAction, type ErrorKind } from '#lib/ui/index.ts';
	import { version } from '$app/env';
	import type { AdminError, AdminErrorCode } from './client.ts';

	let { error, onretry }: { error: AdminError; onretry: () => unknown } = $props();

	const TITLES: Record<AdminErrorCode, string> = {
		access: 'Cloudflare Access sign-in needed',
		closed: 'The console is closed',
		signin: 'Sign in first',
		forbidden: 'No access',
		offline: 'You’re offline',
		stepup: 'Passkey confirmation needed',
		bad: 'That didn’t work',
		server: 'Something went wrong on our side'
	};
	const KINDS: Record<AdminErrorCode, ErrorKind> = {
		access: 'access',
		closed: 'server',
		signin: 'session',
		forbidden: 'access',
		offline: 'offline',
		stepup: 'session',
		bad: 'server',
		server: 'server'
	};
	const primary = $derived<ErrorAction>(
		error.code === 'access'
			? { label: 'Sign in again', onclick: () => location.reload() }
			: error.code === 'signin'
				? { label: 'Go to Settings', href: '/settings#account' }
				: { label: 'Try again', onclick: onretry }
	);
	// the error id from the frontend log, when it has one
	const errorId = $derived((error as AdminError & { errorId?: string }).errorId);
</script>

<ErrorState
	kind={KINDS[error.code]}
	layout="inline"
	title={TITLES[error.code]}
	body={error.message}
	status={error.status || undefined}
	{errorId}
	build={version}
	message={`${error.code} ${error.status}: ${error.message}`}
	{primary}
/>

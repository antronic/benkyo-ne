<!-- Fleet console error card with the right way out for each kind of failure. -->
<script lang="ts">
	import type { AdminError } from './client.ts';

	let { error, onretry }: { error: AdminError; onretry: () => void } = $props();

	const TITLES = {
		access: 'Cloudflare Access sign-in needed',
		closed: 'The console is closed',
		signin: 'Sign in first',
		forbidden: 'No access',
		offline: 'You’re offline',
		stepup: 'Passkey confirmation needed',
		bad: 'That didn’t work',
		server: 'Something went wrong'
	} as const;
</script>

<div class="glass group" role="alert">
	<div class="item col">
		<b>{TITLES[error.code]}</b>
		<span class="caption">{error.message}</span>
		<span class="row" style:gap="8px" style:margin-top="4px">
			{#if error.code === 'access'}
				<button class="btn small" onclick={() => location.reload()}>Sign in again</button>
			{:else if error.code === 'signin'}
				<a class="btn small" href="/settings#account">Go to Settings</a>
			{:else}
				<button class="btn ghost small" onclick={onretry}>Try again</button>
			{/if}
		</span>
	</div>
</div>

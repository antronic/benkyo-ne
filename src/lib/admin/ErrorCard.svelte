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

<div class="glass error" role="alert">
	<b class="title">{TITLES[error.code]}</b>
	<p class="caption message">{error.message}</p>
	<div class="row actions" style:--gap="var(--space-2)">
		{#if error.code === 'access'}
			<button class="btn small" onclick={() => location.reload()}>Sign in again</button>
		{:else if error.code === 'signin'}
			<a class="btn small" href="/settings#account">Go to Settings</a>
		{:else}
			<button class="btn ghost small" onclick={onretry}>Try again</button>
		{/if}
	</div>
</div>

<style>
	.error {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-5) var(--space-6);
		border-radius: var(--radius-card);
	}
	.title {
		font-size: 1.0625rem;
	}
	.message {
		margin: 0;
	}
	.actions {
		margin-top: var(--space-2);
	}
</style>

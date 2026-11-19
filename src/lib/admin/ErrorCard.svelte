<!-- Fleet console error card with the right way out for each kind of failure. -->
<script lang="ts">
	import { Button, Card } from '#lib/ui/index.ts';
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

<Card padding="lg" role="alert">
	<div class="error">
		<b class="title">{TITLES[error.code]}</b>
		<p class="caption message">{error.message}</p>
		<div class="row actions" style:--gap="var(--space-2)">
			{#if error.code === 'access'}
				<Button size="sm" onclick={() => location.reload()}>Sign in again</Button>
			{:else if error.code === 'signin'}
				<Button size="sm" href="/settings#account">Go to Settings</Button>
			{:else}
				<Button size="sm" variant="ghost" onclick={onretry}>Try again</Button>
			{/if}
		</div>
	</div>
</Card>

<style>
	.error {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
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

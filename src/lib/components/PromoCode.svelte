<!--
	Promo code card in Settings, for a signed-in account: shows the package the
	account is on, and redeems a code made in the fleet console. Every state is
	visible: a skeleton while the package loads, an error with a retry, a busy
	Redeem button, and a notice for success or for why a code didn't work.
	`load` and `redeem` default to the real API; /design passes fakes.
-->
<script lang="ts">
	import { t, fmtDate, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { Badge, Button, Card, Notice, TextField } from '#lib/ui/index.ts';
	import Skeleton from '#lib/ui/Skeleton.svelte';
	import { haptic } from '#lib/ios/haptics.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { PromoRequestError, promoStatus, redeemPromo } from '#lib/promo/client.ts';
	import type { PromoRedeemed, PromoStatus } from '#lib/promo/contract.ts';

	let {
		load = promoStatus,
		redeem = redeemPromo,
		onredeemed
	}: {
		load?: () => Promise<PromoStatus>;
		redeem?: (code: string) => Promise<PromoRedeemed>;
		/** after a code works, with the new package (Settings updates the Today badge) */
		onredeemed?: (r: PromoRedeemed) => void;
	} = $props();

	let status = $state<PromoStatus | null>(null);
	let loadFailed = $state(false);
	let code = $state('');
	let busy = $state(false);
	let problem = $state<string | null>(null);
	let done = $state<PromoRedeemed | null>(null);

	async function refresh() {
		loadFailed = false;
		try {
			status = await load();
		} catch {
			loadFailed = true;
		}
	}
	$effect(() => void refresh());

	const ERR_KEYS = new Set([
		'invalid',
		'disabled',
		'expired',
		'used_up',
		'already_redeemed',
		'already_on_plan',
		'rate_limited',
		'offline'
	]);
	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!code.trim() || busy) return;
		busy = true;
		problem = null;
		done = null;
		try {
			const r = await redeem(code.trim());
			done = r;
			status = r;
			onredeemed?.(r);
			code = '';
			haptic('success');
			// a package can bring managed AI: Settings and the AI screens pick it up
			void ai.refresh();
		} catch (err) {
			const p = err instanceof PromoRequestError ? err.problem : 'other';
			problem = t(`promo.err.${ERR_KEYS.has(p) ? p : 'other'}` as MessageKey);
			haptic('error');
		} finally {
			busy = false;
		}
	}

	const day = (ms: number) => fmtDate(ms, { day: 'numeric', month: 'short', year: 'numeric' });
</script>

<Card padding="md">
<div class="promo">
	<div class="head">
		<span class="caption">{t('promo.current')}</span>
		{#if status}
			<span class="plan-line">
				<b class="plan">{status.planName}</b>
				{#if status.grant}<Badge tone={status.grant.kind === 'trial' ? 'info' : 'violet'}>{t(status.grant.kind === 'trial' ? 'promo.trial' : 'promo.comp')}</Badge>{/if}
			</span>
			<span class="caption">
				{#if status.grant}
					{status.grant.endsAt ? t('promo.until', { date: day(status.grant.endsAt) }) : t('promo.untilEnded')}{status.grant.promoCode
						? ` · ${t('promo.fromCode', { code: status.grant.promoCode })}`
						: ''}
				{:else}
					{t('promo.free')}
				{/if}
			</span>
		{:else if loadFailed}
			<Notice tone="warning">
				{t('promo.loadFailed')}
				{#snippet action()}<Button variant="ghost" size="sm" onclick={refresh}>{t('promo.retry')}</Button>{/snippet}
			</Notice>
		{:else}
			<Skeleton variant="line" count={2} label={t('promo.loading')} />
		{/if}
	</div>

	<form class="redeem" onsubmit={submit}>
		<TextField
			bind:value={code}
			label={t('promo.label')}
			placeholder={t('promo.placeholder')}
			hint={t('promo.hint')}
			maxlength={40}
			autocomplete="off"
			autocapitalize="characters"
			spellcheck={false}
			oninput={() => (problem = null)}
		/>
		<Button type="submit" {busy} disabled={!code.trim()}>{t('promo.redeem')}</Button>
	</form>

	{#if problem}
		<Notice tone="danger" title={t('promo.errTitle')}>{problem}</Notice>
	{:else if done}
		<Notice tone="success" title={t('promo.redeemed', { plan: done.planName })}>
			{done.grant?.endsAt
				? t('promo.redeemedBody', { code: done.code, plan: done.planName, date: day(done.grant.endsAt) })
				: t('promo.redeemedBodyOpen', { code: done.code, plan: done.planName })}
		</Notice>
	{/if}
</div>
</Card>

<style>
	.promo {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.plan-line {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.plan {
		font-size: var(--text-title-3);
	}
	.redeem {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
	}
	.redeem :global(.field) {
		flex: 1;
		min-width: 0;
	}
	/* line the button up with the input, not the label above it */
	.redeem :global(.btn) {
		margin-top: var(--space-6);
	}
</style>

<!--
	Sign-up link: /invite/VIP?coupon=SONGKRAN27. Keeps the invite for the
	sign-up screen's invite field and the coupon for after sign-up
	(src/lib/promo/link.ts). A named invite with a card (worker/invite.ts) plays
	the VIP card first; Accept then opens sign-up. A static path: the SPA
	fallback serves it, and the card comes from /api/auth/invite/:code.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { InviteCard, Spinner } from '#lib/ui/index.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { words } from '#lib/state/words.svelte.ts';
	import { cleanInvite, pendingPromo, savePendingInvite, savePendingPromo, takeRef } from '#lib/promo/link.ts';
	import { fetchInviteCard } from '#lib/invite/client.ts';
	import type { InviteCardResponse } from '#lib/invite/contract.ts';

	let card = $state<InviteCardResponse | null>(null);

	const perk = $derived.by(() => {
		const p = card?.perk;
		if (!p) return null;
		const kind = t(p.kind === 'trial' ? 'invite.perkTrial' : 'invite.perkComp', { plan: p.planName });
		return p.days === null ? kind : t('invite.perkDays', { what: kind, days: p.days });
	});

	async function go(signUp: boolean) {
		card = null;
		await goto('/', { replaceState: true });
		if (!ai.checked) await ai.refresh().catch(() => {});
		if (signUp && !ai.signedIn && !ui.showIntro) ui.showWelcome = true;
	}

	/** The app is loaded and the splash (Splash.svelte: at least 900 ms, then a 520 ms fade) has gone, so the card is seen. */
	async function splashGone() {
		const t0 = performance.now();
		while (!(progress.ready && words.ready) && performance.now() - t0 < 10_000) await new Promise((r) => setTimeout(r, 100));
		// performance.now() counts from page load, which is about when the splash appeared
		await new Promise((r) => setTimeout(r, Math.max(300, 1500 - performance.now())));
	}

	onMount(() => {
		const invite = cleanInvite(page.params.code);
		if (invite) savePendingInvite(invite);
		const ref = takeRef(new URL(location.href));
		if (ref?.code) savePendingPromo(ref.code);
		// the layout may have taken ?coupon off the address already (and saved it)
		const coupon = ref?.code ?? pendingPromo()?.code ?? null;
		void (async () => {
			const [c] = await Promise.all([invite ? fetchInviteCard(invite, coupon) : null, splashGone()]);
			// a VIP's own promo code (Fleet → Invitations) is used after sign-up, like ?coupon=
			if (c?.coupon && !ref?.code) savePendingPromo(c.coupon);
			if (c) card = c;
			else await go(true);
		})();
	});
</script>

<main class="page invite">
	{#if !card}<Spinner label={t('invite.opening')} showLabel />{/if}
</main>

{#if card}
	<InviteCard
		open
		code={card.code}
		from={card.card.from}
		note={card.card.note}
		ink={card.card.ink}
		{perk}
		eyebrow={t('invite.eyebrow')}
		title={t('invite.title')}
		acceptLabel={t('invite.accept')}
		laterLabel={t('invite.later')}
		inkLabel={t('invite.inkLabel')}
		onaccept={() => go(true)}
		onclose={() => go(false)}
	/>
{/if}

<style>
	.invite {
		display: grid;
		place-items: center;
		min-height: 60vh;
	}
</style>

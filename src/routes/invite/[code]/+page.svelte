<!--
	Sign-up link: /invite/BK-7KQ2-MX9D?coupon=SONGKRAN27. Keeps the invite for the
	sign-up screen's invite field and the coupon for after sign-up
	(src/lib/promo/link.ts), then opens Today with the sign-up sheet. A static
	path: the SPA fallback serves it, no Worker code runs.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { Spinner } from '#lib/ui/index.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { cleanInvite, savePendingInvite, savePendingPromo, takeRef } from '#lib/promo/link.ts';

	onMount(() => {
		const invite = cleanInvite(page.params.code);
		if (invite) savePendingInvite(invite);
		const ref = takeRef(new URL(location.href));
		if (ref?.code) savePendingPromo(ref.code);
		void (async () => {
			await goto('/', { replaceState: true });
			if (!ai.checked) await ai.refresh().catch(() => {});
			if (!ai.signedIn && !ui.showIntro) ui.showWelcome = true;
		})();
	});
</script>

<main class="page invite">
	<Spinner label={t('invite.opening')} />
</main>

<style>
	.invite {
		display: grid;
		place-items: center;
		min-height: 60vh;
	}
</style>

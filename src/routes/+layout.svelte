<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import Skeleton from '#lib/components/Skeleton.svelte';
	import '../app.css';
	import { onMount, untrack } from 'svelte';
	import { goto, onNavigate } from '$app/navigation';
	import { updater } from '#lib/pwa/update.svelte.ts';
	import UpdateBanner from '#lib/components/UpdateBanner.svelte';
	import InstallGuide from '#lib/components/InstallGuide.svelte';
	import '#lib/pwa/install.svelte.ts'; // listens for the browser's install offer from the start
	import Splash from '#lib/components/Splash.svelte';
	import Intro from '#lib/components/Intro.svelte';
	import Welcome from '#lib/components/Welcome.svelte';
	import BetaConsent from '#lib/components/BetaConsent.svelte';
	import { telemetry } from '#lib/beta/telemetry.svelte.ts';
	import { get as idbGet, put as idbPut } from '#lib/db/idb.ts';
	import { page } from '$app/state';
	import Backdrop from '#lib/components/Backdrop.svelte';
	import TabBar from '#lib/components/TabBar.svelte';
	import Overlays from '#lib/components/Overlays.svelte';
	import { progress } from '#lib/state/progress.svelte.ts';
	import Onboarding from '#lib/components/Onboarding.svelte';
	import { profile } from '#lib/onboarding/profile.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { startAutoSync, sync } from '#lib/sync.ts';
	import { edgeSwipeBack, trackKeyboard } from '#lib/ios/gestures.ts';
	import { insets } from '#lib/ios/device.svelte.ts';
	import { words } from '#lib/state/words.svelte.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { processOutbox } from '#lib/words/maker.ts';
	import { takeAppleResult } from '#lib/ai/client.ts';
	import { toast } from '#lib/ios/overlay.svelte.ts';
	import KuriIntro from '#lib/companion/KuriIntro.svelte';
	import KuriReaction from '#lib/companion/KuriReaction.svelte';

	let { children } = $props();

	// Progress follows the account: sync as soon as you're signed in, however you signed in.
	$effect(() => {
		if (ai.signedIn && ai.account?.id) untrack(() => void sync());
	});

	// Immersive screens hide the navigation and can be swiped back from.
	const immersive = $derived(/^\/(learn\/.+|review|words\/.+|ai\/.+|admin)/.test(page.url.pathname));
	const parent = $derived(
		page.url.pathname.startsWith('/learn/') ? '/learn' : page.url.pathname.startsWith('/words/') ? '/words' : page.url.pathname.startsWith('/ai/') ? '/ai' : page.url.pathname.startsWith('/admin/accounts/') ? '/admin/accounts' : page.url.pathname.startsWith('/admin/') ? '/admin' : page.url.pathname.startsWith('/admin') ? '/settings' : '/'
	);

	// Beta usage data (only once the account has agreed): screens and a daily progress summary.
	$effect(() => {
		if (telemetry.enabled) telemetry.screen(page.url.pathname);
	});
	$effect(() => {
		if (telemetry.enabled && progress.ready) void progress.snapshot();
	});

	async function back() {
		if (ui.backGuard && !(await ui.backGuard())) return false;
		ui.backGuard = null;
		await goto(parent);
	}

	onMount(() => {
		const apple = takeAppleResult();
		progress
			.load()
			.then(() => words.load())
			.then(async () => {
				if (apple) void idbPut('meta', true, 'introSeen'); // you got as far as signing in
				else if (!(await idbGet<boolean>('meta', 'introSeen'))) ui.showIntro = true;
				// people who onboarded before Kuri existed meet Kuri once, on Today
				if (!ui.showIntro && !(await idbGet<boolean>('meta', 'kuriIntroSeen'))) kuriPending = true;
			})
			.then(startAutoSync);
		ai.watch();
		if (apple) void finishApple(apple);
		const onOnline = () => setTimeout(() => void processOutbox(), 1500);
		addEventListener('online', onOnline);
		const vis = () => document.documentElement.classList.toggle('hidden', document.hidden);
		document.addEventListener('visibilitychange', vis);
		const stopKb = trackKeyboard();
		updater.start();
		insets.watch();
		return () => {
			document.removeEventListener('visibilitychange', vis);
			stopKb();
		};
	});

	/** Back from Sign in with Apple (worker/auth/apple.ts): say how it went. */
	async function finishApple(r: NonNullable<ReturnType<typeof takeAppleResult>>) {
		await ai.refresh();
		if (!r.ok) {
			if (r.message) toast(r.message, '⚠️', 3600);
			// back to the beta screen to try again or use a passkey
			if (!ai.signedIn) ui.showWelcome = true;
			return;
		}
		if (r.result === 'linked') toast(t('apple.connected'), '✓');
		else if (r.result === 'created') toast(t('welcome.toBeta', { name: ai.account?.name ?? '' }).trim(), '🎉', 2800);
		else toast(t('welcome.back', { name: ai.account?.name ?? '' }).trim(), '👋');
	}

	// Page morphs with the View Transitions API (falls back to instant swap).
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	let firstRun = false;
	/** Kuri's first meeting is waiting for the next calm moment on Today */
	let kuriPending = $state(false);
	$effect(() => {
		if (!kuriPending || !progress.settings.kuri || page.url.pathname !== '/') return;
		if (ui.showIntro || ui.showOnboarding || ui.showWelcome || ai.needsConsent) return;
		kuriPending = false;
		ui.showKuriIntro = true;
	});
	/** the beta sign-up / sign-in (passkey only), unless already signed in */
	async function offerWelcome() {
		if (!ai.checked) await ai.refresh();
		if (!ai.signedIn) ui.showWelcome = true;
	}
</script>

<Backdrop hue={ui.hue} />

<div class="app" use:edgeSwipeBack={{ enabled: immersive, onback: back }}>
	{#if progress.ready && words.ready}
		{@render children()}
	{:else}
		<main class="page stack boot" style:--gap="16px" aria-busy="true">
			<div class="boot-title"></div>
			<Skeleton variant="card" count={1} label={t('common.loadingProgress')} />
			<Skeleton variant="row" count={3} />
		</main>
	{/if}
</div>

{#if !immersive}
	<TabBar />
{/if}

{#if ui.showIntro}
	<Intro
		ondone={async () => {
			ui.showIntro = false;
			void idbPut('meta', true, 'introSeen');
			// first run: a few questions to set up the plan, then sign-up
			if (!(await profile.load())) (firstRun = true), (ui.showOnboarding = true);
			else await offerWelcome();
		}}
	/>
{/if}
{#if ui.showOnboarding}
	<Onboarding
		ondone={async (start) => {
			ui.showOnboarding = false;
			if (!firstRun) return;
			firstRun = false;
			if (start) void goto(start);
			await offerWelcome();
			// after the questions (and sign-up, if it's showing), Kuri says hello on Today
			kuriPending = true;
		}}
	/>
{/if}
{#if ui.showWelcome}
	<Welcome ondone={() => (ui.showWelcome = false)} />
{/if}
{#if ui.showKuriIntro}
	<KuriIntro
		ondone={() => {
			ui.showKuriIntro = false;
			void idbPut('meta', true, 'kuriIntroSeen');
		}}
	/>
{/if}
{#if progress.settings.kuri && progress.settings.kuriReact && progress.ready}
	<KuriReaction />
{/if}
{#if ai.needsConsent && !ui.showIntro && !ui.showWelcome}
	<!-- required after sign-in until the account agrees to the current beta terms -->
	<BetaConsent />
{/if}
<Splash ready={progress.ready && words.ready} />
<UpdateBanner />
<InstallGuide />
<Overlays />

<style>
	.app {
		min-height: 100dvh;
	}
	.boot-title {
		width: 46%;
		height: 34px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--ink) 9%, transparent);
	}
</style>

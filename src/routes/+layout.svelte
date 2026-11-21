<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { Button, ScrollMore, Skeleton } from '#lib/ui/index.ts';
	import '../app.css';
	import { onMount, untrack } from 'svelte';
	import { afterNavigate, goto, onNavigate } from '$app/navigation';
	import { isImmersive, returnTarget } from '#lib/nav.ts';
	import { leave } from '#lib/state/leave.ts';
	import { updater } from '#lib/pwa/update.svelte.ts';
	import UpdateBanner from '#lib/components/UpdateBanner.svelte';
	import InstallGuide from '#lib/components/InstallGuide.svelte';
	import OpenInSafari from '#lib/components/OpenInSafari.svelte';
	import '#lib/pwa/install.svelte.ts'; // listens for the browser's install offer from the start
	import Splash from '#lib/components/Splash.svelte';
	import Intro from '#lib/components/Intro.svelte';
	import Welcome from '#lib/components/Welcome.svelte';
	import Handoff from '#lib/components/Handoff.svelte';
	import BetaConsent from '#lib/components/BetaConsent.svelte';
	import AvatarSetup from '#lib/components/AvatarSetup.svelte';
	import { avatar } from '#lib/state/avatar.svelte.ts';
	import { telemetry } from '#lib/beta/telemetry.svelte.ts';
	import { reportError, setRoute } from '#lib/debug/errors.svelte.ts';
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
	import { notes } from '#lib/state/notes.svelte.ts';
	import { words } from '#lib/state/words.svelte.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { processOutbox } from '#lib/words/maker.ts';
	import { takeAppleResult } from '#lib/ai/client.ts';
	import { busyToast, clearToast, toast } from '#lib/ios/overlay.svelte.ts';
	import KuriIntro from '#lib/companion/KuriIntro.svelte';
	import KuriReaction from '#lib/companion/KuriReaction.svelte';
	import { fleetParent } from '#lib/admin/nav.ts';
	import { plan } from '#lib/state/plan.svelte.ts';
	import { PromoRequestError, redeemPromo } from '#lib/promo/client.ts';
	import { clearPendingInvite, clearPendingPromo, markPendingTold, pendingInvite, pendingPromo, savePendingPromo, takeRef } from '#lib/promo/link.ts';
	import type { MessageKey } from '#lib/i18n/index.svelte.ts';
	import { attempt, bootDone, reloadOnStaleChunk, safeMode, withTimeout } from '#lib/boot.ts';

	let { children } = $props();

	// Progress follows the account: sync as soon as you're signed in, however you signed in.
	$effect(() => {
		if (ai.signedIn && ai.account?.id) untrack(() => void sync());
	});

	// A promo link (?ref=CODE, src/lib/promo/link.ts): kept on this device until someone is
	// signed in and past the welcome and consent screens, then redeemed once.
	let redeeming = false;
	const promoReady = () =>
		progress.ready && words.ready && ai.checked && !ui.showIntro && !ui.showOnboarding && !ui.onboardingNext && !ui.showWelcome && !ui.handoff && !ai.needsConsent;
	$effect(() => {
		const ready = promoReady();
		const signedIn = ai.signedIn && !!ai.account?.id;
		if (ready) untrack(() => void usePromoLink(signedIn));
	});
	const LINK_ERR = new Set(['invalid', 'disabled', 'expired', 'used_up', 'already_redeemed', 'already_on_plan', 'rate_limited']);
	async function usePromoLink(signedIn: boolean) {
		if (redeeming || !pendingPromo()) return;
		redeeming = true;
		// let the splash finish (Splash.svelte: at least 900 ms, then a 520 ms fade) so the toast is seen
		await new Promise((r) => setTimeout(r, 1500));
		redeeming = false;
		// the intro or a sheet may have opened meanwhile: its closing runs this again
		if (!promoReady()) return;
		signedIn = ai.signedIn && !!ai.account?.id;
		const saved = pendingPromo();
		if (!saved || redeeming) return;
		if (!signedIn) {
			if (!saved.told) {
				markPendingTold();
				toast(t('promo.linkSaved', { code: saved.code }), '🎟️', 3600);
			}
			return;
		}
		redeeming = true;
		busyToast(t('promo.linkRedeeming', { code: saved.code }));
		try {
			const r = await redeemPromo(saved.code);
			clearPendingPromo();
			plan.set(r);
			void ai.refresh(); // a package can bring managed AI
			toast(t('promo.linkRedeemed', { plan: r.planName }), '🎉', 3200);
		} catch (e) {
			const p = e instanceof PromoRequestError ? e.problem : 'other';
			if (p === 'offline' || p === 'network' || p === 'signed_out') {
				clearToast();
				return; // try again on the next change
			}
			clearPendingPromo();
			const reason = t(`promo.err.${LINK_ERR.has(p) ? p : 'other'}` as MessageKey);
			toast(t('promo.linkFailed', { code: saved.code, reason }), '⚠️', 4200);
		} finally {
			redeeming = false;
		}
	}

	// Immersive screens hide the navigation and can be swiped back from.
	const immersive = $derived(isImmersive(page.url.pathname));
	// remember where each full-screen step was opened from, so closing it goes back there
	afterNavigate(({ from, to }) => {
		if (to) ui.returnTo = returnTarget(ui.returnTo, from ? from.url.pathname + from.url.search : null, to.url.pathname + to.url.search);
	});
	const parent = $derived(
		page.url.pathname.startsWith('/learn/') ? '/learn' : page.url.pathname.startsWith('/words/') ? '/words' : page.url.pathname.startsWith('/ai/') ? '/ai' : page.url.pathname.startsWith('/admin') ? fleetParent(page.url.pathname) : '/'
	);

	// Breadcrumbs for error reports (every launch), and beta usage data (only once the account
	// has agreed): screens and a daily progress summary.
	$effect(() => {
		setRoute(page.url.pathname);
		if (telemetry.enabled) telemetry.screen(page.url.pathname);
	});
	$effect(() => {
		if (telemetry.enabled && progress.ready) void progress.snapshot();
	});

	async function back() {
		if (ui.backGuard && !(await ui.backGuard())) return false;
		ui.backGuard = null;
		await (page.url.pathname.startsWith('/admin') ? goto(parent) : leave(parent)); // ui-ok: a client-side page change, no network
	}

	/** how long saved progress may take to open before the app starts without it */
	const LOAD_TIMEOUT_MS = 8000;
	const report = (name: string, e: unknown) => void reportError(e, { name });

	/** Open saved progress. If storage fails or hangs, start anyway so the splash never sticks. */
	async function boot(apple: ReturnType<typeof takeAppleResult>) {
		try {
			await withTimeout(
				progress.load().then(() => Promise.all([words.load(), notes.load()])),
				LOAD_TIMEOUT_MS,
				'loading saved progress'
			);
		} catch (e) {
			report('boot_storage', e);
			console.error('[boot] saved progress could not be opened', e);
			progress.ready = true;
			words.ready = true;
			notes.ready = true;
			toast(t('boot.storageFailed'), '⚠️', 4200);
			return; // no intros or sync without storage; they run on the next good launch
		}
		try {
			if (apple) void idbPut('meta', true, 'introSeen').catch(() => {}); // you got as far as signing in
			else if (!(await idbGet<boolean>('meta', 'introSeen'))) ui.showIntro = true;
			// people who onboarded before Kuri existed meet Kuri once, on Today
			if (!safeMode && !ui.showIntro && !(await idbGet<boolean>('meta', 'kuriIntroSeen'))) kuriPending = true;
		} catch (e) {
			report('boot_intro', e);
		}
		attempt('sync', startAutoSync, report);
	}

	$effect(() => {
		if (progress.ready && words.ready) bootDone();
	});

	onMount(() => {
		// the app is running: hide the static startup screen in app.html (Splash takes over, same look)
		document.documentElement.classList.add('booted');
		reloadOnStaleChunk();
		attempt(
			'promo_link',
			() => {
				const ref = takeRef(new URL(location.href));
				if (!ref) return;
				if (ref.code) savePendingPromo(ref.code);
				history.replaceState(history.state, '', ref.rest); // a reload doesn't redeem it again
			},
			report
		);
		const apple = attempt('apple', takeAppleResult, report) ?? null;
		applePending = !!apple;
		void boot(apple);
		attempt('account', () => ai.watch(), report);
		if (apple) void finishApple(apple).catch((e) => report('boot_apple', e)).finally(() => (applePending = false));
		const onOnline = () => setTimeout(() => void processOutbox().catch(() => {}), 1500);
		addEventListener('online', onOnline);
		const vis = () => document.documentElement.classList.toggle('hidden', document.hidden);
		document.addEventListener('visibilitychange', vis);
		const stopKb = attempt('keyboard', trackKeyboard, report);
		attempt('updater', () => updater.start(), report);
		attempt('insets', () => insets.watch(), report);
		return () => {
			document.removeEventListener('visibilitychange', vis);
			stopKb?.();
		};
	});

	/** Back from Sign in with Apple (worker/auth/apple.ts): say how it went. */
	async function finishApple(r: NonNullable<ReturnType<typeof takeAppleResult>>) { // ui-ok: runs at start-up under the splash
		await ai.refresh();
		if (!r.ok) {
			if (r.message) toast(r.message, '⚠️', 3600);
			// back to the beta screen to try again or use a passkey
			if (!ai.signedIn) ui.showWelcome = true;
			return;
		}
		clearPendingInvite(); // signed in: an invite link has done its job
		if (r.result === 'linked') toast(t('apple.connected'), '✓');
		else if (r.result === 'created') {
			avatar.afterSignup = true;
			toast(t('welcome.toBeta', { name: ai.account?.name ?? '' }).trim(), '🎉', 2800);
			await afterWelcome('created');
		} else {
			toast(t('welcome.back', { name: ai.account?.name ?? '' }).trim(), '👋');
			await afterWelcome('signedIn');
		}
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
	/** back from Sign in with Apple and still finding out how it went */
	let applePending = $state(false);
	/** "Not now" while invited (only offered when no account can be made here): not again until a reload */
	let inviteLater = $state(false);
	// An invite link (/invite/CODE) needs an account: while its invite is pending in this tab
	// and nobody is signed in, sign-up comes back (after a reload too). Welcome has no
	// "Not now" then; signing in or up, or an invite that has ended, clears it.
	$effect(() => {
		if (!progress.ready || !ai.checked || !ai.reached || applePending || inviteLater) return;
		if (ai.signedIn) return void untrack(clearPendingInvite);
		if (ui.showIntro || ui.showWelcome || ui.handoff || page.url.pathname.startsWith('/invite/')) return;
		if (untrack(pendingInvite)) ui.showWelcome = true;
	});
	/** Kuri's first meeting is waiting for the next calm moment on Today */
	let kuriPending = $state(false);
	$effect(() => {
		if (!kuriPending || !progress.settings.kuri || page.url.pathname !== '/') return;
		if (ui.showIntro || ui.showOnboarding || ui.onboardingNext || ui.showWelcome || ui.handoff || ai.needsConsent || avatar.setup || avatar.afterSignup) return;
		kuriPending = false;
		ui.showKuriIntro = true;
	});
	// Sign-up (docs/ONBOARDING.md): the welcome (and its recovery code) → the beta consent →
	// the first-run questions → the avatar step (docs/AVATAR.md) → Today.
	$effect(() => {
		if (!ui.onboardingNext || ui.showIntro || ui.showWelcome || ui.showOnboarding || ai.needsConsent || avatar.setup) return;
		ui.onboardingNext = false;
		firstRun = true;
		ui.showOnboarding = true;
	});
	$effect(() => {
		if (!avatar.afterSignup || avatar.setup || ui.showIntro || ui.showOnboarding || ui.onboardingNext || ui.showWelcome) return;
		if (!ai.signedIn || ai.needsConsent) return;
		avatar.setup = 'signup';
	});
	// keep the offline copy of the avatar in step with the account
	$effect(() => {
		void ai.account;
		void ai.reached;
		void ai.signedIn;
		untrack(() => avatar.sync());
	});
	/** the beta sign-up / sign-in (passkey only), unless already signed in */
	async function offerWelcome() { // ui-ok: only when the account check has not run yet; the sheet opens right after
		if (!ai.checked) await ai.refresh();
		if (!ai.signedIn) ui.showWelcome = true;
	}
	/** the intro ended with no answers on this device: the questions come after sign-up */
	let askAfterWelcome = false;
	/**
	 * After the welcome sheet. A new account answers the questions (unless this device already
	 * has answers) after its consent; "Not now" answers them straight away on a first run; an
	 * existing account signing in is not asked again. Signing in or up shows a loading screen
	 * until the next screen is ready.
	 */
	async function afterWelcome(how: 'created' | 'signedIn' | 'later') { // ui-ok: the Handoff loading screen covers it; the profile read is a quick local read
		const ask = askAfterWelcome;
		if (how === 'later' && pendingInvite()) inviteLater = true;
		askAfterWelcome = false;
		if (how !== 'later') startHandoff(how === 'created' ? 'signup' : 'signin');
		ui.showWelcome = false;
		if (how === 'signedIn') return;
		if (how === 'later' && !ask) return;
		if (!(await profile.load().catch(() => null))) ui.onboardingNext = true;
		else if (ui.handoff === 'signup') endHandoffSoon();
	}

	// The loading screen after sign-in or sign-up (Handoff.svelte): it stays at least long
	// enough to cover the welcome sheet's fade, and ends when the next screen is up.
	const HANDOFF_MIN_MS = 450;
	const HANDOFF_MAX_MS = 8000;
	let handoffAt = 0;
	let handoffTimer: ReturnType<typeof setTimeout> | undefined;
	function startHandoff(kind: 'signin' | 'signup') {
		ui.handoff = kind;
		handoffAt = Date.now();
		clearTimeout(handoffTimer);
		handoffTimer = setTimeout(() => (ui.handoff = null), HANDOFF_MAX_MS); // never stuck
		if (page.url.pathname !== '/') void goto('/', { replaceState: true });
		// signing in brings the account's progress: wait for it, so Today opens with it
		if (kind === 'signin') void sync().catch(() => null).finally(endHandoffSoon);
	}
	function endHandoffSoon() {
		const wait = Math.max(0, HANDOFF_MIN_MS - (Date.now() - handoffAt));
		clearTimeout(handoffTimer);
		handoffTimer = setTimeout(() => (ui.handoff = null), wait);
	}
	// sign-up: the next screen (consent, questions or avatar step) is on screen underneath
	$effect(() => {
		if (ui.handoff !== 'signup') return;
		if (ai.needsConsent || ui.showOnboarding || avatar.setup) untrack(endHandoffSoon);
	});
</script>

<Backdrop hue={ui.hue} />

<div class="app" use:edgeSwipeBack={{ enabled: immersive, onback: back }}>
	{#if progress.ready && words.ready}
		<svelte:boundary onerror={(e) => report('screen_crash', e)}>
			{@render children()}
			{#snippet failed(_error, reset)}
				<main class="page crashed" role="alert">
					<div class="crash-icon" aria-hidden="true">😵‍💫</div>
					<h1>{t('boot.crashTitle')}</h1>
					<p>{t('boot.crashBody')}</p>
					<Button onclick={reset}>{t('boot.retry')}</Button>
					<Button variant="ghost" onclick={() => location.reload()}>{t('boot.reload')}</Button>
				</main>
			{/snippet}
		</svelte:boundary>
	{:else}
		<main class="page stack boot" style:--gap="var(--space-4)" aria-busy="true">
			<div class="boot-title"></div>
			<Skeleton variant="card" count={1} label={t('common.loadingProgress')} />
			<Skeleton variant="row" count={3} />
		</main>
	{/if}
</div>

{#if !immersive}
	<TabBar />
{/if}
{#if progress.ready && words.ready && !ui.showIntro && !ui.showOnboarding && !ui.showWelcome && !ai.needsConsent && !avatar.setup}
	<!-- "More below" on every long screen; the Ask AI composer sets ui.scrollClear -->
	<ScrollMore nav={!immersive} clear={ui.scrollClear} />
{/if}

{#if ui.showIntro}
	<Intro
		ondone={async () => {
			ui.showIntro = false;
			void idbPut('meta', true, 'introSeen');
			// first run: sign-up first, then a few questions to set up the plan (afterWelcome)
			askAfterWelcome = !(await profile.load().catch(() => null));
			await offerWelcome();
			// already signed in (the intro replayed from Settings): straight to the questions
			if (!ui.showWelcome && askAfterWelcome) (askAfterWelcome = false), (ui.onboardingNext = true);
		}}
	/>
{/if}
{#if ui.showOnboarding}
	<Onboarding
		ondone={async () => {
			ui.showOnboarding = false;
			if (!firstRun) return;
			firstRun = false;
			// land on Today, where the plan card offers the first step; never jump into a lesson
			if (page.url.pathname !== '/') void goto('/', { replaceState: true });
			// after the questions (and the avatar step, for a new account), Kuri says hello on Today
			if (!(await idbGet<boolean>('meta', 'kuriIntroSeen').catch(() => false))) kuriPending = true;
		}}
	/>
{/if}
{#if ui.showWelcome}
	<Welcome ondone={afterWelcome} />
{/if}
{#if ui.showKuriIntro}
	<KuriIntro
		ondone={() => {
			ui.showKuriIntro = false;
			void idbPut('meta', true, 'kuriIntroSeen');
		}}
	/>
{/if}
{#if !safeMode && progress.settings.kuri && progress.settings.kuriReact && progress.ready}
	<KuriReaction />
{/if}
{#if ai.needsConsent && !ui.showIntro && !ui.showWelcome}
	<!-- required after sign-in until the account agrees to the current beta terms -->
	<BetaConsent />
{/if}
{#if avatar.setup && !ai.needsConsent}
	<AvatarSetup from={avatar.setup} />
{/if}
{#if ui.handoff}
	<Handoff kind={ui.handoff} />
{/if}
<Splash ready={progress.ready && words.ready} />
<UpdateBanner />
<InstallGuide />
<OpenInSafari />
<Overlays />

<style>
	.app {
		min-height: 100dvh;
	}
	.crashed {
		min-height: 70dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-3);
		text-align: center;
	}
	.crashed h1 {
		margin: 0;
		font-size: 1.25rem;
	}
	.crashed p {
		margin: 0 0 var(--space-2);
		color: var(--ink-2);
		max-width: 320px;
	}
	.crash-icon {
		font-size: 2.5rem;
	}
	.boot-title {
		width: 46%;
		height: 34px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--ink) 9%, transparent);
	}
</style>

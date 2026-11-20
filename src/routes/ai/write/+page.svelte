<!--
	Writing helper (docs/EVERYDAY.md): paste a message you are about to send,
	pick who it is for, and Kuri checks the politeness and suggests a more
	natural version. Phrases from the suggestion can be saved to the phrasebook.
-->
<script lang="ts">
	import { t, tn } from '#lib/i18n/index.svelte.ts';
	import { Button, Card, IconButton, ListGroup, ListRow, MarkedText, PolitenessMeter, Segmented, Skeleton, SpeechBubble, TextArea } from '#lib/ui/index.ts';
	import { goto } from '$app/navigation';
	import { fly } from 'svelte/transition';
	import * as api from '#lib/ai/client.ts';
	import { WRITE_MAX, WRITE_TARGET, WRITE_TO, type WriteResponse, type WriteTo } from '#lib/ai/contract.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { words } from '#lib/state/words.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { saveCandidates, verifiedCandidate } from '#lib/words/maker.ts';
	import { markChanges, politeGap } from '#lib/words/writing.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { toast } from '#lib/ios/overlay.svelte.ts';

	ui.hue = 265;
	const TO_KEY = 'benkyo.write.to';
	const savedTo = (() => {
		try {
			const v = localStorage.getItem(TO_KEY) as WriteTo | null;
			return v && WRITE_TO.includes(v) ? v : null;
		} catch {
			return null;
		}
	})();

	let to = $state<WriteTo>(savedTo ?? 'colleague');
	let text = $state('');
	let busy = $state(false);
	let saving = $state(false);
	/** the message that was checked (the field may change after) */
	let checked = $state('');
	let checkedTo = $state<WriteTo>('colleague');
	let result = $state<WriteResponse | null>(null);
	let showBetter = $state(false);

	const people = $derived(WRITE_TO.map((v) => ({ value: v, label: t(`write.to.${v}`) })));
	const gap = $derived(result ? politeGap(result.level, WRITE_TARGET[checkedTo], result.fits) : 'fits');
	const marked = $derived(result ? markChanges(checked, result.changes) : []);
	const tooLong = $derived(text.length > WRITE_MAX);

	function pickTo(v: WriteTo) {
		to = v;
		try {
			localStorage.setItem(TO_KEY, v);
		} catch {
			/* a remembered choice is only a convenience */
		}
	}

	async function check() {
		if (!text.trim() || busy || tooLong || !ai.available) return;
		busy = true;
		result = null;
		showBetter = false;
		try {
			checked = text.trim();
			checkedTo = to;
			result = await api.write({ text: checked, to, secondLang: progress.settings.secondLang });
			haptic(result.fits ? 'success' : 'warning');
		} catch (e) {
			haptic('error');
			toast(e instanceof Error ? e.message : t('write.failed'), '⚠️', 2800);
		} finally {
			busy = false;
		}
	}

	async function copy() {
		if (!result) return;
		try {
			await navigator.clipboard.writeText(result.better);
			haptic('success');
			toast(t('write.copied'), '✓');
		} catch {
			toast(t('write.copyFailed'), '⚠️');
		}
	}

	async function savePhrases() {
		if (!result?.phrases.length) return;
		saving = true;
		try {
			const items = await Promise.all(result.phrases.map((p) => verifiedCandidate(p, true)));
			const cards = await saveCandidates(items, { tags: [], source: 'user', via: 'writing', ctx: result.better });
			haptic('success');
			toast(tn('write.saved', cards.length), '📖', 2400);
		} catch (e) {
			toast(e instanceof Error ? e.message : t('maker.saveFailed'), '⚠️');
		} finally {
			saving = false;
		}
	}

	const inDeck = (text: string) => words.list.some((c) => !c.deleted && (c.kanji === text || c.front === text));
</script>

<main class="writer">
	<header class="top">
		<IconButton label={t('common.back')} onclick={() => goto('/ai')}>
			<svg viewBox="0 0 24 24" width="18" height="18"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</IconButton>
		<h1 class="title-2">{t('write.title')}</h1>
	</header>
	<p class="caption intro">{t('write.intro')}</p>

	<form class="stack" style:--gap="var(--space-3)" onsubmit={(e) => (e.preventDefault(), check())}>
		<h2 class="eyebrow">{t('write.sendingTo')}</h2>
		<Segmented label={t('write.sendingTo')} options={people} value={to} onchange={pickTo} />
		<TextArea
			jp
			rows={6}
			autogrow
			maxRows={14}
			bind:value={text}
			label={t('write.message')}
			placeholder={t('write.placeholder')}
			error={tooLong ? t('write.tooLong', { n: WRITE_MAX }) : undefined}
		/>
		<Button type="submit" variant="accent" block {busy} disabled={!text.trim() || tooLong || !ai.available}>
			{busy ? t('write.checking') : `✨ ${t('write.check')}`}
		</Button>
		{#if ai.checked && !ai.available}<p class="caption">{ai.reason}</p>{/if}
	</form>

	{#if busy}
		<Skeleton variant="card" count={2} label={t('write.checking')} />
	{:else if result}
		<section class="stack" style:--gap="var(--space-3)" in:fly={{ y: 16, duration: 350 }}>
			<Card padding="md">
				<div class="stack" style:--gap="var(--space-2)">
					<div class="row">
						<span class="headline">{t('write.politeness')}</span>
						<span class="spacer"></span>
						<span class="pill {gap}">{t(`write.gap.${gap}`, { who: t(`write.to.${checkedTo}`).toLowerCase() })}</span>
					</div>
					<PolitenessMeter
						value={result.level}
						target={WRITE_TARGET[checkedTo]}
						steps={[t('write.casual'), t('write.polite'), t('write.keigo')]}
						valueLabel={t('write.yours')}
						targetLabel={t('write.rightFor', { who: t(`write.to.${checkedTo}`).toLowerCase() })}
						label={t('write.politeness')}
					/>
				</div>
			</Card>

			<Card padding="md">
				<MarkedText parts={showBetter || !result.changes.length ? [{ text: result.better }] : marked} />
			</Card>

			<SpeechBubble label={t('write.kuriSays')}>
				{result.verdict.en}
				{#if result.verdict.second}<span class="second">{result.verdict.second}</span>{/if}
			</SpeechBubble>

			<div class="row actions">
				{#if result.changes.length}
					<Button variant="ghost" size="sm" onclick={() => (showBetter = !showBetter)}>{showBetter ? t('write.showChanges') : t('write.showClean')}</Button>
				{/if}
				<Button variant="ghost" size="sm" onclick={copy}>{t('write.copy')}</Button>
			</div>

			{#if result.changes.length}
				<h2 class="eyebrow">{t('write.why')}</h2>
				<ListGroup class="changes">
					{#each result.changes as c (c.from + c.to)}
						<ListRow>
							<span class="change">
								<span class="jp"><del>{c.from}</del> → <b>{c.to}</b></span>
								<span class="caption">{c.why.en}</span>
								{#if c.why.second}<span class="caption">{c.why.second}</span>{/if}
							</span>
						</ListRow>
					{/each}
				</ListGroup>
			{/if}

			{#if result.phrases.length}
				<h2 class="eyebrow">{t('write.phrases')}</h2>
				<ListGroup class="changes">
					{#each result.phrases as p (p.text)}
						<ListRow>
							<span class="change">
								<span class="jp phrase">{p.text}</span>
								<span class="caption">{p.reading} · {p.gloss}</span>
							</span>
							{#snippet trailing()}{#if inDeck(p.text)}<span class="pill">{t('maker.inDeck')}</span>{/if}{/snippet}
						</ListRow>
					{/each}
				</ListGroup>
				<Button variant="accent" block busy={saving} onclick={savePhrases}>
					{saving ? t('common.saving') : tn('write.saveN', result.phrases.length)}
				</Button>
				<p class="caption">{t('write.saveHint')}</p>
			{/if}
		</section>
	{/if}
</main>

<style>
	.writer {
		min-height: 100dvh;
		max-width: 760px;
		margin: 0 auto;
		padding: calc(var(--safe-top) + var(--space-3)) var(--gutter-r) calc(var(--safe-bottom) + var(--kb) + var(--space-6)) var(--gutter-l);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.top {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.intro {
		margin: 0;
	}
	.actions {
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.pill {
		font-size: 0.75rem;
		padding: var(--space-1) var(--space-2);
		border-radius: 999px;
		background: var(--hairline);
		color: var(--ink-2);
		white-space: nowrap;
	}
	.pill.tooCasual,
	.pill.tooFormal {
		background: color-mix(in srgb, var(--warn) 35%, transparent);
		color: var(--ink);
	}
	.pill.fits {
		background: color-mix(in srgb, var(--success) 25%, transparent);
		color: var(--ink);
	}
	.second {
		display: block;
		margin-top: var(--space-1);
		color: var(--ink-2);
	}
	section :global(.changes) {
		padding: 0;
		border-radius: var(--r-m);
	}
	.change {
		display: flex;
		flex-direction: column;
		gap: var(--space-px);
		min-width: 0;
	}
	.change del {
		color: var(--ink-2);
	}
	.phrase {
		font-size: 1.0625rem;
	}
</style>

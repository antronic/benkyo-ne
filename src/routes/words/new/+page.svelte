<!--
	Card maker (docs/AI-PLAN.md §4b). Five input modes; nothing enters your
	deck until you tick items and tap Save.
-->
<script lang="ts">
	import { t, tn } from '#lib/i18n/index.svelte.ts';
	import { Button, Card, FileButton, IconButton, Segmented, Skeleton, TextField } from '#lib/ui/index.ts';
	import Romaji from '#lib/components/Romaji.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { fly } from 'svelte/transition';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { words } from '#lib/state/words.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { candidatesFor, imageToBase64, saveCandidates, type Candidate, type CandidateResult, type MakerMode } from '#lib/words/maker.ts';
	import type { SightingVia } from '#lib/ai/contract.ts';
	import { unknownKanaIn } from '#lib/dict/readable.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { toast } from '#lib/ios/overlay.svelte.ts';
	import { speak } from '#lib/content/kana.ts';

	ui.hue = 285;
	const MODES: { id: MakerMode; label: string; placeholder: string; ai: 'none' | 'optional' | 'required' }[] = $derived([
		{ id: 'english', label: t('maker.english'), placeholder: t('maker.egEnglish'), ai: 'optional' },
		{ id: 'japanese', label: '日本語', placeholder: t('maker.eg', { examples: 'いけ, 池, 食べた' }), ai: 'none' },
		{ id: 'romaji', label: t('maker.romaji'), placeholder: t('maker.eg', { examples: 'ike, itadakimasu' }), ai: 'none' },
		{ id: 'screenshot', label: t('maker.photo'), placeholder: '', ai: 'required' },
		{ id: 'scenario', label: t('maker.scenario'), placeholder: t('maker.egScenario'), ai: 'required' }
	]);

	let mode = $state<MakerMode>((page.url.searchParams.get('mode') as MakerMode) || 'english');
	let input = $state('');
	let file = $state<File | null>(null);
	let preview = $state<string | null>(null);
	let busy = $state(false);
	let result = $state<CandidateResult | null>(null);
	let chosen = $state<Set<string>>(new Set());
	let tags = $state('');
	let saving = $state(false);

	const m = $derived(MODES.find((x) => x.id === mode)!);
	/** Phrasebook (docs/EVERYDAY.md): a photo or a look-up counts as the word coming up in your life. */
	const via = $derived<SightingVia | undefined>(mode === 'screenshot' ? 'photo' : mode === 'scenario' ? undefined : 'lookup');
	const inDeck = (c: Candidate) => {
		const card = words.cards[c.key];
		return card && !card.deleted ? card : null;
	};
	const blocked = $derived(m.ai === 'required' && !ai.available);

	function setMode(id: MakerMode) {
		mode = id;
		result = null;
		chosen = new Set();
		haptic('selection');
		if (id === 'scenario' && !tags) tags = '';
	}

	function pickFile(f: File) {
		file = f;
		if (preview) URL.revokeObjectURL(preview);
		preview = URL.createObjectURL(f);
	}

	async function search() {
		if (busy || blocked) return;
		if (mode === 'screenshot' ? !file : !input.trim()) return;
		busy = true;
		result = null;
		try {
			const image = mode === 'screenshot' && file ? await imageToBase64(file) : undefined;
			result = await candidatesFor(mode, mode === 'screenshot' ? 'Extract the Japanese words and phrases worth learning.' : input, image);
			// Pre-select: AI-proposed items (scenario/photo) and the single top dictionary hit.
			chosen = new Set(mode === 'scenario' || mode === 'screenshot' ? result.items.map((i) => i.key) : result.items.slice(0, 1).map((i) => i.key));
			// scenario/photo: the AI names the pack; it becomes the tag (still editable)
			if ((mode === 'scenario' || mode === 'screenshot') && result.packName) tags = result.packName.en;
			else if (mode === 'scenario' && !tags.trim()) tags = input.trim();
			await seeKnown(result);
			haptic(result.items.length ? 'success' : 'warning');
		} catch (e) {
			toast(e instanceof Error ? e.message : t('maker.lookupFailed'), '⚠️');
		} finally {
			busy = false;
		}
	}

	/**
	 * Words you already have count as met again: every one found in a photo,
	 * and the top hit of a look-up. They stay unticked, since saving adds nothing.
	 */
	async function seeKnown(r: CandidateResult) {
		if (!via) return;
		const known = (via === 'photo' ? r.items : r.items.slice(0, 1)).filter((c) => inDeck(c));
		if (!known.length) return;
		await words.see(known.map((c) => c.key), via, via === 'lookup' ? input.trim() : null);
		const n = new Set(chosen);
		for (const c of known) n.delete(c.key);
		chosen = n;
		if (via === 'photo') toast(t('maker.seenToast', { n: known.length }), '📖', 2400);
	}

	function toggle(k: string) {
		const n = new Set(chosen);
		n.has(k) ? n.delete(k) : n.add(k);
		chosen = n;
		haptic('selection');
	}

	async function save() {
		if (!result || !chosen.size) return;
		saving = true;
		try {
			const items = result.items.filter((i) => chosen.has(i.key));
			const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
			const cards = await saveCandidates(items, {
				tags: tagList,
				source: mode === 'scenario' ? 'scenario' : 'user',
				// cards already counted by the search are not counted twice (same place within 10 minutes)
				via,
				ctx: via === 'lookup' ? input.trim() : null
			});
			const parked = cards.filter((c) => words.isParked(c)).length;
			haptic('success');
			toast(tn('maker.saved', cards.length) + (parked ? ` · ${t('maker.parkedN', { n: parked })}` : ''), '✓', 2400);
			goto('/words');
		} catch (e) {
			toast(e instanceof Error ? e.message : t('maker.saveFailed'), '⚠️');
		} finally {
			saving = false;
		}
	}
</script>

<main class="maker">
	<header class="top">
		<IconButton label={t('common.close')} onclick={() => goto('/words')}>
			<svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /></svg>
		</IconButton>
		<h1 class="title-2">{t('maker.title')}</h1>
		<span class="spacer"></span>
	</header>

	<Segmented label={t('maker.inputMode')} options={MODES.map((x) => ({ value: x.id, label: x.label }))} bind:value={mode} onchange={setMode} />

	<div class="split">
		<div class="pane input-pane">
			{#if mode === 'screenshot'}
				<Card class="drop">
					{#if preview}
						<img src={preview} alt={t('maker.selected')} />
					{:else}
						<span class="caption">{t('maker.photoHint')}</span>
					{/if}
					<FileButton accept="image/*" capture="environment" onpick={pickFile}>📷 {t('maker.pickPhoto')}</FileButton>
				</Card>
			{:else}
				<form onsubmit={(e) => (e.preventDefault(), search())}>
					<TextField
						size="lg"
						bind:value={input}
						placeholder={m.placeholder}
						aria-label={t('maker.inputAria', { mode: m.label })}
						autocomplete="off"
						autocapitalize="off"
						autocorrect="off"
						spellcheck="false"
						enterkeyhint="search"
						lang={mode === 'japanese' ? 'ja' : 'en'}
						autofocus
					/>
				</form>
			{/if}
			<Button variant="accent" block onclick={search} {busy} disabled={blocked || (mode === 'screenshot' ? !file : !input.trim())}>
				{busy ? t('maker.looking') : mode === 'scenario' ? t('maker.suggest') : mode === 'screenshot' ? t('maker.find') : t('maker.lookUp')}
			</Button>
			{#if blocked}
				<p class="caption note">✨ {t('maker.needsAi')} {ai.reason}</p>
			{:else if m.ai === 'optional' && !ai.available && ai.reason}
				<p class="caption note">{t('maker.dictOnly', { reason: ai.reason })}</p>
			{/if}
		</div>

		<div class="pane results-pane">
			{#if busy}
				<Skeleton variant="row" count={4} label={t('maker.lookingUp')} />
			{:else if result}
				{#if result.aiNote && result.items.length}<p class="caption note">⚠️ {result.aiNote}</p>{/if}
				{#if !result.items.length}
					<Card>
						{result.aiNote ? `⚠️ ${result.aiNote}` : t('maker.nothing')}
					</Card>
				{:else}
					<div class="results" in:fly={{ y: 16, duration: 300 }}>
						{#each result.items as c (c.key)}
							{@const missing = unknownKanaIn(c.reading, progress.knownKana)}
							<Card padding="none" class="cand{chosen.has(c.key) ? ' on' : ''}" selected={chosen.has(c.key)} onclick={() => toggle(c.key)} aria-pressed={chosen.has(c.key)}>
								<span class="check" aria-hidden="true">{chosen.has(c.key) ? '✓' : ''}</span>
								<span class="stack body" style:--gap="var(--space-px)">
									<span class="row" style:--gap="var(--space-1h)">
										<span class="jp reading">{c.reading}</span>
										{#if c.text !== c.reading}<span class="jp written">{c.text}</span>{/if}
										{#if c.kind === 'phrase'}<span class="tag">{t('card.phrase')}</span>{/if}
										{#if !c.verified}<span class="tag warn">{t('card.unverified')}</span>{/if}
										{#if inDeck(c)}{@const seen = inDeck(c)?.seen?.count ?? 0}<span class="tag">{seen ? t('maker.seenAgain', { n: seen }) : t('maker.inDeck')}</span>{/if}
									</span>
									<Romaji text={c.reading} />
									<span class="gloss">{c.gloss}</span>
									{#if c.inflection}<span class="caption">{t('maker.fromInput', { form: c.inflection })}</span>{/if}
									{#if c.note}<span class="caption">✨ {c.note.en}{c.note.second ? ` · ${c.note.second}` : ''}</span>{/if}
									{#if missing.length}<span class="caption">⏸ {t('maker.parkedUntil')} <span class="jp">{missing.join(' ')}</span><Romaji text={missing.join(' ')} inline /></span>{/if}
								</span>
								<span class="listen" role="presentation" onclick={(e) => (e.stopPropagation(), speak(c.reading))}>🔊</span>
							</Card>
						{/each}
					</div>
					{#if result.packName}
						<div class="packname">
							<span class="caption">✨ {t('maker.packName')}</span>
							<span class="headline">{result.packName.en}</span>
							{#if result.packName.second}<span class="caption">{result.packName.second}</span>{/if}
						</div>
					{/if}
					<TextField label={result.packName ? t('maker.tagFromPack') : t('maker.tags')} bind:value={tags} placeholder={t('maker.egTags')} />
					<Button block onclick={save} busy={saving} disabled={!chosen.size}>
						{saving ? t('common.saving') : chosen.size ? tn('maker.saveN', chosen.size) : t('maker.saveCards')}
					</Button>
					<p class="caption note">
						{ai.available ? `✨ ${t('maker.aiExtras')}` : t('maker.noAiExtras')}
					</p>
				{/if}
			{/if}
		</div>
	</div>
</main>

<style>
	.maker {
		min-height: 100dvh;
		max-width: 1040px;
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
.split {
		align-items: start !important;
	}
	.pane {
		align-items: stretch !important;
	}
	.note {
		margin: 0;
	}
	.input-pane :global(.drop) {
		display: grid;
		place-items: center;
		gap: var(--space-3);
		min-height: 180px;
		border-radius: var(--r-m);
		border: 1.5px dashed var(--hairline);
		text-align: center;
		overflow: hidden;
	}
	.input-pane img {
		max-width: 100%;
		max-height: 320px;
		border-radius: 12px;
	}
	.results {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.results :global(.cand) {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--r-m);
		min-height: 56px;
	}
	.check {
		flex: none;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 1.5px solid var(--ink-3);
		display: grid;
		place-items: center;
		font-size: 14px;
		font-weight: 700;
		color: #fff;
		margin-top: var(--space-px);
	}
	.results :global(.cand.on .check) {
		background: var(--accent-2);
		border-color: var(--accent-2);
	}
	.body {
		flex: 1;
		min-width: 0;
	}
	.reading {
		font-size: 1.25rem;
		font-weight: 600;
	}
	.written {
		font-size: 1.125rem;
		color: var(--ink-2);
	}
	.gloss {
		font-size: 0.9375rem;
	}
	.tag {
		font-size: 0.6875rem;
		font-weight: 700;
		text-transform: uppercase;
		padding: var(--space-px) var(--space-2);
		border-radius: 999px;
		background: var(--hairline);
	}
	.tag.warn {
		background: color-mix(in srgb, var(--warn) 35%, transparent);
	}
	.listen {
		flex: none;
		padding: var(--space-1h);
		cursor: pointer;
	}
	.packname {
		display: flex;
		flex-direction: column;
		gap: var(--space-px);
		padding: var(--space-3) var(--space-3);
		border-radius: var(--r-m);
		background: color-mix(in srgb, var(--accent-2) 10%, transparent);
	}

</style>

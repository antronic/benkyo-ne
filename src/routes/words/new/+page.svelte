<!--
	Card maker (docs/AI-PLAN.md §4b). Five input modes; nothing enters your
	deck until you tick items and tap Save.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { fly } from 'svelte/transition';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { words } from '#lib/state/words.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { candidatesFor, imageToBase64, saveCandidates, type Candidate, type MakerMode } from '#lib/words/maker.ts';
	import { unknownKanaIn } from '#lib/dict/readable.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { toast } from '#lib/ios/overlay.svelte.ts';
	import { speak } from '#lib/content/kana.ts';

	ui.hue = 285;
	const MODES: { id: MakerMode; label: string; placeholder: string; ai: 'none' | 'optional' | 'required' }[] = [
		{ id: 'english', label: 'English', placeholder: 'e.g. pond, thank you, delicious', ai: 'optional' },
		{ id: 'japanese', label: '日本語', placeholder: 'e.g. いけ, 池, 食べた', ai: 'none' },
		{ id: 'romaji', label: 'Romaji', placeholder: 'e.g. ike, itadakimasu', ai: 'none' },
		{ id: 'screenshot', label: 'Photo', placeholder: '', ai: 'required' },
		{ id: 'scenario', label: 'Scenario', placeholder: 'e.g. ordering at a ramen shop', ai: 'required' }
	];

	let mode = $state<MakerMode>((page.url.searchParams.get('mode') as MakerMode) || 'english');
	let input = $state('');
	let file = $state<File | null>(null);
	let preview = $state<string | null>(null);
	let busy = $state(false);
	let result = $state<{ items: Candidate[]; aiUsed: boolean; aiNote?: string } | null>(null);
	let chosen = $state<Set<string>>(new Set());
	let tags = $state('');
	let saving = $state(false);

	const m = $derived(MODES.find((x) => x.id === mode)!);
	const blocked = $derived(m.ai === 'required' && !ai.available);

	function setMode(id: MakerMode) {
		mode = id;
		result = null;
		chosen = new Set();
		haptic('selection');
		if (id === 'scenario' && !tags) tags = '';
	}

	function pickFile(e: Event) {
		const f = (e.currentTarget as HTMLInputElement).files?.[0] ?? null;
		file = f;
		if (preview) URL.revokeObjectURL(preview);
		preview = f ? URL.createObjectURL(f) : null;
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
			if (mode === 'scenario' && !tags.trim()) tags = input.trim();
			haptic(result.items.length ? 'success' : 'warning');
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Lookup failed', '⚠️');
		} finally {
			busy = false;
		}
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
			const cards = await saveCandidates(items, { tags: tagList, source: mode === 'scenario' ? 'scenario' : 'user' });
			const parked = cards.filter((c) => words.isParked(c)).length;
			haptic('success');
			toast(`${cards.length} card${cards.length === 1 ? '' : 's'} saved${parked ? ` · ${parked} parked` : ''}`, '✓', 2400);
			goto('/words');
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Saving failed', '⚠️');
		} finally {
			saving = false;
		}
	}
</script>

<main class="maker">
	<header class="top">
		<button class="icon-btn" aria-label="Close" onclick={() => goto('/words')}>
			<svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /></svg>
		</button>
		<h1 class="title-2">Make a card</h1>
		<span class="spacer"></span>
	</header>

	<div class="modes glass" role="tablist" aria-label="Input mode">
		{#each MODES as x}
			<button role="tab" aria-selected={mode === x.id} class:on={mode === x.id} onclick={() => setMode(x.id)}>
				<span class:jp={x.id === 'japanese'}>{x.label}</span>
				{#if x.ai !== 'none'}<span class="sparkle" aria-hidden="true">✨</span>{/if}
			</button>
		{/each}
	</div>

	<div class="split">
		<div class="pane input-pane">
			{#if mode === 'screenshot'}
				<label class="drop glass">
					{#if preview}
						<img src={preview} alt="Selected screenshot" />
					{:else}
						<span>📷 Take a photo or choose a screenshot</span>
						<span class="caption">A menu, a sign, a game screen…</span>
					{/if}
					<input type="file" accept="image/*" capture="environment" onchange={pickFile} />
				</label>
			{:else}
				<form class="row" onsubmit={(e) => (e.preventDefault(), search())}>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						type="text"
						bind:value={input}
						placeholder={m.placeholder}
						aria-label="{m.label} input"
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
			<button class="btn accent block" onclick={search} disabled={busy || blocked || (mode === 'screenshot' ? !file : !input.trim())}>
				{busy ? 'Looking…' : mode === 'scenario' ? 'Suggest words' : mode === 'screenshot' ? 'Find words' : 'Look up'}
			</button>
			{#if blocked}
				<p class="caption note">✨ This mode needs AI. {ai.reason}</p>
			{:else if m.ai === 'optional' && !ai.available && ai.reason}
				<p class="caption note">Dictionary only: {ai.reason}</p>
			{/if}
		</div>

		<div class="pane results-pane">
			{#if result}
				{#if result.aiNote && result.items.length}<p class="caption note">⚠️ {result.aiNote}</p>{/if}
				{#if !result.items.length}
					<div class="glass empty">
						{result.aiNote ? `⚠️ ${result.aiNote}` : 'Nothing found. Try another spelling or mode.'}
					</div>
				{:else}
					<div class="results" in:fly={{ y: 16, duration: 300 }}>
						{#each result.items as c (c.key)}
							{@const missing = unknownKanaIn(c.reading, progress.knownKana)}
							<button class="cand glass" class:on={chosen.has(c.key)} onclick={() => toggle(c.key)} aria-pressed={chosen.has(c.key)}>
								<span class="check" aria-hidden="true">{chosen.has(c.key) ? '✓' : ''}</span>
								<span class="stack body" style:--gap="2px">
									<span class="row" style:--gap="6px">
										<span class="jp reading">{c.reading}</span>
										{#if c.text !== c.reading}<span class="jp written">{c.text}</span>{/if}
										{#if c.kind === 'phrase'}<span class="tag">phrase</span>{/if}
										{#if !c.verified}<span class="tag warn">unverified</span>{/if}
									</span>
									<span class="gloss">{c.gloss}</span>
									{#if c.inflection}<span class="caption">from your input: {c.inflection}</span>{/if}
									{#if c.note}<span class="caption">✨ {c.note.en}{c.note.second ? ` · ${c.note.second}` : ''}</span>{/if}
									{#if missing.length}<span class="caption">⏸ parked until you learn <span class="jp">{missing.join(' ')}</span></span>{/if}
								</span>
								<span class="listen" role="presentation" onclick={(e) => (e.stopPropagation(), speak(c.reading))}>🔊</span>
							</button>
						{/each}
					</div>
					<label class="tags">
						<span class="caption">Tags (comma-separated)</span>
						<input type="text" bind:value={tags} placeholder="e.g. ramen shop, travel" />
					</label>
					<button class="btn block" onclick={save} disabled={saving || !chosen.size}>
						{saving ? 'Saving…' : `Save ${chosen.size || ''} card${chosen.size === 1 ? '' : 's'}`}
					</button>
					<p class="caption note">
						{ai.available ? '✨ AI adds a memory hook, an example and your second language after saving; examples are checked against the dictionary.' : 'Cards are saved with dictionary content now; AI extras are added when available.'}
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
		padding: calc(var(--safe-top) + 12px) var(--gutter-r) calc(var(--safe-bottom) + var(--kb) + 24px) var(--gutter-l);
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.top {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.modes {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		padding: 4px;
		border-radius: 14px;
		gap: 2px;
	}
	.modes button {
		border: 0;
		background: none;
		border-radius: 10px;
		min-height: 40px;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--ink-2);
		cursor: pointer;
		position: relative;
		transition: background 250ms, color 250ms;
	}
	.modes button.on {
		background: var(--glass-strong);
		color: var(--ink);
		box-shadow: 0 3px 10px rgb(0 0 0 / 0.1);
	}
	.sparkle {
		position: absolute;
		top: 2px;
		right: 4px;
		font-size: 9px;
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
	.drop {
		position: relative;
		display: grid;
		place-items: center;
		gap: 4px;
		min-height: 180px;
		border-radius: var(--r-m);
		border: 1.5px dashed var(--hairline);
		text-align: center;
		cursor: pointer;
		overflow: hidden;
		padding: 12px;
	}
	.drop img {
		max-width: 100%;
		max-height: 320px;
		border-radius: 12px;
	}
	.drop input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}
	.results {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.cand {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 12px 14px;
		border-radius: var(--r-m);
		text-align: left;
		cursor: pointer;
		transition: box-shadow 200ms, transform 300ms var(--spring);
		min-height: 56px;
	}
	.cand:active {
		transform: scale(0.98);
	}
	.cand.on {
		box-shadow:
			0 0 0 2px var(--accent-2),
			var(--glass-shadow);
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
		margin-top: 2px;
	}
	.on .check {
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
		padding: 2px 7px;
		border-radius: 999px;
		background: var(--hairline);
	}
	.tag.warn {
		background: color-mix(in srgb, var(--warn) 35%, transparent);
	}
	.listen {
		flex: none;
		padding: 6px;
		cursor: pointer;
	}
	.tags {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.empty {
		padding: 16px;
		border-radius: var(--r-m);
	}
</style>

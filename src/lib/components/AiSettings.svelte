<!--
	AI settings (docs/AI-PLAN.md): your account's provider keys (write-only),
	live model list from each provider's /models, per-feature model choice,
	prices, the monthly cap meter, and the second explanation language.
-->
<script lang="ts">
	import { i18n, t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import Skeleton from '#lib/components/Skeleton.svelte';
	import AccountSettings from '#lib/components/AccountSettings.svelte';
	import { onMount } from 'svelte';
	import * as api from '#lib/ai/client.ts';
	import type { Feature, FeatureModel, ModelInfo, ProviderKind } from '#lib/ai/contract.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { confirmDestructive, toast } from '#lib/ios/overlay.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';

	const LANG_CODES = ['th', 'zh', 'ko', 'vi', 'id', 'es', 'fr', 'de', 'pt', 'it', 'ru', 'nl', 'sv', 'hu', 'sl'];
	// language names in the interface language ("Thai" / "ไทย")
	const LANGS = $derived.by((): [string, string][] => {
		const names = new Intl.DisplayNames([i18n.tag], { type: 'language' });
		return [['', t('ai.langNone')], ...LANG_CODES.map((c): [string, string] => [c, names.of(c) ?? c])];
	});
	const FEATURES: { id: Feature; label: MessageKey; hint: MessageKey }[] = [
		{ id: 'fill', label: 'ai.feat.fill', hint: 'ai.feat.fillHint' },
		{ id: 'propose', label: 'ai.feat.propose', hint: 'ai.feat.proposeHint' },
		{ id: 'vision', label: 'ai.feat.vision', hint: 'ai.feat.visionHint' }
	];

	let models = $state<ModelInfo[]>([]);
	let features = $state<FeatureModel[]>([]);
	let loadingModels = $state(false);
	let busy = $state(false);
	let capInput = $state(5);

	// new key form
	let provider = $state<ProviderKind>('anthropic');
	let label = $state('');
	let baseUrl = $state('');
	let apiKey = $state('');


	onMount(async () => {
		await ai.refresh();
		if (ai.signedIn) await loadModels();
		if (ai.usage) capInput = ai.usage.capUsd;
	});

	/** Called by the Account section after sign-in, sign-up or sign-out. */
	export async function reload() {
		if (ai.signedIn) {
			await loadModels();
			if (ai.usage) capInput = ai.usage.capUsd;
		} else {
			models = [];
			features = [];
		}
	}

	async function guard<T>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> {
		busy = true;
		try {
			const r = await fn();
			if (ok) {
				haptic('success');
				toast(ok, '✓');
			}
			return r;
		} catch (e) {
			haptic('error');
			toast(e instanceof Error ? e.message : t('welcome.error'), '⚠️', 2600);
		} finally {
			busy = false;
		}
	}

	async function loadModels() {
		loadingModels = true;
		try {
			[models, features] = await Promise.all([api.listModels(), api.getFeatures()]);
		} catch (e) {
			toast(e instanceof Error ? e.message : t('ai.loadModelsFailed'), '⚠️');
		} finally {
			loadingModels = false;
		}
	}


	async function addKey() {
		if (!apiKey.trim()) return;
		const r = await guard(
			() =>
				api.addCredential({
					provider,
					label: label.trim() || (provider === 'anthropic' ? 'Anthropic' : t('ai.openaiCompat')),
					baseUrl: provider === 'openai-compatible' ? baseUrl.trim() : undefined,
					apiKey: apiKey.trim()
				}),
			t('ai.keySaved')
		);
		apiKey = '';
		if (r) {
			label = '';
			baseUrl = '';
			await ai.refresh();
			await loadModels();
		}
	}
	async function removeKey(id: number, name: string) {
		if (!(await confirmDestructive(t('ai.removeKeyTitle', { name }), t('ai.removeKeyBody'), t('ai.removeKey')))) return;
		await guard(() => api.deleteCredential(id), t('ai.keyRemoved'));
		await ai.refresh();
		await loadModels();
	}

	function current(f: Feature) {
		const m = features.find((x) => x.feature === f);
		return m ? `${m.credentialId}|${m.model}` : '';
	}
	async function choose(f: Feature, value: string) {
		const [cid, ...rest] = value.split('|');
		const fm = { feature: f, credentialId: Number(cid), model: rest.join('|') };
		await guard(() => api.setFeature(fm), t('ai.modelUpdated'));
		features = [...features.filter((x) => x.feature !== f), fm];
	}
	async function price(m: ModelInfo) {
		const i = prompt(t('ai.priceIn', { model: m.id }), m.price?.inputPerM.toString() ?? '');
		if (i === null) return;
		const o = prompt(t('ai.priceOut', { model: m.id }), m.price?.outputPerM.toString() ?? '');
		if (o === null || !Number.isFinite(+i) || !Number.isFinite(+o)) return;
		await guard(() => api.setPrice({ provider: m.provider, model: m.id, inputPerM: +i, outputPerM: +o }), t('ai.priceSaved'));
		await loadModels();
	}
	async function saveCap() {
		await guard(() => api.setCap(Math.max(0, capInput)), t('ai.capUpdated'));
		await ai.refresh();
	}

	const fmt = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`;
	const groups = $derived(
		ai.credentials.map((c) => ({ c, list: models.filter((m) => m.credentialId === c.id) }))
	);
</script>

<AccountSettings onchange={reload} />

<h2 class="eyebrow section" id="ai">{t('ai.section')}</h2>

<div class="glass group">
	<div class="item">
		<span class="stack" style:--gap="var(--space-px)">
			<span>{t('ai.explainLang')}</span>
			<span class="caption">{t('ai.explainLangBody')}</span>
		</span>
		<span class="spacer"></span>
		<select
			aria-label={t('ai.secondLang')}
			value={progress.settings.secondLang ?? ''}
			onchange={(e) => progress.saveSettings({ secondLang: e.currentTarget.value || null })}
		>
			{#each LANGS as [code, name]}<option value={code}>{name}</option>{/each}
		</select>
	</div>
</div>

{#if ai.signedIn}
	{#if ai.usage}
		{@const pct = Math.min(1, ai.usage.spentUsd / Math.max(ai.usage.capUsd, 0.0001))}
		<div class="glass group">
			<div class="item">
				<span class="stack" style:--gap="var(--space-1h)" style="flex:1">
					<span class="row"><span>{t('ai.thisMonth')}</span><span class="spacer"></span><b>{t('ai.spentOf', { spent: fmt(ai.usage.spentUsd), cap: fmt(ai.usage.capUsd) })}</b></span>
					<span class="meter" class:warn={pct > 0.8}><span style:width="{pct * 100}%"></span></span>
					<span class="caption">{t('ai.callsCap', { n: ai.usage.calls })}</span>
				</span>
			</div>
			<div class="item row">
				<span>{t('ai.cap')}</span><span class="spacer"></span>
				<input class="num" type="number" min="0" step="1" bind:value={capInput} aria-label={t('ai.capAria')} />
				<button class="btn ghost small" onclick={saveCap} disabled={busy}>{t('common.save')}</button>
			</div>
		</div>
	{/if}

	<h3 class="eyebrow section">{t('ai.keys')}</h3>
	<div class="glass group">
		{#each ai.credentials as c (c.id)}
			<div class="item">
				<span class="stack" style:--gap="var(--space-px)">
					<span>{c.label}</span>
					<span class="caption">{c.provider === 'anthropic' ? 'Anthropic' : c.baseUrl} · ••••{c.last4}</span>
				</span>
				<span class="spacer"></span>
				<button class="btn ghost small danger" onclick={() => removeKey(c.id, c.label)} disabled={busy}>{t('account.remove')}</button>
			</div>
		{:else}
			<div class="item caption">{t('ai.noKeys')}</div>
		{/each}
		<div class="item add">
			<div class="row">
				<select bind:value={provider} aria-label={t('ai.provider')}>
					<option value="anthropic">Anthropic</option>
					<option value="openai-compatible">{t('ai.openaiCompat')}</option>
				</select>
				<input type="text" placeholder={t('ai.labelOptional')} bind:value={label} />
			</div>
			{#if provider === 'openai-compatible'}
				<input type="text" placeholder={t('ai.baseUrl')} bind:value={baseUrl} autocapitalize="off" />
			{/if}
			<div class="row">
				<input type="password" placeholder={t('ai.apiKey')} bind:value={apiKey} autocomplete="off" />
				<button class="btn small" onclick={addKey} disabled={busy || !apiKey.trim()}>{t('common.save')}</button>
			</div>
		</div>
	</div>

	{#if ai.credentials.length}
		<h3 class="eyebrow section">{t('ai.models')}</h3>
		<div class="glass group">
			{#each FEATURES as f}
				<div class="item feature">
					<span class="stack" style:--gap="var(--space-px)"><span>{t(f.label)}</span><span class="caption">{t(f.hint)}</span></span>
					<select aria-label={t('ai.modelFor', { feature: t(f.label) })} value={current(f.id)} onchange={(e) => choose(f.id, e.currentTarget.value)} disabled={loadingModels}>
						{#each groups as g}
							<optgroup label={g.c.label}>
								{#each g.list.filter((m) => f.id !== 'vision' || m.vision !== false) as m}
									<option value="{g.c.id}|{m.id}" disabled={!m.price}>{m.label}{m.price ? '' : ' 🔒'}</option>
								{/each}
							</optgroup>
						{/each}
					</select>
				</div>
			{/each}
			<details class="item">
				<summary class="caption">{t('ai.allModels', { n: models.length })}</summary>
				{#if loadingModels && !models.length}<Skeleton variant="line" count={4} label={t('ai.loadingModels')} />{/if}
				<div class="model-list">
					{#each models as m}
						<div class="model">
							<span class="stack" style:--gap="1px">
								<span class="mono">{m.id}</span>
								<span class="caption">
									{m.contextTokens ? (m.contextTokens >= 1_000_000 ? `${+(m.contextTokens / 1_000_000).toFixed(1)}M ctx` : `${Math.round(m.contextTokens / 1000)}K ctx`) : ''}
									{m.vision ? '· 👁 vision' : ''}
									{m.structured ? '· {} structured' : ''}
								</span>
							</span>
							<span class="spacer"></span>
							<button class="price" onclick={() => price(m)}>
								{m.price ? `$${m.price.inputPerM} / $${m.price.outputPerM}` : `🔒 ${t('ai.setPrice')}`}
								{#if m.priceSource}<span class="caption">{m.priceSource}</span>{/if}
							</button>
						</div>
					{/each}
				</div>
				<button class="btn ghost small" onclick={loadModels} disabled={loadingModels}>{loadingModels ? t('common.loading') : t('common.refresh')}</button>
			</details>
		</div>
	{/if}
{/if}

<style>
	.section {
		margin: var(--space-4) var(--space-1h) var(--space-px);
	}
	.group {
		padding: var(--space-1) 0;
		border-radius: var(--r-m);
	}
	.item {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		min-height: 48px;
	}
	.item + .item {
		border-top: 0.5px solid var(--hairline);
	}
	/* .item is a flex row; these two must stack full-width */
	details.item {
		display: block;
	}
	/* add-key form: evenly spaced rows of equal-height controls */
	.item.add {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: var(--space-3);
	}
	.add .row {
		--gap: var(--space-3);
		align-items: stretch;
	}
	.add select {
		flex: none;
		max-width: none;
	}
	.add input {
		flex: 1;
		min-width: 0;
	}
	.add .btn {
		flex: none;
		min-height: 48px;
	}
	/* one look for every control in this section */
	select,
	.num,
	.add input,
	input[type='password'],
	.item input[type='text'] {
		font: inherit;
		font-size: 1rem;
		height: 48px;
		min-height: 48px;
		padding: 0 var(--space-4);
		border-radius: 12px;
		border: 0.5px solid var(--hairline);
		background: var(--glass-strong);
		color: var(--ink);
		box-sizing: border-box;
	}
	select {
		padding-right: var(--space-8);
		appearance: none;
		-webkit-appearance: none;
		background-image: linear-gradient(45deg, transparent 50%, var(--ink-2) 50%),
			linear-gradient(135deg, var(--ink-2) 50%, transparent 50%);
		background-position:
			calc(100% - 18px) 21px,
			calc(100% - 13px) 21px;
		background-size: 5px 5px;
		background-repeat: no-repeat;
		text-overflow: ellipsis;
	}
	/* model pickers: label above a full-width picker */
	.item.feature {
		flex-direction: column;
		align-items: stretch;
		gap: var(--space-2);
	}
	.feature select {
		width: 100%;
		max-width: none;
	}
	select {
		max-width: 52vw;
	}
	.num {
		width: 88px;
	}
	.meter {
		height: 8px;
		border-radius: 4px;
		background: var(--hairline);
		overflow: hidden;
	}
	.meter span {
		display: block;
		height: 100%;
		background: var(--success);
		transition: width 600ms var(--spring);
	}
	.meter.warn span {
		background: var(--warn);
	}
	.mono {
		font-family: ui-monospace, monospace;
		font-size: 0.8125rem;
		word-break: break-all;
	}
	summary {
		cursor: pointer;
		min-height: 32px;
	}
	.model-list {
		margin: var(--space-2) 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.model {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.model > .stack {
		flex: 1;
		min-width: 0;
	}
	.model .mono {
		word-break: normal;
		overflow-wrap: anywhere;
	}
	.price {
		flex: none;
	}
	.price {
		border: 0.5px solid var(--hairline);
		background: var(--glass-strong);
		border-radius: 10px;
		padding: var(--space-1h) var(--space-3);
		font-size: 0.8125rem;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		cursor: pointer;
		min-height: 44px;
	}
	.danger {
		color: var(--danger);
	}
</style>

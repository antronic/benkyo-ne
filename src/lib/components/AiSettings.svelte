<!--
	AI settings (docs/AI-PLAN.md): your account's provider keys (write-only),
	live model list from each provider's /models, per-feature model choice,
	prices, the monthly cap meter, and the second explanation language.
-->
<script lang="ts">
	import { fmtDate, i18n, t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { Badge, Button, FieldRow, ListGroup, ListRow, Notice, Segmented, Select, Skeleton, Spinner, TextField } from '#lib/ui/index.ts';
	import AccountSettings from '#lib/components/AccountSettings.svelte';
	import { onMount } from 'svelte';
	import * as api from '#lib/ai/client.ts';
	import type { AiSource, Feature, FeatureModel, ModelInfo, ProviderKind } from '#lib/ai/contract.ts';
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
	/** Which action is running, so its own button shows the spinner. */
	let pending = $state('');
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

	async function guard<T>(fn: () => Promise<T>, ok?: string, key = ''): Promise<T | undefined> {
		busy = true;
		pending = key;
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
			pending = '';
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
			t('ai.keySaved'),
			'add'
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
		await guard(() => api.deleteCredential(id), t('ai.keyRemoved'), `rm${id}`);
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
		await guard(() => api.setPrice({ provider: m.provider, model: m.id, inputPerM: +i, outputPerM: +o }), t('ai.priceSaved'), `price${m.credentialId}|${m.id}`);
		await loadModels();
	}
	/** Switch between the package's AI and the learner's own key. */
	async function chooseSource(prefer: AiSource) {
		if (ai.managed?.prefer === prefer) return;
		const r = await guard(() => api.setAiSource(prefer), t('managed.switched'), 'source');
		if (r) ai.managed = r;
	}
	const day = (ms: number) => fmtDate(ms, { day: 'numeric', month: 'short', year: 'numeric' });
	const sourceOptions = $derived<{ value: AiSource; label: string; disabled?: boolean }[]>([
		{ value: 'package', label: t('managed.usePackage'), disabled: busy },
		{ value: 'own', label: t('managed.useOwn'), disabled: busy || ai.credentials.length === 0 }
	]);
	const inUse = $derived(
		!ai.managed?.active
			? t('managed.inUseNone')
			: ai.managed.active === 'package'
				? t('managed.inUsePackage', { name: ai.managed.plan?.name ?? '' })
				: t('managed.inUseOwn')
	);

	async function saveCap() {
		await guard(() => api.setCap(Math.max(0, capInput)), t('ai.capUpdated'), 'cap');
		await ai.refresh();
	}

	const fmt = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`;
	const groups = $derived(
		ai.credentials.map((c) => ({ c, list: models.filter((m) => m.credentialId === c.id) }))
	);
	/** Model picker options for one feature, one <optgroup> per key. */
	const modelOptions = (f: Feature) =>
		groups.flatMap((g) =>
			g.list
				.filter((m) => f !== 'vision' || m.vision !== false)
				.map((m) => ({ value: `${g.c.id}|${m.id}`, label: `${m.label}${m.price ? '' : ' 🔒'}`, group: g.c.label, disabled: !m.price }))
		);
	const langOptions = $derived(LANGS.map(([value, label]) => ({ value, label })));
	const providerOptions = $derived<{ value: ProviderKind; label: string }[]>([
		{ value: 'anthropic', label: 'Anthropic' },
		{ value: 'openai-compatible', label: t('ai.openaiCompat') }
	]);
</script>

<AccountSettings onchange={reload} />

<h2 class="eyebrow section" id="ai">{t('ai.section')}</h2>

<ListGroup>
	<ListRow title={t('ai.explainLang')} subtitle={t('ai.explainLangBody')}>
		{#snippet trailing()}
			<span class="pick-cap">
				<Select
					label={t('ai.secondLang')}
					options={langOptions}
					value={progress.settings.secondLang ?? ''}
					onchange={(v) => progress.saveSettings({ secondLang: v || null })}
				/>
			</span>
		{/snippet}
	</ListRow>
</ListGroup>

{#if ai.signedIn}
	{#if !ai.checked}
		<Skeleton variant="row" count={2} label={t('managed.loading')} />
	{:else if ai.managed?.plan}
		{@const m = ai.managed}
		{@const plan = m.plan!}
		{@const pct = Math.min(1, m.spentUsd / Math.max(m.allowanceUsd, 0.0001))}
		<h3 class="eyebrow section">{t('managed.section')}</h3>
		{#if m.blocked === 'allowance'}
			<Notice tone="warning" title={t('managed.usedUpTitle')}>
				{ai.credentials.length ? t('managed.usedUp', { date: day(m.resetsAt) }) : t('managed.usedUpNoKey', { date: day(m.resetsAt) })}
			</Notice>
		{/if}
		<ListGroup>
			<ListRow title={t('managed.included', { name: plan.name })} subtitle={plan.endsAt ? t('managed.until', { date: day(plan.endsAt) }) : undefined}>
				{#snippet trailing()}<Badge tone="accent">✨ {plan.name}</Badge>{/snippet}
			</ListRow>
			<ListRow>
				<span class="stack" style:--gap="var(--space-1h)">
					<span class="row"><span>{t('managed.allowance')}</span><span class="spacer"></span><b class="nowrap">{t('managed.allowanceOf', { spent: fmt(m.spentUsd), cap: fmt(m.allowanceUsd) })}</b></span>
					<span class="meter" class:warn={pct > 0.8}><span style:width="{pct * 100}%"></span></span>
					<span class="caption">{t('managed.resets', { n: m.calls, date: day(m.resetsAt) })}</span>
				</span>
			</ListRow>
			<ListRow>
				<span class="stack source" style:--gap="var(--space-2)" aria-busy={pending === 'source'}>
					<span class="row"><span>{t('managed.useFrom')}</span><span class="spacer"></span>{#if pending === 'source'}<Spinner size="sm" label={t('common.loading')} />{/if}</span>
					<Segmented label={t('managed.useAria')} options={sourceOptions} value={m.prefer} onchange={chooseSource} />
					<span class="caption"><b>{t('managed.inUse', { what: inUse })}</b></span>
					<span class="caption">
						{ai.credentials.length === 0 ? t('managed.needKey') : m.prefer === 'own' ? t('managed.ownHint') : t('managed.packageHint')}
					</span>
				</span>
			</ListRow>
			{#each FEATURES as f}
				{@const pm = m.models.find((x) => x.feature === f.id)}
				<ListRow title={t(f.label)}>
					{#snippet trailing()}<span class="caption">{pm ? pm.label : t('managed.notIncluded')}</span>{/snippet}
				</ListRow>
			{/each}
		</ListGroup>
	{:else if ai.managed?.ended}
		<Notice tone="warning" title={t('managed.endedTitle', { name: ai.managed.ended.name })}>
			{t('managed.ended', { date: day(ai.managed.ended.endedAt) })}
		</Notice>
	{/if}

	{#if ai.usage}
		{@const pct = Math.min(1, ai.usage.spentUsd / Math.max(ai.usage.capUsd, 0.0001))}
		<ListGroup>
			<ListRow>
				<span class="stack" style:--gap="var(--space-1h)">
					<span class="row"><span>{ai.managed?.plan ? t('ai.ownThisMonth') : t('ai.thisMonth')}</span><span class="spacer"></span><b>{t('ai.spentOf', { spent: fmt(ai.usage.spentUsd), cap: fmt(ai.usage.capUsd) })}</b></span>
					<span class="meter" class:warn={pct > 0.8}><span style:width="{pct * 100}%"></span></span>
					<span class="caption">{t('ai.callsCap', { n: ai.usage.calls })}</span>
				</span>
			</ListRow>
			<ListRow title={t('ai.cap')}>
				{#snippet trailing()}
					<span class="cap">
						<FieldRow size="sm">
							<TextField class="num" type="number" min="0" step="1" bind:value={capInput} aria-label={t('ai.capAria')} />
							<Button variant="ghost" onclick={saveCap} disabled={busy} busy={pending === 'cap'}>{t('common.save')}</Button>
						</FieldRow>
					</span>
				{/snippet}
			</ListRow>
		</ListGroup>
	{/if}

	<h3 class="eyebrow section">{t('ai.keys')}</h3>
	<ListGroup>
		{#each ai.credentials as c (c.id)}
			<ListRow title={c.label} subtitle="{c.provider === 'anthropic' ? 'Anthropic' : c.baseUrl} · ••••{c.last4}">
				{#snippet trailing()}
					<Button variant="ghost-danger" size="sm" onclick={() => removeKey(c.id, c.label)} disabled={busy} busy={pending === `rm${c.id}`}>{t('account.remove')}</Button>
				{/snippet}
			</ListRow>
		{:else}
			<ListRow subtitle={t('ai.noKeys')} />
		{/each}
		<ListRow>
			<div class="add">
				<FieldRow>
					<Select label={t('ai.provider')} options={providerOptions} bind:value={provider} />
					<TextField grow placeholder={t('ai.labelOptional')} aria-label={t('ai.labelOptional')} bind:value={label} />
				</FieldRow>
				{#if provider === 'openai-compatible'}
					<TextField placeholder={t('ai.baseUrl')} aria-label={t('ai.baseUrl')} bind:value={baseUrl} autocapitalize="off" />
				{/if}
				<FieldRow as="form" onsubmit={addKey}>
					<TextField grow type="password" placeholder={t('ai.apiKey')} aria-label={t('ai.apiKey')} bind:value={apiKey} autocomplete="off" />
					<Button type="submit" disabled={busy || !apiKey.trim()} busy={pending === 'add'}>{t('common.save')}</Button>
				</FieldRow>
			</div>
		</ListRow>
	</ListGroup>

	{#if ai.credentials.length}
		<h3 class="eyebrow section">{t('ai.models')}</h3>
		<ListGroup>
			{#each FEATURES as f}
				<ListRow title={t(f.label)} subtitle={t(f.hint)}>
					<span class="model-pick">
						{#if loadingModels && !models.length}
							<Skeleton variant="line" count={1} label={t('ai.loadingModels')} />
						{:else}
							<Select
								block
								label={t('ai.modelFor', { feature: t(f.label) })}
								options={modelOptions(f.id)}
								value={current(f.id)}
								onchange={(v) => choose(f.id, v)}
								disabled={loadingModels}
							/>
						{/if}
					</span>
				</ListRow>
			{/each}
			<ListRow>
				<details>
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
								<Button variant="ghost" size="sm" class="price" onclick={() => price(m)} disabled={busy} busy={pending === `price${m.credentialId}|${m.id}`}>
									<span class="price-text">
										{m.price ? `$${m.price.inputPerM} / $${m.price.outputPerM}` : `🔒 ${t('ai.setPrice')}`}
										{#if m.priceSource}<span class="caption">{m.priceSource}</span>{/if}
									</span>
								</Button>
							</div>
						{/each}
					</div>
					<Button variant="ghost" size="sm" onclick={loadModels} busy={loadingModels}>{loadingModels ? t('common.loading') : t('common.refresh')}</Button>
				</details>
			</ListRow>
		</ListGroup>
	{/if}
{/if}

<style>
	.section {
		margin: var(--space-4) var(--space-1h) var(--space-px);
	}
	/* long language names: keep the picker from crowding the row title */
	.pick-cap {
		display: flex;
		max-width: 52vw;
	}
	.cap {
		display: flex;
	}
	.source {
		width: 100%;
	}
	.nowrap {
		white-space: nowrap;
	}
	.cap :global(.num) {
		width: 88px;
	}
	/* add-key form: evenly spaced rows of equal-height controls */
	.add {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.model-pick {
		display: block;
		margin-top: var(--space-2);
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
		word-break: normal;
		overflow-wrap: anywhere;
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
	.model :global(.price) {
		flex: none;
		min-height: 44px;
		height: auto;
		font-size: 0.8125rem;
	}
	.price-text {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
	}
</style>

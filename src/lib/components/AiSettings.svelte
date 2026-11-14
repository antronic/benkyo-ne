<!--
	AI settings (docs/AI-PLAN.md): passkey, provider keys (write-only),
	live model list from each provider's /models, per-feature model choice,
	prices, the monthly cap meter, and the second explanation language.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import * as api from '#lib/ai/client.ts';
	import type { Feature, FeatureModel, ModelInfo, ProviderKind } from '#lib/ai/contract.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { confirmDestructive, toast } from '#lib/ios/overlay.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';

	const LANGS: [string, string][] = [
		['', 'None (English only)'],
		['th', 'Thai'],
		['zh', 'Chinese'],
		['ko', 'Korean'],
		['vi', 'Vietnamese'],
		['id', 'Indonesian'],
		['es', 'Spanish'],
		['fr', 'French'],
		['de', 'German'],
		['pt', 'Portuguese'],
		['it', 'Italian'],
		['ru', 'Russian'],
		['nl', 'Dutch'],
		['sv', 'Swedish'],
		['hu', 'Hungarian'],
		['sl', 'Slovenian']
	];
	const FEATURES: { id: Feature; label: string; hint: string }[] = [
		{ id: 'fill', label: 'Card & pack content', hint: 'Hooks, examples, translations' },
		{ id: 'propose', label: 'Suggestions', hint: 'English & scenario modes' },
		{ id: 'vision', label: 'Screenshots', hint: 'Needs a model that reads images' }
	];

	let models = $state<ModelInfo[]>([]);
	let features = $state<FeatureModel[]>([]);
	let loadingModels = $state(false);
	let busy = $state(false);
	let recoveryCode = $state<string | null>(null);
	let setupToken = $state('');
	let recoverInput = $state('');
	let capInput = $state(5);

	// new key form
	let provider = $state<ProviderKind>('anthropic');
	let label = $state('');
	let baseUrl = $state('');
	let apiKey = $state('');

	const supported = typeof window !== 'undefined' && 'PublicKeyCredential' in window;

	onMount(async () => {
		await ai.refresh();
		if (ai.signedIn) await loadModels();
		if (ai.usage) capInput = ai.usage.capUsd;
	});

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
			toast(e instanceof Error ? e.message : 'Something went wrong', '⚠️', 2600);
		} finally {
			busy = false;
		}
	}

	async function loadModels() {
		loadingModels = true;
		try {
			[models, features] = await Promise.all([api.listModels(), api.getFeatures()]);
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Couldn’t load models', '⚠️');
		} finally {
			loadingModels = false;
		}
	}

	async function register() {
		const r = await guard(() => api.registerPasskey(ai.registered ? undefined : setupToken.trim()), 'Passkey saved');
		if (r) {
			recoveryCode = r.recoveryCode ?? null;
			await guard(() => api.signIn());
			await ai.refresh();
			await loadModels();
		}
	}
	async function signIn() {
		await guard(() => api.signIn(), 'Signed in');
		await ai.refresh();
		if (ai.signedIn) await loadModels();
	}
	async function signOut() {
		await guard(() => api.signOut(), 'Signed out');
		await ai.refresh();
	}
	async function useRecovery() {
		const r = await guard(() => api.recover(recoverInput.trim()), 'Recovered, now add a new passkey');
		if (r) {
			recoverInput = '';
			await ai.refresh();
		}
	}

	async function addKey() {
		if (!apiKey.trim()) return;
		const r = await guard(
			() =>
				api.addCredential({
					provider,
					label: label.trim() || (provider === 'anthropic' ? 'Anthropic' : 'OpenAI-compatible'),
					baseUrl: provider === 'openai-compatible' ? baseUrl.trim() : undefined,
					apiKey: apiKey.trim()
				}),
			'Key saved (encrypted)'
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
		if (!(await confirmDestructive(`Remove “${name}”?`, 'The encrypted key is deleted from your Worker.', 'Remove Key'))) return;
		await guard(() => api.deleteCredential(id), 'Key removed');
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
		await guard(() => api.setFeature(fm), 'Model updated');
		features = [...features.filter((x) => x.feature !== f), fm];
	}
	async function price(m: ModelInfo) {
		const i = prompt(`Input price for ${m.id} (USD per million tokens)`, m.price?.inputPerM.toString() ?? '');
		if (i === null) return;
		const o = prompt(`Output price for ${m.id} (USD per million tokens)`, m.price?.outputPerM.toString() ?? '');
		if (o === null || !Number.isFinite(+i) || !Number.isFinite(+o)) return;
		await guard(() => api.setPrice({ provider: m.provider, model: m.id, inputPerM: +i, outputPerM: +o }), 'Price saved');
		await loadModels();
	}
	async function saveCap() {
		await guard(() => api.setCap(Math.max(0, capInput)), 'Cap updated');
		await ai.refresh();
	}

	const fmt = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`;
	const groups = $derived(
		ai.credentials.map((c) => ({ c, list: models.filter((m) => m.credentialId === c.id) }))
	);
</script>

<h2 class="eyebrow section" id="ai">AI assistant</h2>

<div class="glass group">
	<div class="item">
		<span class="stack" style:--gap="2px">
			<span>Explanation language</span>
			<span class="caption">English plus a second language for meanings, hooks and examples.</span>
		</span>
		<span class="spacer"></span>
		<select
			aria-label="Second language"
			value={progress.settings.secondLang ?? ''}
			onchange={(e) => progress.saveSettings({ secondLang: e.currentTarget.value || null })}
		>
			{#each LANGS as [code, name]}<option value={code}>{name}</option>{/each}
		</select>
	</div>
</div>

<div class="glass group">
	{#if !supported}
		<div class="item caption">This browser doesn’t support passkeys.</div>
	{:else if ai.signedIn}
		<div class="item">
			<span class="stack" style:--gap="2px"><span>Signed in with passkey</span><span class="caption">AI requests go through your Worker.</span></span>
			<span class="spacer"></span>
			<button class="btn ghost small" onclick={signOut} disabled={busy}>Sign out</button>
		</div>
		<div class="item">
			<span class="caption">Add a passkey for another device</span><span class="spacer"></span>
			<button class="btn ghost small" onclick={register} disabled={busy}>Add passkey</button>
		</div>
	{:else if ai.registered}
		<div class="item"><button class="btn block" onclick={signIn} disabled={busy}>Sign in with passkey</button></div>
		<details class="item">
			<summary class="caption">Lost your passkey?</summary>
			<div class="row" style="margin-top:8px">
				<input type="text" placeholder="Recovery code" bind:value={recoverInput} autocomplete="off" />
				<button class="btn ghost small" onclick={useRecovery} disabled={busy}>Use</button>
			</div>
		</details>
	{:else}
		<div class="item caption">
			Set up AI once: create a passkey (Face ID / Touch ID). Enter the setup token you set as a Worker secret.
		</div>
		<div class="item row">
			<input type="text" placeholder="Setup token" bind:value={setupToken} autocomplete="off" autocapitalize="off" />
			<button class="btn small" onclick={register} disabled={busy || !setupToken.trim()}>Create passkey</button>
		</div>
	{/if}
	{#if recoveryCode}
		<div class="item recovery">
			<span class="stack" style:--gap="4px">
				<b>Recovery code: shown once</b>
				<code>{recoveryCode}</code>
				<span class="caption">Store it in your password manager. It lets you add a new passkey if you lose this one.</span>
			</span>
			<button class="btn ghost small" onclick={() => (recoveryCode = null)}>Done</button>
		</div>
	{/if}
</div>

{#if ai.signedIn}
	{#if ai.usage}
		{@const pct = Math.min(1, ai.usage.spentUsd / Math.max(ai.usage.capUsd, 0.0001))}
		<div class="glass group">
			<div class="item">
				<span class="stack" style:--gap="6px" style="flex:1">
					<span class="row"><span>This month</span><span class="spacer"></span><b>{fmt(ai.usage.spentUsd)} of {fmt(ai.usage.capUsd)}</b></span>
					<span class="meter" class:warn={pct > 0.8}><span style:width="{pct * 100}%"></span></span>
					<span class="caption">{ai.usage.calls} calls · AI stops at the cap, it never goes over.</span>
				</span>
			</div>
			<div class="item row">
				<span>Monthly cap (USD)</span><span class="spacer"></span>
				<input class="num" type="number" min="0" step="1" bind:value={capInput} aria-label="Monthly cap" />
				<button class="btn ghost small" onclick={saveCap} disabled={busy}>Save</button>
			</div>
		</div>
	{/if}

	<h3 class="eyebrow section">API keys</h3>
	<div class="glass group">
		{#each ai.credentials as c (c.id)}
			<div class="item">
				<span class="stack" style:--gap="2px">
					<span>{c.label}</span>
					<span class="caption">{c.provider === 'anthropic' ? 'Anthropic' : c.baseUrl} · ••••{c.last4}</span>
				</span>
				<span class="spacer"></span>
				<button class="btn ghost small danger" onclick={() => removeKey(c.id, c.label)} disabled={busy}>Remove</button>
			</div>
		{:else}
			<div class="item caption">No keys yet. Keys are encrypted on your Worker and can’t be read back.</div>
		{/each}
		<div class="item add">
			<div class="row">
				<select bind:value={provider} aria-label="Provider">
					<option value="anthropic">Anthropic</option>
					<option value="openai-compatible">OpenAI-compatible</option>
				</select>
				<input type="text" placeholder="Label (optional)" bind:value={label} />
			</div>
			{#if provider === 'openai-compatible'}
				<input type="text" placeholder="Base URL, e.g. https://openrouter.ai/api/v1" bind:value={baseUrl} autocapitalize="off" />
			{/if}
			<div class="row">
				<input type="password" placeholder="API key" bind:value={apiKey} autocomplete="off" />
				<button class="btn small" onclick={addKey} disabled={busy || !apiKey.trim()}>Save</button>
			</div>
		</div>
	</div>

	{#if ai.credentials.length}
		<h3 class="eyebrow section">Models</h3>
		<div class="glass group">
			{#each FEATURES as f}
				<div class="item feature">
					<span class="stack" style:--gap="2px"><span>{f.label}</span><span class="caption">{f.hint}</span></span>
					<select aria-label="Model for {f.label}" value={current(f.id)} onchange={(e) => choose(f.id, e.currentTarget.value)} disabled={loadingModels}>
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
				<summary class="caption">All models ({models.length}) · fetched live from each provider</summary>
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
								{m.price ? `$${m.price.inputPerM} / $${m.price.outputPerM}` : '🔒 set price'}
								{#if m.priceSource}<span class="caption">{m.priceSource}</span>{/if}
							</button>
						</div>
					{/each}
				</div>
				<button class="btn ghost small" onclick={loadModels} disabled={loadingModels}>{loadingModels ? 'Loading…' : 'Refresh'}</button>
			</details>
		</div>
	{/if}
{/if}

<style>
	.section {
		margin: 16px 6px 2px;
	}
	.group {
		padding: 4px 0;
		border-radius: var(--r-m);
	}
	.item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
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
		gap: 10px;
	}
	.add .row {
		--gap: 10px;
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
		padding: 0 14px;
		border-radius: 12px;
		border: 0.5px solid var(--hairline);
		background: var(--glass-strong);
		color: var(--ink);
		box-sizing: border-box;
	}
	select {
		padding-right: 32px;
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
		gap: 8px;
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
	.recovery {
		background: color-mix(in srgb, var(--warn) 14%, transparent);
	}
	code,
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
		margin: 8px 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.model {
		display: flex;
		align-items: center;
		gap: 8px;
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
		padding: 6px 10px;
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

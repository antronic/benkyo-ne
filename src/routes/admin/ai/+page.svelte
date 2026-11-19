<!--
	Fleet console: AI providers. The operator's own provider keys, which pay
	for the managed AI that packages include. A key is only kept after it
	lists the provider's models; it's encrypted and never shown again.
	Every change asks for a passkey tap and goes in the audit log.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import LargeTitle from '#lib/components/LargeTitle.svelte';
	import ErrorCard from '#lib/admin/ErrorCard.svelte';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { confirmDestructive, toast } from '#lib/ios/overlay.svelte.ts';
	import { AdminError, addProvider, getProviders, patchProvider, removeProvider } from '#lib/admin/client.ts';
	import type { AdminProvider, AdminProviders } from '#lib/admin/contract.ts';
	import '#lib/admin/admin.css';

	ui.hue = 200;
	let data = $state<AdminProviders | null>(null);
	let error = $state<AdminError | null>(null);
	let busy = $state(false);

	// add form
	let preset = $state('anthropic');
	let label = $state('');
	let baseUrl = $state('');
	let apiKey = $state('');
	// replace-key form, one provider at a time
	let rekey = $state<{ id: number; key: string } | null>(null);

	async function load() {
		error = null;
		try {
			data = await getProviders();
		} catch (e) {
			error = e instanceof AdminError ? e : new AdminError(0, 'server', String(e));
		}
	}
	onMount(load);

	const chosen = $derived(data?.presets.find((p) => p.id === preset));
	const presetName = (id: string) => data?.presets.find((p) => p.id === id)?.name ?? id;

	async function run(fn: () => Promise<AdminProviders>, done: string) {
		busy = true;
		try {
			data = await fn();
			toast(done, '✓');
			return true;
		} catch (err) {
			toast(err instanceof AdminError ? err.message : 'Passkey confirmation cancelled', '⚠️', 3200);
			return false;
		} finally {
			busy = false;
		}
	}

	async function add(e: SubmitEvent) {
		e.preventDefault();
		const ok = await run(
			() => addProvider({ preset, apiKey, label: label.trim() || undefined, baseUrl: preset === 'custom' ? baseUrl : undefined }),
			'Provider added'
		);
		if (ok) {
			apiKey = '';
			label = '';
			baseUrl = '';
		}
	}

	async function saveKey(e: SubmitEvent) {
		e.preventDefault();
		if (!rekey) return;
		const { id, key } = rekey;
		if (await run(() => patchProvider(id, { apiKey: key }), 'Key replaced')) rekey = null;
	}

	const toggle = (p: AdminProvider) => run(() => patchProvider(p.id, { enabled: !p.enabled }), p.enabled ? 'Turned off' : 'Turned on');

	async function remove(p: AdminProvider) {
		if (!(await confirmDestructive(`Remove ${p.label}?`, 'Its encrypted key is deleted. Packages that use it have to drop its models first.', 'Remove'))) return;
		await run(() => removeProvider(p.id), 'Provider removed');
	}

	const time = (t: number) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
</script>

<svelte:head><title>AI providers · Fleet</title></svelte:head>

<main class="page stack fleet" style:--gap="8px">
	<LargeTitle title="AI providers" />

	{#if error}
		<ErrorCard {error} onretry={load} />
	{:else if !data}
		<div class="glass group" aria-busy="true"><div class="item caption">Loading…</div></div>
	{:else}
		{#if !data.canSaveKeys}
			<div class="glass group" role="alert">
				<div class="item col">
					<b class="warn-text">Keys can’t be saved yet</b>
					<span class="caption">Set the AI_MASTER_KEY Worker secret first (docs/FLEET.md). It encrypts every provider key.</span>
				</div>
			</div>
		{/if}

		{#each data.providers as p, i (p.id)}
			<div class="glass group rise" style:--i={i}>
				<div class="item">
					<span class="stack" style:--gap="2px" style:min-width="0">
						<b class="ellipsis">{p.label}</b>
						<span class="caption">{presetName(p.preset)} · key ending {p.last4}</span>
					</span>
					<span class="spacer"></span>
					<span class="pill" class:off={!p.enabled || !!p.checkError}>{!p.enabled ? 'Off' : p.checkError ? 'Not answering' : 'On'}</span>
				</div>
				<a class="item nav" href="/admin/ai/{p.id}">
					<span class="stack" style:--gap="2px">
						<span>{p.modelCount === null ? 'Models' : `${p.modelCount} models`}</span>
						{#if p.checkError}
							<span class="caption warn-text">{p.checkError}</span>
						{:else if p.checkedAt}
							<span class="caption">Listed {time(p.checkedAt)}</span>
						{/if}
					</span>
					<span class="spacer"></span>
					<span class="caption" aria-hidden="true">›</span>
				</a>
				<div class="item">
					<span class="caption">{p.usedBy.length ? `In ${p.usedBy.join(', ')}` : 'Not in a package yet'}</span>
				</div>
				{#if rekey?.id === p.id}
					<form class="item col" onsubmit={saveKey}>
						<label class="caption" for="rekey-{p.id}">New API key</label>
						<input id="rekey-{p.id}" type="password" bind:value={rekey.key} autocomplete="off" spellcheck="false" required minlength="8" />
						<span class="row" style:gap="8px">
							<span class="spacer"></span>
							<button type="button" class="btn small ghost" onclick={() => (rekey = null)} disabled={busy}>Cancel</button>
							<button class="btn small" disabled={busy}>{busy ? 'Checking…' : 'Check and save'}</button>
						</span>
					</form>
				{:else}
					<div class="item" style:gap="16px">
						<button class="link" onclick={() => (rekey = { id: p.id, key: '' })} disabled={busy}>Replace key</button>
						<button class="link" onclick={() => toggle(p)} disabled={busy}>{p.enabled ? 'Turn off' : 'Turn on'}</button>
						<span class="spacer"></span>
						<button class="link danger" onclick={() => remove(p)} disabled={busy}>Remove</button>
					</div>
				{/if}
			</div>
		{/each}

		<h2 class="eyebrow section">{data.providers.length ? 'Add another provider' : 'Add your first provider'}</h2>
		<form class="glass group" onsubmit={add}>
			<div class="item col">
				<span class="caption">Provider</span>
				<span class="chips" role="group" aria-label="Provider">
					{#each data.presets as pr (pr.id)}
						<button type="button" class="chip" aria-pressed={preset === pr.id} onclick={() => (preset = pr.id)}>{pr.name}</button>
					{/each}
				</span>
			</div>
			{#if preset === 'custom'}
				<div class="item col">
					<label class="caption" for="base">Base URL</label>
					<input id="base" type="url" bind:value={baseUrl} placeholder="https://llm.example.com/v1" required spellcheck="false" />
				</div>
			{/if}
			<div class="item col">
				<label class="caption" for="label">Name {preset === 'custom' ? '' : '(optional)'}</label>
				<input id="label" type="text" bind:value={label} maxlength="40" placeholder={preset === 'custom' ? 'My server' : chosen?.name} required={preset === 'custom'} />
			</div>
			<div class="item col">
				<label class="caption" for="key">API key</label>
				<input id="key" type="password" bind:value={apiKey} autocomplete="off" spellcheck="false" required minlength="8" />
				{#if chosen?.keysUrl}<span class="caption"><a href={chosen.keysUrl} target="_blank" rel="noreferrer">Get a {chosen.name} key ↗</a></span>{/if}
			</div>
			<div class="item">
				<span class="caption">Benkyo lists the provider’s models with this key before keeping it. It’s encrypted and never shown again.</span>
				<span class="spacer"></span>
				<button class="btn small" disabled={busy || !data.canSaveKeys}>{busy ? 'Checking…' : 'Check and save'}</button>
			</div>
		</form>

		<p class="caption foot">
			These keys pay for the managed AI in <a href="/admin/packages">packages</a>. Learners’ own keys stay separate. Changes ask for your passkey and go in the audit log.
		</p>
	{/if}
</main>

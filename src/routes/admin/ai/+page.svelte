<!--
	Fleet console: AI providers. The operator's own provider keys, which pay
	for the managed AI that packages include. A key is only kept after it
	lists the provider's models; it's encrypted and never shown again.
	Every change asks for a passkey tap and goes in the audit log.
	Built only from #lib/ui components (the /design catalog).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import LargeTitle from '#lib/ui/LargeTitle.svelte';
	import ErrorCard from '#lib/admin/ErrorCard.svelte';
	import { Badge, Button, Card, Chip, ListGroup, ListRow, Notice, SectionHeader, TextField } from '#lib/ui/index.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { confirmDestructive, toast } from '#lib/ios/overlay.svelte.ts';
	import { AdminError, addProvider, getProviders, patchProvider, removeProvider } from '#lib/admin/client.ts';
	import type { AdminProvider, AdminProviders } from '#lib/admin/contract.ts';
	import FleetTrail from '#lib/admin/FleetTrail.svelte';
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

	async function add() {
		if (apiKey.trim().length < 8 || (preset === 'custom' && (!baseUrl.trim() || !label.trim()))) {
			toast(preset === 'custom' ? 'Fill in the base URL, name and key' : 'Paste the API key first', '⚠️', 2600);
			return;
		}
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

	async function saveKey() {
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
	const sub = (p: AdminProvider) => `${presetName(p.preset) === p.label ? '' : `${presetName(p.preset)} · `}key ending ${p.last4}`;
</script>

<svelte:head><title>AI providers · Fleet</title></svelte:head>

<main class="page stack fleet" style:--gap="var(--space-2)">
	<FleetTrail />
	<LargeTitle title="AI providers" />

	{#if error}
		<ErrorCard {error} onretry={load} />
	{:else if !data}
		<ListGroup><ListRow subtitle="Loading…" /></ListGroup>
	{:else}
		{#if !data.canSaveKeys}
			<Notice tone="danger" title="Keys can’t be saved yet">Set the AI_MASTER_KEY Worker secret first (docs/FLEET.md). It encrypts every provider key.</Notice>
		{/if}

		{#each data.providers as p (p.id)}
			<ListGroup class="provider">
				<ListRow title={p.label} subtitle={sub(p)}>
					{#snippet trailing()}
						<Badge tone={!p.enabled || p.checkError ? 'danger' : 'success'}>{!p.enabled ? 'Off' : p.checkError ? 'Not answering' : 'On'}</Badge>
					{/snippet}
				</ListRow>
				<ListRow
					href="/admin/ai/{p.id}"
					title={p.modelCount === null ? 'Models' : `${p.modelCount} models`}
					subtitle={p.checkError ?? (p.checkedAt ? `Listed ${time(p.checkedAt)}` : undefined)}
				/>
				<ListRow subtitle={p.usedBy.length ? `In ${p.usedBy.join(', ')}` : 'Not in a package yet'} />
				{#if rekey?.id === p.id}
					<ListRow>
						<div class="stack" style:--gap="var(--space-3)">
							<TextField label="New API key" type="password" bind:value={rekey.key} autocomplete="off" spellcheck="false" />
							<span class="row" style:gap="var(--space-2)">
								<span class="spacer"></span>
								<Button variant="ghost" size="sm" onclick={() => (rekey = null)} disabled={busy}>Cancel</Button>
								<Button size="sm" onclick={saveKey} {busy}>Check and save</Button>
							</span>
						</div>
					</ListRow>
				{:else}
					<ListRow>
						<span class="row" style:gap="var(--space-2) var(--space-5)" style:flex-wrap="wrap">
							<Button variant="plain" size="sm" onclick={() => (rekey = { id: p.id, key: '' })} disabled={busy}>Replace key</Button>
							<Button variant="plain" size="sm" onclick={() => toggle(p)} disabled={busy}>{p.enabled ? 'Turn off' : 'Turn on'}</Button>
							<span class="spacer"></span>
							<Button variant="plain" class="danger" size="sm" onclick={() => remove(p)} disabled={busy}>Remove</Button>
						</span>
					</ListRow>
				{/if}
			</ListGroup>
		{/each}

		<SectionHeader title={data.providers.length ? 'Add another provider' : 'Add your first provider'} />
		<Card padding="md">
			<div class="stack" style:--gap="var(--space-4)">
				<div class="stack" style:--gap="var(--space-1h)">
					<span class="caption">Provider</span>
					<span class="chips" role="group" aria-label="Provider">
						{#each data.presets as pr (pr.id)}
							<Chip selected={preset === pr.id} onclick={() => (preset = pr.id)}>{pr.name}</Chip>
						{/each}
					</span>
				</div>
				{#if preset === 'custom'}
					<TextField id="base" label="Base URL" type="url" bind:value={baseUrl} placeholder="https://llm.example.com/v1" spellcheck="false" />
				{/if}
				<TextField id="label" label={preset === 'custom' ? 'Name' : 'Name (optional)'} bind:value={label} maxlength={40} placeholder={preset === 'custom' ? 'My server' : chosen?.name} />
				<TextField id="key" label="API key" type="password" bind:value={apiKey} autocomplete="off" spellcheck="false" hint="Benkyo lists the provider’s models with this key before keeping it. It’s encrypted and never shown again." />
				<span class="row" style:gap="var(--space-2)" style:flex-wrap="wrap">
					{#if chosen?.keysUrl}<Button variant="plain" size="sm" href={chosen.keysUrl}>Get an API key from {chosen.name} ↗</Button>{/if}
					<span class="spacer"></span>
					<Button onclick={add} {busy} disabled={!data.canSaveKeys}>Check and save</Button>
				</span>
			</div>
		</Card>

		<p class="caption foot">
			These keys pay for the managed AI in <a href="/admin/packages">packages</a>. Learners’ own keys stay separate. Changes ask for your passkey and go in the audit log.
		</p>
	{/if}
</main>

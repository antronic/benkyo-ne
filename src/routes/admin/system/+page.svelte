<!-- Fleet console: what's deployed, whether migrations ran, health checks and table sizes. Read-only. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { version } from '$app/env';
	import { Button, LargeTitle, ListGroup, SectionHeader, Skeleton } from '#lib/ui/index.ts';
	import ErrorCard from '#lib/admin/ErrorCard.svelte';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { AdminError, getSystem } from '#lib/admin/client.ts';
	import type { AdminSystem } from '#lib/admin/contract.ts';
	import '#lib/admin/admin.css';

	ui.hue = 200;
	let s = $state<AdminSystem | null>(null);
	let error = $state<AdminError | null>(null);
	let loading = $state(false);

	async function load() {
		loading = true;
		error = null;
		try {
			s = await getSystem();
		} catch (e) {
			error = e instanceof AdminError ? e : new AdminError(0, 'server', String(e));
		} finally {
			loading = false;
		}
	}
	onMount(load);

	const when = (t: number | null) =>
		t === null ? 'unknown' : new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
	// SvelteKit's default version name is the build time in ms
	const appBuilt = /^\d{12,}$/.test(version) ? when(Number(version)) : version;
	const FEATURES: Record<string, string> = { fill: 'Fill a card', propose: 'Suggest cards', vision: 'Read a photo' };
</script>

<svelte:head><title>System · Fleet</title></svelte:head>

<main class="page stack fleet" style:--gap="var(--space-3)">
	<LargeTitle title="System" />

	{#if error}
		<ErrorCard {error} onretry={load} />
	{:else if !s}
		<Skeleton variant="row" count={4} label="Checking the system" />
	{:else}
		<SectionHeader title="Deployed" />
		<ListGroup>
			<div class="item">
				<span class="stack" style:--gap="var(--space-px)" style:min-width="0">
					<span>Worker</span>
					<span class="caption ellipsis">{s.worker ? `${s.worker.tag ?? s.worker.id}` : 'Local dev, no version metadata'}</span>
				</span>
				<span class="spacer"></span><span class="caption">{s.worker ? when(s.worker.deployedAt) : ''}</span>
			</div>
			<div class="item">
				<span>App build</span><span class="spacer"></span><span class="caption">{appBuilt}</span>
			</div>
			<div class="item">
				<span class="stack" style:--gap="var(--space-px)" style:min-width="0">
					<span>Database migrations</span>
					<span class="caption wrap">
						{#if s.migrations.applied}Last applied {s.migrations.applied}{#if s.migrations.appliedAt}, {when(s.migrations.appliedAt)}{/if}{:else}No migration record{/if}
					</span>
					{#if !s.migrations.upToDate}<span class="caption danger">This Worker expects {s.migrations.expected}. Run the migrations.</span>{/if}
				</span>
				<span class="spacer"></span>
				<span class="pill" class:off={!s.migrations.upToDate}>{s.migrations.upToDate ? 'Up to date' : 'Behind'}</span>
			</div>
		</ListGroup>

		<SectionHeader title="Health" />
		<ListGroup>
			{#each s.checks as c (c.name)}
				<div class="item">
					<span class="dot" class:bad={!c.ok} aria-hidden="true"></span>
					<span class="stack" style:--gap="var(--space-px)" style:min-width="0">
						<span>{c.name}</span>
						<span class="caption">{c.detail}</span>
					</span>
					<span class="spacer"></span>
					<span class="visually-hidden">{c.ok ? 'OK' : 'Problem'}</span>
				</div>
			{/each}
		</ListGroup>

		<SectionHeader title="AI" />
		<ListGroup>
			<div class="item"><span>Accounts with their own AI key</span><span class="spacer"></span><b class="num">{s.ai.accountsWithKey}</b></div>
			{#each s.ai.featureModels as m (m.feature + m.model)}
				<div class="item">
					<span class="stack" style:--gap="var(--space-px)" style:min-width="0">
						<span>{FEATURES[m.feature] ?? m.feature}</span>
						<span class="caption ellipsis">{m.model}</span>
					</span>
					<span class="spacer"></span><span class="caption">{m.accounts} {m.accounts === 1 ? 'account' : 'accounts'}</span>
				</div>
			{/each}
		</ListGroup>

		<SectionHeader title="Data" />
		<ListGroup>
			{#each s.tables as t (t.name)}
				<div class="item"><code>{t.name}</code><span class="spacer"></span><b class="num">{t.rows.toLocaleString()}</b></div>
			{/each}
		</ListGroup>

		<p class="caption foot">
			Checked {new Date(s.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} ·
			<Button variant="link" onclick={load} busy={loading}>{loading ? 'Checking…' : 'Check again'}</Button>
		</p>
	{/if}
</main>

<style>
	.dot {
		flex: none;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--success);
	}
	.dot.bad {
		background: var(--danger);
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.wrap {
		overflow-wrap: anywhere;
	}
	code {
		font: 14px ui-monospace, 'SF Mono', Menlo, monospace;
	}
</style>

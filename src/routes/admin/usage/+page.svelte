<!-- Fleet console: AI usage and spend over 7, 30 or 90 days. Read-only. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import LargeTitle from '#lib/components/LargeTitle.svelte';
	import ErrorCard from '#lib/admin/ErrorCard.svelte';
	import DayBars from '#lib/admin/DayBars.svelte';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { AdminError, getUsage } from '#lib/admin/client.ts';
	import type { AdminUsage } from '#lib/admin/contract.ts';
	import '#lib/admin/admin.css';

	ui.hue = 200;
	const WINDOWS = [7, 30, 90] as const;
	let days = $state<(typeof WINDOWS)[number]>(30);
	let u = $state<AdminUsage | null>(null);
	let error = $state<AdminError | null>(null);
	let loading = $state(false);

	async function load() {
		loading = true;
		error = null;
		try {
			u = await getUsage(days);
		} catch (e) {
			error = e instanceof AdminError ? e : new AdminError(0, 'server', String(e));
		} finally {
			loading = false;
		}
	}
	onMount(load);

	function pick(d: (typeof WINDOWS)[number]) {
		if (d === days) return;
		days = d;
		void load();
	}

	const usd = (n: number) => (n === 0 ? '$0' : n < 0.01 ? '<$0.01' : `$${n.toFixed(n < 100 ? 2 : 0)}`);
	const tokens = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));
	const when = (t: number) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
	const FEATURES: Record<string, string> = { fill: 'Fill a card', propose: 'Suggest cards', vision: 'Read a photo' };
	const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
	const share = (n: number) => (u && u.totals.usd ? Math.round((n / u.totals.usd) * 100) : 0);
</script>

<svelte:head><title>Usage · Fleet</title></svelte:head>

<main class="page stack fleet" style:--gap="var(--space-3)">
	<LargeTitle title="Usage" />

	<div class="segmented" role="group" aria-label="Time window">
		{#each WINDOWS as d (d)}
			<button aria-pressed={days === d} onclick={() => pick(d)} disabled={loading}>{d} days</button>
		{/each}
	</div>

	{#if error}
		<ErrorCard {error} onretry={load} />
	{:else if !u}
		<div class="glass group" aria-busy="true"><div class="item caption">Loading…</div></div>
	{:else}
		<div class="tiles" aria-busy={loading}>
			<div class="glass tile"><span class="caption">Spend</span><b class="num">{usd(u.totals.usd)}</b></div>
			<div class="glass tile"><span class="caption">Calls</span><b class="num">{u.totals.calls}</b></div>
			<div class="glass tile" class:warn={u.totals.failed > 0}><span class="caption">Failed</span><b class="num">{u.totals.failed}</b></div>
		</div>

		<h2 class="eyebrow section">Spend per day</h2>
		<div class="glass group">
			<div class="item col">
				<DayBars days={u.byDay.map((d) => ({ day: d.day, value: d.usd }))} label="AI spend per day" format={usd} column="Spend" />
			</div>
		</div>

		<h2 class="eyebrow section">By feature</h2>
		<div class="glass group">
			{#each u.byFeature as f (f.feature)}
				<div class="item">
					<span class="stack" style:--gap="var(--space-px)">
						<span>{FEATURES[f.feature] ?? f.feature}</span>
						<span class="caption">{plural(f.calls, 'call')} · {share(f.usd)}% of spend</span>
					</span>
					<span class="spacer"></span><b class="num">{usd(f.usd)}</b>
				</div>
			{:else}
				<div class="item caption">No AI calls in this window.</div>
			{/each}
		</div>

		<h2 class="eyebrow section">By model</h2>
		<div class="glass group">
			{#each u.byModel as m (m.provider + m.model)}
				<div class="item">
					<span class="stack" style:--gap="var(--space-px)" style:min-width="0">
						<span class="ellipsis">{m.model}</span>
						<span class="caption">{m.provider} · {plural(m.calls, 'call')} · {tokens(m.inputTokens)} in, {tokens(m.outputTokens)} out</span>
					</span>
					<span class="spacer"></span><b class="num">{usd(m.usd)}</b>
				</div>
			{:else}
				<div class="item caption">No AI calls in this window.</div>
			{/each}
		</div>

		<h2 class="eyebrow section">Top accounts</h2>
		<div class="glass group">
			{#each u.topAccounts as a (a.id)}
				<a class="item" href="/admin/accounts/{a.id}">
					<span class="stack" style:--gap="var(--space-px)" style:min-width="0">
						<span class="ellipsis">{a.name} <span class="caption">#{a.id}</span></span>
						<span class="caption">{plural(a.calls, 'call')}</span>
					</span>
					<span class="spacer"></span><b class="num">{usd(a.usd)}</b><span class="caption" aria-hidden="true">›</span>
				</a>
			{:else}
				<div class="item caption">Nobody used AI in this window.</div>
			{/each}
		</div>

		<h2 class="eyebrow section">Failed calls</h2>
		<div class="glass group">
			{#each u.failures as f, i (i)}
				<div class="item">
					<span class="stack" style:--gap="var(--space-px)" style:min-width="0">
						<span>{FEATURES[f.feature] ?? f.feature} <span class="caption">· {f.model}</span></span>
						<span class="caption">
							{when(f.at)} ·
							{#if f.accountId !== null}<a href="/admin/accounts/{f.accountId}">{f.name ?? `#${f.accountId}`}</a>{:else}unknown account{/if}
						</span>
					</span>
				</div>
			{:else}
				<div class="item caption">No failed calls.</div>
			{/each}
		</div>
		<p class="caption foot">Spend counts finished calls only. Days are UTC.</p>
	{/if}
</main>

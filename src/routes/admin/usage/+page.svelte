<!-- Fleet console: AI usage and spend over 7, 30 or 90 days. Read-only. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { BarChart, Card, Columns, LargeTitle, ListGroup, ListRow, SectionHeader, Segmented, Skeleton, Spinner } from '#lib/ui/index.ts';
	import ErrorCard from '#lib/admin/ErrorCard.svelte';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { AdminError, getUsage } from '#lib/admin/client.ts';
	import type { AdminUsage } from '#lib/admin/contract.ts';
	import FleetTrail from '#lib/admin/FleetTrail.svelte';
	import { formatCredits } from '#lib/ai/credits.ts';
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

	const windowOptions = $derived(WINDOWS.map((d) => ({ value: String(d), label: `${d} days`, disabled: loading })));

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
	<FleetTrail />
	<LargeTitle title="Usage" />

	<div class="window">
		<Segmented options={windowOptions} value={String(days)} label="Time window" onchange={(v) => pick(Number(v) as (typeof WINDOWS)[number])} />
		{#if loading && u}<Spinner label="Loading" size="sm" />{/if}
	</div>

	{#if error}
		<ErrorCard {error} onretry={load} />
	{:else if !u}
		<Skeleton variant="tile" count={3} label="Loading usage" />
	{:else}
		<div class="tiles" aria-busy={loading}>
			<Card class="tile"><span class="caption">Spend</span><b class="num">{usd(u.totals.usd)}</b></Card>
			<Card class="tile"><span class="caption">Calls</span><b class="num">{u.totals.calls}</b></Card>
			<Card class={u.totals.failed > 0 ? 'tile warn' : 'tile'}><span class="caption">Failed</span><b class="num">{u.totals.failed}</b></Card>
		</div>

		<SectionHeader title="Spend per day" />
		<ListGroup>
			<div class="item col">
				<BarChart days={u.byDay.map((d) => ({ day: d.day, value: d.usd }))} label="AI spend per day" format={usd} column="Spend" />
			</div>
		</ListGroup>

		<Columns min="420px">
			<section>
				<SectionHeader title="Who paid" />
				<ListGroup>
					{#each ['package', 'own'] as src (src)}
						{@const row = u.bySource.find((b) => b.source === src)}
						<ListRow
							title={src === 'package' ? 'Managed AI (your provider keys)' : 'Learners’ own keys'}
							subtitle="{plural(row?.calls ?? 0, 'call')} · {share(row?.usd ?? 0)}% of spend"
						>
							{#snippet trailing()}<b class="num">{usd(row?.usd ?? 0)}</b>{/snippet}
						</ListRow>
					{/each}
				</ListGroup>
			</section>
			<section>
				<SectionHeader title="Managed AI by package" />
				<ListGroup>
					{#each u.byPackage as p (p.planId)}
						<ListRow href="/admin/packages" title={p.name} subtitle="{plural(p.accounts, 'account')} · {plural(p.calls, 'call')} · {formatCredits(p.credits ?? 0)} credits used · {formatCredits(p.allowanceCredits)} a month each">
							{#snippet trailing()}<b class="num">{usd(p.usd)}</b>{/snippet}
						</ListRow>
					{:else}
						<ListRow subtitle="No package used managed AI in this window." />
					{/each}
				</ListGroup>
			</section>
			<section>
				<SectionHeader title="By feature" />
				<ListGroup>
					{#each u.byFeature as f (f.feature)}
						<ListRow title={FEATURES[f.feature] ?? f.feature} subtitle="{plural(f.calls, 'call')} · {share(f.usd)}% of spend">
							{#snippet trailing()}<b class="num">{usd(f.usd)}</b>{/snippet}
						</ListRow>
					{:else}
						<ListRow subtitle="No AI calls in this window." />
					{/each}
				</ListGroup>
			</section>
			<section>
				<SectionHeader title="By model" />
				<ListGroup>
					{#each u.byModel as m (m.provider + m.model)}
						<ListRow>
							<span class="ellipsis">{m.model}</span>
							<span class="caption">{m.provider} · {plural(m.calls, 'call')} · {tokens(m.inputTokens)} in, {tokens(m.outputTokens)} out</span>
							{#snippet trailing()}<b class="num">{usd(m.usd)}</b>{/snippet}
						</ListRow>
					{:else}
						<ListRow subtitle="No AI calls in this window." />
					{/each}
				</ListGroup>
			</section>
			<section>
				<SectionHeader title="Top accounts" />
				<ListGroup>
					{#each u.topAccounts as a (a.id)}
						<ListRow href="/admin/accounts/{a.id}">
							<span class="ellipsis">{a.name} <span class="caption">#{a.id}</span></span>
							<span class="caption">{plural(a.calls, 'call')}</span>
							{#snippet trailing()}<b class="num">{usd(a.usd)}</b>{/snippet}
						</ListRow>
					{:else}
						<ListRow subtitle="Nobody used AI in this window." />
					{/each}
				</ListGroup>
			</section>
			<section>
				<SectionHeader title="Failed calls" />
				<ListGroup>
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
						<ListRow subtitle="No failed calls." />
					{/each}
				</ListGroup>
			</section>
		</Columns>


		<p class="caption foot">Spend counts finished calls only. Days are UTC.</p>
	{/if}
</main>

<style>
	.window {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		max-width: 360px;
	}
</style>

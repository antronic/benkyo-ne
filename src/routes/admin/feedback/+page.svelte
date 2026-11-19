<!--
	Fleet console: Feedback (docs/FEEDBACK.md). Thumbs and reports learners left
	on lessons, units, grammar points, kanji and words: the totals, the content
	with the most reports and thumbs down, and the open reports, oldest first.
	Mark a report fixed once the content is corrected, or dismiss it. Every
	change is written to the audit log.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Badge, Button, Card, LargeTitle, ListGroup, ListRow, Notice, Skeleton, StatTile } from '#lib/ui/index.ts';
	import ErrorCard from '#lib/admin/ErrorCard.svelte';
	import FleetTrail from '#lib/admin/FleetTrail.svelte';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { AdminError, getFeedback, setFeedbackReport } from '#lib/admin/client.ts';
	import type { AdminFeedback, AdminFeedbackReport, FeedbackReportStatus } from '#lib/feedback/contract.ts';
	import '#lib/admin/admin.css';

	ui.hue = 200;
	let data = $state<AdminFeedback | null>(null);
	let error = $state<AdminError | null>(null);
	let busy = $state<string | null>(null);
	let actionError = $state<{ id: number; message: string } | null>(null);
	let done = $state<string | null>(null);

	async function load() {
		error = null;
		try {
			data = await getFeedback();
		} catch (e) {
			error = e instanceof AdminError ? e : new AdminError(0, 'server', String(e));
		}
	}
	onMount(load);

	const REASONS: Record<string, string> = {
		wrong: 'Mistake in the Japanese',
		translation: 'English or Thai is off',
		audio: 'Reading or sound is wrong',
		confusing: 'Hard to understand',
		other: 'Something else'
	};
	const KINDS: Record<string, string> = { word: 'Word', phrase: 'Phrase', kana: 'Kana', kanji: 'Kanji', lesson: 'Lesson', unit: 'Unit', grammar: 'Grammar' };
	const kindOf = (subject: string) => KINDS[subject.slice(0, subject.indexOf(':'))] ?? subject;
	const when = (t: number) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
	const LANG: Record<string, string> = { en: 'English', th: 'Thai' };

	async function mark(r: AdminFeedbackReport, status: FeedbackReportStatus) {
		busy = `${r.id}:${status}`;
		actionError = null;
		done = null;
		try {
			await setFeedbackReport(r.id, status);
			done = `${status === 'fixed' ? 'Marked fixed' : 'Dismissed'}: ${r.label || r.subject}`;
			await load();
		} catch (e) {
			actionError = { id: r.id, message: e instanceof Error ? e.message : String(e) };
		} finally {
			busy = null;
		}
	}
</script>

<svelte:head><title>Feedback · Fleet</title></svelte:head>

<main class="page stack fleet" style:--gap="var(--space-3)">
	<FleetTrail />
	<LargeTitle title="Feedback" />

	{#if error}
		<ErrorCard {error} onretry={load} />
	{:else if !data}
		<Skeleton variant="card" count={1} label="Loading feedback" />
		<Skeleton variant="row" count={3} />
	{:else}
		<div class="ui-stats">
			<StatTile label="Open reports" value={data.open} tone={data.open ? 'danger' : 'default'} />
			<StatTile label="Thumbs up" value={data.up} />
			<StatTile label="Thumbs down" value={data.down} />
		</div>

		{#if done}<Notice tone="success">{done}</Notice>{/if}

		<h2 class="eyebrow section">Reports to review</h2>
		{#if !data.reports.length}
			<ListGroup><ListRow subtitle="No open reports. Learners report a lesson, unit, grammar point, kanji or word from its ⚑ Report a problem button." /></ListGroup>
		{/if}
		{#each data.reports as r (r.id)}
			<Card padding="md" class="fb-report">
				<div class="row">
					<Badge>{kindOf(r.subject)}</Badge>
					<b lang="ja">{r.label || r.subject}</b>
					<span class="caption subject">{r.subject}</span>
					<span class="end caption">{when(r.createdAt)}{#if r.locale} · {LANG[r.locale] ?? r.locale}{/if}</span>
				</div>
				<p class="body"><b>{REASONS[r.reason] ?? r.reason}</b>{#if r.detail}: {r.detail}{/if}</p>
				<div class="row">
					<Button size="sm" variant="ghost" busy={busy === `${r.id}:fixed`} onclick={() => mark(r, 'fixed')}>✓ Fixed</Button>
					<Button size="sm" variant="ghost" busy={busy === `${r.id}:dismissed`} onclick={() => mark(r, 'dismissed')}>Dismiss</Button>
				</div>
				{#if actionError?.id === r.id}<Notice tone="danger">{actionError.message}</Notice>{/if}
			</Card>
		{/each}

		<h2 class="eyebrow section">Most reported and thumbs down</h2>
		{#if !data.subjects.length}
			<ListGroup><ListRow subtitle="No thumbs yet." /></ListGroup>
		{:else}
			<ListGroup>
				{#each data.subjects as s (s.subject)}
					<ListRow title={`${kindOf(s.subject)} · ${s.label || s.subject}`} subtitle={s.subject}>
						{#snippet trailing()}
							<span class="counts">
								{#if s.open}<Badge tone="danger">{s.open} open</Badge>{/if}
								<span class="caption">👍 {s.up} · 👎 {s.down}</span>
							</span>
						{/snippet}
					</ListRow>
				{/each}
			</ListGroup>
		{/if}
		<p class="caption">Fixed and dismissed reports are deleted after 180 days. A learner can report the same item again once its report is handled.</p>
	{/if}
</main>

<style>
	:global(.fb-report) {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.end {
		margin-left: auto;
	}
	.subject {
		overflow-wrap: anywhere;
	}
	.body {
		margin: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.counts {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
</style>

<!--
	Settings → Debugging (docs/DEBUGGING.md): debug mode, the build number, and the
	errors kept on this device with their ids, so a learner can tell us exactly what broke.
-->
<script lang="ts">
	import { t, fmtDateTime } from '#lib/i18n/index.svelte.ts';
	import { toast } from '#lib/ios/overlay.svelte.ts';
	import { telemetry } from '#lib/beta/telemetry.svelte.ts';
	import { buildNumber, clearLog, debug, errorDetails, setDebug } from '#lib/debug/errors.svelte.ts';
	import { Button, ListGroup, ListRow, Switch } from '#lib/ui/index.ts';

	const SHOWN = 5;

	async function copy(id: string) {
		try {
			await navigator.clipboard.writeText(errorDetails(id));
			toast(t('debug.copied'), '✓');
		} catch {
			toast(t('debug.copyFailed'), '⚠️');
		}
	}
</script>

<h2 class="eyebrow section">{t('debug.section')}</h2>
<ListGroup class="rise">
	<ListRow title={t('debug.mode')} subtitle={t('debug.modeBody')}>
		{#snippet trailing()}<Switch label={t('debug.mode')} checked={debug.on} onchange={(v) => setDebug(v)} />{/snippet}
	</ListRow>
	<ListRow title={t('debug.build')}>
		{#snippet trailing()}<span class="caption num">{buildNumber()}</span>{/snippet}
	</ListRow>
	<ListRow
		title={t('debug.problems')}
		subtitle={debug.log.length ? `${t('debug.problemsBody')}${telemetry.enabled ? ` ${t('debug.sent')}.` : ''}` : t('debug.none')}
	/>
	{#each debug.log.slice(0, SHOWN) as r (r.id)}
		<ListRow title={r.message} subtitle="{r.id} · {fmtDateTime(r.at)}{r.route ? ` · ${r.route}` : ''}">
			{#snippet trailing()}<Button variant="ghost" size="sm" onclick={() => copy(r.id)}>{t('debug.copy')}</Button>{/snippet}
		</ListRow>
	{/each}
	{#if debug.log.length}
		<ListRow>
			<span><Button variant="link" onclick={clearLog}>{t('debug.clear')}</Button></span>
		</ListRow>
	{/if}
</ListGroup>

<style>
	.section {
		margin: var(--space-4) var(--space-1h) var(--space-px);
	}
	.num {
		font-variant-numeric: tabular-nums;
	}
</style>

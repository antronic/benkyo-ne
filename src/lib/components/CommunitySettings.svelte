<!--
	Community in Settings (docs/COMMUNITY.md): your public handle and the people
	you blocked, with Unblock. Only for a signed-in account; nothing shows until
	the first share made a handle, except the blocked list once there is one.
-->
<script lang="ts">
	import { t, fmtDate, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { Button, ListGroup, ListRow, Notice, Skeleton } from '#lib/ui/index.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { community } from '#lib/state/community.svelte.ts';
	import { listBlocks, problemKey, unblock } from '#lib/community/client.ts';
	import type { Blocked } from '#lib/community/contract.ts';

	let blocked = $state<Blocked[] | null>(null);
	let failed = $state<MessageKey | null>(null);
	let busy = $state<string | null>(null);

	async function load(id: number) {
		failed = null;
		blocked = null;
		try {
			const [, b] = await Promise.all([community.ensure(id), listBlocks()]);
			blocked = b;
		} catch (e) {
			failed = problemKey(e) as MessageKey;
		}
	}

	$effect(() => {
		const id = ai.account?.id;
		if (ai.signedIn && id !== undefined) void load(id);
	});

	async function undo(handle: string) {
		busy = handle;
		try {
			await unblock(handle);
			blocked = blocked!.filter((b) => b.handle !== handle);
		} catch (e) {
			failed = problemKey(e) as MessageKey;
		} finally {
			busy = null;
		}
	}
</script>

{#if ai.signedIn && ai.account}
	<h2 class="eyebrow section">{t('community.settings')}</h2>
	{#if failed}
		<Notice tone="warning" title={t('community.loadFailed')}>
			{#snippet action()}<Button size="sm" variant="ghost" onclick={() => load(ai.account!.id)}>{t('boot.retry')}</Button>{/snippet}
			{t(failed)}
		</Notice>
	{:else if blocked === null || !community.me}
		<Skeleton variant="row" count={1} label={t('community.settingsLoading')} />
	{:else}
		<ListGroup class="rise">
			<ListRow title={t('community.settingsHandle')} subtitle={community.me.profile ? `@${community.me.profile.handle}` : t('community.settingsNone')} />
			{#each blocked as b (b.handle)}
				<ListRow title={`@${b.handle}`} subtitle={`${t('community.blocked')} · ${fmtDate(b.at, { day: 'numeric', month: 'short' })}`}>
					{#snippet trailing()}
						<Button size="sm" variant="ghost" busy={busy === b.handle} onclick={() => undo(b.handle)}>{t('community.unblock')}</Button>
					{/snippet}
				</ListRow>
			{:else}
				<ListRow subtitle={t('community.blockedNone')} />
			{/each}
		</ListGroup>
	{/if}
{/if}

<!--
	The "More" sheet of the main navigation (src/lib/nav.ts, docs/DESIGN-SYSTEM.md):
	the screens that are not in the tab bar, each with one line on what it is, and
	"Edit tab bar" to choose which ones are.
-->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { Badge, Button, Checkbox, ListGroup, ListRow, Notice, SectionHeader, Sheet } from '#lib/ui/index.ts';
	import NavIcon from './NavIcon.svelte';
	import { NAV_ITEMS, type NavItem } from '#lib/nav.ts';

	interface Props {
		open: boolean;
		onclose: () => void;
		/** the screens in More */
		more: NavItem[];
		/** the screen you are on (its href), or null */
		current: string | null;
		/** how many tabs the bar on this screen holds besides More */
		room: number;
		/** pinned hrefs as saved */
		pins: string[];
		onpins: (pins: string[]) => void;
		/** cards due, shown on Review */
		due?: number;
		/** start in edit mode (the /design catalog) */
		editing?: boolean;
	}
	let { open, onclose, more, current, room, pins, onpins, due = 0, editing = $bindable(false) }: Props = $props();

	// edit a copy; Done saves it
	let draft = $state<string[]>([]);
	$effect(() => {
		if (open) draft = pins.slice(0, room);
	});
	const full = $derived(draft.length >= room);
	function toggle(href: string, on: boolean) {
		draft = on ? [...draft, href] : draft.filter((h) => h !== href);
	}
	function done() {
		onpins(NAV_ITEMS.map((i) => i.href).filter((h) => draft.includes(h)));
		editing = false;
	}
	function close() {
		editing = false;
		onclose();
	}
</script>

<Sheet {open} label={editing ? t('nav.editTitle') : t('nav.moreTitle')} onclose={close}>
	{#snippet header()}
		<SectionHeader title={editing ? t('nav.editTitle') : t('nav.moreTitle')} />
	{/snippet}
	{#if editing}
		<p class="caption">{t('nav.editBody', { n: room })}</p>
		<ListGroup>
			{#each NAV_ITEMS as item (item.href)}
				{@const on = draft.includes(item.href)}
				<ListRow>
					{#snippet leading()}<NavIcon path={item.icon} />{/snippet}
					<Checkbox checked={on} disabled={!on && full} onchange={(v) => toggle(item.href, v)}>{t(item.label)}</Checkbox>
				</ListRow>
			{/each}
		</ListGroup>
		{#if full}<Notice tone="info">{t('nav.editFull')}</Notice>{/if}
		<Button block onclick={done}>{t('common.done')}</Button>
	{:else}
		<ListGroup>
			{#each more as item (item.href)}
				<ListRow href={item.href} title={t(item.label)} subtitle={t(item.desc)} selected={item.href === current} onclick={close}>
					{#snippet leading()}<NavIcon path={item.icon} />{/snippet}
					{#snippet trailing()}
						{#if item.href === '/review' && due > 0}<Badge tone="accent" variant="solid">{due > 99 ? '99+' : due}</Badge>{/if}
					{/snippet}
				</ListRow>
			{/each}
		</ListGroup>
		<Button variant="ghost" block onclick={() => (editing = true)}>{t('nav.editTabs')}</Button>
	{/if}
</Sheet>

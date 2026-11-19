<!--
	Build or tweak an avatar by hand: a live preview, then tabs of picture tiles and colour
	swatches (docs/AVATAR.md). Every tile is the learner's own avatar with that one part changed,
	drawn as an instant SVG. bind:person.
-->
<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { Avatar, Segmented, SwatchPicker, TilePicker } from '#lib/ui/index.ts';
	import { avatarSvg } from '#lib/avatar/render.ts';
	import { COLOURS, OPTIONS, type Person } from '#lib/avatar/person.ts';

	let { person = $bindable(), name = '' }: { person: Person; name?: string } = $props();

	type Tab = 'face' | 'hair' | 'head' | 'colours' | 'extras';
	let tab = $state<Tab>('hair');
	type PartKey = keyof typeof OPTIONS;
	type ColourKey = keyof typeof COLOURS;
	const TABS: Record<Tab, (PartKey | ColourKey)[]> = {
		face: ['headShape', 'eyes', 'brows', 'mouth', 'beard', 'blush'],
		hair: ['hair', 'hairColor'],
		head: ['head', 'headColor', 'glasses'],
		colours: ['skin', 'cloth', 'frameColor'],
		extras: ['outfit', 'earrings', 'aid']
	};
	const isColour = (k: string): k is ColourKey => k in COLOURS;
	const label = (k: string) => t(`avatar.part.${k}` as MessageKey);
	const optLabel = (k: string, v: string) => t(`avatar.opt.${k}.${v}` as MessageKey);
	const set = (k: string, v: string) => (person = { ...person, [k]: v });
	// the head-covering colour only matters with one on
	const shown = $derived(TABS[tab].filter((k) => k !== 'headColor' || person.head !== 'none'));
</script>

<div class="editor">
	<div class="preview"><Avatar {person} {name} size={150} live label={t('avatar.previewLabel')} /></div>
	<Segmented
		label={t('avatar.tabs')}
		bind:value={tab}
		options={(Object.keys(TABS) as Tab[]).map((v) => ({ value: v, label: t(`avatar.tab.${v}` as MessageKey) }))}
	/>
	{#each shown as k (k)}
		<section class="group" aria-label={label(k)}>
			<h3 class="footnote">{label(k)}</h3>
			{#if isColour(k)}
				<SwatchPicker
					label={label(k)}
					value={person[k] as string}
					options={Object.entries(COLOURS[k]).map(([v, color]) => ({ value: v, color, label: optLabel(k, v) }))}
					onchange={(v) => set(k, v)}
				/>
			{:else}
				<TilePicker label={label(k)} value={person[k] as string} options={OPTIONS[k].map((v) => ({ value: v as string, label: optLabel(k, v) }))} onchange={(v) => set(k, v)}>
					{#snippet art(v)}
						<span class="tile-art">{@html avatarSvg({ ...person, [k]: v }, 56)}</span>
					{/snippet}
				</TilePicker>
			{/if}
		</section>
	{/each}
</div>

<style>
	.editor {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.preview {
		display: flex;
		justify-content: center;
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	h3 {
		margin: 0;
		color: var(--color-text-2);
		font-weight: var(--weight-semibold);
	}
	.tile-art {
		display: block;
		width: 56px;
		height: 56px;
		border-radius: var(--radius-round);
		overflow: hidden;
	}
	.tile-art :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>

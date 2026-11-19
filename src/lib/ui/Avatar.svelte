<!--
	Someone's avatar (docs/AVATAR.md), drawn by Coreva Render with Benkyo's style pack.
	`person` is the saved parts; null shows the first letter of `name` instead.
	The SVG still is instant and works offline. `live` mounts the live 3D avatar on top of it
	(looks around, follows the pointer, waves once when `wave`); it stays the still under
	reduced motion, without a GPU, or before three.js has loaded once.
-->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { avatarSvg, mountLive } from '#lib/avatar/render.ts';
	import type { Person } from '#lib/avatar/person.ts';
	import type { AvatarHandle } from '@antronic/coreva-render';

	let {
		person,
		name = '',
		size = 44,
		live = false,
		wave = false,
		label
	}: {
		/** the saved parts; null: no avatar, the initial shows */
		person: Partial<Person> | null | undefined;
		/** used for the initial and the accessible name */
		name?: string;
		/** CSS px */
		size?: number;
		live?: boolean;
		wave?: boolean;
		/** accessible name; defaults to name. "" hides it from screen readers (the name is already beside it) */
		label?: string;
	} = $props();

	let host = $state<HTMLElement>();
	let handle: AvatarHandle | null = null;
	let liveOn = $state(false);
	const initial = $derived((name.trim()[0] ?? '?').toUpperCase());
	const still = $derived(person ? avatarSvg(person, size) : '');
	const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	$effect(() => {
		const p = person;
		if (!live || !p || !host || reduced) return;
		if (handle) {
			handle.update(p);
			return;
		}
		try {
			handle = mountLive(host, p, { size, wave, onState: (s) => (liveOn = s === 'live') });
		} catch {
			handle = null; // the still stays
		}
	});
	onDestroy(() => handle?.destroy());
</script>

<span class="avatar" style:--size="{size}px" role={label === '' ? undefined : 'img'} aria-label={label === '' ? undefined : (label ?? name)} aria-hidden={label === '' ? 'true' : undefined}>
	{#if person}
		<span class="still" class:hidden={liveOn} aria-hidden="true">{@html still}</span>
		{#if live}<span class="live" bind:this={host} aria-hidden="true"></span>{/if}
	{:else}
		<span class="initial" aria-hidden="true">{initial}</span>
	{/if}
</span>

<style>
	.avatar {
		position: relative;
		display: inline-grid;
		flex: none;
		width: var(--size);
		height: var(--size);
		border-radius: var(--radius-round);
		overflow: hidden;
		vertical-align: middle;
	}
	.still,
	.live {
		grid-area: 1 / 1;
		display: block;
		width: 100%;
		height: 100%;
	}
	.still :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}
	.hidden {
		visibility: hidden;
	}
	.initial {
		display: grid;
		place-items: center;
		background: var(--gradient-brand);
		color: var(--color-on-accent);
		font-weight: var(--weight-bold);
		font-size: calc(var(--size) * 0.42);
		line-height: 1;
	}
</style>

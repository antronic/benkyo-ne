<!--
	Illustrations for the install guide: a simplified device with the control
	to tap highlighted in the accent colour and a pulsing ring. Drawn with the
	design tokens, so they follow light and dark mode. Icons are generic
	(share = box with an arrow, menu = dots), not any vendor's artwork.
-->
<script lang="ts" module>
	export type ArtKind =
		| 'ios-share'
		| 'ipad-share'
		| 'ios-add'
		| 'ios-confirm'
		| 'phone-home'
		| 'tablet-home'
		| 'android-menu'
		| 'android-install'
		| 'android-confirm'
		| 'desktop-icon'
		| 'desktop-confirm'
		| 'desktop-window'
		| 'mac-file'
		| 'mac-confirm'
		| 'mac-dock';
</script>

<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';

	let { kind, label = '' }: { kind: ArtKind; label?: string } = $props();

	const host = typeof location === 'undefined' ? 'benkyo.jirachai.me' : location.host;
	const ICON = '/icons/icon.svg';
</script>

{#snippet share(x: number, y: number, cls = 'ink-s')}
	<g transform="translate({x} {y})" class={cls} fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
		<path d="M-4 -2 H-6 V7 H6 V-2 H4" />
		<path d="M0 3 V-8 M-3.5 -4.5 L0 -8 L3.5 -4.5" />
	</g>
{/snippet}

{#snippet dots(x: number, y: number, vertical = false, cls = 'ink')}
	<g transform="translate({x} {y}) rotate({vertical ? 90 : 0})" class={cls}>
		<circle cx="-5" cy="0" r="1.7" /><circle cx="0" cy="0" r="1.7" /><circle cx="5" cy="0" r="1.7" />
	</g>
{/snippet}

{#snippet ring(x: number, y: number, r = 12, dashed = false)}
	<circle cx={x} cy={y} {r} class="ring" class:dashed />
	{#if !dashed}<circle cx={x} cy={y} {r} class="ring pulse" />{/if}
{/snippet}

{#snippet bars(x: number, y: number, w: number, n = 3, gap = 12)}
	{#each Array(n) as _, i}
		<rect x={x} y={y + i * gap} width={w * (i % 2 ? 0.7 : 1)} height="6" rx="3" class="ghost" />
	{/each}
{/snippet}

{#snippet phone(top: boolean)}
	<!-- top: shows the top of the screen (bottom cropped); else the bottom -->
	{@const y = top ? 8 : -34}
	<rect x="70" y={y} width="140" height="200" rx="24" class="frame" />
	<rect x="76" y={y + 6} width="128" height="188" rx="19" class="screen" />
	{#if top}<rect x="122" y={y + 11} width="36" height="9" rx="4.5" class="notch" />{/if}
{/snippet}

{#snippet tablet()}
	<rect x="18" y="10" width="244" height="190" rx="18" class="frame" />
	<rect x="25" y="17" width="230" height="176" rx="12" class="screen" />
{/snippet}

{#snippet appIcon(x: number, y: number, s: number)}
	<image href={ICON} x={x} y={y} width={s} height={s} />
{/snippet}

{#snippet browserWindow(chrome = true)}
	<rect x="14" y="10" width="252" height="170" rx="10" class="frame" />
	<rect x="15" y="11" width="250" height="168" rx="9" class="screen" />
	<path d="M15 20 a9 9 0 0 1 9 -9 h232 a9 9 0 0 1 9 9 V{chrome ? 46 : 32} H15 Z" class="bar" />
	<circle cx="27" cy="21" r="3" class="ghost" /><circle cx="37" cy="21" r="3" class="ghost" /><circle cx="47" cy="21" r="3" class="ghost" />
{/snippet}

<svg viewBox="0 0 280 168" role="img" aria-label={label} class="art">
	{#if kind === 'ios-share'}
		{@render phone(false)}
		{@render bars(90, 2, 96, 4, 14)}
		<rect x="90" y="62" width="100" height="40" rx="10" class="ghost soft" />
		<rect x="76" y="110" width="128" height="50" class="bar" />
		<rect x="86" y="118" width="84" height="20" rx="10" class="pill" />
		<text x="128" y="131.5" class="url" text-anchor="middle">{host}</text>
		{@render dots(188, 128, false, 'ink')}
		{@render ring(188, 128, 11, true)}
		{@render share(128, 151, 'hl-s')}
		{@render ring(128, 150, 13)}
	{:else if kind === 'ipad-share'}
		{@render tablet()}
		<path d="M25 29 a12 12 0 0 1 12 -12 h206 a12 12 0 0 1 12 12 V44 H25 Z" class="bar" />
		<rect x="90" y="23" width="100" height="16" rx="8" class="pill" />
		<text x="140" y="34.5" class="url" text-anchor="middle">{host}</text>
		{@render dots(206, 31, false, 'ink')}
		{@render ring(206, 31, 10, true)}
		{@render share(230, 32, 'hl-s')}
		{@render ring(230, 31, 12)}
		{@render bars(44, 60, 120, 4, 16)}
		<rect x="180" y="58" width="58" height="56" rx="10" class="ghost soft" />
	{:else if kind === 'ios-add'}
		{@render phone(false)}
		{@render bars(90, 2, 96, 3, 14)}
		<rect x="76" y="-28" width="128" height="200" class="dim" />
		<rect x="76" y="40" width="128" height="140" rx="16" class="sheet" />
		<rect x="128" y="45" width="24" height="4" rx="2" class="ghost" />
		<rect x="84" y="56" width="112" height="22" rx="7" class="row" />
		<rect x="92" y="64" width="50" height="6" rx="3" class="ghost" />
		<rect x="84" y="82" width="112" height="22" rx="7" class="row" />
		<rect x="92" y="90" width="66" height="6" rx="3" class="ghost" />
		<rect x="84" y="108" width="112" height="26" rx="8" class="row hl-row" />
		<text x="110" y="124.5" class="lbl sm9">{t('install.art.addHome')}</text>
		<g transform="translate(95 121)" class="hl-s" fill="none" stroke-width="1.6">
			<rect x="-6" y="-6" width="12" height="12" rx="3" />
			<path d="M0 -3 V3 M-3 0 H3" stroke-linecap="round" />
		</g>
		<rect x="84" y="138" width="112" height="22" rx="7" class="row" />
		<rect x="92" y="146" width="40" height="6" rx="3" class="ghost" />
		{@render ring(95, 121, 10)}
	{:else if kind === 'ios-confirm'}
		{@render phone(true)}
		<text x="86" y="44" class="soft-t">{t('common.cancel')}</text>
		<rect x="122" y="37" width="40" height="7" rx="3.5" class="ghost" />
		<text x="196" y="44" class="lbl hl-t" text-anchor="end">{label || t('install.art.add')}</text>
		{@render ring(186, 40, 15)}
		<rect x="84" y="56" width="112" height="44" rx="10" class="row" />
		{@render appIcon(90, 62, 32)}
		<text x="130" y="76" class="lbl">Benkyo</text>
		<text x="130" y="89" class="url">{host}</text>
		<rect x="84" y="106" width="112" height="24" rx="8" class="row" />
		<text x="91" y="121.5" class="small-t">{t('install.art.webApp')}</text>
		<rect x="172" y="112" width="20" height="12" rx="6" class="ok" />
		<circle cx="186" cy="118" r="4.5" class="knob" />
	{:else if kind === 'phone-home' || kind === 'tablet-home'}
		{@const tab = kind === 'tablet-home'}
		{#if tab}{@render tablet()}{:else}{@render phone(true)}{/if}
		{@const cols = tab ? 6 : 4}
		{@const x0 = tab ? 44 : 86}
		{@const step = tab ? 34 : 28}
		{#each Array(tab ? 3 : 4) as _, r}
			{#each Array(cols) as _, c}
				{#if !(r === 1 && c === 1)}
					<rect x={x0 + c * step} y={(tab ? 30 : 34) + r * (tab ? 42 : 32)} width={tab ? 24 : 20} height={tab ? 24 : 20} rx={tab ? 6 : 5} class="ghost soft" />
				{/if}
			{/each}
		{/each}
		{@const ix = x0 + step}
		{@const iy = (tab ? 30 : 34) + (tab ? 42 : 32)}
		{@const s = tab ? 24 : 20}
		{@render appIcon(ix, iy, s)}
		<text x={ix + s / 2} y={iy + s + 12} class="cap" text-anchor="middle">Benkyo</text>
		{@render ring(ix + s / 2, iy + s / 2, s * 0.72)}
	{:else if kind === 'android-menu'}
		{@render phone(true)}
		<rect x="76" y="30" width="128" height="22" class="bar" />
		<rect x="84" y="34" width="86" height="14" rx="7" class="pill" />
		<text x="127" y="44" class="url" text-anchor="middle">{host}</text>
		<rect x="175" y="36" width="10" height="10" rx="2.5" class="ink-s" fill="none" stroke-width="1.4" />
		{@render dots(195, 41, true, 'hl')}
		{@render ring(195, 41, 10)}
		{@render bars(88, 64, 100, 5, 14)}
		<rect x="88" y="138" width="104" height="40" rx="10" class="ghost soft" />
	{:else if kind === 'android-install'}
		{@render phone(true)}
		<rect x="76" y="30" width="128" height="22" class="bar" />
		<rect x="84" y="34" width="86" height="14" rx="7" class="pill" />
		{@render bars(88, 64, 100, 5, 14)}
		<rect x="92" y="34" width="110" height="118" rx="8" class="sheet" />
		{#each [0, 1, 3] as i}
			<rect x="102" y={46 + i * 22} width={i === 1 ? 50 : 62} height="6" rx="3" class="ghost" />
		{/each}
		<rect x="95" y="82" width="104" height="24" rx="6" class="hl-row" />
		<g transform="translate(105 94)" class="hl-s" fill="none" stroke-width="1.5" stroke-linecap="round">
			<rect x="-4.5" y="-7" width="9" height="14" rx="2" />
			<path d="M0 -3 V2 M-2.2 0 L0 2.2 L2.2 0" />
		</g>
		<text x="116" y="97" class="lbl sm">{label || t('install.art.addHomeAndroid')}</text>
		{@render ring(105, 94, 10)}
		<rect x="102" y="134" width="44" height="6" rx="3" class="ghost" />
	{:else if kind === 'android-confirm'}
		{@render phone(true)}
		{@render bars(88, 40, 100, 6, 14)}
		<rect x="76" y="14" width="128" height="180" class="dim" />
		<rect x="84" y="62" width="112" height="78" rx="14" class="sheet" />
		{@render appIcon(92, 72, 24)}
		<text x="122" y="83" class="lbl">Benkyo</text>
		<text x="122" y="94" class="url">{host}</text>
		<text x="126" y="126" class="soft-t" text-anchor="middle">{t('common.cancel')}</text>
		<rect x="148" y="114" width="42" height="18" rx="9" class="hl" />
		<text x="169" y="126.5" class="on-hl" text-anchor="middle">{t('install.art.install')}</text>
		{@render ring(169, 123, 16)}
	{:else if kind === 'desktop-icon'}
		{@render browserWindow()}
		<rect x="22" y="32" width="210" height="10" rx="5" class="pill" />
		<text x="30" y="40" class="url">{host}</text>
		<g transform="translate(222 37)" class="hl-s" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
			<rect x="-6" y="-5" width="12" height="8.5" rx="1.5" />
			<path d="M-3 6 H3 M0 -3 V1.5 M-2 -0.5 L0 1.5 L2 -0.5" />
		</g>
		{@render ring(222, 37, 10)}
		{@render dots(252, 37, true, 'ink')}
		{@render ring(252, 37, 8, true)}
		{@render bars(32, 62, 120, 5, 16)}
		<rect x="170" y="60" width="80" height="70" rx="10" class="ghost soft" />
	{:else if kind === 'desktop-confirm'}
		{@render browserWindow()}
		<rect x="22" y="32" width="210" height="10" rx="5" class="pill" />
		{@render bars(32, 62, 120, 5, 16)}
		<rect x="15" y="46" width="250" height="133" class="dim" />
		<rect x="120" y="50" width="136" height="84" rx="10" class="sheet" />
		{@render appIcon(130, 60, 22)}
		<text x="158" y="70" class="lbl">{t('install.art.installApp')}</text>
		<text x="158" y="82" class="url">Benkyo · {host}</text>
		<rect x="186" y="104" width="62" height="20" rx="10" class="hl" />
		<text x="217" y="117.5" class="on-hl" text-anchor="middle">{t('install.art.install')}</text>
		<text x="160" y="117.5" class="soft-t" text-anchor="middle">{t('common.cancel')}</text>
		{@render ring(217, 114, 18)}
	{:else if kind === 'desktop-window'}
		<rect x="0" y="146" width="280" height="22" class="bar" />
		{#each [96, 120, 168, 192] as x}<rect x={x} y="150" width="14" height="14" rx="4" class="ghost" />{/each}
		{@render appIcon(142, 149, 16)}
		{@render ring(150, 157, 12)}
		<rect x="40" y="8" width="200" height="130" rx="10" class="frame" />
		<rect x="41" y="9" width="198" height="128" rx="9" class="screen" />
		<path d="M41 18 a9 9 0 0 1 9 -9 h180 a9 9 0 0 1 9 9 V26 H41 Z" class="bar" />
		{@render appIcon(48, 12, 11)}
		<text x="63" y="21" class="small-t">Benkyo</text>
		<circle cx="88" cy="68" r="22" fill="none" class="ghost-s" stroke-width="7" />
		<path d="M88 46 a22 22 0 0 1 21 28" fill="none" class="hl-s" stroke-width="7" stroke-linecap="round" />
		{@render bars(122, 52, 96, 4, 14)}
		<rect x="54" y="102" width="172" height="26" rx="8" class="ghost soft" />
	{:else if kind === 'mac-file'}
		<rect x="0" y="0" width="280" height="168" class="screen" />
		<g transform="translate(0 12)">
		<rect x="0" y="-12" width="280" height="30" class="bar" />
		<rect x="10" y="6" width="22" height="6" rx="3" class="ghost" />
		<rect x="40" y="2" width="34" height="14" rx="4" class="hl" />
		<text x="57" y="12.5" class="on-hl" text-anchor="middle">{t('install.art.file')}</text>
		{#each [84, 116, 148] as x}<rect x={x} y="6" width="22" height="6" rx="3" class="ghost" />{/each}
		<rect x="40" y="20" width="132" height="118" rx="8" class="sheet" />
		{#each [0, 1, 2, 4] as i}
			<rect x="50" y={32 + i * 20} width={i % 2 ? 60 : 78} height="6" rx="3" class="ghost" />
		{/each}
		<rect x="44" y="92" width="124" height="20" rx="5" class="hl-row" />
		<text x="52" y="105.5" class="lbl">{t('install.art.addDock')}</text>
		{@render ring(57, 9, 13)}
		<rect x="190" y="40" width="74" height="96" rx="10" class="ghost soft" />
		</g>
	{:else if kind === 'mac-confirm'}
		{@render browserWindow(false)}
		{@render bars(32, 50, 140, 6, 16)}
		<rect x="15" y="32" width="250" height="147" class="dim" />
		<rect x="70" y="34" width="140" height="94" rx="12" class="sheet" />
		{@render appIcon(80, 46, 26)}
		<text x="114" y="57" class="lbl">Benkyo</text>
		<text x="114" y="69" class="url">{host}</text>
		<text x="140" y="117.5" class="soft-t" text-anchor="middle">{t('common.cancel')}</text>
		<rect x="164" y="104" width="38" height="20" rx="7" class="hl" />
		<text x="183" y="117.5" class="on-hl" text-anchor="middle">{t('install.art.add')}</text>
		{@render ring(183, 114, 17)}
	{:else if kind === 'mac-dock'}
		<rect x="0" y="0" width="280" height="168" class="screen" />
		<rect x="0" y="0" width="280" height="14" class="bar" />
		<rect x="60" y="26" width="160" height="96" rx="10" class="ghost soft" />
		<rect x="40" y="132" width="200" height="30" rx="10" class="sheet" />
		{#each [50, 76, 102, 154, 180, 206] as x}<rect x={x} y="137" width="20" height="20" rx="5" class="ghost" />{/each}
		{@render appIcon(128, 137, 20)}
		<circle cx="138" cy="160" r="1.4" class="ink" />
		{@render ring(138, 147, 15)}
	{/if}
</svg>

<style>
	.art {
		display: block;
		width: 100%;
		height: auto;
		font-family: var(--font-text);
		border-radius: var(--radius-control);
		background: color-mix(in srgb, var(--color-accent) 7%, var(--color-bg-2));
	}
	.frame {
		fill: var(--color-surface-strong);
		stroke: var(--color-text-3);
		stroke-width: 1.5;
	}
	.screen {
		fill: var(--color-bg);
	}
	.notch {
		fill: var(--p-sumi-950);
	}
	.bar {
		fill: color-mix(in srgb, var(--color-text) 6%, var(--color-bg));
	}
	.pill {
		fill: var(--color-fill-strong);
	}
	.ghost {
		fill: var(--color-fill-strong);
	}
	.ghost.soft {
		fill: var(--color-fill);
	}
	.ghost-s {
		stroke: var(--color-fill-strong);
	}
	.dim {
		fill: rgb(0 0 0 / 0.28);
	}
	.sheet {
		fill: var(--color-bg-2);
		stroke: var(--color-border);
	}
	.row {
		fill: var(--color-bg);
	}
	.hl-row {
		fill: color-mix(in srgb, var(--color-accent) 16%, var(--color-bg));
		stroke: var(--color-accent);
		stroke-width: 1.2;
	}
	.ink {
		fill: var(--color-text-2);
	}
	.ink-s {
		stroke: var(--color-text-2);
	}
	.hl {
		fill: var(--color-accent);
	}
	.hl-s {
		stroke: var(--color-accent);
	}
	.ok {
		fill: var(--color-success);
	}
	.knob {
		fill: var(--color-knob);
	}
	text {
		fill: var(--color-text);
		font-size: 9px;
	}
	.url {
		fill: var(--color-text-2);
		font-size: 7px;
	}
	.lbl {
		font-size: 9.5px;
		font-weight: 600;
	}
	.lbl.sm9 {
		font-size: 8.5px;
	}
	.lbl.sm {
		font-size: 8px;
	}
	.hl-t {
		fill: var(--color-accent);
	}
	.soft-t {
		fill: var(--color-text-2);
		font-size: 9px;
	}
	.small-t {
		font-size: 8px;
	}
	.cap {
		font-size: 6.5px;
		font-weight: 600;
	}
	.on-hl {
		fill: var(--color-on-accent);
		font-size: 9px;
		font-weight: 600;
	}
	.ring {
		fill: none;
		stroke: var(--color-accent);
		stroke-width: 2;
	}
	.ring.dashed {
		stroke-width: 1.4;
		stroke-dasharray: 3 3;
		opacity: 0.8;
	}
	.pulse {
		transform-box: fill-box;
		transform-origin: center;
		animation: pulse 1.8s var(--ease-out, ease-out) infinite;
	}
	@keyframes pulse {
		from {
			transform: scale(1);
			opacity: 0.7;
		}
		to {
			transform: scale(1.7);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pulse {
			animation: none;
			opacity: 0;
		}
	}
</style>

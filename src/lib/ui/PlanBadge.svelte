<!--
	The learner's package as a small pill. Paid packages (Plus, Pro, or one made
	in the Fleet console) get a gradient with a light sweep across it every few
	seconds; Free is a quiet neutral pill with no motion. The sweep stops under
	prefers-reduced-motion. `shine={false}` keeps the gradient but no sweep.
	`loading` shows a shimmering empty pill while the package is fetched.
-->
<script lang="ts">
	let {
		plan,
		name,
		shine = true,
		size = 'md',
		loading = false,
		loadingLabel = 'Loading package'
	}: {
		/** plan id: 'free', 'plus', 'pro' or a console package id */
		plan: string;
		/** label to show (the package's name) */
		name: string;
		shine?: boolean;
		size?: 'sm' | 'md';
		loading?: boolean;
		loadingLabel?: string;
	} = $props();

	const tier = $derived(plan === 'free' ? 'free' : plan === 'plus' ? 'plus' : plan === 'pro' ? 'pro' : 'custom');
</script>

{#if loading}
	<span class="plan-badge skeleton {size}" role="status" aria-busy="true" aria-label={loadingLabel}></span>
{:else}
	<span class="plan-badge {tier} {size}" class:shine={shine && tier !== 'free'} title={name}>
		{#if tier !== 'free'}<span class="spark" aria-hidden="true">✦</span>{/if}
		<span class="label">{name}</span>
	</span>
{/if}

<style>
	.plan-badge {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-px) var(--space-2);
		border-radius: var(--radius-pill);
		font-size: var(--text-caption);
		font-weight: var(--weight-bold);
		line-height: 1.4;
		letter-spacing: 0.02em;
		white-space: nowrap;
		overflow: hidden;
		isolation: isolate;
		vertical-align: middle;
	}
	.sm {
		padding: 0 var(--space-1h);
		font-size: var(--text-caption-2);
	}
	.label {
		max-width: 14em;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.spark {
		font-size: 0.85em;
	}
	.free {
		background: var(--color-fill);
		color: var(--color-text-2);
		font-weight: var(--weight-semibold);
	}
	.plus {
		background: linear-gradient(115deg, var(--p-ai-500), var(--p-sumire-500) 60%, var(--p-sumire-400));
		color: var(--p-white);
		box-shadow: 0 4px 14px -6px color-mix(in srgb, var(--p-sumire-500) 70%, transparent);
	}
	.pro {
		background: linear-gradient(115deg, var(--p-yamabuki-400), var(--p-yamabuki-500) 45%, var(--p-shu-400));
		color: var(--p-sumi-900);
		box-shadow: 0 4px 14px -6px color-mix(in srgb, var(--p-yamabuki-500) 80%, transparent);
	}
	.custom {
		background: linear-gradient(115deg, var(--p-sumire-500), var(--p-shu-500));
		color: var(--p-white);
		box-shadow: 0 4px 14px -6px color-mix(in srgb, var(--p-sumire-500) 60%, transparent);
	}
	.skeleton {
		width: 4.5em;
		height: 1.4em;
		box-sizing: content-box;
		background: linear-gradient(100deg, var(--color-fill) 30%, var(--color-fill-strong) 50%, var(--color-fill) 70%);
		background-size: 300% 100%;
		animation: plan-sk 1.4s ease-in-out infinite;
	}
	@keyframes plan-sk {
		0% {
			background-position: 100% 0;
		}
		100% {
			background-position: -100% 0;
		}
	}
	.shine::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		background: linear-gradient(105deg, transparent 30%, rgb(255 255 255 / 0.65) 48%, rgb(255 255 255 / 0.15) 54%, transparent 70%);
		transform: translateX(-120%);
		animation: plan-shine 3.6s ease-in-out 0.6s infinite;
	}
	/* the label sits above the sweep's layer but the sweep still reads over the gradient */
	.shine > * {
		position: relative;
	}
	@keyframes plan-shine {
		0% {
			transform: translateX(-120%);
		}
		40%,
		100% {
			transform: translateX(120%);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.skeleton {
			animation: none;
		}
		.shine::after {
			animation: none;
			opacity: 0;
		}
	}
</style>

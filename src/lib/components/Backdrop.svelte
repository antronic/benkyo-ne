<!-- Slow-drifting blurred colour fields behind the glass. CSS only. -->
<script lang="ts">
	let { hue = 8 }: { hue?: number } = $props();
</script>

<div class="backdrop" aria-hidden="true" style:--h={hue}>
	<div class="blob a"></div>
	<div class="blob b"></div>
	<div class="blob c"></div>
	<div class="grain"></div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		background: var(--bg);
		pointer-events: none;
	}
	.blob {
		position: absolute;
		width: 70vmax;
		height: 70vmax;
		border-radius: 50%;
		filter: blur(80px);
		opacity: 0.45;
		transition: background 1.2s var(--ease-out);
		animation: drift 28s ease-in-out infinite alternate;
	}
	.a {
		background: hsl(var(--h) 85% 68%);
		top: -30vmax;
		left: -20vmax;
	}
	.b {
		background: hsl(calc(var(--h) + 210) 75% 66%);
		bottom: -35vmax;
		right: -25vmax;
		animation-duration: 34s;
		animation-delay: -8s;
	}
	.c {
		background: hsl(calc(var(--h) + 40) 90% 72%);
		top: 30%;
		left: 40%;
		width: 40vmax;
		height: 40vmax;
		opacity: 0.25;
		animation-duration: 40s;
	}
	@media (prefers-color-scheme: dark) {
		.blob {
			opacity: 0.22;
		}
	}
	.grain {
		position: absolute;
		inset: 0;
		opacity: 0.05;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
	}
	@keyframes drift {
		to {
			transform: translate(8vmax, 6vmax) scale(1.15);
		}
	}
	:global(html.hidden) .blob {
		animation-play-state: paused;
	}
</style>

<!--
	A button that opens the file picker (or the camera on a phone). Looks like
	Button; the native input is hidden inside it.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		accept,
		capture,
		variant = 'ghost',
		block = false,
		disabled = false,
		onpick,
		children
	}: {
		accept?: string;
		capture?: 'user' | 'environment';
		variant?: 'primary' | 'accent' | 'ghost';
		block?: boolean;
		disabled?: boolean;
		onpick: (file: File) => void;
		children: Snippet;
	} = $props();
</script>

<label class="btn {variant === 'primary' ? '' : variant}" class:block class:disabled>
	{@render children()}
	<input
		type="file"
		{accept}
		{capture}
		{disabled}
		onchange={(e) => {
			const f = e.currentTarget.files?.[0];
			if (f) onpick(f);
			e.currentTarget.value = '';
		}}
	/>
</label>

<style>
	label {
		position: relative;
		overflow: hidden;
	}
	input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}
	.disabled {
		opacity: 0.4;
		pointer-events: none;
	}
</style>

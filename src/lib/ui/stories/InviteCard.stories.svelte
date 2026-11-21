<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { InviteCard, sampleInk } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Learning/InviteCard',
		component: InviteCard,
		args: {
			inline: true,
			code: 'VIP',
			from: 'Job',
			note: 'Saved you a seat. Start with kana, I’ll check in on Friday.',
			ink: sampleInk(),
			perk: 'Plus trial · 14 days',
			replay: 0
		}
	});
</script>

<Story name="Inline" />
<Story name="No ink, no perk" args={{ ink: null, perk: null }} />
<Story
	name="Pop-up"
	args={{ inline: false, open: true, onaccept: () => {}, onclose: () => {} }}
	parameters={{ layout: 'fullscreen', docs: { story: { inline: false, height: '760px' } } }}
/>

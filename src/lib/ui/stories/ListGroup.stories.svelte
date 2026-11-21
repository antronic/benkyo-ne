<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { ListGroup, ListRow } from '#lib/ui/index.ts';

	const { Story } = defineMeta({ title: 'Content/ListGroup', component: ListGroup });
</script>

<Story name="Settings list" asChild>
	<ListGroup>
		<ListRow title="Account" subtitle="Signed in with a passkey" href="#account" chevron />
		<ListRow title="Language" href="#language" chevron>{#snippet trailing()}<span class="caption">English</span>{/snippet}</ListRow>
		<ListRow title="Sign out" tone="danger" onclick={() => {}} />
	</ListGroup>
</Story>

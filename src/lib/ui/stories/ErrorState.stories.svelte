<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Card, ErrorState } from '#lib/ui/index.ts';

	const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
	const KINDS = ['offline', 'not-found', 'server', 'session', 'access', 'crash', 'update'] as const;

	const { Story } = defineMeta({
		title: 'Feedback/ErrorState',
		component: ErrorState,
		args: {
			kind: 'server',
			layout: 'page',
			status: 500,
			errorId: 'E-7F3K2Q',
			build: '1795166208411',
			message: 'PUT /api/admin/credit-rates → 500',
			kuri: true,
			retry: () => wait(900),
			sendNote: async (note: string) => (await wait(800), note.length > 0)
		},
		argTypes: { kind: { control: 'select', options: KINDS }, layout: { control: 'inline-radio', options: ['page', 'inline'] } }
	});
</script>

<Story name="Playground">
	{#snippet template(args)}<Card padding="none">{#key args.kind}<ErrorState {...args} />{/key}</Card>{/snippet}
</Story>
<Story name="Offline" args={{ kind: 'offline', status: undefined }} />
<Story name="Not found" args={{ kind: 'not-found', status: 404 }} />
<Story name="Signed out" args={{ kind: 'session', status: 401 }} />
<Story name="Fleet 403" args={{ kind: 'access', status: 403, home: { href: '/admin', label: 'Fleet overview' } }} />
<Story name="Crash" args={{ kind: 'crash', status: undefined }} />
<Story name="Update" args={{ kind: 'update', status: undefined }} />
<Story name="Inline" args={{ layout: 'inline', errorId: 'E-9QH2MX' }} />
<Story name="Inline offline" args={{ layout: 'inline', kind: 'offline', status: undefined, errorId: undefined, message: undefined }} />

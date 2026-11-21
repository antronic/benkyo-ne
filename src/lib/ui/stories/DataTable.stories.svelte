<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { DataTable, type DataColumn } from '#lib/ui/index.ts';

	type Row = { id: number; name: string; plan: string; ai: string };
	const COLUMNS: DataColumn[] = [
		{ key: 'name', label: 'Account' },
		{ key: 'plan', label: 'Package' },
		{ key: 'ai', label: 'AI this month', align: 'end' }
	];
	const ROWS: Row[] = [
		{ id: 1, name: 'Example Learner', plan: 'Plus', ai: '$0.42' },
		{ id: 2, name: 'Second Learner', plan: 'Free', ai: '$0.00' },
		{ id: 3, name: 'Third Learner', plan: 'Pro', ai: '$3.10' }
	];

	const { Story } = defineMeta({
		title: 'Data/DataTable',
		component: DataTable,
		parameters: { docs: { description: { component: 'Columns on wide screens, one stacked block per row when narrow. Try the phone viewport.' } } }
	});
</script>

<Story name="Accounts" asChild>
	<DataTable label="Example accounts" columns={COLUMNS} rows={ROWS} key={(r) => r.id} href={(r) => `#account-${r.id}`}>
		{#snippet cell(r, c)}{r[c.key as keyof Row]}{/snippet}
	</DataTable>
</Story>

<Story name="Empty" asChild>
	<DataTable label="No accounts" columns={COLUMNS} rows={[] as Row[]} key={(r) => r.id}>
		{#snippet cell(r, c)}{r[c.key as keyof Row]}{/snippet}
	</DataTable>
</Story>

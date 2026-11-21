<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { BarChart } from '#lib/ui/index.ts';

	const WEEK = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'].map((day, i) => ({ day, value: [12, 16, 8, 19, 4, 0, 11][i] }));
	const FORTNIGHT = Array.from({ length: 14 }, (_, i) => ({ day: `2026-11-${String(i + 1).padStart(2, '0')}`, value: [2, 4, 3, 6, 5, 8, 7, 4, 9, 6, 5, 7, 10, 8][i] }));

	const { Story } = defineMeta({
		title: 'Data/BarChart',
		component: BarChart,
		args: { days: WEEK, label: 'Minutes a day this week', column: 'Minutes', format: (n: number) => `${n} min` }
	});
</script>

<Story name="Week" />
<Story name="Two weeks" args={{ days: FORTNIGHT, label: 'Reviews a day', column: 'Reviews', format: (n: number) => String(n) }} />
<Story name="No data" args={{ days: WEEK.map((d) => ({ ...d, value: 0 })) }} />

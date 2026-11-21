<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { PlanBadge } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Content/PlanBadge',
		component: PlanBadge,
		args: { plan: 'pro', name: 'Pro', shine: true, size: 'md', loading: false },
		argTypes: { plan: { control: 'select', options: ['free', 'plus', 'pro', 'exam-sprint-k3x9a'] }, size: { control: 'inline-radio', options: ['sm', 'md'] } }
	});
</script>

<Story name="Playground" />

<Story name="Packages" asChild>
	<div class="stack" style:--gap="var(--space-3)">
		<div class="row wrap" style:--gap="var(--space-2)">
			<PlanBadge plan="pro" name="Pro" />
			<PlanBadge plan="plus" name="Plus" />
			<PlanBadge plan="exam-sprint-k3x9a" name="Exam sprint" />
			<PlanBadge plan="free" name="Free" />
		</div>
		<div class="row wrap" style:--gap="var(--space-2)">
			<PlanBadge plan="pro" name="Pro" size="sm" />
			<PlanBadge plan="plus" name="Plus" size="sm" />
			<PlanBadge plan="plus" name="Plus, no shine" shine={false} />
			<PlanBadge plan="free" name="" loading />
		</div>
	</div>
</Story>

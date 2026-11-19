<!--
	Design system catalog: every token and component, in light and dark.
	Not linked from the tab bar; open /design directly.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { BarChart, Badge, Breadcrumbs, Button, Card, Checkbox, Chip, Columns, DataTable, FieldRow, FileButton, IconButton, LargeTitle, ListGroup, ListRow, MenuBar, Notice, PageDots, PlanBadge, ProgressRing, SectionHeader, Segmented, Select, Sheet, SideNav, Skeleton, Slider, Spinner, StatTile, Stepper, Switch, TextArea, TextField } from '#lib/ui/index.ts';
	import PromoCode from '#lib/components/PromoCode.svelte';
	import { PromoRequestError } from '#lib/promo/client.ts';
	import type { PromoStatus } from '#lib/promo/contract.ts';
	import { colorGroups, motionPatterns, motionTokens, radiusTokens, spaceTokens, textStyles } from '#lib/design/tokens.ts';

	type Mode = 'auto' | 'light' | 'dark' | 'both';
	let mode = $state<Mode>(matchMedia('(min-width: 900px)').matches ? 'both' : 'auto');
	let root: HTMLElement;
	let values = $state<Record<string, string>>({});

	// demo state
	let haptics = $state(true);
	let romaji = $state(false);
	let quizMode = $state<'read' | 'write' | 'listen'>('read');
	let filter = $state('due');
	let newPerDay = $state(10);
	let nav = $state<'auto' | 'bottom' | 'side'>('auto');
	let word = $state('');
	let reading = $state('たべる');
	let agreed = $state(false);
	let retention = $state(0.9);
	let confirmName = $state('');
	let picked = $state('');
	let sheetOpen = $state(false);
	let dotPage = $state(1);
	let saving = $state(false);
	const barDays = Array.from({ length: 14 }, (_, i) => ({ day: `2026-11-${String(i + 1).padStart(2, '0')}`, value: [2, 4, 3, 6, 5, 8, 7, 4, 9, 6, 5, 7, 10, 8][i] }));
	function fakeSave() {
		saving = true;
		setTimeout(() => (saving = false), 1500);
	}

	// promo code demo: no network, a short wait so the busy state shows
	const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
	const fakePromoFree = async (): Promise<PromoStatus> => (await wait(600), { plan: 'free', planName: 'Free', grant: null });
	const fakePromoTrial = async (): Promise<PromoStatus> => (
		await wait(900), { plan: 'plus', planName: 'Plus', grant: { kind: 'trial', endsAt: Date.now() + 21 * 86_400_000, promoCode: 'WELCOME30' } }
	);
	async function fakeRedeem(code: string) {
		await wait(700);
		if (code.toUpperCase().replace(/[\s\-_.]/g, '') !== 'SONGKRAN27') throw new PromoRequestError(404, 'invalid', 'invalid');
		return { code: 'SONGKRAN27', plan: 'pro', planName: 'Pro', grant: { kind: 'comp' as const, endsAt: Date.now() + 30 * 86_400_000, promoCode: 'SONGKRAN27' } };
	}

	const tokenNames = [...colorGroups.flatMap((g) => g.tokens.map((t) => t.name)), ...spaceTokens, ...radiusTokens];

	function readValues() {
		const out: Record<string, string> = {};
		for (const panel of root.querySelectorAll<HTMLElement>('[data-panel]')) {
			const cs = getComputedStyle(panel);
			for (const n of tokenNames) out[`${panel.dataset.panel}:${n}`] = cs.getPropertyValue(n).trim();
		}
		values = out;
	}

	$effect(() => {
		const html = document.documentElement;
		if (mode === 'light' || mode === 'dark') html.dataset.theme = mode;
		else delete html.dataset.theme;
		requestAnimationFrame(readValues);
	});

	onMount(() => {
		const mq = matchMedia('(prefers-color-scheme: dark)');
		const on = () => requestAnimationFrame(readValues);
		mq.addEventListener('change', on);
		return () => {
			mq.removeEventListener('change', on);
			delete document.documentElement.dataset.theme;
		};
	});

	// Replay a motion demo: restart the CSS animation on its stage.
	function replay(e: MouseEvent) {
		const b = (e.target as HTMLElement).closest<HTMLElement>('[data-replay]');
		if (!b) return;
		const stage = b.closest('.mrow-demo')?.querySelector<HTMLElement>('.stage');
		if (!stage) return;
		stage.classList.remove('play');
		void stage.offsetWidth;
		stage.classList.add('play');
	}

	const panels = $derived(mode === 'both' ? (['light', 'dark'] as const) : (['current'] as const));
	const px = (v: string | undefined) => (v ? v.replace(/^0$/, '0px') : '');
</script>

<svelte:head><title>Design system · Benkyo</title></svelte:head>

<main class="page stack catalog" style:--gap="var(--space-4)" bind:this={root} onclick={replay} role="presentation">
	<LargeTitle title="Design system" />
	<p class="subhead intro">
		Tokens live in <code class="mono">lib/design/tokens.css</code>, components in <code class="mono">lib/ui</code>. Everything on this page is built from them.
	</p>
	<div class="mode">
		<Segmented
			label="Theme"
			bind:value={mode}
			options={[
				{ value: 'both', label: 'Side by side' },
				{ value: 'auto', label: 'Auto' },
				{ value: 'light', label: 'Light' },
				{ value: 'dark', label: 'Dark' }
			]}
		/>
	</div>

	<div class="panels" class:two={mode === 'both'}>
		{#each panels as p (p)}
			<section class="panel stack" style:--gap="var(--space-2)" data-panel={p} data-theme={p === 'current' ? undefined : p}>
				{#if mode === 'both'}<p class="eyebrow panel-name">{p}</p>{/if}

				<!-- ------------------------------------------------ colour -->
				<SectionHeader title="Colour" />
				{#each colorGroups as g (g.name)}
					<p class="footnote group-name">{g.name}</p>
					<div class="swatches">
						{#each g.tokens as t (t.name)}
							<div class="swatch">
								<span class="chip-color" style:background="var({t.name})"></span>
								<span class="sw-text">
									<code class="mono tok">{t.name}</code>
									<span class="caption">{t.use}</span>
									<code class="mono val">{values[`${p}:${t.name}`] ?? ''}</code>
								</span>
							</div>
						{/each}
					</div>
				{/each}
				<p class="footnote group-name">Gradients</p>
				<div class="grads">
					<div class="grad" style:background="var(--gradient-brand)"><code class="mono">--gradient-brand</code></div>
					<div class="grad" style:background="var(--gradient-ai)"><code class="mono">--gradient-ai</code></div>
				</div>

				<!-- ------------------------------------------------ type -->
				<SectionHeader title="Type" />
				<Card padding="md">
					<div class="type-list">
						{#each textStyles as s (s.name)}
							<div class="type-row">
								<span class={s.cls}>{s.name}</span>
								<code class="mono caption">{s.size} · {s.token}</code>
							</div>
						{/each}
						<div class="type-row">
							<span class="jp jp-sample">勉強しましょう</span>
							<code class="mono caption">.jp · --font-jp</code>
						</div>
					</div>
				</Card>

				<!-- ------------------------------------------------ space & radius -->
				<SectionHeader title="Spacing" />
				<Card padding="md">
					<div class="spaces">
						{#each spaceTokens as t (t)}
							<div class="space-row">
								<code class="mono caption name">{t}</code>
								<span class="bar" style:width="var({t})"></span>
								<code class="mono caption">{px(values[`${p}:${t}`])}</code>
							</div>
						{/each}
					</div>
				</Card>

				<SectionHeader title="Radius" />
				<div class="radii">
					{#each radiusTokens as t (t)}
						<div class="radius">
							<span class="rbox" style:border-radius="var({t})"></span>
							<code class="mono caption">{t.replace('--radius-', '')}</code>
						</div>
					{/each}
				</div>

				<SectionHeader title="Material and easing" />
				<div class="materials">
					<Card padding="md"><span class="headline">Glass</span><br /><span class="caption">.glass · Card</span></Card>
					<Card padding="md" strong><span class="headline">Glass strong</span><br /><span class="caption">Card strong</span></Card>
					<Card padding="md" sheen><span class="headline">Sheen</span><br /><span class="caption">Card sheen</span></Card>
				</div>
				<div class="motion">
					{#each motionTokens as m (m.name)}
						<div class="mrow">
							<span class="track"><span class="ball" style:animation-timing-function="var({m.name})"></span></span>
							<code class="mono caption">{m.name}</code>
							<span class="caption">{m.use}</span>
						</div>
					{/each}
				</div>

				<!-- ------------------------------------------------ components -->
				<SectionHeader title="Buttons" />
				<Card padding="md">
					<div class="wrap">
						<Button>Primary</Button>
						<Button variant="accent">Start lesson</Button>
						<Button variant="ghost">Ghost</Button>
						<Button variant="danger">Erase</Button>
						<Button variant="plain">Plain</Button>
					</div>
					<div class="wrap">
						<Button size="sm">Small</Button>
						<Button size="sm" variant="accent">Small accent</Button>
						<Button size="sm" variant="ghost">Small ghost</Button>
						<Button size="sm" busy>Saving</Button>
						<Button size="sm" disabled>Disabled</Button>
					</div>
					<div class="wrap">
						<IconButton label="Play audio">🔊</IconButton>
						<IconButton label="Close">✕</IconButton>
						<IconButton label="More" size="sm">⋯</IconButton>
					</div>
					<Button variant="accent" block>Block button</Button>
				</Card>

				<SectionHeader title="Chips and badges" />
				<Card padding="md">
					<div class="wrap">
						{#each [['due', 'Due', 12], ['new', 'New', 4], ['all', 'All', 186]] as [v, l, c] (v)}
							<Chip selected={filter === v} count={c as number} onclick={() => (filter = v as string)}>{l}</Chip>
						{/each}
						<Chip tone="accent">Drill weak words</Chip>
					</div>
					<div class="wrap">
						<Badge>Neutral</Badge>
						<Badge tone="accent">Accent</Badge>
						<Badge tone="info">Info</Badge>
						<Badge tone="success">Synced</Badge>
						<Badge tone="warning">Due</Badge>
						<Badge tone="danger">Failed</Badge>
						<Badge tone="violet">AI</Badge>
					</div>
					<div class="wrap">
						<Badge variant="solid" tone="accent">3</Badge>
						<Badge variant="solid" tone="success">Beta</Badge>
						<Badge variant="tag">N5</Badge>
						<Badge variant="tag" tone="warning">Check</Badge>
						<Badge variant="tag" tone="info">New</Badge>
					</div>
				</Card>

				<SectionHeader title="Package badge" />
				<p class="caption">The learner's package beside the Today greeting. Paid packages shine every few seconds (no motion when the device asks for reduced motion); Free stays quiet, and a shimmering pill shows while the package loads.</p>
				<Card padding="md">
					<div class="wrap">
						<PlanBadge plan="pro" name="Pro" />
						<PlanBadge plan="plus" name="Plus" />
						<PlanBadge plan="exam-sprint-k3x9a" name="Exam sprint" />
						<PlanBadge plan="free" name="Free" />
						<PlanBadge plan="free" name="" loading />
					</div>
					<div class="wrap">
						<PlanBadge plan="pro" name="Pro" size="sm" />
						<PlanBadge plan="plus" name="Plus" size="sm" />
						<PlanBadge plan="plus" name="Plus, no shine" shine={false} />
					</div>
					<div class="row hello-demo">
						<span class="title-3">Good evening, Job</span>
						<PlanBadge plan="pro" name="Pro" />
					</div>
				</Card>

				<SectionHeader title="Stat tiles" />
				<div class="ui-stats">
					<StatTile label="Models listed" value={318} />
					<StatTile label="Active, 7 days" value={42} note="6 in the last 24 h" />
					<StatTile label="Failed, 24 h" value={3} tone="danger" />
				</div>

				<SectionHeader title="Grouped list" />
				<ListGroup>
					<ListRow title="Haptics">
						{#snippet trailing()}<Switch label="Haptics" bind:checked={haptics} />{/snippet}
					</ListRow>
					<ListRow title="Show romaji" subtitle="Small romaji under Japanese text.">
						{#snippet trailing()}<Switch label="Show romaji" bind:checked={romaji} />{/snippet}
					</ListRow>
					<ListRow title="New cards per day" subtitle="Each new card adds future reviews.">
						{#snippet trailing()}<Stepper label="New cards per day" bind:value={newPerDay} min={0} max={50} step={5} />{/snippet}
					</ListRow>
					<ListRow title="Tab bar position">
						{#snippet trailing()}<Select
								label="Tab bar position"
								bind:value={nav}
								options={[
									{ value: 'auto', label: 'Auto' },
									{ value: 'bottom', label: 'Bottom' },
									{ value: 'side', label: 'Side' }
								]}
							/>{/snippet}
					</ListRow>
					<ListRow title="Account" subtitle="Signed in with a passkey" href="#account">
						{#snippet leading()}<span class="avatar">J</span>{/snippet}
						{#snippet trailing()}<Badge tone="success">Synced</Badge>{/snippet}
					</ListRow>
					<ListRow title="Erase all progress" tone="danger" onclick={() => {}} />
				</ListGroup>

				<SectionHeader title="Navigation" />
				<p class="caption">
					A section's pages: SideNav as a sidebar on wide screens, MenuBar on phones opening the same list in a Sheet. Breadcrumbs on every page below the top show where you are and the way back. Fleet uses all three.
				</p>
				<Card padding="sm" class="demo-nav">
					<SideNav
						label="Example sections"
						current="#nav-accounts"
						items={[
							{ href: '#nav-overview', label: 'Overview', icon: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z' },
							{ href: '#nav-accounts', label: 'Accounts', group: 'People', note: '128', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0' },
							{ href: '#nav-packages', label: 'Packages', group: 'Plans', icon: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9' },
							{ href: '#nav-audit', label: 'Audit log', group: 'Platform', icon: 'M7 4h10a2 2 0 0 1 2 2v14l-3-2-2 2-2-2-2 2-2-2-3 2V6a2 2 0 0 1 2-2zM9 9h6M9 13h4' }
						]}
					/>
				</Card>
				<Breadcrumbs items={[{ label: 'Fleet', href: '#nav-overview' }, { label: 'Accounts', href: '#nav-accounts' }, { label: 'Example Learner' }]} />
				<MenuBar floating={false} current="Accounts" label="Example menu" icon="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0" onmenu={() => (sheetOpen = true)} />

				<SectionHeader title="Wide layouts" />
				<p class="caption">On a desktop, Columns puts sections side by side and stacks them on phones. DataTable shows records in columns, and becomes one stacked block per row when it is narrow.</p>
				<Columns min="200px">
					<section>
						<SectionHeader title="Left" level={3} />
						<ListGroup><ListRow title="First column" /></ListGroup>
					</section>
					<section>
						<SectionHeader title="Right" level={3} />
						<ListGroup><ListRow title="Second column" /></ListGroup>
					</section>
				</Columns>
				<DataTable
					label="Example accounts"
					columns={[
						{ key: 'name', label: 'Account' },
						{ key: 'plan', label: 'Package' },
						{ key: 'ai', label: 'AI this month', align: 'end' }
					]}
					rows={[
						{ id: 1, name: 'Example Learner', plan: 'Plus', ai: '$0.42' },
						{ id: 2, name: 'Second Learner', plan: 'Free', ai: '$0.00' }
					]}
					key={(r) => r.id}
					href={(r) => `#account-${r.id}`}
				>
					{#snippet cell(r, c)}{c.key === 'name' ? r.name : c.key === 'plan' ? r.plan : r.ai}{/snippet}
				</DataTable>

				<SectionHeader title="Segmented control" />
				<Segmented
					label="Quiz mode"
					bind:value={quizMode}
					options={[
						{ value: 'read', label: 'Read' },
						{ value: 'write', label: 'Write' },
						{ value: 'listen', label: 'Listen' }
					]}
				/>

				<SectionHeader title="Text fields" />
				<Card padding="md">
					<div class="stack" style:--gap="var(--space-3)">
						<TextField label="English" placeholder="e.g. to eat" bind:value={word} hint="We'll suggest the Japanese." />
						<TextField label="Reading" jp bind:value={reading} />
						<TextField label="Kanji" value="食る" error="That kanji doesn't match the reading." />
						<TextArea label="Note" placeholder="A sentence to remember it by" autogrow />
					</div>
				</Card>

				<SectionHeader title="Notices" />
				<div class="stack" style:--gap="var(--space-2)">
					<Notice title="Tip">Swipe from the left edge to go back.</Notice>
					<Notice tone="success">All 186 cards synced.</Notice>
					<Notice tone="warning" title="12 reviews due">
						Clear them before adding new cards.
						{#snippet action()}<Button size="sm" variant="ghost">Review</Button>{/snippet}
					</Notice>
					<Notice tone="danger">Couldn't reach the server. Your progress is saved on this device.</Notice>
				</div>

				<SectionHeader title="Field with an action" />
				<Card padding="md">
					<div class="stack" style:--gap="var(--space-3)">
						<p class="caption">A field and its button share one height (FieldRow, 44px by default), so neither looks heavier. The field fills the row; the button keeps its width.</p>
						<FieldRow>
							<TextField grow placeholder="Type the account name" aria-label="Account name" bind:value={confirmName} />
							<Button variant="danger" disabled={confirmName !== 'test'}>Delete</Button>
						</FieldRow>
						<FieldRow>
							<Select label="Package" value="plus" options={[{ value: 'plus', label: 'Plus' }, { value: 'pro', label: 'Pro' }]} />
							<TextField grow placeholder="Note (optional)" aria-label="Note" />
							<Button busy={saving} onclick={fakeSave}>Grant</Button>
						</FieldRow>
						<FieldRow size="lg">
							<TextField grow placeholder="Your name" aria-label="Your name" />
							<Button variant="accent">Create</Button>
						</FieldRow>
					</div>
				</Card>

				<SectionHeader title="Checkbox, slider and file" />
				<Card padding="md">
					<div class="stack" style:--gap="var(--space-3)">
						<Checkbox bind:checked={agreed}>I agree to share anonymous usage data during the beta.</Checkbox>
						<div class="row"><span>Target retention</span><span class="spacer"></span><b>{Math.round(retention * 100)}%</b></div>
						<Slider label="Target retention" min={0.8} max={0.95} step={0.01} bind:value={retention} />
						<FileButton accept="image/*" onpick={(f) => (picked = f.name)}>Choose a screenshot</FileButton>
						{#if picked}<span class="caption">Picked {picked}</span>{/if}
					</div>
				</Card>

				<SectionHeader title="Loading and progress" />
				<Card padding="md">
					<div class="stack" style:--gap="var(--space-3)">
						<p class="caption">The person always sees what the app is doing. Content that is on its way shows a Skeleton in its shape; an action in progress shows a Spinner or a busy Button.</p>
						<div class="row" style:--gap="var(--space-4)">
							<Spinner label="Loading" size="sm" />
							<Spinner label="Loading" />
							<Spinner label="Saving your cards" showLabel />
						</div>
						<Button busy={saving} onclick={fakeSave}>{saving ? 'Saving' : 'Save'}</Button>
						<Skeleton variant="row" count={2} />
						<div class="row" style:--gap="var(--space-4)">
							<ProgressRing value={0.65} size={88} width={9}><b>13</b></ProgressRing>
							<div class="spacer"><BarChart label="Reviews a day" days={barDays} column="Reviews" /></div>
						</div>
						<PageDots count={4} bind:index={dotPage} label="Intro pages" pageLabel={(n) => `Page ${n}`} />
					</div>
				</Card>

				<SectionHeader title="Sheet" />
				<Button variant="ghost" onclick={() => (sheetOpen = true)}>Open a sheet</Button>

				<SectionHeader title="Promo code (Settings)" />
				<p class="caption">Try SONGKRAN27 for success; any other code shows an error. The second card is an account already on a trial.</p>
				<div class="stack" style:--gap="var(--space-2)">
					<PromoCode load={fakePromoFree} redeem={fakeRedeem} />
					<PromoCode load={fakePromoTrial} redeem={fakeRedeem} />
				</div>

				<!-- ------------------------------------------------ motion -->
				<SectionHeader title="Motion" />
				<Card padding="md">
					<div class="principles">
						<p><strong>Springs for touch, ease-out for arrivals.</strong> Anything under the finger (presses, toggles, drags) uses a spring so it feels physical. Things that arrive on their own (pages, sheets, toasts) ease out and settle.</p>
						<p><strong>Motion shows where things went.</strong> Sheets come up from the bottom and go back down, pages morph rather than cut, and a card that opens grows from where it was.</p>
						<p><strong>Feedback starts at once.</strong> A press responds on touch, not on release. Keep state changes at 200ms and arrivals under 700ms.</p>
						<p><strong>One moment per screen.</strong> Loops live on the splash, intro and backdrop only. Study screens stay still so the kana is the thing that moves.</p>
						<p><strong>Pair motion with a haptic, never rely on it.</strong> A wrong answer shakes and buzzes and also turns red. With Reduce Motion on, everything runs in 1ms and pages swap instantly.</p>
					</div>
				</Card>
				<div class="mlist">
					{#each motionPatterns as m (m.id)}
						<Card padding="sm" class="mrow-demo">
							<div class="mtext">
								<span class="headline">{m.name}</span>
								<span class="caption">{m.when}</span>
								<code class="mono spec">{m.spec}</code>
								<span class="caption">Haptic: {m.haptic}</span>
							</div>
							<div class="stage play demo-{m.id}" aria-hidden="true">
								{#if m.id === 'press'}<span class="d-btn">Tap</span>
								{:else if m.id === 'rise'}<span class="d-card" style:--i="0"></span><span class="d-card" style:--i="1"></span><span class="d-card" style:--i="2"></span>
								{:else if m.id === 'page'}<span class="d-page old"></span><span class="d-page new"></span>
								{:else if m.id === 'sheet'}<span class="d-scrim"></span><span class="d-sheet"></span>
								{:else if m.id === 'toast'}<span class="d-toast">Saved</span>
								{:else if m.id === 'toggle'}<span class="d-switch"></span>
								{:else if m.id === 'progress'}<span class="d-track"><span class="d-fill"></span></span>
								{:else if m.id === 'shake'}<span class="d-field">食る</span>
								{:else}<span class="d-orb"></span>{/if}
							</div>
							{#if m.id !== 'ambient'}<Button variant="ghost" size="sm" class="replay" data-replay>Replay</Button>{/if}
						</Card>
					{/each}
				</div>
			</section>
		{/each}
	</div>
</main>

<Sheet open={sheetOpen} label="Example sheet" onclose={() => (sheetOpen = false)}>
	<div class="stack">
		<p>Sheets hold a short task. Drag down or tap outside to close.</p>
		<Button onclick={() => (sheetOpen = false)}>Done</Button>
	</div>
</Sheet>

<style>
	.catalog {
		--panel-max: 640px;
		--page-max: 1280px;
	}
	.intro {
		margin: 0;
	}
	.mode {
		max-width: 420px;
	}
	.panels {
		display: grid;
		gap: var(--space-6);
		grid-template-columns: minmax(0, var(--panel-max));
	}
	.panels.two {
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
	}
	.panel {
		min-width: 0;
		padding: var(--space-2) var(--space-4) var(--space-6);
		border-radius: var(--radius-sheet);
		background: var(--color-bg);
		color: var(--color-text);
	}
	.panels:not(.two) .panel {
		padding: 0;
		background: none;
	}
	.panel-name {
		margin: var(--space-3) var(--space-1h) 0;
		color: var(--color-text-2);
	}
	.group-name {
		margin: var(--space-2) var(--space-1h) 0;
	}
	code {
		font-size: 0.85em;
	}
	.swatches {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: var(--space-2);
	}
	.swatch {
		display: flex;
		gap: var(--space-3);
		align-items: center;
		padding: var(--space-2);
		border-radius: var(--radius-control);
		background: var(--color-surface);
		border: var(--hairline-w) solid var(--color-surface-edge);
	}
	.chip-color {
		flex: none;
		width: 44px;
		height: 44px;
		border-radius: var(--radius-md);
		border: var(--hairline-w) solid var(--color-border);
		background-image: none;
		box-shadow: inset 0 0 0 1px var(--color-border);
	}
	.sw-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.tok {
		font-weight: var(--weight-semibold);
	}
	.val {
		color: var(--color-text-3);
		font-size: var(--text-caption-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.grads {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2);
	}
	.grad {
		height: 64px;
		border-radius: var(--radius-control);
		display: flex;
		align-items: flex-end;
		padding: var(--space-2) var(--space-3);
		color: #fff;
	}
	.type-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.type-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;
	}
	.type-row > span {
		margin: 0;
	}
	.jp-sample {
		font-size: var(--text-title-2);
	}
	.spaces {
		display: flex;
		flex-direction: column;
		gap: var(--space-1h);
	}
	.space-row {
		display: grid;
		grid-template-columns: 96px 1fr auto;
		align-items: center;
		gap: var(--space-3);
	}
	.space-row .name {
		color: var(--color-text);
	}
	.bar {
		height: 12px;
		border-radius: 3px;
		background: var(--color-info);
	}
	.radii {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
	}
	.radius {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
	}
	.rbox {
		width: 96px;
		height: 64px;
		background: var(--color-surface-strong);
		border: 1.5px solid var(--color-accent);
	}
	.materials {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-2);
		padding: var(--space-4);
		border-radius: var(--radius-card);
		background:
			radial-gradient(circle at 20% 30%, color-mix(in srgb, var(--color-accent) 55%, transparent), transparent 45%),
			radial-gradient(circle at 80% 70%, color-mix(in srgb, var(--color-info) 55%, transparent), transparent 45%),
			var(--color-bg-2);
	}
	.motion {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}
	.mrow {
		display: grid;
		grid-template-columns: 120px auto 1fr;
		gap: var(--space-3);
		align-items: center;
	}
	.track {
		position: relative;
		height: 16px;
		border-radius: var(--radius-pill);
		background: var(--color-fill);
	}
	.ball {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 12px;
		height: 12px;
		border-radius: var(--radius-round);
		background: var(--color-accent);
		animation: slide 1800ms infinite alternate;
	}
	@keyframes slide {
		0%,
		15% {
			transform: translateX(0);
		}
		85%,
		100% {
			transform: translateX(100px);
		}
	}
	.hello-demo {
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
	.wrap {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-3);
	}
	.avatar {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-round);
		background: var(--gradient-brand);
		color: #fff;
		display: grid;
		place-items: center;
		font-weight: var(--weight-bold);
		font-size: var(--text-subhead);
	}
	/* ---- motion demos ---- */
	.principles {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		font-size: var(--text-subhead);
	}
	.principles p {
		margin: 0;
	}
	.mlist {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: var(--space-2);
	}
	.mlist :global(.mrow-demo) {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 96px;
		grid-template-rows: auto auto;
		gap: var(--space-2) var(--space-3);
	}
	.mtext {
		grid-row: 1 / span 2;
		display: flex;
		flex-direction: column;
		gap: var(--space-px);
		min-width: 0;
	}
	.spec {
		font-size: var(--text-caption-2);
		color: var(--color-info);
	}
	.catalog :global(.replay) {
		grid-column: 2;
		justify-self: center;
	}
	.stage {
		position: relative;
		width: 96px;
		height: 72px;
		border-radius: var(--radius-md);
		background: var(--color-fill);
		overflow: hidden;
		display: grid;
		place-items: center;
	}
	.d-btn {
		padding: var(--space-1h) var(--space-4);
		border-radius: var(--radius-pill);
		background: var(--color-accent);
		color: var(--color-on-accent);
		font-weight: var(--weight-semibold);
		font-size: var(--text-footnote);
	}
	.play .d-btn {
		animation: d-press 900ms var(--ease-spring) both;
	}
	@keyframes d-press {
		0%, 10% { transform: scale(1); }
		30% { transform: scale(var(--press-scale)); }
		100% { transform: scale(1); }
	}
	.demo-rise {
		display: flex;
		flex-direction: column;
		gap: var(--space-1h);
		padding: var(--space-3);
		place-items: stretch;
	}
	.d-card {
		height: 12px;
		border-radius: 4px;
		background: var(--color-surface-strong);
		box-shadow: var(--shadow-raised);
	}
	.play .d-card {
		animation: rise var(--dur-slow) var(--ease-spring) both;
		animation-delay: calc(var(--i) * var(--stagger) * 2);
	}
	.d-page {
		position: absolute;
		inset: 10px 18px;
		border-radius: 8px;
	}
	.d-page.old {
		background: var(--color-info);
		opacity: 0;
	}
	.d-page.new {
		background: var(--color-accent);
	}
	.play .d-page.old {
		animation: d-out var(--dur-page) var(--ease-out) both;
	}
	.play .d-page.new {
		animation: d-in var(--dur-page) var(--ease-out) both;
	}
	@keyframes d-out {
		from { opacity: 1; transform: none; filter: none; }
		to { opacity: 0; transform: scale(0.97); filter: blur(4px); }
	}
	@keyframes d-in {
		from { opacity: 0; transform: scale(1.02); filter: blur(4px); }
	}
	.d-scrim {
		position: absolute;
		inset: 0;
		background: rgb(0 0 0 / 0.25);
	}
	.d-sheet {
		position: absolute;
		left: 6px;
		right: 6px;
		bottom: 0;
		height: 46px;
		border-radius: 12px 12px 0 0;
		background: var(--color-surface-strong);
		box-shadow: var(--shadow-surface);
	}
	.play .d-scrim {
		animation: d-fade var(--dur-fast) both;
	}
	.play .d-sheet {
		animation: d-up var(--dur-base) cubic-bezier(0.33, 1, 0.68, 1) both;
	}
	@keyframes d-fade {
		from { opacity: 0; }
	}
	@keyframes d-up {
		from { transform: translateY(100%); }
	}
	.d-toast {
		padding: var(--space-1h) var(--space-3);
		border-radius: var(--radius-pill);
		background: var(--color-surface-strong);
		box-shadow: var(--shadow-surface);
		font-size: var(--text-footnote);
		font-weight: var(--weight-semibold);
	}
	.play .d-toast {
		animation: d-pop 380ms cubic-bezier(0.33, 1, 0.68, 1) both;
	}
	@keyframes d-pop {
		from { opacity: 0; transform: scale(0.85); }
	}
	.d-switch {
		position: relative;
		width: 51px;
		height: 31px;
		border-radius: var(--radius-pill);
		background: var(--color-success);
	}
	.d-switch::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 27px;
		height: 27px;
		border-radius: 50%;
		background: var(--color-knob);
		box-shadow: var(--shadow-knob);
		transform: translateX(20px);
	}
	.play .d-switch {
		animation: d-track 250ms both;
	}
	.play .d-switch::after {
		animation: d-knob var(--dur-toggle) var(--ease-spring-bouncy) both;
	}
	@keyframes d-track {
		from { background: var(--color-fill-strong); }
	}
	@keyframes d-knob {
		from { transform: none; }
	}
	.d-track {
		width: 72px;
		height: 8px;
		border-radius: var(--radius-pill);
		background: var(--color-fill-strong);
		overflow: hidden;
	}
	.d-fill {
		display: block;
		height: 100%;
		width: 70%;
		border-radius: inherit;
		background: var(--color-success);
	}
	.play .d-fill {
		animation: d-grow 600ms var(--ease-spring) both;
	}
	@keyframes d-grow {
		from { width: 20%; }
	}
	.d-field {
		padding: var(--space-1h) var(--space-4);
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-danger);
		background: var(--color-surface-strong);
		font-family: var(--font-jp);
	}
	.play .d-field {
		animation: shake 480ms var(--ease-out);
	}
	.d-orb {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--gradient-brand);
		filter: blur(2px);
		animation: d-breathe 6s ease-in-out infinite alternate;
	}
	@keyframes d-breathe {
		from { transform: scale(0.85); opacity: 0.7; }
		to { transform: scale(1.1); opacity: 1; }
	}
</style>

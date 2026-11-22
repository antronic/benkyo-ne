<!--
	Design system catalog: every token and component, in light and dark.
	Not linked from the tab bar; open /design directly.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Avatar, BarChart, Badge, Breadcrumbs, Button, Card, Checkbox, Chip, Columns, DataTable, ErrorState, type ErrorKind, FieldRow, FileButton, IconButton, LargeTitle, ListGroup, ListRow, MenuBar, Notice, PageDots, PlanBadge, ProgressRing, InkPad, SafariPrompt, ScrollMore, InkReplay, InviteCard, KanjiTile, MarkedText, NextStep, SetupCard, PolitenessMeter, SpeechBubble, sampleInk, type Ink, SectionHeader, Segmented, Select, Sheet, SideNav, Skeleton, Slider, Spinner, StatTile, StepBar, Stepper, Switch, SwatchPicker, TextArea, TextField, TilePicker } from '#lib/ui/index.ts';
	import { avatarSvg } from '#lib/avatar/render.ts';
	import { DEFAULTS as AV_DEFAULTS, SKIN, type Person } from '#lib/avatar/person.ts';
	import NoteCard from '#lib/components/NoteCard.svelte';
	import WordCardView from '#lib/components/WordCardView.svelte';
	import WordPoliteness from '#lib/components/WordPoliteness.svelte';
	import { politenessFromMarks } from '#lib/words/politeness.ts';
	import NavMore from '#lib/components/NavMore.svelte';
	import NavIcon from '#lib/components/NavIcon.svelte';
	import { cleanPins, MORE_ICON, splitBar } from '#lib/nav.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import CommunityNotes from '#lib/components/CommunityNotes.svelte';
	import ContentFeedback from '#lib/components/ContentFeedback.svelte';
	import { fakeFeedback } from '#lib/feedback/fake.ts';
	import { fakeCommunity } from '#lib/community/fake.ts';
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
	let peekOpen = $state(false);
	let peekText = $state('');
	// navigation draft (src/lib/nav.ts): the phone bar's More sheet, with its own pins
	let navMoreOpen = $state(false);
	let navEditing = $state(false);
	let navPins = $state<string[]>(cleanPins(undefined));
	const navSplit = $derived(splitBar(5, navPins));
	// error pages draft: one ErrorState per kind, fake id and build, no network
	let errKind = $state<ErrorKind>('server');
	const ERR_KINDS: { value: ErrorKind; label: string }[] = [
		{ value: 'server', label: '500' },
		{ value: 'crash', label: 'Bug' },
		{ value: 'offline', label: 'Offline' },
		{ value: 'not-found', label: '404' },
		{ value: 'session', label: 'Signed out' },
		{ value: 'access', label: 'Fleet 403' },
		{ value: 'update', label: 'Update' }
	];
	const ERR_STATUS: Partial<Record<ErrorKind, number>> = { server: 500, 'not-found': 404, session: 401, access: 403 };
	const fakeNote = async (note: string) => (await wait(800), note.length > 0); // ui-ok: demo for ErrorState, whose Send button shows busy
	const demoCommunity = fakeCommunity();
	const demoFeedback = fakeFeedback();
	const demoFeedbackFail = fakeFeedback({ fail: true });
	const demoCommunityNew = fakeCommunity({ joined: false });
	const demoCommunityEmpty = fakeCommunity({ empty: true });
	const demoCommunityFail = fakeCommunity({ fail: true });
	let demoNote = $state("Think tabe-ru = table.\nPast: 食べた, not 食べった.");
	let dotPage = $state(1);
	// VIP invite card: Fleet writes the note and draws; the link plays it back
	let vipInk = $state<Ink>(sampleInk());
	let vipNote = $state('Saved you a seat. Start with kana, I’ll check in on Friday.');
	let vipFrom = $state('Job');
	let vipReplay = $state(0);
	let vipPopup = $state(false);
	// a VIP can carry a promo code (Fleet → Invitations); the card shows what it gives
	let vipCoupon = $state('WELCOME30');
	const VIP_COUPONS = [
		{ value: '', label: 'No promo code' },
		{ value: 'WELCOME30', label: 'WELCOME30 · Plus trial · 14 days' },
		{ value: 'SONGKRAN27', label: 'SONGKRAN27 · Pro on us · 30 days' }
	];
	const vipPerk = $derived(vipCoupon === 'WELCOME30' ? 'Plus trial · 14 days' : vipCoupon === 'SONGKRAN27' ? 'Pro on us · 30 days' : null);
	// avatar demo: parts from lib/avatar/person.ts, drawn by the Benkyo style pack
	let avHair = $state<Person['hair']>('swept');
	let avSkin = $state<Person['skin']>('s4');
	const avPerson = $derived<Person>({ ...AV_DEFAULTS, hair: avHair, skin: avSkin });
	const AV_HAIR: { value: Person['hair']; label: string }[] = [
		{ value: 'swept', label: 'Swept' },
		{ value: 'bob', label: 'Bob' },
		{ value: 'curly', label: 'Curly' },
		{ value: 'bun', label: 'Bun' }
	];
	const AV_SKIN = (Object.keys(SKIN) as Person['skin'][]).slice(0, 6).map((k, i) => ({ value: k, color: SKIN[k], label: `Skin tone ${i + 1}` }));
	// Everyday Japanese drafts (docs/EVERYDAY.md): phrasebook, Writing helper, kanji you keep forgetting, domain packs, weekly report
	let politeTarget = $state<'friend' | 'colleague' | 'boss' | 'customer'>('boss');
	let politeFixed = $state(false);
	const POLITE_TARGET = { friend: 0.1, colleague: 0.5, boss: 0.78, customer: 0.9 };
	/** Word politeness draft: real words with the JMdict marks of their first sense. */
	const POLITE_WORDS = [
		{ front: 'たべる', kanji: '食べる', gloss: 'to eat', marks: [] },
		{ front: 'おまえ', kanji: 'お前', gloss: 'you (to an equal or below)', marks: ['fam', 'male'] },
		{ front: 'サーセン', kanji: null, gloss: 'sorry (slangy すみません)', marks: ['sl'] },
		{ front: 'すみません', kanji: null, gloss: 'excuse me; I’m sorry', marks: ['uk', 'pol'] },
		{ front: 'いらっしゃる', kanji: null, gloss: 'to come; to go; to be (someone above you)', marks: ['hon'] },
		{ front: 'もうす', kanji: '申す', gloss: 'to say; to be called (about yourself)', marks: ['hum'] },
		{ front: 'さくねん', kanji: '昨年', gloss: 'last year', marks: ['form'] }
	].map((w) => ({ ...w, level: politenessFromMarks(w.marks, w.kanji ?? w.front), gloss2: null, hook: null, usage: null, example: null, kind: 'word' as const, verified: true }));
	let politeWord = $state('いらっしゃる');
	const politeCard = $derived(POLITE_WORDS.find((w) => w.front === politeWord) ?? POLITE_WORDS[0]);

	const politeYours = $derived(politeFixed ? 0.8 : 0.22);
	const PHRASES = [
		{ jp: 'よろしくお願いします', from: 'Writing helper · LINE', n: 23 },
		{ jp: '資料', from: 'Photo · Slack · look-up', n: 14 },
		{ jp: '確認します', from: 'Writing helper', n: 11 },
		{ jp: 'お手数ですが', from: 'Photo · LINE', n: 6 }
	];
	const FORGOT = [
		{ k: '議', r: 'ぎ', m: 3, w: 1 },
		{ k: '確', r: 'かく', m: 2, w: 2 },
		{ k: '認', r: 'にん', m: 1, w: 2 },
		{ k: '締', r: 'し', m: 2, w: 1 },
		{ k: '較', r: 'かく', m: 2, w: 0 },
		{ k: '与', r: 'よ', m: 1, w: 1 }
	];
	const LEVELS = [
		{ id: 'N5', name: 'Beginner', ex: 'これは わたしの ほん です。' },
		{ id: 'N4', name: 'Basic', ex: '雨が降ったら、家で映画を見ます。' },
		{ id: 'N3', name: 'Everyday, work', ex: '会議の資料を事前に共有してもらえますか。' },
		{ id: 'N2', name: 'Business', ex: 'ご多忙のところ恐縮ですが、ご確認願います。' },
		{ id: 'N1', name: 'Advanced', ex: '当該案件につき、遺憾ながら見送らせていただきます。' }
	] as const;
	let myLevel = $state<(typeof LEVELS)[number]['id']>('N3');
	const weekDays = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'].map((day, i) => ({ day, value: [12, 16, 8, 19, 4, 0, 11][i] }));
	let saving = $state(false);
	const barDays = Array.from({ length: 14 }, (_, i) => ({ day: `2026-11-${String(i + 1).padStart(2, '0')}`, value: [2, 4, 3, 6, 5, 8, 7, 4, 9, 6, 5, 7, 10, 8][i] }));
	function fakeSave() {
		saving = true;
		setTimeout(() => (saving = false), 1500);
	}

	// promo code demo: no network, a short wait so the busy state shows
	const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
	const fakePromoFree = async (): Promise<PromoStatus> => (await wait(600), { plan: 'free', planName: 'Free', grant: null }); // ui-ok: demo data for PromoCode, which shows its own skeleton and busy state
	const fakePromoTrial = async (): Promise<PromoStatus> => ( // ui-ok: demo data for PromoCode, which shows its own skeleton and busy state
		await wait(900), { plan: 'plus', planName: 'Plus', grant: { kind: 'trial', endsAt: Date.now() + 21 * 86_400_000, promoCode: 'WELCOME30' } }
	);
	async function fakeRedeem(code: string) { // ui-ok: demo data for PromoCode, which shows its own skeleton and busy state
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
		Tokens live in <code class="mono">lib/design/tokens.css</code>, components in <code class="mono">lib/ui</code>. Everything on this page is built from them. Each kit component also has its own page, with its props and states, in
		<a href="/storybook/" data-sveltekit-reload>Storybook</a>.
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
					<div class="wrap" data-mixed-sizes>
						<IconButton label="Play audio">🔊</IconButton>
						<IconButton label="Close">✕</IconButton>
						<IconButton label="More" size="sm">⋯</IconButton>
						<IconButton label="Random look" size="lg">🎲</IconButton>
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

				<SectionHeader title="Next step" />
				<p class="caption">The one thing to do now, at the top of Today: an eyebrow, a title, one line and one button. A quiet "Then" link names what comes after. When today's work is done the card turns calm and has no button.</p>
				<div class="stack" style:--gap="var(--space-3)">
					<NextStep hue={8} eyebrow="Start here · Hiragana" title="Vowels" body="5 new kana · about 4 min" action="Start lesson" href="/design" then={{ label: 'Then: Travel words and phrases', href: '/design' }}>
						{#snippet art()}<span class="jp" style="font-size:3.5rem;opacity:.55">あいう</span>{/snippet}
					</NextStep>
					<NextStep hue={265} eyebrow="Reviews due" title="12 cards" body="Timed to come up just before you’d forget them." action="Start review" href="/design" then={{ label: 'Then: K-row', href: '/design' }} />
					<NextStep done eyebrow="Today" title="That’s today’s new kana" body="Stop here and review tomorrow. It sticks better." then={{ label: 'Or look around Learn', href: '/design' }} />
				</div>

				<SectionHeader title="Set-up card" />
				<p class="caption">Optional set-up steps wait here instead of in front of the first lesson. Each row has one small button and is ticked off when done; ✕ hides the card.</p>
				<SetupCard
					title="Set up Benkyo"
					count="1 of 3 done"
					items={[
						{ id: 'avatar', icon: '🙂', title: 'Make your avatar', body: 'It shows next to your name.', action: 'Make', onclick: () => {} },
						{ id: 'install', icon: '📲', title: 'Install the app', body: 'Opens full screen and works offline.', action: 'Install', busy: true, onclick: () => {} },
						{ id: 'plan', icon: '🎯', title: 'Pick your daily goal', done: true }
					]}
					ondismiss={() => {}}
				/>

				<SectionHeader title="VIP invite card" />
				<Card padding="md">
					<div class="stack" style:--gap="var(--space-3)">
						<span class="caption">
							A VIP is made in Fleet → Invitations: a name (the link, /invite/VIP), a note, who it's from, an optional drawing and
							an optional promo code. Opening the link plays this card, then sign-up with the invite filled in; the promo code is used
							after sign-up (a ?coupon= in the link wins). The buttons come in with the note. Reduced motion shows it without animation.
						</span>
						<TextField label="Note" bind:value={vipNote} maxlength={160} />
						<TextField label="From" bind:value={vipFrom} maxlength={40} />
						<InkPad bind:value={vipInk} label="Handwriting for the invite" placeholder="Write or draw here (Fleet)" />
						<Select label="Promo code" options={VIP_COUPONS} bind:value={vipCoupon} />
						<span class="caption">InkReplay on its own: plays the handwriting back at the writer's speed.</span>
						{#key vipReplay}<InkReplay ink={vipInk} label="Handwriting played back" />{/key}
						<div class="wrap">
							<Button size="sm" onclick={() => vipReplay++}>Play again</Button>
							<Button size="sm" variant="ghost" onclick={() => (vipPopup = true)}>Open as popup</Button>
						</div>
						<InviteCard inline replay={vipReplay} code="VIP" from={vipFrom} note={vipNote} ink={vipInk.strokes.length ? vipInk : null} perk={vipPerk} />
					</div>
				</Card>
				<InviteCard
					open={vipPopup}
					code="VIP"
					from={vipFrom}
					note={vipNote}
					ink={vipInk.strokes.length ? vipInk : null}
					perk={vipPerk}
					onaccept={() => (vipPopup = false)}
					onclose={() => (vipPopup = false)}
				/>

				<SectionHeader title="Word politeness" />
				<p class="caption">
					On a word’s card: how polite the word is, as a step bar from casual to formal, and who you can say it to. The level comes from the
					dictionary’s usage marks (JMdict), so it works offline and costs nothing. Words with no mark are neutral: the sentence ending sets
					the politeness. Shown on the Words card and in word packs.
				</p>
				<div class="row wrap" style:--gap="var(--space-2)" role="group" aria-label="Sample word">
					{#each POLITE_WORDS as w (w.front)}<Chip selected={politeWord === w.front} onclick={() => (politeWord = w.front)}>{w.kanji ?? w.front}</Chip>{/each}
				</div>
				<Card padding="md">
					<div class="stack" style:--gap="var(--space-4)">
						<WordCardView card={politeCard} compact />
						<WordPoliteness level={politeCard.level} />
					</div>
				</Card>
				<SectionHeader title="Step bar" level={3} />
				<Card padding="md">
					<div class="stack" style:--gap="var(--space-4)">
						<StepBar steps={['Casual', 'Polite', 'Keigo', 'Formal']} value={1} label="Politeness" />
						<StepBar steps={['Casual', 'Polite', 'Keigo', 'Formal']} value={null} tones={['warning', 'success', 'info', 'violet']} label="Politeness" anyLabel="Any level" />
					</div>
				</Card>

				<SectionHeader title="Draft · Everyday Japanese" />
				<p class="caption">
					Drafts for people who already use Japanese every day (docs/EVERYDAY.md). Not in the app yet: these are the pieces Job approved in the
					Design Studio, built from the kit so the real screens can use them.
				</p>

				<SectionHeader title="Pick your level" level={3} />
				<p class="caption">No quiz: the learner picks the hardest sentence they can read, and Learn opens there with nothing locked.</p>
				<ListGroup>
					{#each LEVELS as l (l.id)}
						<ListRow title="{l.id} · {l.name}" selected={myLevel === l.id} onclick={() => (myLevel = l.id)}>
							<span class="jp caption">{l.ex}</span>
						</ListRow>
					{/each}
				</ListGroup>
				<Segmented label="Your level" bind:value={myLevel} options={LEVELS.map((l) => ({ value: l.id, label: l.id }))} />
				<Card padding="md">
					<div class="stack" style:--gap="var(--space-2)">
						<span class="headline">Already know this?</span>
						<span class="caption">Answer 3 quick questions and the unit is marked done. Get one wrong and you study it as usual.</span>
						<div class="wrap">
							<Button size="sm" variant="ghost">Test out</Button>
							<Button size="sm" variant="accent">Study it</Button>
						</div>
					</div>
				</Card>

				<SectionHeader title="Phrasebook" level={3} />
				<Card padding="md">
					<div class="stack" style:--gap="var(--space-2)">
						<span class="caption">Read a photo: words found in a LINE screenshot are marked.</span>
						<MarkedText
							parts={[
								{ text: '明日の' },
								{ text: '定例会議', kind: 'mark' },
								{ text: 'ですが、' },
								{ text: '資料', kind: 'mark' },
								{ text: 'を事前に' },
								{ text: '共有', kind: 'mark' },
								{ text: 'していただけますか？' }
							]}
						/>
					</div>
				</Card>
				<ListGroup>
					{#each PHRASES as ph, i (ph.jp)}
						<ListRow>
							{#snippet leading()}<span class="rank">{i + 1}</span>{/snippet}
							<span class="jp phrase">{ph.jp}</span>
							<span class="caption">{ph.from}</span>
							{#snippet trailing()}<Badge tone="accent">{ph.n}×</Badge>{/snippet}
						</ListRow>
					{/each}
				</ListGroup>

				<SectionHeader title="Writing helper" level={3} />
				<Card padding="md">
					<div class="stack" style:--gap="var(--space-3)">
						<Segmented
							label="Sending to"
							bind:value={politeTarget}
							options={[
								{ value: 'friend', label: 'Friend' },
								{ value: 'colleague', label: 'Colleague' },
								{ value: 'boss', label: 'Boss' },
								{ value: 'customer', label: 'Customer' }
							]}
						/>
						<PolitenessMeter value={politeYours} target={POLITE_TARGET[politeTarget]} targetLabel="Right for a {politeTarget}" />
						<MarkedText
							parts={politeFixed
								? [{ text: '部長\nお疲れ様です。\n明日の会議の資料をお送りします。\nご確認いただけますと幸いです。\nよろしくお願いいたします。' }]
								: [
										{ text: '部長\n' },
										{ text: 'お疲れ様です。', kind: 'add' },
										{ text: '\n明日の会議の資料を' },
										{ text: '送ります', kind: 'del' },
										{ text: 'お送りします', kind: 'add' },
										{ text: '。\n' },
										{ text: '見てください', kind: 'del' },
										{ text: 'ご確認いただけますと幸いです', kind: 'add' },
										{ text: '。\n' },
										{ text: 'よろしく', kind: 'del' },
										{ text: 'よろしくお願いいたします', kind: 'add' },
										{ text: '。' }
									]}
						/>
						<SpeechBubble><b class="jp">見てください</b> is an instruction. To a boss, ask softly: <b class="jp">ご確認いただけますと幸いです</b>.</SpeechBubble>
						<div class="wrap">
							<Button size="sm" variant="ghost" onclick={() => (politeFixed = !politeFixed)}>{politeFixed ? 'Show changes' : 'Use suggestion'}</Button>
						</div>
					</div>
				</Card>

				<SectionHeader title="Kanji you keep forgetting" level={3} />
				<div class="kanji-set">
					{#each FORGOT as f (f.k)}<KanjiTile kanji={f.k} reading={f.r} misread={f.m} unwritten={f.w} />{/each}
				</div>
				<p class="caption">Red dots: misread in review. Blue dots: couldn’t write it by hand. The drill uses InkPad inside a word from the phrasebook.</p>

				<SectionHeader title="Domain packs" level={3} />
				<ListGroup>
					<ListRow title="IT and tech" subtitle="Meetings, specs, bugs · 120 words" href="#domain-it">
						{#snippet leading()}<span class="domain" aria-hidden="true">💻</span>{/snippet}
						{#snippet trailing()}<Badge tone="success">38 known</Badge>{/snippet}
					</ListRow>
					<ListRow title="Office and email" subtitle="Greetings, requests, keigo · 90 words" href="#domain-office">
						{#snippet leading()}<span class="domain" aria-hidden="true">💼</span>{/snippet}
						{#snippet trailing()}<Badge tone="success">51 known</Badge>{/snippet}
					</ListRow>
					<ListRow title="Medical" subtitle="Clinic, symptoms, forms · 110 words" href="#domain-medical">
						{#snippet leading()}<span class="domain" aria-hidden="true">🏥</span>{/snippet}
					</ListRow>
				</ListGroup>

				<SectionHeader title="Weekly report" level={3} />
				<div class="ui-stats">
					<StatTile label="Read" value={14} note="photos and messages" />
					<StatTile label="Wrote" value={9} note="checked messages" />
					<StatTile label="Saved" value={23} note="new phrases" />
				</div>
				<BarChart days={weekDays} label="Minutes a day this week" column="Minutes" format={(n) => `${n} min`} />
				<Card padding="md">
					<div class="stack" style:--gap="var(--space-2)">
						<Badge tone="accent" variant="tag">One thing to work on</Badge>
						<span class="headline">Humble forms (<span class="jp">謙譲語</span>)</span>
						<span class="caption">4 of your 9 messages to your boss used plain forms like <span class="jp">送ります</span>.</span>
						<SpeechBubble>9 messages checked and 23 phrases saved! Let’s work on humble forms next.</SpeechBubble>
						<div class="wrap"><Button size="sm" variant="accent">5 minute practice</Button></div>
					</div>
				</Card>
				<!-- with `tail`: no avatar, the bubble points at Kuri walking on Today (KuriWalker) -->
				<div class="row" style:--gap="var(--space-3)" style:flex-wrap="wrap">
					<SpeechBubble tail="down"><b class="jp" lang="ja">はじめまして！</b> I’m Kuri. I’ll study with you.</SpeechBubble>
					<SpeechBubble tail="left" tailAt={20}>3 reviews today!</SpeechBubble>
				</div>

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

				<SectionHeader title="Avatar" />
				<Card padding="md">
					<div class="stack" style:--gap="var(--space-3)">
						<div class="row" style:--gap="var(--space-3)">
							<Avatar person={avPerson} name="Example Learner" size={72} />
							<Avatar person={avPerson} name="Example Learner" size={40} />
							<Avatar person={avPerson} name="Example Learner" size={24} label="" />
							<Avatar person={null} name="Example Learner" size={40} />
						</div>
						<TilePicker label="Hair" options={AV_HAIR} bind:value={avHair}>
							{#snippet art(v)}{@html avatarSvg({ ...avPerson, hair: v }, 56)}{/snippet}
						</TilePicker>
						<SwatchPicker label="Skin" options={AV_SKIN} bind:value={avSkin} />
					</div>
				</Card>

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

				<SectionHeader title="Error pages" />
				<p class="caption">What went wrong in plain words, what still works, and the next step. The error ID and build are on screen so a screenshot is a full report. Pick a case:</p>
				<div class="row wrap" style:--gap="var(--space-2)" role="group" aria-label="Error case">
					{#each ERR_KINDS as k (k.value)}<Chip selected={errKind === k.value} onclick={() => (errKind = k.value)}>{k.label}</Chip>{/each}
				</div>
				<Card padding="none" class="err-frame">
					{#key errKind}
						<ErrorState
							kind={errKind}
							status={ERR_STATUS[errKind]}
							errorId="E-7F3K2Q"
							build="1795166208411"
							message="PUT /api/admin/credit-rates → 500"
							retry={() => wait(900)}
							sendNote={fakeNote}
							home={errKind === 'access' ? { href: '/admin', label: 'Fleet overview' } : undefined}
						/>
					{/key}
				</Card>
				<p class="caption">Inline, when one panel fails and the rest of the screen still works (Fleet → Packages saving a credit rate):</p>
				<ErrorState kind="server" layout="inline" status={500} errorId="E-9QH2MX" build="1795166208411" message="PUT /api/admin/credit-rates → 500" retry={() => wait(900)} />
				<ErrorState kind="offline" layout="inline" retry={() => wait(900)} />

				<SectionHeader title="More below" />
				<p class="caption">Floats above the bottom of a long screen while more than about half a screen is still below, and scrolls smoothly to the end when tapped. It clears the tab bar, the safe area, the keyboard and the Ask AI composer, and hides near the bottom. The root layout shows it on every screen, so there is nothing to add per screen.</p>
				<div class="row"><ScrollMore demo /></div>

				<SectionHeader title="Open in Safari" />
				<p class="caption">On iPhone and iPad only Safari can install Benkyo. Opened inside LINE, Instagram, Chrome or another app, the app asks once per visit to move the page to Safari, keeping the whole link. Open in Safari uses the iOS 17 Safari link; Copy link is the fallback. The install guide shows the same card.</p>
				<div class="safari-demos">
					<SafariPrompt href="https://benkyo.jirachai.me/invite/VIP" app="LINE" oncontinue={() => {}} />
					<SafariPrompt href="https://benkyo.jirachai.me/" app="Chrome" browser />
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
						<p class="caption">Spinner sizes: sm 14, md 20, lg 32, inline 1em (follows the text). The arc turns inside a still SVG, so it stays centred in Safari at any position.</p>
						<div class="row" style:--gap="var(--space-4)">
							<Spinner label="Loading" size="sm" />
							<Spinner label="Loading" />
							<Spinner label="Loading" size="lg" />
							<span class="caption">Inline <Spinner size="inline" /> in text</span>
						</div>
						<div class="row" style:--gap="var(--space-4)">
							<Spinner label="Checking" size="sm" showLabel />
							<Spinner label="Saving your cards" showLabel />
							<Spinner label="Asking Kuri" size="lg" showLabel />
						</div>
						<p class="caption">Busy buttons use the inline Spinner in the text colour (tone current), in every variant and size.</p>
						<div class="row" style:--gap="var(--space-2)" style:flex-wrap="wrap">
							<Button busy>Saving</Button>
							<Button variant="accent" busy>Saving</Button>
							<Button variant="ghost" busy>Saving</Button>
							<Button variant="danger" busy>Deleting</Button>
							<Button variant="ghost-danger" busy>Deleting</Button>
							<Button variant="plain" busy>Saving</Button>
						</div>
						<!-- the sizes side by side on purpose: check:layout's one-height rule skips data-mixed-sizes -->
						<div class="row" data-mixed-sizes style:--gap="var(--space-2)" style:flex-wrap="wrap">
							<Button size="sm" busy>Small</Button>
							<Button size="md" busy>Medium</Button>
							<Button size="lg" busy>Large</Button>
							<Button busy={saving} onclick={fakeSave}>{saving ? 'Saving' : 'Try it'}</Button>
						</div>
						<p class="caption">Skeleton variants: row, card, tile, line.</p>
						<Skeleton variant="row" count={2} />
						<Skeleton variant="card" count={1} />
						<Skeleton variant="tile" count={3} />
						<Skeleton variant="line" count={2} />
						<div class="row" style:--gap="var(--space-4)">
							<PlanBadge plan="free" name="" loading />
							<span class="caption">PlanBadge while the package loads</span>
						</div>
						<div class="row" style:--gap="var(--space-4)">
							<ProgressRing value={0.65} size={88} width={9}><b>13</b></ProgressRing>
							<div class="spacer"><BarChart label="Reviews a day" days={barDays} column="Reviews" /></div>
						</div>
						<PageDots count={4} bind:index={dotPage} label="Intro pages" pageLabel={(n) => `Page ${n}`} />
					</div>
				</Card>

				<SectionHeader title="Draft · Navigation for many items" />
				<p class="caption">Eight screens (with Community) do not fit a phone tab bar. Recommended: your tabs + More. A phone bar holds 4 tabs and More, a bar from 600 px (unfolded Duo portrait, iPad portrait) 6 and More. More lists the rest with one line each and "Edit tab bar" to pick your tabs. On a screen from More, the More tab takes its icon and name. The side rail (iPad and Duo landscape) shows every screen in groups, Settings last; the desktop sidebar adds labels and group headings.</p>
				<Card>
					<div class="stack" style:--gap="var(--space-3)">
						<SectionHeader title="Phone bar with these pins" level={3} />
						<div class="nav-demo" aria-hidden="true">
							{#each navSplit.tabs as item (item.href)}
								<span class="nav-demo-tab"><NavIcon path={item.icon} size={20} />{t(item.label)}</span>
							{/each}
							<span class="nav-demo-tab"><NavIcon path={MORE_ICON} size={20} />{t('nav.more')}</span>
						</div>
						<div class="row" style:--gap="var(--space-2)">
							<Button variant="ghost" onclick={() => ((navEditing = false), (navMoreOpen = true))}>Open More</Button>
							<Button variant="ghost" onclick={() => ((navEditing = true), (navMoreOpen = true))}>Edit tab bar</Button>
						</div>
					</div>
				</Card>
				<p class="caption">Also considered: fewer tabs (Kana inside Learn, Settings behind your avatar on Today; no More, but things move) and a bar that scrolls sideways (hides tabs with no sign they are there; not iOS).</p>

				<SectionHeader title="Sheet" />
				<p class="caption">A sheet holds a short task. A peek sheet (<code>peek</code>) opens at medium height over what you were looking at, so it stays in view: drag the grabber up (or tap it) for full height, down to go back, down again to close. Its <code>footer</code> stays pinned above the keyboard. Ask AI about a word (Words card, word pack) is a peek.</p>
				<div class="row" style:--gap="var(--space-2)">
					<Button variant="ghost" onclick={() => (sheetOpen = true)}>Open a sheet</Button>
					<Button variant="ghost" onclick={() => (peekOpen = true)}>Open a peek sheet</Button>
				</div>

				<SectionHeader title="My note (words, kana, kanji, units)" />
				<p class="caption">A private note on any study item. Saves as you type; empty deletes it. In Review it shows as a "My note" button only after you answer.</p>
				<div class="stack" style:--gap="var(--space-2)">
					<NoteCard value={demoNote} onsave={async (b) => (demoNote = b)} />
					<NoteCard value="" onsave={async () => {}} />
					<NoteCard value="" loading onsave={async () => {}} />
					<NoteCard peek value={demoNote || 'Looks like 大 with a dot: the dog’s ear.'} onsave={async () => {}} />
				</div>

				<SectionHeader title="Community notes (under My note)" />
				<p class="caption">Notes other learners shared on the same item, most liked first, with hearts, replies and a ••• menu to report or block. The first share asks for a public handle and the guidelines. 文A (tooltip "Translate") on a note in another language translates it with your AI. Made-up learners; nothing is sent.</p>
				<div class="stack" style:--gap="var(--space-2)">
					<CommunityNotes subject="kanji:日" label="日" note={demoNote} api={demoCommunity} signedIn accountId={-1} canTranslate />
					<CommunityNotes subject="kanji:日" label="日" note={demoNote} api={demoCommunityNew} signedIn accountId={-2} canTranslate={false} />
					<CommunityNotes subject="kanji:日" label="日" note="" api={demoCommunityEmpty} signedIn accountId={-3} canTranslate={false} />
					<CommunityNotes subject="kanji:日" label="日" note="" api={demoCommunityFail} signedIn accountId={-4} canTranslate={false} />
					<CommunityNotes subject="kanji:日" label="日" note="" signedIn={false} canTranslate={false} />
				</div>

				<SectionHeader title="Content feedback (lessons, units, grammar, kanji, words)" />
				<p class="caption">Thumbs up or down and Report a problem on anything the app teaches; Job reads them in Fleet → Feedback. A thumb down opens the report form. The full bar sits under the content; compact (•••) sits in a list row and opens a sheet. The second bar fails as if offline; the last is signed out. Nothing is sent.</p>
				<div class="stack" style:--gap="var(--space-2)">
					<Card padding="sm"><ContentFeedback subject="kanji:日" label="日" api={demoFeedback} signedIn accountId={-1} /></Card>
					<Card padding="sm"><ContentFeedback subject="unit:n5-01" label="Greetings" api={demoFeedbackFail} signedIn accountId={-1} /></Card>
					<Card padding="sm" class="row" style="--gap: var(--space-2)"><span class="headline" lang="ja">たべる 食べる</span><ContentFeedback compact subject="word:demo" label="食べる" api={demoFeedback} signedIn accountId={-1} /></Card>
					<Card padding="sm"><ContentFeedback subject="grammar:demo" label="〜てください" signedIn={false} /></Card>
				</div>

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

<NavMore open={navMoreOpen} onclose={() => (navMoreOpen = false)} more={navSplit.more} current={null} room={4} pins={navPins} due={12} bind:editing={navEditing} onpins={(p) => (navPins = p)} />
<Sheet open={sheetOpen} label="Example sheet" onclose={() => (sheetOpen = false)}>
	<div class="stack">
		<p>Sheets hold a short task. Drag down or tap outside to close.</p>
		<Button onclick={() => (sheetOpen = false)}>Done</Button>
	</div>
</Sheet>

<Sheet peek open={peekOpen} label="Example peek sheet" onclose={() => (peekOpen = false)}>
	{#snippet header()}<h2 class="title-3">💬 Ask AI</h2>{/snippet}
	<Card padding="sm"><span class="title-3 jp">食べる</span> <span class="caption">たべる · to eat</span></Card>
	<p class="subhead">The page behind stays in view. Drag up for more room.</p>
	{#each ['Show me 食べる in a few everyday sentences', 'Is 食べる casual or polite?', 'Break down the kanji in 食べる'] as s}<Chip onclick={() => (peekText = s)}>{s}</Chip>{/each}
	{#snippet footer()}
		<FieldRow as="form" size="md" onsubmit={() => (peekText = '')}>
			<TextArea grow autogrow rows={1} maxRows={4} bind:value={peekText} placeholder="Ask about 食べる…" aria-label="Example question" />
			<Button type="submit" variant="accent" aria-label="Send" disabled={!peekText.trim()}>↑</Button>
		</FieldRow>
	{/snippet}
</Sheet>

<style>
	.nav-demo {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		padding: var(--space-1h);
		border-radius: 999px;
		background: color-mix(in srgb, var(--ink) 6%, transparent);
	}
	.nav-demo-tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-px);
		padding: var(--space-1) 0;
		font-size: 10.5px;
		font-weight: 600;
		color: var(--ink-2);
	}
	.wrap {
		flex-wrap: wrap;
	}
	.panel :global(.err-frame) {
		overflow: hidden;
		background: var(--color-bg);
	}
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
	.rank {
		width: 22px;
		text-align: end;
		font-weight: var(--weight-bold);
		color: var(--color-text-3);
	}
	.phrase {
		font-weight: var(--weight-semibold);
	}
	.kanji-set {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-3);
	}
	.domain {
		width: 36px;
		height: 36px;
		border-radius: var(--radius-md);
		background: var(--color-fill);
		display: grid;
		place-items: center;
		font-size: 20px;
	}
	.safari-demos {
		display: grid;
		gap: var(--space-3);
	}
</style>

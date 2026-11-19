<!--
	Make or change your avatar (docs/AVATAR.md). Opens full screen from the sign-up step, the
	one-time prompt on Today, or Settings (avatar.setup).

	  start → (selfie) consent → getting ready (first time) → camera → reading → result → save
	        → (by hand) editor → save

	The selfie is read on this phone and wiped as soon as it is read; only the parts are saved.
	Unsure readings become questions with nothing picked. Every step shows its state, and
	"Build it myself" is always there, offline too.
-->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { Avatar, Button, Card, Chip, FileButton, Notice, Spinner } from '#lib/ui/index.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { toast } from '#lib/ios/overlay.svelte.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { avatar } from '#lib/state/avatar.svelte.ts';
	import { telemetry } from '#lib/beta/telemetry.svelte.ts';
	import { cleanPerson, DEFAULTS, type Person } from '#lib/avatar/person.ts';
	import { mapToPerson, type Ask } from '#lib/avatar/mapping.ts';
	import { loadReader, toCanvas, wipe } from '#lib/avatar/selfie.ts';
	import AvatarEditor from './AvatarEditor.svelte';

	let { from }: { from: 'signup' | 'prompt' | 'settings' } = $props();

	type Step = 'start' | 'consent' | 'loading' | 'camera' | 'reading' | 'result' | 'edit' | 'problem';
	let step = $state<Step>('start');
	let person = $state<Person>(cleanPerson(avatar.person ?? {}) ?? { ...DEFAULTS });
	let source = $state<'selfie' | 'manual'>('manual');
	let asks = $state<Ask[]>([]);
	let answered = $state<Partial<Record<Ask, boolean>>>({});
	let progress = $state(0);
	let problem = $state<'no_face' | 'many_faces' | 'camera' | 'download' | null>(null);
	let readStep = $state(0);
	let saving = $state(false);
	let saveError = $state('');
	let video = $state<HTMLVideoElement>();
	let stream: MediaStream | null = null;
	const name = $derived(ai.account?.name ?? '');

	function stopCamera() {
		stream?.getTracks().forEach((tr) => tr.stop());
		stream = null;
	}
	onDestroy(stopCamera);

	function close() {
		stopCamera();
		avatar.setup = null;
		avatar.afterSignup = false;
		// a new account lands on Today after this step, never in a lesson
		if (from === 'signup') void goto('/');
	}
	async function later() {
		haptic('selection');
		close();
		// the one-time prompt and the sign-up step are answered for good; Settings just closes
		if (from !== 'settings') await avatar.later().catch(() => {}); // ui-ok: background note, the sheet is already closed
	}

	async function startSelfie() {
		step = 'loading';
		progress = 0;
		try {
			await loadReader((p) => (progress = p));
		} catch {
			problem = 'download';
			step = 'problem';
			return;
		}
		await openCamera();
	}
	async function openCamera() {
		step = 'camera';
		try {
			stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 } }, audio: false });
			if (video) {
				video.srcObject = stream;
				await video.play();
			}
		} catch {
			stopCamera();
			problem = 'camera';
			step = 'problem';
		}
	}
	async function shoot() {
		if (!video?.videoWidth) return;
		haptic('selection');
		const c = await toCanvas(video, 720, true);
		stopCamera();
		await read(c);
	}
	async function picked(file: File) {
		stopCamera();
		step = 'loading';
		progress = 0;
		try {
			await loadReader((p) => (progress = p));
		} catch {
			problem = 'download';
			step = 'problem';
			return;
		}
		await read(await toCanvas(file, 720));
	}
	async function read(c: HTMLCanvasElement) {
		step = 'reading';
		readStep = 0;
		const tick = () => new Promise((r) => setTimeout(r, 350));
		try {
			const reader = await loadReader();
			await tick();
			const res = reader.read(c);
			wipe(c); // the photo is gone from here on
			readStep = 1;
			await tick();
			if (!res.ok) {
				problem = res.reason;
				step = 'problem';
				return;
			}
			const mapped = mapToPerson(res.m);
			readStep = 2;
			await tick();
			// keep what the photo can't say (clothes, frame) from the current avatar
			person = { ...person, ...mapped.person, cloth: person.cloth, collar: person.collar, frameColor: person.frameColor, outfit: person.outfit, earrings: person.earrings, aid: person.aid };
			asks = mapped.ask;
			answered = {};
			source = 'selfie';
			readStep = 3;
			haptic('success');
			step = 'result';
		} catch {
			wipe(c);
			problem = 'no_face';
			step = 'problem';
		}
	}

	function answer(q: Ask, v: string) {
		answered = { ...answered, [q]: true };
		if (q === 'glasses') person = { ...person, glasses: v as Person['glasses'] };
		if (q === 'beard') person = { ...person, beard: v as Person['beard'] };
		if (q === 'head') person = { ...person, head: v as Person['head'] };
	}
	const QUESTIONS: Record<Ask, string[]> = {
		head: ['none', 'hijab', 'turban', 'headscarf', 'cap', 'beanie', 'bucket'],
		glasses: ['none', 'round', 'square'],
		beard: ['none', 'stubble']
	};
	const answerOf = (q: Ask) => (q === 'head' ? person.head : q === 'glasses' ? person.glasses : person.beard);

	async function save() {
		saving = true;
		saveError = '';
		try {
			await avatar.save(person, { source, asked: asks });
			haptic('success');
			toast(t('avatar.saved'), '✓');
			close();
		} catch (e) {
			saveError = ai.online ? (e instanceof Error ? e.message : t('avatar.saveFailed')) : t('avatar.saveOffline');
			haptic('error');
		} finally {
			saving = false;
		}
	}
	async function remove() {
		saving = true;
		saveError = '';
		try {
			await avatar.remove();
			toast(t('avatar.removed'), '✓');
			close();
		} catch {
			saveError = ai.online ? t('avatar.saveFailed') : t('avatar.saveOffline');
		} finally {
			saving = false;
		}
	}
	function manual() {
		step = 'edit';
		telemetry.track('event', 'avatar_editor', { from });
	}
	const chips = $derived([t(`avatar.opt.hair.${person.hair}` as MessageKey), t(`avatar.opt.eyes.${person.eyes}` as MessageKey), ...(person.glasses !== 'none' ? [t(`avatar.opt.glasses.${person.glasses}` as MessageKey)] : []), t(`avatar.opt.skin.${person.skin}` as MessageKey)]);
	const READ_STEPS: MessageKey[] = ['avatar.read.face', 'avatar.read.colours', 'avatar.read.parts'];
	const PROBLEM: Record<NonNullable<typeof problem>, [MessageKey, MessageKey]> = {
		no_face: ['avatar.problem.noFace', 'avatar.problem.noFaceBody'],
		many_faces: ['avatar.problem.manyFaces', 'avatar.problem.manyFacesBody'],
		camera: ['avatar.problem.camera', 'avatar.problem.cameraBody'],
		download: ['avatar.problem.download', 'avatar.problem.downloadBody']
	};
</script>

<div class="setup" role="dialog" aria-modal="true" aria-label={t('avatar.title')} transition:fade={{ duration: 250 }}>
	<div class="panel">
		{#if step === 'start'}
			<div class="head">
				{#if from === 'signup'}<span class="caption step-of">{t('avatar.signupStep')}</span>{/if}
				<Button variant="plain" size="sm" onclick={later}>{from === 'settings' ? t('common.close') : t('avatar.later')}</Button>
			</div>
			<div class="hero">
				<Avatar {person} {name} size={200} live wave label={t('avatar.previewLabel')} />
				<h2 class="large-title">{from === 'signup' ? t('avatar.titleSignup') : t('avatar.title')}</h2>
				<p class="subhead">{t('avatar.lead')}</p>
			</div>
			<div class="actions">
				<Button variant="accent" block onclick={() => (step = 'consent')}>{t('avatar.useSelfie')}</Button>
				<Button variant="ghost" block onclick={manual}>{t('avatar.buildMyself')}</Button>
				{#if from === 'settings' && avatar.person}
					<Button variant="ghost-danger" block busy={saving} onclick={remove}>{t('avatar.remove')}</Button>
				{/if}
				{#if saveError}<Notice tone="danger">{saveError}</Notice>{/if}
			</div>
		{:else if step === 'consent'}
			<div class="head"><Button variant="plain" size="sm" onclick={() => (step = 'start')}>{t('common.back')}</Button></div>
			<div class="hero">
				<h2 class="title-1">{t('avatar.consent.title')}</h2>
			</div>
			<Card strong padding="md">
				<ul class="ticks">
					<li><span aria-hidden="true">📱</span><span><b>{t('avatar.consent.phone')}</b> {t('avatar.consent.phoneBody')}</span></li>
					<li><span aria-hidden="true">🗑️</span><span><b>{t('avatar.consent.deleted')}</b> {t('avatar.consent.deletedBody')}</span></li>
					<li><span aria-hidden="true">🧩</span><span><b>{t('avatar.consent.choices')}</b> {t('avatar.consent.choicesBody')}</span></li>
				</ul>
			</Card>
			<div class="actions">
				<Button variant="accent" block onclick={startSelfie}>{t('avatar.openCamera')}</Button>
				<FileButton accept="image/*" block onpick={picked}>{t('avatar.choosePhoto')}</FileButton>
				<Button variant="plain" block onclick={manual}>{t('avatar.buildMyself')}</Button>
			</div>
		{:else if step === 'loading'}
			<div class="center" role="status" aria-live="polite">
				<Spinner size="lg" label={t('avatar.loading')} />
				<h2 class="title-2">{t('avatar.loading')}</h2>
				<p class="subhead muted">{t('avatar.loadingBody')}</p>
				<div class="bar" aria-hidden="true"><i style:width="{Math.round(progress * 100)}%"></i></div>
				<p class="caption muted">{t('avatar.loadingPct', { n: Math.round(progress * 100) })}</p>
			</div>
			<div class="actions"><Button variant="ghost" block onclick={manual}>{t('avatar.buildInstead')}</Button></div>
		{:else if step === 'camera'}
			<div class="camera">
				<!-- the live camera; the frame is read only when the shutter is pressed -->
				<video bind:this={video} playsinline muted aria-label={t('avatar.cameraLabel')}></video>
				<div class="oval" aria-hidden="true"></div>
				<p class="hint caption">{t('avatar.cameraHint')}</p>
			</div>
			<div class="actions row">
				<Button variant="ghost" onclick={() => (stopCamera(), (step = 'consent'))}>{t('common.cancel')}</Button>
				<Button variant="accent" class="grow" onclick={shoot}>{t('avatar.shutter')}</Button>
			</div>
		{:else if step === 'reading'}
			<div class="center" role="status" aria-live="polite">
				<Spinner size="lg" label={t('avatar.reading')} />
				<h2 class="title-2">{t('avatar.reading')}</h2>
				<ul class="steps">
					{#each READ_STEPS as k, i (k)}
						<li class:done={readStep > i}>{readStep > i ? '✓' : i === readStep ? '…' : '·'} {t(k)}</li>
					{/each}
				</ul>
				<span class="pill caption">🗑️ {t('avatar.photoDeleted')}</span>
			</div>
		{:else if step === 'result'}
			<div class="head">
				<span class="caption">🗑️ {t('avatar.photoDeleted')}</span>
				<Button variant="plain" size="sm" onclick={() => openCamera()}>{t('avatar.retake')}</Button>
			</div>
			<div class="hero">
				<h2 class="large-title">{t('avatar.hereYouAre')}</h2>
				<Avatar {person} {name} size={200} live wave label={t('avatar.previewLabel')} />
				<div class="chips">{#each chips as c (c)}<Chip>{c}</Chip>{/each}</div>
			</div>
			{#each asks as q (q)}
				<Card padding="md">
					<p class="body-b">{t(`avatar.ask.${q}` as MessageKey)}</p>
					<div class="chips">
						{#each QUESTIONS[q] as v (v)}
							<Chip selected={answered[q] && answerOf(q) === v} onclick={() => answer(q, v)}>{t(`avatar.opt.${q === 'head' ? 'head' : q}.${v}` as MessageKey)}</Chip>
						{/each}
					</div>
				</Card>
			{/each}
			<div class="actions row">
				<Button variant="ghost" onclick={() => (step = 'edit')}>{t('avatar.tweak')}</Button>
				<Button variant="accent" class="grow" busy={saving} disabled={asks.some((q) => !answered[q])} onclick={save}>{t('avatar.looksGood')}</Button>
			</div>
			{#if saveError}<Notice tone="danger">{saveError}</Notice>{/if}
		{:else if step === 'edit'}
			<div class="head">
				<Button variant="plain" size="sm" onclick={() => (step = source === 'selfie' ? 'result' : 'start')}>{t('common.back')}</Button>
				<Button variant="accent" size="sm" busy={saving} onclick={save}>{t('avatar.save')}</Button>
			</div>
			<AvatarEditor bind:person {name} />
			{#if saveError}<Notice tone="danger">{saveError}</Notice>{/if}
		{:else if step === 'problem' && problem}
			<div class="head"><Button variant="plain" size="sm" onclick={() => (step = 'consent')}>{t('common.back')}</Button></div>
			<div class="hero">
				<span class="big-emoji" aria-hidden="true">{problem === 'camera' ? '📷' : problem === 'download' ? '📶' : '🙈'}</span>
				<h2 class="title-1">{t(PROBLEM[problem][0])}</h2>
			</div>
			<Notice tone={problem === 'camera' || problem === 'download' ? 'danger' : 'warning'}>{t(PROBLEM[problem][1])}</Notice>
			{#if problem === 'no_face' || problem === 'many_faces'}<p class="caption muted center-text">{t('avatar.photoNotKept')}</p>{/if}
			<div class="actions">
				<Button variant="accent" block onclick={problem === 'download' ? startSelfie : openCamera}>{t('avatar.tryAgain')}</Button>
				<FileButton accept="image/*" block onpick={picked}>{t('avatar.choosePhoto')}</FileButton>
				<Button variant="plain" block onclick={manual}>{t('avatar.buildMyself')}</Button>
			</div>
		{/if}
	</div>
</div>

<style>
	.setup {
		position: fixed;
		inset: 0;
		z-index: 160;
		display: flex;
		justify-content: center;
		padding: calc(var(--safe-top) + var(--space-3)) max(var(--space-5), var(--safe-right)) calc(var(--safe-bottom) + var(--space-5)) max(var(--space-5), var(--safe-left));
		background: var(--color-bg);
		overflow-y: auto;
	}
	.panel {
		width: 100%;
		max-width: 520px;
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		margin: 0 auto;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: var(--control-md);
	}
	.step-of {
		color: var(--color-text-2);
		font-weight: var(--weight-semibold);
	}
	.head :global(:last-child) {
		margin-left: auto;
	}
	.hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--space-3);
	}
	.hero h2 {
		margin: 0;
	}
	.hero p {
		margin: 0;
		max-width: 34ch;
		color: var(--color-text-2);
	}
	.actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-top: auto;
	}
	.actions.row {
		flex-direction: row;
	}
	.actions.row :global(.grow) {
		flex: 1;
	}
	.ticks {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.ticks li {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
	}
	.center {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: var(--space-3);
	}
	.center h2,
	.center p {
		margin: 0;
	}
	.muted {
		color: var(--color-text-2);
	}
	.center-text {
		text-align: center;
		margin: 0;
	}
	.bar {
		width: min(260px, 100%);
		height: 6px;
		border-radius: var(--radius-pill);
		background: var(--color-fill);
		overflow: hidden;
	}
	.bar i {
		display: block;
		height: 100%;
		background: var(--color-accent);
		transition: width var(--dur-fast);
	}
	.steps {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		color: var(--color-text-2);
	}
	.steps .done {
		color: var(--color-success);
	}
	.pill {
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-pill);
		background: color-mix(in srgb, var(--color-success) 14%, transparent);
	}
	.camera {
		position: relative;
		flex: 1;
		min-height: 360px;
		border-radius: var(--radius-card);
		overflow: hidden;
		background: #000; /* ui-ok: camera viewfinder */
	}
	video {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scaleX(-1); /* a mirror, like the iPhone camera */
	}
	.oval {
		position: absolute;
		left: 50%;
		top: 46%;
		width: 62%;
		aspect-ratio: 0.79;
		transform: translate(-50%, -50%);
		border-radius: 50%;
		border: 3px solid rgb(255 255 255 / 0.9);
		box-shadow: 0 0 0 100vmax rgb(0 0 0 / 0.45);
	}
	.hint {
		position: absolute;
		left: 0;
		right: 0;
		bottom: var(--space-4);
		margin: 0;
		text-align: center;
		color: #fff; /* ui-ok: text on the camera image */
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-2);
	}
	.body-b {
		margin: 0 0 var(--space-2);
		font-weight: var(--weight-semibold);
	}
	.big-emoji {
		font-size: 64px;
		line-height: 1;
	}
</style>

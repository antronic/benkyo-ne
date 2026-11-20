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
	import { Avatar, Button, Card, Chip, FileButton, IconButton, Notice, Spinner, SwatchPicker } from '#lib/ui/index.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { toast } from '#lib/ios/overlay.svelte.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { avatar } from '#lib/state/avatar.svelte.ts';
	import { telemetry } from '#lib/beta/telemetry.svelte.ts';
	import { cleanPerson, DEFAULTS, randomPerson, SKIN, type Person } from '#lib/avatar/person.ts';
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
	// the camera in use: front cameras show (and shoot) as a mirror, back cameras don't
	let facing = $state<'user' | 'environment'>('user');
	let mirror = $state(true);
	let cameras = $state(0); // how many cameras the device has; the switch shows when there are two or more
	let camBusy = $state(false); // opening or switching: the viewfinder shows a spinner
	let switchFailed = $state(false);
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
	/** Ask for a camera: the facing one by default, or a given device (computers with two webcams). */
	async function getStream(want: { facing: 'user' | 'environment' } | { deviceId: string }) {
		const pick = 'deviceId' in want ? { deviceId: { exact: want.deviceId } } : { facingMode: want.facing };
		return navigator.mediaDevices.getUserMedia({ video: { ...pick, width: { ideal: 1280 } }, audio: false });
	}
	async function show(s: MediaStream) {
		stream = s;
		const set = s.getVideoTracks()[0]?.getSettings() ?? {};
		if (set.facingMode === 'user' || set.facingMode === 'environment') facing = set.facingMode;
		// only a camera that says it faces away is shown as is; webcams look like a mirror
		mirror = set.facingMode !== 'environment';
		if (video) {
			video.srcObject = s;
			await video.play(); // ui-ok: callers hold camBusy, the viewfinder spinner
		}
	}
	async function countCameras() {
		try {
			cameras = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput').length; // ui-ok: background count, the switch appears when it is known
		} catch {
			cameras = 1;
		}
	}
	async function openCamera() {
		step = 'camera';
		camBusy = true;
		switchFailed = false;
		try {
			await show(await getStream({ facing }));
			void countCameras(); // device labels and the full list only come after permission
		} catch {
			stopCamera();
			problem = 'camera';
			step = 'problem';
		} finally {
			camBusy = false;
		}
	}
	async function switchCamera() {
		if (camBusy) return;
		haptic('selection');
		camBusy = true;
		switchFailed = false;
		const was = stream?.getVideoTracks()[0]?.getSettings() ?? {};
		const other = facing === 'user' ? 'environment' : 'user';
		// iOS and Android need the old camera let go before the other one opens
		stopCamera();
		try {
			let next: MediaStream | null = null;
			if (was.facingMode) next = await getStream({ facing: other }).catch(() => null);
			if (next && next.getVideoTracks()[0]?.getSettings().deviceId === was.deviceId) {
				next.getTracks().forEach((tr) => tr.stop());
				next = null;
			}
			if (!next) {
				// no facing mode to go by (a computer): step to the next camera in the list
				const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
				const at = list.findIndex((d) => d.deviceId === was.deviceId);
				const to = list[(at + 1) % list.length];
				if (to && to.deviceId !== was.deviceId) next = await getStream({ deviceId: to.deviceId });
			}
			if (!next) throw new Error('no other camera');
			await show(next);
		} catch {
			// keep going with the camera we had
			switchFailed = true;
			try {
				await show(await getStream(was.deviceId ? { deviceId: was.deviceId } : { facing }));
			} catch {
				stopCamera();
				problem = 'camera';
				step = 'problem';
			}
		} finally {
			camBusy = false;
		}
	}
	async function shoot() {
		if (!video?.videoWidth) return;
		haptic('selection');
		const c = await toCanvas(video, 720, mirror);
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

	function answer(q: Exclude<Ask, 'skin'>, v: string) {
		answered = { ...answered, [q]: true };
		if (q === 'glasses') person = { ...person, glasses: v as Person['glasses'] };
		if (q === 'beard') person = { ...person, beard: v as Person['beard'] };
		if (q === 'head') person = { ...person, head: v as Person['head'] };
	}
	const QUESTIONS: Record<Exclude<Ask, 'skin'>, string[]> = {
		head: ['none', 'hijab', 'turban', 'headscarf', 'cap', 'beanie', 'bucket'],
		glasses: ['none', 'round', 'square'],
		beard: ['none', 'stubble']
	};
	const skinAsked = $derived(asks.includes('skin'));
	const answerOf = (q: Exclude<Ask, 'skin'>) => (q === 'head' ? person.head : q === 'glasses' ? person.glasses : person.beard);

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
	// the dice: a new random look in the preview; "Build it myself" then opens it to tweak and save
	function roll() {
		haptic('selection');
		person = randomPerson();
		source = 'manual';
		asks = [];
		answered = {};
	}
	function manual() {
		step = 'edit';
		telemetry.track('event', 'avatar_editor', { from });
	}
	const chips = $derived([t(`avatar.opt.hair.${person.hair}` as MessageKey), t(`avatar.opt.eyes.${person.eyes}` as MessageKey), ...(person.glasses !== 'none' ? [t(`avatar.opt.glasses.${person.glasses}` as MessageKey)] : []), ...(skinAsked && !answered.skin ? [] : [t(`avatar.opt.skin.${person.skin}` as MessageKey)])]);
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
				<Button variant="plain" size="sm" class="end" onclick={later}>{from === 'settings' ? t('common.close') : t('avatar.later')}</Button>
			</div>
			<div class="hero">
				<Avatar {person} {name} size={200} live wave label={t('avatar.previewLabel')} />
				<h2 class="large-title">{from === 'signup' ? t('avatar.titleSignup') : t('avatar.title')}</h2>
				<p class="subhead">{t('avatar.lead')}</p>
			</div>
			<div class="actions">
				<Button variant="accent" block onclick={() => (step = 'consent')}>{t('avatar.useSelfie')}</Button>
				<div class="row-actions">
					<Button variant="ghost" class="grow" onclick={manual}>{t('avatar.buildMyself')}</Button>
					<IconButton label={t('avatar.random')} size="lg" onclick={roll}>🎲</IconButton>
				</div>
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
				<video bind:this={video} class:mirror playsinline muted aria-label={t('avatar.cameraLabel')}></video>
				<div class="oval" aria-hidden="true"></div>
				{#if cameras > 1}
					<div class="flip">
						<IconButton label={facing === 'user' ? t('avatar.useBackCamera') : t('avatar.useFrontCamera')} disabled={camBusy} onclick={switchCamera}>🔄</IconButton>
					</div>
				{/if}
				{#if camBusy}
					<div class="cam-wait" role="status" aria-live="polite">
						<Spinner size="lg" label={t('avatar.cameraStarting')} />
						<p class="caption">{t('avatar.cameraStarting')}</p>
					</div>
				{/if}
				<p class="hint caption">{t('avatar.cameraHint')}</p>
			</div>
			{#if switchFailed}<Notice tone="warning">{t('avatar.switchFailed')}</Notice>{/if}
			<div class="actions row">
				<Button variant="ghost" onclick={() => (stopCamera(), (step = 'consent'))}>{t('common.cancel')}</Button>
				<Button variant="accent" class="grow" disabled={camBusy} onclick={shoot}>{t('avatar.shutter')}</Button>
			</div>
			<FileButton accept="image/*" block disabled={camBusy} onpick={picked}>{t('avatar.choosePhoto')}</FileButton>
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
				<Button variant="plain" size="sm" class="end" onclick={() => openCamera()}>{t('avatar.retake')}</Button>
			</div>
			<div class="hero">
				<h2 class="large-title">{t('avatar.hereYouAre')}</h2>
				<Avatar {person} {name} size={200} live wave label={t('avatar.previewLabel')} />
				<div class="chips">{#each chips as c (c)}<Chip>{c}</Chip>{/each}</div>
			</div>
			{#each asks.filter((q) => q !== 'skin') as q (q)}
				<Card padding="md">
					<p class="body-b">{t(`avatar.ask.${q}` as MessageKey)}</p>
					<div class="chips">
						{#each QUESTIONS[q] as v (v)}
							<Chip selected={answered[q] && answerOf(q) === v} onclick={() => answer(q, v)}>{t(`avatar.opt.${q === 'head' ? 'head' : q}.${v}` as MessageKey)}</Chip>
						{/each}
					</div>
				</Card>
			{/each}
			<!-- light and camera change how skin looks in a photo, so the tone is always one tap away -->
			<Card padding="md">
				<!-- too dim to tell: nothing is picked until the learner taps one -->
				<p class="body-b">{t(skinAsked && !answered.skin ? 'avatar.skinAsk' : 'avatar.skinCheck')}</p>
				<SwatchPicker
					label={t('avatar.part.skin')}
					value={skinAsked && !answered.skin ? ('' as Person['skin']) : person.skin}
					options={Object.entries(SKIN).map(([v, color]) => ({ value: v as Person['skin'], color, label: t(`avatar.opt.skin.${v}` as MessageKey) }))}
					onchange={(v) => ((person = { ...person, skin: v }), (answered = { ...answered, skin: true }))}
				/>
			</Card>
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
		/* the top keeps at least the side gutter: with no safe area at the top (a computer, a phone on its
		   side) the bar with "Later" sat 12px from the edge */
		padding: max(var(--space-5), calc(var(--safe-top) + var(--space-3))) max(var(--space-5), var(--safe-right)) calc(var(--safe-bottom) + var(--space-5)) max(var(--space-5), var(--safe-left));
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
	/* Back stays on the left; Later, Close and Retake sit on the right */
	.head :global(.end) {
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
	.row-actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.row-actions :global(.grow),
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
	}
	video.mirror {
		transform: scaleX(-1); /* the front camera is a mirror, like the iPhone camera */
	}
	.flip {
		position: absolute;
		top: var(--space-3);
		right: var(--space-3);
	}
	.cam-wait {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-3);
		background: rgb(0 0 0 / 0.55); /* ui-ok: dims the camera image */
		color: #fff; /* ui-ok: text on the camera image */
	}
	.cam-wait p {
		margin: 0;
		color: #fff; /* ui-ok: text on the camera image */
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

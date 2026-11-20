# Avatar

Every account can have a profile picture: a drawn avatar made from a selfie or built by hand.
It shows on Today, in Settings, on community posts and replies, and beside your messages in Ask.

## Flow

- **Sign-up.** Registration (passkey, recovery code, consent), then the avatar step, then Today.
  `Welcome.svelte` (and the Apple `created` result) sets `avatar.afterSignup`; `+layout.svelte`
  opens `AvatarSetup` once the intro, onboarding and Welcome sheets are closed. Closing the step
  in sign-up mode goes to `/`, never a lesson.
- **Existing accounts.** A one-time card on Today ("Make it" / "Not now"). It shows while
  `account.avatarAsked` is false. Saving or "Not now" sets `accounts.avatar_asked_at`, so the
  card never comes back, on any device.
- **Settings.** Account → Profile picture opens the same sheet. Remove is there too.

`AvatarSetup.svelte` steps: start → consent (selfie only) → getting ready (first time: downloads
the reader) → camera or "Choose a photo" → reading → result (answer any questions, Tweak or
Looks good) → save. "Build it myself" opens `AvatarEditor.svelte` at any step and works offline.

The camera step opens the front camera and shows a spinner until the picture is live. When the
device has two or more cameras, a switch button (kit `IconButton`, top right of the viewfinder)
flips between front and back by `facingMode`; on a computer, where cameras report no facing mode,
it steps to the next camera in `enumerateDevices()`. Only a camera that reports
`facingMode: 'environment'` is shown and shot unmirrored. If switching fails, the old camera comes
back with a warning; if that fails too, the "Camera is off" problem step shows.

## Reading a selfie (on the device)

1. `src/lib/avatar/selfie.ts` loads MediaPipe Tasks Vision: Face Landmarker (478 points and
   blend shapes) and the hair segmenter. The wasm and models are same-origin files under
   `/avatar/` (about 19 MB, fetched with progress, cached by the service worker after first use,
   not precached).
2. `measure.ts` turns landmarks and the hair mask into numbers: face width and jaw ratios, skin and
   hair colour (CIELAB), hair area, length below the chin, fringe, roughness, top bun, beard
   darkness on jaw, upper lip and chin, glasses edges, smile, open mouth, and whether the hair looks
   covered.
3. `mapping.ts` maps the numbers to parts (`Person` in `person.ts`). Anything it is unsure of
   (glasses, beard, a head covering) becomes a question with nothing picked. A head covering is
   never guessed.
4. The photo canvas is wiped (`wipe()`) as soon as it is read. The photo never leaves the phone and
   is never stored; only the parts are saved.

Thresholds were tuned on two public MediaPipe test images kept outside the repo. No real face is
committed.

Lessons from a real indoor selfie (2026-11-20, dim side light, thin wire glasses), which came out
as Tone 8, long hair and no glasses:

- **Skin.** Side light left one cheek about 30 L* darker than the other, and the median of the
  three patches landed on the shade. Skin now comes from the brightest patch (the side facing the
  light) and is matched by lightness alone against `SKIN_PHOTO_L` in `mapping.ts`, a photo
  lightness scale. Hue is ignored because indoor light tints it. The result screen always shows
  the skin swatches, so a wrong tone takes one tap to fix. The beard is judged against the cheek
  on the same side, so a shaded jaw isn't read as a beard.
- **Exposure** (photos 2 and 3, 2026-11-20: a dark bathroom where skin read L* 44, and warm curtain
  light where it read 58; same skin as the L* 69 window photo). Phones set the exposure for the
  face, so plain lightness can't give a tone. `measure()` returns `faceBright`, the 99th
  percentile L* inside the face: the shine on the nose and forehead. Shine is a surface
  reflection, about as bright on any skin, so light skin sits close to it and dark skin well
  below it in any exposure. The tone is `skin / faceBright × 82` on the `SKIN_PHOTO_L` scale. All
  three photos give s2 to s3. A face with no shine at all (`faceBright` < 30) asks with no tone picked.
  An earlier try used the teeth as a white reference. It worked only when smiling, and was
  dropped once the shine ratio covered all three photos.
- **Glasses** (photo 3): the inner-rim and bridge test scored 0.38. The lower rim under both eyes
  is now a cue too: a thin dark line across the cheek in most columns under each eye.
- **Eye colour**: the style had one fixed blue-grey. `eyeColor` (`EYEC` in `person.ts`, style id
  `benkyo-v2`) is read from MediaPipe's iris points (468 to 477): the ring between pupil and
  glints. Only an iris lighter than L* 30 picks a colour, otherwise 'dark'.
- **Hair length.** Side hair is followed down from the eyes and stops at the first gap. Before,
  any dark patch the segmenter called hair (a shirt or a chair) counted as long hair.
  Roughness (curls) uses the median row jump near the head and skips the round top of the head.
- **Glasses.** Thin wire frames hardly change the edge average at the nose bridge. The reader now
  also looks for thin dark lines: the rims beside the nose on both sides, and the bridge across it.

## Drawing

The engine is `@antronic/coreva-render` (Job's Coreva Render, from GitHub Packages; `.npmrc`
reads `GITHUB_PACKAGES_TOKEN` from the environment; CI maps the repository secret `PACKAGES_TOKEN` to it). Benkyo ships its own style pack,
`src/lib/avatar/pack/benkyo-style.js` (id `benkyo-v2` since eye colours; was `benkyo-v1`, the Coreva flat style in Benkyo colours,
with head coverings, hats and 16 hairstyles). `render.ts` wraps it:

- `avatarSvg(person, size)`: a memoised still SVG, used for every small avatar and tile.
- `mountLive(el, person, …)`: the live 3D avatar (three.js WebGPU build at
  `/avatar/vendor/three.webgpu.min.js`), at most two at once, off when reduced motion is on.

`scripts/copy-avatar-vendor.mjs` copies three.js and the MediaPipe wasm into
`static/avatar/vendor/` (gitignored) before `dev` and `build`. The two model files are committed in
`static/avatar/models/`.

A higher-detail "Kuri style" pack exists as a draft only (project files, `avatar/`); it is not in
the app.

## Storage

- `accounts.avatar`: compact JSON, only the parts that differ from `DEFAULTS` (`compactPerson`).
  `cleanPerson` whitelists every key and value on the way in and out, so a damaged or old value
  falls back to the default.
- `accounts.avatar_asked_at`: when the one-time question was answered.
- `PUT /api/auth/avatar`: `{ avatar: {...} }` saves, `{ avatar: null }` removes,
  `{ later: true }` answers "Not now". Returns `/api/auth/me`.
- localStorage `benkyo.avatar`: the signed-in account's parts, so the avatar shows offline.

## Beta data

With consent (v3), `avatar_saved` records the saved parts and whether they came from a selfie or by
hand, and which questions were asked. Never the photo, never landmarks. `avatar_removed` records
a removal. See [BETA-DATA.md](BETA-DATA.md).

## Licences

- MediaPipe Tasks Vision and its models: Apache 2.0.
- three.js: MIT.
- `@antronic/coreva-render`: Job's own package (UNLICENSED, private).

## Asks for Coreva Render

- Export the face blend shapes and waving arm rig (for example `corevaRig(ctx, person)`), so
  layered style packs do not copy them.
- An exact-colour option (no tone mapping) for 3D styles.

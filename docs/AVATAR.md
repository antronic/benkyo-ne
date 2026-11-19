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

## Drawing

The engine is `@antronic/coreva-render` (Job's Coreva Render, from GitHub Packages; `.npmrc`
reads `GITHUB_PACKAGES_TOKEN` from the environment). Benkyo ships its own style pack,
`src/lib/avatar/pack/benkyo-style.js` (id `benkyo-v1`, the Coreva flat style in Benkyo colours,
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

# Benkyo-ne 勉強ね

A Japanese-learning PWA: kana lessons with animated stroke order, mnemonic
pictures, handwriting checked in WebAssembly, and FSRS spaced repetition.
It works offline and runs on Cloudflare's free tier.

**→ The learning design (curriculum, teaching and memory techniques, visual and
motion system, architecture) is in [`docs/PLAN.md`](docs/PLAN.md).**

## Stack

| Layer | Tech |
|---|---|
| UI | Svelte 5 + SvelteKit 3 (static SPA via `adapter-static`) |
| Offline | Service worker (`src/service-worker/`), IndexedDB, local-first |
| Scheduling | FSRS-5, TypeScript (`src/lib/srs/fsrs.ts`) |
| Handwriting | Rust → `wasm32-unknown-unknown` (`wasm/stroke/`), JS fallback |
| Stroke data | KanjiVG (CC BY-SA 3.0), compiled by `scripts/build-strokes.mjs` |
| Backend | Cloudflare Worker (`worker/`) + D1 (sync) + KV/Cache API (content) |
| Hosting | Workers Static Assets: free and unmetered |

## Develop

```bash
npm install
npm run dev          # Vite dev server (UI only; /api not available)
npm test             # FSRS + handwriting matcher (JS and WASM) tests
npm run check        # svelte-check / TypeScript

# Full stack locally (Worker + local D1):
npm run build
npm run db:migrate:local
npx wrangler dev     # http://localhost:8787
```

Regenerating derived assets is optional, since the outputs are committed:

```bash
npm run build:strokes   # re-download KanjiVG → src/lib/content/strokes.json
npm run build:wasm      # needs Rust + `rustup target add wasm32-unknown-unknown`
NODE_PATH=$(npm root -g) node scripts/build-icons.mjs   # PNG icons (needs Playwright)
```

## Deploy to Cloudflare (free plan)

The Cloudflare resources already exist and their IDs are in `wrangler.jsonc`:
D1 `benkyo` (migrated) and KV `CONTENT`.

### Automatic deploys (recommended): Workers Builds

Cloudflare builds and deploys on every push. No secrets live in GitHub.

1. Cloudflare dashboard → **Workers & Pages → Create → Import a repository**
   (or open an existing `benkyo-ne` Worker → **Settings → Builds → Connect**).
2. Pick GitHub → `antronic/benkyo-ne`.
3. Settings:
   - **Production branch:** `main`
   - **Build command:** `npm run build`
   - **Deploy command:** `npm run cf:deploy` (applies D1 migrations, then deploys)
   - **Non-production branch deploy command:** `npm run cf:preview` (uploads a preview version with its own URL, without touching production)
4. Save. Every push to `main` goes live. Other branches get preview URLs.

Live at **https://benkyo.jirachai.me** (Workers custom domain, configured in
both wrangler configs).

### Script-only deploy (no asset upload)

`npm run cf:deploy:embedded` bundles `build/` into the Worker script
(`worker/embedded.ts`, `wrangler.embedded.jsonc`) and deploys that. Use it where
Wrangler's asset upload can't run, for example behind a proxy that rewrites the
`Authorization` header. Static files then count as Worker requests (free plan:
100k/day). The next normal deploy (`npm run cf:deploy` or Workers Builds)
switches back to free Static Assets under the same Worker name and domain.

### Manual deploy from your machine

```bash
npx wrangler login
npm run build && npm run cf:deploy
```

Static assets are served without invoking the Worker. Only `/api/*` runs
Worker code (`run_worker_first`), which keeps traffic inside the free request
limits. See `docs/PLAN.md` §8.1 for the free-tier budget.

## Project layout

```
docs/PLAN.md                 learning + product plan
src/routes/                  Today · Learn · Lesson · Review · Kana · Settings
src/lib/components/          StrokeAnimator, TracePad, KanaGlyph, TabBar, …
src/lib/content/             kana, lessons, mnemonics (+ SVG scenes), confusables, strokes.json
src/lib/srs/fsrs.ts          scheduler
src/lib/handwriting/match.ts WASM loader + JS fallback
src/lib/state/               progress (IndexedDB-backed runes store)
src/lib/ios/                 haptics, swipe-back, keyboard, action sheets/toasts, size classes
src/lib/sync.ts              append-only review-log sync
src/service-worker/          offline caching
wasm/stroke/                 Rust handwriting matcher
worker/                      Cloudflare Worker + D1 migrations
```

## Licences

Code: MIT. Stroke data in `src/lib/content/strokes.json` is derived from
[KanjiVG](https://kanjivg.tagaini.net) © Ulrich Apel and is CC BY-SA 3.0.

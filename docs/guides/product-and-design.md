# Product and design: deciding what to build and how it should feel

How to think like a product designer on Benkyo, and how to build UI that fits it. The learning
design is in `docs/PLAN.md`, the visual system in `docs/DESIGN-SYSTEM.md` and the `/design` page.

## Who we build for

| Person | Where | What they need |
| --- | --- | --- |
| **Beginner** | A phone, a few minutes a day | Learn kana without feeling lost; know what to do next |
| **Returning learner** | Phone or iPad, often offline | Reviews ready, progress never lost, quick sessions |
| **Learner who already knows some** | Anywhere | Skip what they know (placement check), drills, kanji |
| **Thai speaker** | Thai interface | Everything in natural Thai, nothing clipped |
| **AI user** | Ask AI, card maker, lesson packs | Their own key, a clear spend cap, fast streaming answers |
| **Job** | `/admin` fleet console | See accounts, usage and health; change settings safely |

Progress and keys are personal. **Trust comes before delight**: a screen that is plain and always
right beats one that is beautiful and once wrong.

## Design thinking, as steps

1. **Understand the person.** Who, where, what did they just do, what might confuse them? Two sentences.
2. **State the problem as their problem.** Not "add a counter" but "after a review the learner
   cannot tell how many cards are left today".
3. **Think of more than one answer.** At least two.
4. **Pick the smallest one that solves the problem.** Every extra option is something to get wrong.
5. **Check the learning science.** Does it help memory (spaced repetition, active recall, dual
   coding), or only look busy? See `docs/PLAN.md`.
6. **Walk every state:** first launch, empty, loading, offline, signed out, error, AI key missing,
   cap reached, Thai, light and dark, phone, iPad, iPhone Duo (folded and unfolded), desktop.

## Rules for the product

- **Offline first.** Learning, review and progress work with no network. Sync and AI may wait.
- **Never lose progress.** An IndexedDB change needs an upgrade path; a sync change needs both old
  and new clients to keep working until everyone updates.
- **The server confirms before the UI does** for accounts, keys, consent and admin actions.
- **Show errors as they are.** A spend cap is a cap message, not "something went wrong".
- **Stay on the free plan** (`docs/PLAN.md` §8.1). A feature that needs paid Cloudflare usage is a
  question for Job.

## Rules for the UI

- **Feels like iOS**: large titles, sheets, swipe-back, haptics (`src/lib/ios/`). Copy the existing
  screen patterns.
- **Design system first**: tokens from `src/lib/design/tokens.css`, components from `#lib/ui`,
  listed on `/design`. No magic colours or sizes. A new component goes into `src/lib/ui` and onto `/design`.
- **Kit only**: every control and card in the app comes from `#lib/ui` (no raw `<button>`,
  `<input>`, `<select>`, `<textarea>`, no hand-made `.btn` / `.glass`), and every kit component is on
  `/design`. A field and its button share a `FieldRow`. `npm run lint:ui` and the hook enforce it.
- **The user always knows the state**: loading shows a `Skeleton` or `Spinner`, an action shows
  `busy` on its button, errors say what to do next. `npm run lint:ui` flags async work with none.
- **Light and dark** at parity. `data-theme` on an element forces a theme for screenshots.
- **Layouts**: phone (390 px), iPad (768 px and up), unfolded iPhone Duo (side rail only in
  landscape or 840 px and up, see `RAIL_QUERY` in `src/lib/ios/device.svelte.ts`), desktop.
  No horizontal scroll; touch targets at least 44 px; respect safe-area insets.
- **Safari first.** Most learners are on iPhone. Avoid CSS or JS that Safari does not support; the
  startup fallback in `src/app.html` must keep working with JS failing.
- **Thai text** must not clip or overflow; check it on screen, not only in the test.
- **Motion** follows `docs/DESIGN-SYSTEM.md`; respect `prefers-reduced-motion`.
- **Romaji** shows under Japanese text, except where it would give the answer away.

## Done checklist for a screen

- Empty, loading (Skeleton, Spinner or busy button), offline and error states handled.
- Every control comes from the kit and every kit component you added is on `/design`.
- Phone, iPad and desktop layouts checked, no horizontal scroll.
- Reachable and placed: the screen is in its nav (tab bar, or Fleet's `src/lib/admin/nav.ts`), the nav marks it current, and a screen below the top shows the way back (Breadcrumbs or a back button). Walk there from the home screen, do not open the URL.
- Light and dark, English and Thai, keyboard focus visible.
- Gate green, and you walked the flow in a real browser and attached screenshots.

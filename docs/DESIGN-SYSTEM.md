# Design system

Benkyo's look is an iOS-style Liquid Glass interpretation: washi paper and sumi ink
backgrounds, translucent glass surfaces, vermilion (朱) for main actions and indigo (藍)
for links and selection. This document says where things live and how to use them.
The live references are the **/design** page (not linked from the tab bar) and the component
**Storybook** at [/storybook/](https://benkyo.jirachai.me/storybook/) ([below](#storybook)).

## Files

| What | Where |
| --- | --- |
| Tokens (CSS custom properties) | `src/lib/design/tokens.css`, imported at the top of `src/app.css` |
| Token list for the catalog | `src/lib/design/tokens.ts` |
| Global utility classes (`.glass`, `.btn`, type classes, `.page`, `.stack`, `.row`) | `src/app.css` |
| Components | `src/lib/ui/*.svelte`, exported from `src/lib/ui/index.ts` |
| Catalog page | `src/routes/design/+page.svelte` |
| Storybook stories (one file per kit component) | `src/lib/ui/stories/<Name>.stories.svelte` |
| Storybook config (app CSS, themes, viewports, `$app/*` stand-ins) | `.storybook/` |

## Tokens

Three layers:

1. **Primitives** `--p-*`: the raw palette (`--p-shu-500`, `--p-ai-400`, `--p-washi-100`).
   Components never use these directly.
2. **Semantic** tokens, which components use:
   - Colour: `--color-bg`, `--color-bg-2`, `--color-text`, `--color-text-2`, `--color-text-3`,
     `--color-border`, `--color-fill`, `--color-fill-strong`, `--color-surface`,
     `--color-surface-strong`, `--color-surface-edge`, `--color-accent`, `--color-info`,
     `--color-violet`, `--color-success`, `--color-warning`, `--color-danger`,
     `--color-primary`, `--color-link`, `--color-focus`, `--gradient-brand`, `--gradient-ai`
   - Spacing on a 4px grid: `--space-1` (4) … `--space-12` (48), plus `--space-px` (2) and `--space-1h` (6)
   - Type: `--text-caption-2` (11) … `--text-large-title` (34), `--weight-*`, `--leading-*`, `--font-text`, `--font-display`, `--font-jp`, `--font-mono`
   - Radius: `--radius-xs` 4, `-sm` 8, `-md` 12, `-control` 14, `-card` 22, `-sheet` 32, `-pill`
   - Size: `--control-sm` 36, `--control-md` 44 (minimum touch target), `--control-lg` 50, `--field-h` 54
   - Elevation and material: `--shadow-surface`, `--shadow-raised`, `--blur-glass`
   - Motion: `--ease-spring`, `--ease-spring-bouncy`, `--ease-out`, `--dur-fast` … `--dur-slow`
   - Layers: `--z-nav` … `--z-toast`
3. **Legacy aliases** (`--bg`, `--ink`, `--accent`, `--accent-2`, `--r-m`, `--glass` …) map to the
   semantic tokens so existing screens are unchanged. New code should use the semantic names;
   migrate old names as you touch a file.

### Themes

The OS setting picks light or dark. To force a theme, set `data-theme="light"` or
`data-theme="dark"` on `<html>` or on any element; that subtree resolves every token,
including the legacy aliases, in that theme. The catalog's side-by-side view and the
planned `/admin` console use this.

## Components

Import from `#lib/ui/index.ts`:

```svelte
<script lang="ts">
	import { Button, ListGroup, ListRow, Switch } from '#lib/ui/index.ts';
	let haptics = $state(true);
</script>

<ListGroup>
	<ListRow title="Haptics">
		{#snippet trailing()}<Switch label="Haptics" bind:checked={haptics} />{/snippet}
	</ListRow>
</ListGroup>
<Button variant="accent" block>Start lesson</Button>
```

| Component | Props | Replaces |
| --- | --- | --- |
| `Button` | `variant` primary · accent · ghost · danger · ghost-danger · plain (text, no side padding; `class="danger"` for red) · link, `size` sm 36 · md 44 · lg 50 (default, or the FieldRow's size), `block`, `href`, `busy`, `icon` snippet | `<button class="btn …">` |
| `IconButton` | `label` (required), `size` | `.icon-btn` |
| `Card` | `strong`, `sheen`, `padding` none · sm · md · lg, `radius`, `as`; `href` or `onclick` make it a tappable tile (`selected`, `disabled`) | `<div class="glass …">`, answer tiles |
| `SectionHeader` | `title`, `level`, `trailing` snippet | `<h2 class="eyebrow section">` |
| `ListGroup` + `ListRow` | row: `title`, `subtitle`, `href` / `onclick`, `chevron`, `tone`, `selected`, `disabled`, `leading` / `trailing` snippets | `.group` + `.item` in settings, account, AI settings, words |
| `Switch` | `bind:checked`, `label`, `onchange` | `.switch` in settings |
| `Segmented` | `options`, `bind:value`, `label` | `.seg` in Welcome and AccountSettings |
| `Chip` | `selected`, `tone`, `count`, `href` / `onclick` | `.chip` in words, AI ask, AI lesson |
| `Badge` | `tone`, `variant` soft · solid · tag | `.badge`, `.tag`, `.pill` (five copies) |
| `TextField` | `bind:value`, `label`, `hint`, `error`, `jp`, `size` sm · md · lg, `variant` default · answer · bare, `grow`, `bind:ref` | `<input>` |
| `TextArea` | `bind:value`, `rows`, `autogrow`, `maxRows`, `label` | `<textarea>` |
| `FieldRow` | `size` (default md, passed to every control inside), `stack` never · narrow, `as` div · form, `onsubmit` | a field next to its button |
| `Select` | `options` (`group` makes an optgroup), `bind:value`, `label`, `size`, `block` | `<select>`, `.pick` |
| `Checkbox` | `bind:checked`, children = label | `<input type="checkbox">` |
| `Slider` | `bind:value`, `min`, `max`, `step`, `label` | `<input type="range">` |
| `FileButton` | `onpick(file)`, `accept`, button props | `<input type="file">` |
| `Stepper` | `bind:value`, `min`, `max`, `step`, `label` | `.stepper` in settings |
| `Notice` | `tone`, `title`, `action` snippet | new |
| `Skeleton` | `variant` row · card · tile · line, `count`, `label` | blank space while data loads |
| `Spinner` | `label` (none = decorative), `size` sm · md · lg · inline (1em), `tone` accent · current, `showLabel` | a short wait with no layout to preview; `Button busy` uses the inline one |
| `ProgressRing`, `BarChart` | progress and per-day bars | |
| `Sheet` | `open`, `label`, `onclose`, `header`, `peek`, `footer`, `bind:body` | bottom sheets; `peek` opens at medium height over what you were looking at (drag or tap the grabber for full height), `footer` stays pinned above the keyboard (Ask AI peek on word cards) |
| `LargeTitle` | the screen's iOS large title and compact title bar | |
| `StatTile` | `label`, `value`, `note`, `tone` default · danger; lay out in `<div class="ui-stats">` | `.tile` in the fleet console |
| `SideNav` | `items` (href, label, icon, group, note), `current`, `label`, `header`/`footer` snippets | a section's pages; Fleet's sidebar and phone menu |
| `MenuBar` | `current`, `label`, `icon`, `onmenu`, `expanded`, `floating` | phone pill naming the current page; opens the section menu |
| `Columns` | `min` (column width, default 340px); `<section>` children stack their header and content; `.span-all` takes the row | side-by-side sections on desktop, stacked on phones (Fleet) |
| `DataTable` | `columns` (key, label, align, width), `rows`, `key`, `label`, `cell` snippet, `href` (whole row opens it) | records in columns; under 560px of its own width each row stacks with labels |
| `Breadcrumbs` | `items` (label, href); last is the current page; phones show only `‹ parent` | where you are and the way back, below a section's top page |
| `PolitenessMeter` (draft) | `value`, `target` 0 casual → 1 keigo, `steps`, `valueLabel`, `targetLabel` | Writing helper: how polite a message is against who it is for ([EVERYDAY.md](EVERYDAY.md)) |
| `MarkedText` (draft) | `parts` (`text`, `kind` mark · add · del), `size` | words found in a photo; a suggested rewrite |
| `KanjiTile` (draft) | `kanji`, `reading`, `misread`, `unwritten` | "Kanji you keep forgetting" set |
| `SpeechBubble` (draft) | children, `avatar` snippet (default Kuri), `label` | a short line from Kuri |

### Kit only

Every control and card in the app comes from the kit, and every kit component is on `/design`
and has a Storybook story (Job, 2026-11-19: "all components designed must present in storybook,
and all components that using in app must came from storybook"; 2026-11-21: "I need the actual
storybook").

- Outside `src/lib/ui`, no raw `<button>`, `<input>`, `<select>` or `<textarea>`, and no hand-made
  `class="btn"`, `"glass"`, `"card"`, `"chip"` or `"switch"`. If the kit lacks something, add it to
  `src/lib/ui`, export it from `index.ts`, show it on `/design` and add its story in the same PR.
- A field and its action sit in a `FieldRow`: one height (md 44px by default), bottoms aligned, the
  field grows and the button keeps its label width. Never pair a 54px field with a 36px pill.
- A deliberate exception (a drawing canvas's hidden input, the app shell's tab bar) carries
  `ui-ok: <reason>` on the line, or `ui-ok-file: <reason>` for a whole shell component.

### Loading states

The user always knows what the app is doing (Job, 2026-11-19).

- Data that loads shows a `Skeleton` shaped like the content; a short wait with nothing to preview
  shows a `Spinner`; an action shows `busy` on the button that started it, and the button can't be
  pressed twice.
- Errors say what failed and what to do; offline is a normal state, not an error.
- Every spinner is the kit `Spinner`. It turns an SVG arc inside a still box; a spinning element
  box (`rotate(1turn)` on a span, a border ring, a whole `<svg>`) wobbles in Safari, because WebKit
  pivots the rotation on a pixel-snapped point while the box sits at a fractional position or size.
  `npm run lint:ui` (rule `spin-box`) rejects full-turn rotate keyframes anywhere under `src/`.
- Work the user didn't start on screen (a link's promo code being used after sign-in) shows
  `busyToast(text)` (a toast with a spinner) until the result toast replaces it.
- Text that says something is under way ("Asking your providers…") sits in a `Spinner` label, so
  it reads as loading and not as a message.
- Buttons never wait on an animation: the VIP invite card's Accept appears with the note, not
  after the drawing has played.
- `npm run lint:ui` checks each async function on its own: it must set a value that the markup
  uses next to a `Skeleton`, `Spinner`, `ProgressRing`, `busy` or `aria-busy` (on that line, or in
  an `{#if}` / `{:else if}` around it), call `busyToast()`, or await a function in the same file
  that does. A spinner elsewhere in the file no longer counts, and "…Loading…" text without a
  spinner fails. Waits that are not loading (tick, timers, confirm sheets, clipboard, goto) are
  skipped. An instant local read or write says so with `// ui-ok: reason` on the function's first
  line.

`Button` and `IconButton` reuse the global `.btn` / `.icon-btn` styles in `app.css`, so a
migrated button and an old one look the same.

### Errors

`ErrorState` (kit) is the one way to show that something failed. Kinds: `offline`, `not-found`,
`server`, `crash`, `session`, `access` (Fleet 403), `update`. Each says what happened in plain words,
what still works ("your progress is saved on this device"), and two actions. Bugs and server errors
show the error ID and build on screen, so a screenshot is a full report, with Copy details, Show
details and an optional note. `layout="inline"` puts it in a card when one panel fails and the rest of
the screen works; prefer that to throwing. Kuri is drawn in plain SVG here, never with the WebGL
renderer, so it shows when the app is broken. `src/routes/+error.svelte` picks the kind with
`errorKind()` in `src/lib/errorKind.ts`.

### More below

`ScrollMore` (kit) is a glass "More below ↓" pill that floats above the bottom of a long screen
while more than 200px, or 40% of the screen, is still below (`scrollMore.ts`). Tapping it scrolls
smoothly to the end (instantly under reduced motion) and moves focus to `<main>`; it fades out near
the bottom. The root layout shows one on every screen. It clears the tab bar (none on the side rail),
the safe area and the keyboard; a screen with its own fixed bottom bar sets `ui.scrollClear` (Ask AI
composer, Fleet menu pill). It sits under the tab bar and sheets (z-index 45). A full-screen sheet that
scrolls itself (the beta consent) puts its own `ScrollMore` inside, with `target` set to the scrolling
element.

## Storybook

A real [Storybook](https://storybook.js.org) (10, `@storybook/svelte-vite`, stories in Svelte CSF
with `@storybook/addon-svelte-csf`) shows every kit component on its own, with controls for its
props, the variants and states, and a Docs page. Live at https://benkyo.jirachai.me/storybook/.

- **Run it:** `npm run storybook` (dev server on port 6006, a forever process: background it).
  `npm run build-storybook` writes the static site to `build/storybook/`; `npm run build` runs it
  after the app build, so every deploy ships it and CI builds it.
- **Matches the app:** `.storybook/preview.ts` imports `src/app.css` (tokens, type, glass). The
  toolbar's theme switch sets `data-theme="light|dark"` on `<html>`, as the app does. The viewport
  menu has the review widths: phone 390, iPad 768, iPad landscape 1024, desktop 1280.
- **Plain Svelte, no SvelteKit:** `.storybook/vite.config.ts` uses the Svelte plugin only, and maps
  the few `$app/*` modules the kit reaches (`$app/env`, `$app/navigation`, `$app/state`) to small
  stand-ins in `.storybook/app/`. A kit component that needs another `$app` module gets a stand-in
  there.
- **One story file per component**, `src/lib/ui/stories/<Name>.stories.svelte`, titled by group
  (`Controls/`, `Content/`, `Feedback/`, `Navigation/`, `Data/`, `Learning/`, `Avatar/`): a
  `Playground` story with `args` for the controls, plus named stories for variants and states.
  A story that shows several components together uses `asChild`. Overlays (Sheet, the InviteCard
  pop-up) set `docs.story.inline: false` so they don't cover the Docs page. `npm run lint:ui`
  (rule `kit-story`) fails when a kit component has no story file.
- **Served without Worker code:** `/storybook/*` is a plain static path (not in `run_worker_first`),
  the service worker leaves it alone, and the embedded deploy skips it.
- `/design` stays as the in-app catalog (it also shows app components and drafts that are not in
  the kit). New kit work starts with its story; the story is the source of truth for a component's
  props and states.

## Navigation for many items

The main navigation (`src/lib/components/TabBar.svelte`) reads one list, `NAV_ITEMS` in
`src/lib/nav.ts`: href, label, one-line description, icon and group (Study, Your words, People, You).
A new top-level screen gets an entry there and nothing else.

| Where | What it shows |
| --- | --- |
| Phone bottom bar (< 600 px) | 4 tabs + More |
| Bottom bar ≥ 600 px (unfolded Duo portrait, iPad portrait) | 6 tabs + More |
| Folded Duo / iOS 27 side status column | 4 icons + More, in a column |
| Side rail (`RAIL_QUERY`) | every screen, in groups split by a hairline, Settings last; under 600 px tall, 4 tabs + More |
| Sidebar (`SIDEBAR_QUERY`, ≥ 1200 px) | every screen with its label, group headings, Settings at the bottom |

- The tabs are the learner's pins (`settings.navPins`, default `DEFAULT_PINS`), shown in list order;
  if fewer are pinned than fit, the next screens in the list fill in. More holds the rest.
- More opens `NavMore.svelte` (kit `Sheet` + `ListGroup`): each screen with its description, the
  Review due count, and "Edit tab bar" (a `Checkbox` per screen, up to the room on that screen).
- On a screen that lives in More, the More tab takes that screen's icon and name and is marked
  active, so the bar always says where you are. If Review is in More, its due count shows on More.
- `check:layout` opens More when it checks that every top-level screen is reachable.

## Motion and transitions

The live versions of these, with replay buttons, are in the Motion section of `/design`.

### Principles

1. **Springs for touch, ease-out for arrivals.** Anything under the finger (presses, toggles,
   drags) uses `--ease-spring` or `--ease-spring-bouncy`. Things that arrive by themselves
   (pages, sheets, toasts) use `--ease-out` or `cubicOut` and settle without overshoot.
2. **Motion shows where things went.** Sheets rise from the bottom and leave the same way,
   routes morph with View Transitions, shared elements (`view-transition-name`) grow from
   where they were. The tab bar never animates during a page change.
3. **Feedback starts at once.** Presses react on touch-down. State changes take
   `--dur-fast` (200ms); arrivals stay under `--dur-slow` (700ms).
4. **One moment per screen.** Looping, ambient motion belongs to the splash, intro and
   backdrop only. Study screens stay still so the kana is the thing that moves (stroke
   animation, trace ink).
5. **Never motion alone.** Pair it with a haptic and a visible state: a wrong answer
   shakes, buzzes (`haptic('error')`) and turns red.
6. **Respect the settings.** `prefers-reduced-motion` cuts every animation to 1ms and turns
   off page morphs; `prefers-reduced-transparency` swaps glass for solid surfaces. Both are
   global in `app.css`, so don't override them with `!important`.

### Patterns

| Pattern | Use for | Spec | Haptic |
| --- | --- | --- | --- |
| Press | Buttons, chips, cards, rows | scale `--press-scale` (0.96; icon buttons 0.9, chips 0.95), `--dur-press`, `--ease-spring` | `selection` on chips, segments, tabs |
| Rise in | Content on a screen's first show | `.rise` with `style:--i`: y 18px + blur 6px → 0, `--dur-slow`, `--ease-spring`, `--stagger` per item | none |
| Page change | Route changes | View Transitions: old fades to scale 0.97 + blur 4px, new from scale 1.02, `--dur-page`, `--ease-out`; shared elements 560ms spring | none |
| Sheet | Details, pickers, action sheets | `fly` y from below, `--dur-base`, `cubicOut`, `opacity: 1`; scrim `fade` 200–220ms; drag to dismiss | `warning` before a destructive choice |
| Toast | Confirmation after an action | `scale` from 0.85, 380ms `cubicOut`; out `fade` 200ms | `success` |
| Toggle | Switch knob, stepper, segment | `--dur-toggle`, `--ease-spring-bouncy`; track colour 250ms | `selection` |
| Progress | Rings and bars | width or stroke 500–600ms, `--ease-spring` | `success` when a goal completes |
| Wrong answer | Wrong answer, invalid field | `.shake`, 480ms, `--ease-out` | `error` |
| Ambient | Splash, intro, backdrop | drift or breathe 6–9s, `ease-in-out`, `alternate` | none |
| Loading | Waiting on data | `Skeleton` shimmer 1.4s; `Spinner` arc 800ms linear (2.4s with reduced motion) | none |

### Rules

- Animate `transform`, `opacity` and `filter` only. Avoid animating layout properties
  (`width` on progress bars is the one exception).
- Use the tokens, not raw numbers: `--dur-*`, `--ease-*`, `--stagger`, `--press-scale`.
- Stagger at most about 6 items; after that, show the rest at once.
- Don't block input behind an animation. A user can tap through a rise-in or close a sheet
  mid-flight.

## Spacing and layout

Spacing is checked, not just recommended.

- **Every padding, margin and gap uses `var(--space-*)`**, including `style:padding=…` and the
  `style:--gap=…` of `.stack` / `.row`. Allowed without a token: `0`, hairlines (≤ 1px), and a line
  marked `/* ui-ok: reason */` for real geometry (centring a 60px orb with `margin: -30px`, clearing a
  fixed bar with `200px`).
- **Card insets**: content sits at least `--space-3` (12px) from a card's sides and `--space-2`
  (8px) from its top and bottom. Cards use `--space-4` or more; feature cards `--space-5`.
- **Page column**: on wide screens (≥ 600px) `.page` draws one column of `--page-max` (default
  1040px) centred in the space right of the rail. A screen narrows it by setting `--page-max`
  (Settings 680px, Fleet 820px); never left-align a column by giving children a `max-width`.
- **Never put `.rise` (or any transform/filter) on an ancestor of `LargeTitle`**: it traps the fixed title bar inside that box.
- **Controls** are at least 32px tall (`.btn.small`, steppers); primary touch targets 44px.

The checks:

| Check | Runs | Catches |
| --- | --- | --- |
| `npm run lint:ui` (`scripts/check-spacing.mjs`) | the gate and CI | hard-coded px in padding, margin, gap; `--fix` snaps them to the nearest token (ties round up) |
| `npm run lint:ui` (`scripts/check-ui.mjs`) | the gate and CI | raw native controls and hand-made kit classes outside `src/lib/ui`, a kit component not exported or not on `/design`, async work with no loading state, a full-turn spin on an element box (`spin-box`) |
| Claude Code hook (`.claude/settings.json`, PostToolUse on Edit/Write) | after every agent edit of a `.svelte` or `.css` file | both lints, reported back to the agent at once (exit 2) |
| `npm run check:layout` (`scripts/check-layout.mjs`) | the gate and CI, after `npm run build` | horizontal scroll, an off-centre column (≥ 600px), text hugging a card edge, controls under 32px, and a compact title bar that does not span rail to edge or whose title is off the column centre; at 390, 768, 1024 (side rail) and 1280px. A second pass loads Fleet's AI, packages, promo and account screens with synthetic data (`scripts/layout-fixtures.mjs`) and opens their forms and the model picker. A navigation pass then walks Fleet: every page under `src/routes/admin` must be in the Fleet nav (or linked from its parent, for detail pages), be marked current there with the same name as its title, and show a breadcrumb back; every top-level screen must be in the tab bar. At 1280px every Fleet page must fill at least 900px beside the sidebar. An avatar setup pass opens that full-screen sheet from Today as a synthetic signed-in learner and checks each step (start, after the dice, editor top and scrolled, consent, camera with Chromium's fake camera, "no face" from a chosen photo). Everywhere: controls side by side in one row share one height (plain text buttons, chips, tabs, radios and a row marked `data-mixed-sizes` are exempt), a "Back" button sits on the left, and a full-screen sheet's top padding is not smaller than its side padding |
| `npm run check:render` (`scripts/check-render.mjs`) | the gate and CI, after `npm run build` | GPU work no screenshot shows: with SwiftShader WebGL2, it counts every WebGL/WebGPU context while it opens the avatar setup, rolls the dice three times and taps editor tiles; a new context after the live avatar started (an engine rebuild), more alive than `setLiveLimit`, a lost context or a page error fails it; at 390 and 1280px. It also drops the Settings Kuris' contexts (each must rebuild) and shakes the Today Kuri (it must get dizzy; a plain drag must not) |
| `src/lib/design/spacing.test.ts` | `npm test` | the lint's scale drifting from `tokens.css` |
| `src/lib/ui/kit.test.ts` | `npm test` | the UI kit lint's rules, and every kit component exported and on `/design` |

`LAYOUT_SHOTS=<dir> npm run check:layout` saves a screenshot of each failing screen; CI uploads
them as the `layout-failures` artifact. `LAYOUT_REVIEW=<dir>` saves every avatar setup step, pass
or fail, for the visual review (CI uploads them as `layout-review`).

## Rules of thumb

- Use a semantic token for every colour, space, radius and font size. A raw hex or px
  value in a component is a smell; add a token if one is missing.
- Touch targets are at least `--control-md` (44px).
- Japanese text gets the `.jp` class (or `jp` prop) for `--font-jp` and proportional kana.
- Glass needs something behind it. On solid backgrounds prefer `Card strong`.
- Respect `prefers-reduced-motion` and `prefers-reduced-transparency`; `app.css` already
  handles both globally.

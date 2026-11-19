# Design system

Benkyo's look is an iOS-style Liquid Glass interpretation: washi paper and sumi ink
backgrounds, translucent glass surfaces, vermilion (朱) for main actions and indigo (藍)
for links and selection. This document says where things live and how to use them.
The live reference is the **/design** page (not linked from the tab bar).

## Files

| What | Where |
| --- | --- |
| Tokens (CSS custom properties) | `src/lib/design/tokens.css`, imported at the top of `src/app.css` |
| Token list for the catalog | `src/lib/design/tokens.ts` |
| Global utility classes (`.glass`, `.btn`, type classes, `.page`, `.stack`, `.row`) | `src/app.css` |
| Components | `src/lib/ui/*.svelte`, exported from `src/lib/ui/index.ts` |
| Catalog page | `src/routes/design/+page.svelte` |

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
| `Button` | `variant` primary · accent · ghost · danger · plain, `size` md · sm, `block`, `href`, `busy`, `icon` snippet | `<button class="btn …">` |
| `IconButton` | `label` (required), `size` | `.icon-btn` |
| `Card` | `strong`, `sheen`, `padding` none · sm · md · lg, `radius`, `as` | `<div class="glass …">` |
| `SectionHeader` | `title`, `level`, `trailing` snippet | `<h2 class="eyebrow section">` |
| `ListGroup` + `ListRow` | row: `title`, `subtitle`, `href` / `onclick`, `chevron`, `tone`, `leading` / `trailing` snippets | `.group` + `.item` in settings, account, AI settings, words |
| `Switch` | `bind:checked`, `label`, `onchange` | `.switch` in settings |
| `Segmented` | `options`, `bind:value`, `label` | `.seg` in Welcome and AccountSettings |
| `Chip` | `selected`, `tone`, `count`, `href` / `onclick` | `.chip` in words, AI ask, AI lesson |
| `Badge` | `tone`, `variant` soft · solid · tag | `.badge`, `.tag`, `.pill` (five copies) |
| `TextField` | `bind:value`, `label`, `hint`, `error`, `jp` | `input[type=text]` |
| `Select` | `options`, `bind:value`, `label` | `.pick` in settings |
| `Stepper` | `bind:value`, `min`, `max`, `step`, `label` | `.stepper` in settings |
| `Notice` | `tone`, `title`, `action` snippet | new |

`Button` and `IconButton` reuse the global `.btn` / `.icon-btn` styles in `app.css`, so a
migrated button and an old one look the same.

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
| Loading | Waiting on data | `Skeleton` shimmer 1.4s; spinners only inside a busy button | none |

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
- **Controls** are at least 32px tall (`.btn.small`, steppers); primary touch targets 44px.

The checks:

| Check | Runs | Catches |
| --- | --- | --- |
| `npm run lint:ui` (`scripts/check-spacing.mjs`) | the gate and CI | hard-coded px in padding, margin, gap; `--fix` snaps them to the nearest token (ties round up) |
| Claude Code hook (`.claude/settings.json`, PostToolUse on Edit/Write) | after every agent edit of a `.svelte` or `.css` file | the same lint, reported back to the agent at once |
| `npm run check:layout` (`scripts/check-layout.mjs`) | the gate and CI, after `npm run build` | horizontal scroll, an off-centre desktop column, text hugging a card edge, controls under 32px; at 390, 768 and 1280px |
| `src/lib/design/spacing.test.ts` | `npm test` | the lint's scale drifting from `tokens.css` |

`LAYOUT_SHOTS=<dir> npm run check:layout` saves a screenshot of each failing screen; CI uploads
them as the `layout-failures` artifact.

## Rules of thumb

- Use a semantic token for every colour, space, radius and font size. A raw hex or px
  value in a component is a smell; add a token if one is missing.
- Touch targets are at least `--control-md` (44px).
- Japanese text gets the `.jp` class (or `jp` prop) for `--font-jp` and proportional kana.
- Glass needs something behind it. On solid backgrounds prefer `Card strong`.
- Respect `prefers-reduced-motion` and `prefers-reduced-transparency`; `app.css` already
  handles both globally.

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

## Rules of thumb

- Use a semantic token for every colour, space, radius and font size. A raw hex or px
  value in a component is a smell; add a token if one is missing.
- Touch targets are at least `--control-md` (44px).
- Japanese text gets the `.jp` class (or `jp` prop) for `--font-jp` and proportional kana.
- Glass needs something behind it. On solid backgrounds prefer `Card strong`.
- Respect `prefers-reduced-motion` and `prefers-reduced-transparency`; `app.css` already
  handles both globally.

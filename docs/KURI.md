# Kuri, the Shiba companion

Kuri (栗, after the chestnut coat) is a low-poly Shiba who studies with you.

![Kuri in the app](screenshots/kuri.webp)

## Where Kuri appears

| Where | What Kuri does | Setting |
| --- | --- | --- |
| Today | Walks around the bottom of the screen, sits, dozes after 30s. Drag to move, tap for a hop and a line. | Walk around on Today |
| Ask AI | Avatar in the header; thinks while a reply streams. | Show Kuri |
| Lessons and reviews | Pops up in the corner for ~1.5s on a right (happy) or wrong (encourage) answer. | React to answers |
| First meeting | ~4s intro once: after onboarding, or the first time an existing user opens Today. Skippable; still with reduced motion. Replay from Settings. | Show Kuri |

All settings live in `progress.settings` (`kuri`, `kuriStyle`, `kuriWalk`, `kuriReact`, `kuriLowPoly`). The intro is marked seen in IDB `meta/kuriIntroSeen`.

## Files

| What | Where |
| --- | --- |
| Renderer and geometry (no dependencies) | `src/lib/companion/shiba.ts` |
| Types, settings helpers, reaction bus | `src/lib/companion/kuri.svelte.ts` |
| One Kuri on a canvas | `src/lib/companion/Kuri.svelte` |
| Today walker, intro, reaction, Settings section | `KuriWalker.svelte`, `KuriIntro.svelte`, `KuriReaction.svelte`, `KuriSettings.svelte` |

Call `kuriReact('happy' | 'encourage')` from a study screen to make Kuri react.

## Performance

- The renderer is a separate ~9 KB gzipped chunk, loaded with a dynamic import only when a Kuri is on screen. With Kuri off it's never downloaded.
- Full model ~1,500 triangles (~90 KB GPU); low poly ~950 (~57 KB). Small Kuris use low poly at 30 fps by default.
- One interleaved vertex buffer (20 bytes a vertex), no per-frame matrix allocations, hidden parts skipped.
- Drawing stops when the tab is hidden, when the canvas is off screen, and after one still frame with reduced motion. `destroy()` frees the buffer, shader and WebGL context when a screen unmounts.

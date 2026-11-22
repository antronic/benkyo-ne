# Kuri, the Shiba companion

Kuri (栗, after the chestnut coat) is a low-poly Shiba who studies with you.

![Kuri in the app](screenshots/kuri.webp)

## Where Kuri appears

| Where | What Kuri does | Setting |
| --- | --- | --- |
| Today | Walks around the free parts of the screen, sits, dozes after 30s. Never covers a button, link, field or the menu bar (see Keep-out below). Drag to move, tap for a hop and a line. Shake while holding (four quick back-and-forth swings) and Kuri gets dizzy: x x eyes, a wobbling head and stars circling, then a line when set down. | Walk around on Today |
| Ask AI | Avatar in the header; thinks while a reply streams. | Show Kuri |
| Lessons and reviews | Pops up in a free corner for ~1.5s on a right (happy) or wrong (encourage) answer; when every corner holds a control, the nearest free spot, else only the sound. | React to answers |
| First meeting | Once, on Today after the first lesson (or the first time an existing user opens Today): Kuri waves and says はじめまして in a small speech bubble beside it, for about 9s or until a tap. Replay from Settings. | Show Kuri |

All settings live in `progress.settings` (`kuri`, `kuriStyle`, `kuriWalk`, `kuriReact`, `kuriLowPoly`, `kuriSound`). The intro is marked seen in IDB `meta/kuriIntroSeen`.

## Keep-out

Kuri must never cover a control or the menu bar (Job, 2026-11-22). Kuri's 104px box takes taps, so
anything under it would be blocked. `src/lib/companion/keepOut.ts` reads the page every 400 ms and
on every scroll or resize:

- **Hard boxes**: every button, link, field, switch, tab or focusable element, and fixed or sticky
  menu bars (the tab bar, side rail, sidebar, compact title bar). Kuri keeps a 6px gap from them.
  Elements in a dialog, hidden ones and ones that take no taps are left out.
- **Soft boxes**: lines of text (weight 1) and cards (weight 0.25). Kuri may stand on them, but a
  spot that covers less wins.

The walker only wanders to a free spot it can reach in a straight line without passing over a
control. When the page scrolls under Kuri onto a control, Kuri fades out (no taps) and comes back
at the nearest free spot once scrolling stops; when it is put down on a control, or the page
changes under it, it hops off. When no spot is free at all, Kuri stays out of the way until one is.
Its speech bubble goes above, below or beside Kuri, wherever it covers no control.

`npm run check:render` watches Kuri on Today at phone, iPad and desktop width (hello, wandering,
scrolling, put down on Start lesson) and fails if Kuri ever covers a control or the menu bar.

## Sound

With **Sound** on (the default), Kuri yips on a tap, squeaks when picked up, yawns and sighs through its nose falling asleep, hums while Ask AI thinks, goes "awawawa" with twinkling stars when shaken dizzy, chirps or "awoo"s for right and wrong answers, and says "はじめまして！" when it first says hello.

- Everything is synthesized with Web Audio in `src/lib/companion/sound.ts` (about 3 KB gzipped). The sleep yawn uses a breathier voice (glottal pulse with jitter, aspiration and a small room) so it sounds like a real dog; the rest use the formant buzz. There are no audio files.
- The voice is built from scratch: a buzzing tone through vowel filters, one syllable at a time. It copies no recording or real voice.
- On iPhone and iPad (Safari 16.4+) the page's audio is marked `ambient`, so it follows the silent switch. Only there: on Mac Safari an `ambient` page played nothing at all (2026-11-21). Other browsers can't detect silent mode and play at the page volume.
- After the page has been in the background, the next tap builds a fresh AudioContext unless the old one is still running (iPhone leaves it `interrupted`, and an interrupted context can stay silent).
- Browsers lock audio until the first touch. `kuri.svelte.ts` unlocks it on the first tap while Sound is on, so nothing plays before the learner touches the app.
- Sound defaults to on. A stored `kuriSound` only counts once `kuriSoundChosen` is set (the learner flipped the switch); older saved settings that just carried the old `false` default get the new default.
- Use `kuriSound(name)` and `kuriHello()` from `kuri.svelte.ts`; they do nothing when Kuri or Sound is off.

## Files

| What | Where |
| --- | --- |
| Renderer and geometry (no dependencies) | `src/lib/companion/shiba.ts` |
| Types, settings helpers, reaction bus, sound helpers | `src/lib/companion/kuri.svelte.ts` |
| Synthesized sounds and voice | `src/lib/companion/sound.ts` |
| One Kuri on a canvas | `src/lib/companion/Kuri.svelte` |
| Today walker (and its hello), reaction, Settings section | `KuriWalker.svelte`, `KuriReaction.svelte`, `KuriSettings.svelte` |
| Keep-out zones | `keepOut.ts` (tests in `keepOut.test.ts`) |

Call `kuriReact('happy' | 'encourage')` from a study screen to make Kuri react. Every answer a learner checks calls it: Learn lessons, and in Review the kana, kanji and word cards (`onWordAnswer` for `WordQuiz`).

## Performance

- The renderer is a separate ~9 KB gzipped chunk, loaded with a dynamic import only when a Kuri is on screen. With Kuri off it's never downloaded.
- Full model ~1,500 triangles (~90 KB GPU); low poly ~950 (~57 KB). Small Kuris use low poly at 30 fps by default.
- One interleaved vertex buffer (20 bytes a vertex), no per-frame matrix allocations, hidden parts skipped.
- Drawing stops when the tab is hidden, when the canvas is off screen, and after one still frame with reduced motion. `destroy()` frees the buffer, shader and WebGL context when a screen unmounts.
- When the browser drops the WebGL context (Safari does after the app sat in the background, a sleep or memory pressure), `Kuri.svelte` replaces the canvas and builds Kuri again once the page is visible, at most 3 times a minute. `npm run check:render` checks it on Settings, and that shaking the Today Kuri makes it dizzy while a plain drag does not.

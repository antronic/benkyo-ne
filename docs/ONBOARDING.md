# First-run onboarding

New installs get a few tappable questions and the plan they produce, **after** the beta sign-up:

    introduction → sign-up (passkey, recovery code) → beta consent → questions → avatar step → Today

- **Create account**: the questions open once the consent is agreed, then the avatar step
  (docs/AVATAR.md). The same for `/invite` links and an Apple `created` result.
- **Not now** (signed out, first run): the questions open straight away, then Today.
- **Sign in** to an existing account: no questions; the Today plan card's Personalize nudge stays.
- A device that already has answers (`meta/profile`, including Skip) is never asked again; Adjust on
  the plan card reopens them. `ui.onboardingNext` holds the questions while sign-up finishes
  (`+layout.svelte`, `afterWelcome`).

## Loading after sign-in and sign-up

Signing in or up shows a full-screen loading screen (`Handoff.svelte`, kit `Spinner`, `ui.handoff`)
over the welcome sheet's fade, so nothing blank or half-loaded shows on the way:

- sign-up: until the consent, the questions or the avatar step is on screen;
- sign-in: until the first sync has brought in the account's progress, then Today.

It shows for at least 450 ms (the welcome fade) and never more than 8 s (offline, a slow sync).

![Onboarding screens](screenshots/onboarding.webp)

| Question | Choices | Default (Skip) | What it sets |
|---|---|---|---|
| What brings you to Japanese? | Travel, Anime/manga/games, Friends & family, Food & culture, Work or school, Just for fun (pick any) | none | Topic course suggested in the plan (first pick wins) |
| How much do you know already? | Brand new · Some kana · Read hiragana & katakana | Brand new | Lesson 1, or the placement check (hiragana, then katakana) |
| How much time a day? | 5 · 10 · 20 minutes | 10 | `settings.newPerDay` 5 · 10 · 15 |

- Single-choice questions advance on tap. **Skip** is on every question and keeps the
  defaults without touching Settings. Back and "Change answers" let people revise.
- **Start learning** lands on Today (never inside a lesson), where the plan card links the first
  step; for a new account the avatar step comes first.
- If the build has the interface language (`src/lib/i18n`), a language switch sits on the first
  question and the questionnaire switches live. Its copy (English + Thai) is in
  `src/lib/onboarding/strings.ts`; move it into `en.ts` / `th.ts` once i18n is merged.
- The placement check is offered only when `/learn/placement` exists in the build; otherwise
  everyone starts at lesson 1.

## Today plan card

`PlanCard.svelte` shows the plan on Today with each step ticked off (lesson done, any lesson
of that script passed, any card added from the course). **Adjust** reopens the questions with
the previous answers; ✕ hides it; it disappears when every step is done. Installs from before
onboarding (or people who skipped) see a small "Personalize" nudge until they've learned 10 kana.

## Storage

Answers live on the device in IndexedDB `meta/profile` (`{ goals, level, minutes, at, skipped, hidden? }`).
They are not synced; the pace they set is in Settings, which already travels with the device.
Mapping logic is pure and tested: `src/lib/onboarding/plan.ts`.

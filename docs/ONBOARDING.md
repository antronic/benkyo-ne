# First-run onboarding

Learn first, set up later (docs/UX-FLOW.md, phase 3). A new install reaches its first lesson in
five taps:

    intro (one page) → two quick questions → account (passkey) → lesson 1
    → back on Today: beta consent → Kuri says hello; recovery code, avatar, install on the set-up card

- **Intro** (`Intro.svelte`): one page with the language switch, **Get started** and **I have an
  account** (opens the account sheet on Sign in). Replay from Settings → About.
- **Quick questions** (`Onboarding.svelte`, `quick`): how much you know and how much a day (plus the
  level for everyday users); the last tap saves and moves on. Skip keeps the defaults. A device that
  already has answers skips them. The full set (why you learn, the plan page) is Settings → Learning →
  Your plan.
- **Create account**: no recovery-code screen. `firstRun.recoveryPending` puts "Save a recovery code"
  on Today's set-up card, which makes a fresh code (`/api/auth/recovery-code`) when tapped; the code is
  never stored. `firstRun.consentLater` holds the beta consent until a lesson is done and the learner is
  off a full-screen step (`consentDue` in `+layout.svelte`). AI, beta data and the avatar wait for it.
  An account that must re-consent (a new consent version) sees it at once.
- **Then** straight into the first step (`firstStepHref()`): lesson 1, or the placement check or level
  for someone who already reads kana. **Not now** goes there too, signed out.
- A sign-up from elsewhere (Settings, an invite, an Apple `created` result) with no answers on this
  device gets the full questions after the account, then Today (`ui.onboardingNext`).
- **Invite links** (`/invite/CODE`) need an account: the VIP card has only Accept, and sign-up has
  no **Not now** while the invite is pending in the tab (`benkyo.inviteLink`, sessionStorage). It
  reopens after a reload until someone signs up or in, which clears it; an ended or full invite is
  cleared at once. **Not now** stays only when no account can be made (no passkeys and no Apple, or
  the server unreachable). Open in Safari and the install guide's link carry the invite and coupon
  over (`resumeLink`, `src/lib/promo/link.ts`), since the app has moved on to `/` by then.
  The sign-up sends the invite whether or not sign-up is open, so it is counted and saved on the
  account (Fleet → Invitations shows who used it and when), and sends the saved promo code: the
  server redeems it, or the invite's own, as it makes the account (`signupPromo`), before the first
  lesson and the consent. A sign-in with a pending code redeems it in the root layout.
- **Sign in** to an existing account: no questions; Today's set-up card offers "Pick your daily goal".
- A device that already has answers (`meta/profile`, including Skip) is never asked again; Settings →
  Your plan reopens them.

## Loading after sign-in and sign-up

Signing in or up shows a full-screen loading screen (`Handoff.svelte`, kit `Spinner`, `ui.handoff`)
over the welcome sheet's fade, so nothing blank or half-loaded shows on the way:

- sign-up: until the first lesson (or, from elsewhere, the questions) is on screen;
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
- The full set's **Start learning** lands on Today, where the next-step card links the first step.
  The first run's quick set goes on to the account and then the first step itself.
- If the build has the interface language (`src/lib/i18n`), a language switch sits on the intro and
  on the full set's first question, and the questionnaire switches live. Its copy (English + Thai) is in
  `src/lib/onboarding/strings.ts`; move it into `en.ts` / `th.ts` once i18n is merged.
- The placement check is offered only when `/learn/placement` exists in the build; otherwise
  everyone starts at lesson 1.

## The plan on Today

The plan's steps (`src/lib/today/plan.svelte.ts`: `planSteps`, `stepDone`) feed Today's one next
step (`pickNext` in `src/lib/today/next.ts`, docs/UX-FLOW.md): a placement check, a level or
everyday Japanese becomes the hero card; a topic course shows as the "Then" link under the next
lesson. Settings → Learning → **Your plan** reopens the questions with the previous answers. People
who skipped the questions see "Pick your daily goal" on Today's set-up card.

## Storage

Answers live on the device in IndexedDB `meta/profile` (`{ goals, level, minutes, at, skipped, hidden? }`).
They are not synced; the pace they set is in Settings, which already travels with the device.
Mapping logic is pure and tested: `src/lib/onboarding/plan.ts`.

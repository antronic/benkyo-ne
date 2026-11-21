# App flow: learn first, set up later

From the whole-app UX review of 2026-11-21 (learners found the flow confusing, back and forth,
unclear how to start, and too wordy). Job asked for all four phases to be built.

## Rules for every screen

1. **One next step.** A screen has one main button. Today always says what to do now.
2. **Go back where you came from.** A full-screen step (lesson, review, pack, Ask AI) closes with
   `leave(fallback)` from `src/lib/state/leave.ts`. The root layout keeps `ui.returnTo` with
   `returnTarget()` (`src/lib/nav.ts`), so a lesson opened from Today closes to Today and one opened
   from Learn closes to Learn. Never close with a fixed `goto('/learn')`.
3. **No AI nagging.** An account without AI (`ai.reasonKind === 'noAi'`: no package, no key of
   its own) is normal. Screens hide Ask AI buttons and hints for it instead of asking for an API key.
4. **Learner words only.** No FSRS, retention targets, engines, drafts or API keys on learner
   screens. Those live in Settings, under Advanced.
5. **Empty states say how to start.** Review with nothing learned says so and offers the first
   lesson, instead of "All caught up".

## Phases

| Phase | What | State |
| --- | --- | --- |
| 1 | Quick wins: back to where you came from, Review empty state, no API-key nagging, N5 draft notice hidden, lighter Today | Live (PR #100) |
| 2 | Today hero: one next-step card (`NextStep`, `pickNext`), a progress line, the set-up card (`SetupCard`: daily goal, avatar, install); plan answers move to Settings → Your plan; Today keeps room at the bottom for Kuri | This PR |
| 3 | First run: welcome, two questions, account, straight into lesson 1; recovery code, consent, avatar and install move to the setup card | Planned |
| 4 | Navigation: 5 tabs (Today, Learn, Review, Words, Me), shorter Learn, grouped Settings | Planned |

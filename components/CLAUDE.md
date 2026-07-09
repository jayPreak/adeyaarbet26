# components — UI Reference (AI)

Read root `CLAUDE.md` first. Before committing changes here, follow its
Documentation Protocol (CHANGELOG.md + docs/ai/SESSION_LOG.md + this file if stale).

## App shell
The live app shell is `app/(tabs)/layout.jsx` ("TabsShell": ErrorBoundary +
BettingProvider + AppHeader + TabBar + shared modals). State lives in
`lib/BettingContext.jsx` (`useBetting()`).
(The old `AdeYaarApp.jsx` monolith shell was dead code and was removed 2026-07-09.)

## Layout
- `index.jsx` — shared widgets: MatchCard, HeroMatch, PlaceBetSheet, BetCard,
  AppHeader, TabBar, Flag, SectionHead, Toast, SpecialNotification, `useBettingOpen()`.
- `screens/` — screen bodies rendered by `app/(tabs)/*/page`: HomeScreen,
  FixturesScreen, BracketScreen, SpecialsScreen, LeaderboardScreen, BetsScreen.
- `desktop/DesktopApp.jsx` — desktop variant.
- `*BetModal.jsx` — one modal per special (CupWinner, Continent, H2H, GoldenBoot,
  GoalScorer, FinalFour, TotalGoals, ThirdPlaceQualifier). New modals: open state in
  BettingContext, render in `app/(tabs)/layout.jsx`.
- `MatchPropsSheet.jsx` — match props + duels bottom sheet.
- `CountdownGate.jsx` / `CountdownSplash.jsx` / `MiniCountdown.jsx`, `LineupSheet.jsx`,
  `SearchOverlay.jsx`, `R32BetPage.jsx` — misc.

## Conventions
- Never show raw `match_id`/`pick` to users — use `getSpecial(kind).formatPick(pick)`
  and `getTeam(code).name`.
- `useBettingOpen()` fail-safes to CLOSED when kickoffTs is null; cutoff = kickoff − 30s.
- Bottom sheets on iOS Safari: use the `--vvh` CSS var (real visible viewport height),
  not `100dvh`; pin submit buttons so they clear browser chrome; render above TabBar.
- Disable submit buttons on first tap (`submitting` flag) — double-tap = duplicate bet.
- Styling: inline styles + `app/globals.css` vars (`--ink`, `--surface-2`, `--gold`,
  `--win`, `--loss`, …). Dark theme only, mobile-first.

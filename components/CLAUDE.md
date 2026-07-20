# components — UI Reference (AI)

Read root `CLAUDE.md` first. Before committing changes here, follow its
Documentation Protocol (CHANGELOG.md + docs/ai/SESSION_LOG.md + this file if stale).

## ⛔ AdeYaarApp.jsx is DEAD CODE
It is not rendered anywhere. The live app shell is `app/(tabs)/layout.jsx`
("TabsShell": ErrorBoundary + BettingProvider + AppHeader + TabBar + shared modals).
State lives in `lib/BettingContext.jsx` (`useBetting()`). Wiring anything into
AdeYaarApp.jsx silently does nothing.

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
- `WrappedStory.jsx` — Spotify-Wrapped-style full-screen stat story (14 slides)
  opened from a banner on Home when `isTournamentSettled()`. Self-contained:
  `computeWrapped()` derives every stat client-side from `bets` / `allChallenges`
  / `settlementByUser` / `allUsers` (no API/RPC). Uses settlement-normalized `net`
  (failure mode #14) and `allChallenges` (full history, not the narrowed
  `challenges`) for the duel record. Story mechanics (auto-advance, tap-nav,
  hold-to-pause, keyboard, progress bars) live entirely in the component.
- `LiveStreamPanel.jsx` — collapsible embedded live-video player rendered on Home
  above the hero card when a match is live. Reads mirror URLs from
  `lib/streams.js:getStreams(matchId)`; renders nothing if the id has no mapping.
  Iframe is only mounted while expanded (autoplay + data usage). Display-only —
  no money/betting logic.

## Conventions
- Never show raw `match_id`/`pick` to users — use `getSpecial(kind).formatPick(pick)`
  and `getTeam(code).name`.
- `useBettingOpen()` fail-safes to CLOSED when kickoffTs is null; cutoff = kickoff − 30s.
- Bottom sheets on iOS Safari: use the `--vvh` CSS var (real visible viewport height),
  not `100dvh`; pin submit buttons so they clear browser chrome; render above TabBar.
- Disable submit buttons on first tap (`submitting` flag) — double-tap = duplicate bet.
- Styling: inline styles + `app/globals.css` vars (`--ink`, `--surface-2`, `--gold`,
  `--win`, `--loss`, …). Dark theme only, mobile-first.

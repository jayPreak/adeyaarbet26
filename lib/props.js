// Match prop bets: exact scoreline, over/under total goals, penalties prop.
// Pure functions shared by the UI (option lists, labels) and auto-resolve
// (computing the winning pick from a final FIFA score).
//
// Scoreline rules: settles on the final score INCLUDING extra time but
// EXCLUDING penalty shootouts. Scores with either side above 3 fall into
// catch-all buckets so the market always has a defined winner.

export const OU_LINE = 2.5;

const SCORELINE_MAX = 3;

// All exact scorelines 0-0 … 3-3, then the three catch-all buckets.
export const SCORELINE_OPTIONS = (() => {
  const opts = [];
  for (let h = 0; h <= SCORELINE_MAX; h++) {
    for (let a = 0; a <= SCORELINE_MAX; a++) {
      opts.push(`${h}-${a}`);
    }
  }
  opts.push('other_home', 'other_away', 'other_draw');
  return opts;
})();

// Map a final score to the winning scoreline pick.
export function scorelineBucket(homeScore, awayScore) {
  if (homeScore == null || awayScore == null) return null;
  if (homeScore <= SCORELINE_MAX && awayScore <= SCORELINE_MAX) {
    return `${homeScore}-${awayScore}`;
  }
  if (homeScore > awayScore) return 'other_home';
  if (awayScore > homeScore) return 'other_away';
  return 'other_draw';
}

export function formatScorelinePick(pick, homeName = 'Home', awayName = 'Away') {
  if (pick === 'other_home') return `Any other ${homeName} win`;
  if (pick === 'other_away') return `Any other ${awayName} win`;
  if (pick === 'other_draw') return 'Any other draw (4-4+)';
  return pick;
}

// Over/under 2.5 total goals (including extra time).
export function overUnderPick(homeScore, awayScore) {
  if (homeScore == null || awayScore == null) return null;
  return homeScore + awayScore > OU_LINE ? 'over' : 'under';
}

export function formatOverUnderPick(pick) {
  if (pick === 'over') return `Over ${OU_LINE} goals`;
  if (pick === 'under') return `Under ${OU_LINE} goals`;
  return pick;
}

// Penalties prop: did the match go to a shootout?
export function pensPick(wentToPens) {
  return wentToPens ? 'yes' : 'no';
}

export function formatPensPick(pick) {
  if (pick === 'yes') return 'Goes to penalties';
  if (pick === 'no') return 'Decided before penalties';
  return pick;
}

// Total tournament goals special (matchId TOTAL_GOALS, kind total_goals).
export const TOTAL_GOALS_LINE = 269.5;

export function formatTotalGoalsPick(pick) {
  if (pick === 'over') return `Over ${TOTAL_GOALS_LINE} goals`;
  if (pick === 'under') return `Under ${TOTAL_GOALS_LINE} goals`;
  return pick;
}

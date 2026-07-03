// Leaderboard achievements — computed from the rankings entries the
// leaderboard API already returns. Pure function so it's unit-testable.
//
// Each ranking entry: { id, display_name, username, realisedBalance,
//   totalStaked, betCount, winRate, winStreak, topBets: [{amount, status, profit}] }

function name(r) {
  return (r.display_name || r.username || '?').split(' ')[0];
}

function best(rankings, score, { min = -Infinity } = {}) {
  let top = null;
  let topScore = min;
  for (const r of rankings) {
    const s = score(r);
    if (s == null || !Number.isFinite(s)) continue;
    if (s > topScore) { topScore = s; top = r; }
  }
  return top ? { entry: top, score: topScore } : null;
}

/**
 * Compute fun titles from leaderboard rankings.
 * Returns [{ id, emoji, title, description, userId, userName, avatarUrl }]
 * — only titles that someone has actually earned.
 */
export function computeAchievements(rankings, fmtMoney = (n) => String(n)) {
  if (!Array.isArray(rankings) || rankings.length === 0) return [];
  const out = [];
  const add = (id, emoji, title, r, description) => out.push({
    id, emoji, title,
    userId: r.id,
    userName: name(r),
    avatarUrl: r.avatar_url || null,
    description,
  });

  const shark = best(rankings, r => r.realisedBalance, { min: 0 });
  if (shark && shark.score > 0) {
    add('shark', '🦈', 'The Shark', shark.entry, `Up ${fmtMoney(shark.score)} — everyone owes them`);
  }

  const donor = best(rankings, r => -(r.realisedBalance ?? 0), { min: 0 });
  if (donor && donor.score > 0) {
    add('donator', '🫠', 'The Donator', donor.entry, `Down ${fmtMoney(donor.score)} — funding everyone's wins`);
  }

  const degen = best(rankings, r => r.betCount, { min: 0 });
  if (degen && degen.score >= 5) {
    add('degenerate', '🎰', 'The Degenerate', degen.entry, `${degen.score} bets placed — cannot be stopped`);
  }

  const roller = best(rankings, r => r.totalStaked, { min: 0 });
  if (roller && roller.score > 0) {
    add('high_roller', '💰', 'High Roller', roller.entry, `${fmtMoney(roller.score)} total staked`);
  }

  // winRate is null until a user has 3+ resolved bets, so this self-gates.
  const sniper = best(rankings, r => r.winRate == null ? null : r.winRate, { min: 0 });
  if (sniper && sniper.score > 50) {
    add('sniper', '🎯', 'The Sniper', sniper.entry, `${sniper.score}% win rate`);
  }

  const streak = best(rankings, r => r.winStreak, { min: 0 });
  if (streak && streak.score >= 3) {
    add('hot_streak', '🔥', 'Hot Streak', streak.entry, `${streak.score} wins in a row`);
  }

  const hunter = best(rankings, r => {
    const profits = (r.topBets || []).filter(b => b.status === 'won').map(b => b.profit);
    return profits.length ? Math.max(...profits) : null;
  }, { min: 0 });
  if (hunter && hunter.score > 0) {
    add('big_game', '🐘', 'Big Game Hunter', hunter.entry, `${fmtMoney(hunter.score)} profit on a single bet`);
  }

  const heartbreak = best(rankings, r => {
    const losses = (r.topBets || []).filter(b => b.status === 'lost').map(b => b.amount);
    return losses.length ? Math.max(...losses) : null;
  }, { min: 0 });
  if (heartbreak && heartbreak.score > 0) {
    add('heartbreak', '💔', 'Heartbreak Kid', heartbreak.entry, `${fmtMoney(heartbreak.score)} torched on one bet`);
  }

  return out;
}

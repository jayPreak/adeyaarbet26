import { TEAM } from '@/lib/data';
import { formatScorelinePick, formatOverUnderPick, formatPensPick, formatTotalGoalsPick } from '@/lib/props';

const ALL_TEAMS = Object.values(TEAM).sort((a, b) => a.name.localeCompare(b.name));

// Confederation mapping
const CONFEDERATIONS = {
  UEFA: { label: 'Europe (UEFA)', teams: ['GER','ESP','FRA','ENG','POR','NED','BEL','SUI','CRO','DEN','SRB','POL','AUT','SCO','HUN','SVK','CZE','ALB','SVN','ROU','UKR','GEO','TUR','GRE','IRL','WAL','NOR','SWE','FIN','ISR','BIH','ISL','MNE','MKD','BUL','LUX'] },
  CONMEBOL: { label: 'South America (CONMEBOL)', teams: ['BRA','ARG','URU','COL','ECU','CHI','PER','PAR','VEN','BOL'] },
  CONCACAF: { label: 'N/C America (CONCACAF)', teams: ['MEX','USA','CAN','CRC','JAM','HON','SLV','PAN','HAI','TRI','CUW','GUA','NIC','BER'] },
  CAF: { label: 'Africa (CAF)', teams: ['NGA','SEN','MAR','CMR','EGY','GHA','CIV','ALG','TUN','RSA','MLI','COD','GUI','MOZ','TAN','UGA','ZAM'] },
  AFC: { label: 'Asia (AFC)', teams: ['JPN','KOR','AUS','IRN','SAU','QAT','IRQ','UZB','CHN','OMA','BHR','JOR','IND','IDN','THA','VNM'] },
  OFC: { label: 'Oceania (OFC)', teams: ['NZL','PNG','FIJ','SOL','NCL','TAH'] },
};

export function getConfederation(teamCode) {
  for (const [conf, data] of Object.entries(CONFEDERATIONS)) {
    if (data.teams.includes(teamCode)) return conf;
  }
  return null;
}

export const CONFEDERATION_OPTIONS = Object.entries(CONFEDERATIONS).map(([code, data]) => ({
  value: code,
  label: data.label,
  teams: data.teams,
}));


export const SPECIALS = [
  {
    id: 'cup_winner',
    matchId: 'CUP_WINNER',
    title: `Cup Winner — ${ALL_TEAMS.length} teams`,
    description: 'Pick the team that wins the 2026 FIFA World Cup',
    emoji: '🏆',
    options: ALL_TEAMS.map(t => ({ value: t.code, label: t.name })),
    optionType: 'team',
    multiPick: false,
    penalty: true,
    resolvesTs: '2026-07-19T19:00:00Z',
    formatPick: (pick) => {
      const t = TEAM[pick];
      return t ? t.name : pick;
    },
  },
  {
    id: 'continent',
    matchId: 'CONTINENT',
    title: 'Winning Continent',
    description: 'Which confederation will the World Cup winner come from?',
    emoji: '🌍',
    options: CONFEDERATION_OPTIONS,
    optionType: 'continent',
    multiPick: false,
    deadlineTs: '2026-06-18T23:59:00Z',
    resolvesTs: '2026-07-19T19:00:00Z',
    formatPick: (pick) => {
      const conf = CONFEDERATIONS[pick];
      return conf ? conf.label : pick;
    },
  },
  {
    id: 'h2h',
    matchId: 'MESSI_V_RONALDO',
    title: 'Player H2H: Messi v. Ronaldo Goals',
    description: 'Who scores more goals in the 2026 World Cup?',
    emoji: '⚔️',
    options: [
      { value: 'messi', label: 'Lionel Messi', country: 'ARG' },
      { value: 'ronaldo', label: 'Cristiano Ronaldo', country: 'POR' },
    ],
    optionType: 'player',
    multiPick: false,
    deadlineTs: '2026-06-19T23:59:00Z',
    resolvesTs: '2026-07-19T19:00:00Z',
    resolutionRules: [
      'More goals through all rounds → wins',
      'Tie → more assists wins',
      'Still tie → fewer penalty goals wins',
      'Still tie → player whose team goes further wins',
      'Still tie → 50-50 split',
      'Player withdraws → opposing player wins',
      'Both don\'t play → 50-50 split',
      'Tournament cancelled after Aug 2 → 50-50 split',
    ],
    formatPick: (pick) => pick === 'messi' ? 'Lionel Messi 🇦🇷' : pick === 'ronaldo' ? 'Cristiano Ronaldo 🇵🇹' : pick,
  },
  {
    id: 'r32_loser',
    matchId: 'R32_BIGGEST_LOSER',
    title: 'KO Flop',
    description: 'Who loses the most money across R32 + R16 matches?',
    emoji: '🫠',
    options: [],
    optionType: 'player',
    multiPick: false,
    deadlineTs: '2026-07-03T12:30:00Z',
    resolvesTs: '2026-07-08T20:00:00Z',
    formatPick: (pick) => pick || '?',
  },
  {
    id: 'r32_winner',
    matchId: 'R32_BIGGEST_WINNER',
    title: 'KO Bagholder',
    description: 'Who wins the most money across R32 + R16 matches?',
    emoji: '💸',
    options: [],
    optionType: 'player',
    multiPick: false,
    deadlineTs: '2026-07-03T12:30:00Z',
    resolvesTs: '2026-07-08T20:00:00Z',
    formatPick: (pick) => pick || '?',
  },
  {
    id: 'third_place_qualifiers',
    matchId: 'THIRD_QUALIFIERS',
    title: '3rd Place Race — Pick 8 Qualifiers',
    description: 'Pick all 8 third-place teams that will advance to the Round of 32. All 8 must be correct to win.',
    emoji: '🥉',
    options: [],
    optionType: 'team',
    multiPick: false,
    deadlineTs: '2026-06-26T18:59:00Z',
    resolvesTs: '2026-06-26T21:00:00Z',
    formatPick: (pick) => {
      if (!pick) return pick;
      return pick.split(',').join(' · ');
    },
  },
  {
    id: 'final_four',
    matchId: 'FINAL_FOUR',
    title: 'Final Four — Pick the Semifinalists',
    description: 'Pick the 4 teams that reach the semifinals. Most correct picks wins the pool (ties split it).',
    emoji: '🔮',
    options: [],
    optionType: 'team',
    multiPick: false,
    penalty: true,
    // Betting closes at qf_deadline (server); it RESOLVES once all four QFs
    // finish and the semifinalists are known. Last QF (QF-4) kicks off
    // 2026-07-12 01:00 UTC → resolved by ~04:00 UTC. Keep it in the ACTIVE
    // grid until then (resolvesTs is what moves a card to "Settled").
    resolvesTs: '2026-07-12T04:00:00Z',
    formatPick: (pick) => {
      if (!pick) return pick;
      return pick.split(',').map(c => TEAM[c]?.name || c).join(' · ');
    },
  },
  {
    id: 'total_goals',
    matchId: 'TOTAL_GOALS',
    title: 'Total Goals O/U 299.5',
    description: 'Across all 104 tournament matches (incl. extra time, excl. shootouts) — over or under 299.5 goals? Settled at tournament end.',
    emoji: '🌡️',
    options: [
      { value: 'over', label: 'Over 299.5' },
      { value: 'under', label: 'Under 299.5' },
    ],
    optionType: 'side',
    multiPick: false,
    resolvesTs: '2026-07-19T19:00:00Z',
    formatPick: formatTotalGoalsPick,
  },
  {
    id: 'ko_cup_winner',
    matchId: 'KO_CUP_WINNER',
    title: 'Cup Winner Last 8',
    description: 'Pick the World Cup winner from the remaining 8 knockout teams. Separate pool from the group-stage cup winner bet.',
    emoji: '🏆',
    options: [],
    optionType: 'team',
    multiPick: false,
    penalty: true,
    deadlineTs: '2026-07-09T19:30:00Z',
    resolvesTs: '2026-07-19T19:00:00Z',
    formatPick: (pick) => {
      const t = TEAM[pick];
      return t ? t.name : pick;
    },
  },
  // Per-match prop kinds — hidden from the Specials grid (they live on match
  // cards), registered here so BetCard/activity can format their picks.
  {
    id: 'scoreline',
    matchId: null,
    hidden: true,
    title: 'Exact Score',
    description: 'Pick the exact final score (incl. extra time)',
    emoji: '🎯',
    options: [],
    optionType: 'score',
    multiPick: false,
    formatPick: (pick) => formatScorelinePick(pick),
  },
  {
    id: 'over_under',
    matchId: null,
    hidden: true,
    title: 'Over/Under 2.5',
    description: 'Over or under 2.5 total goals',
    emoji: '⚖️',
    options: [],
    optionType: 'side',
    multiPick: false,
    formatPick: formatOverUnderPick,
  },
  {
    id: 'pens',
    matchId: null,
    hidden: true,
    title: 'Penalties?',
    description: 'Will the match go to a penalty shootout?',
    emoji: '🥅',
    options: [],
    optionType: 'side',
    multiPick: false,
    formatPick: formatPensPick,
  },
  {
    id: 'challenge',
    matchId: null,
    hidden: true,
    title: 'Duel',
    description: '1v1 winner-takes-all duel with a friend',
    emoji: '⚔️',
    options: [],
    optionType: 'side',
    multiPick: false,
    formatPick: (pick) => pick === 'home' ? 'Home' : pick === 'away' ? 'Away' : pick,
  },
];

export function getSpecial(id) {
  return SPECIALS.find(s => s.id === id) || null;
}

export function getSpecialByMatchId(matchId) {
  return SPECIALS.find(s => s.matchId === matchId) || null;
}

const SPECIAL_LABEL_OVERRIDES = {
  CUP_WINNER: 'Cup Winner',
  CONTINENT: 'Winning Continent',
  MESSI_V_RONALDO: 'Messi vs Ronaldo',
  GOLDEN_BOOT: 'Golden Boot',
  THIRD_QUALIFIERS: '3rd Place Qualifiers',
  R32_BIGGEST_LOSER: 'KO Flop',
  R32_BIGGEST_WINNER: 'KO Bagholder',
  FINAL_FOUR: 'Final Four',
  TOTAL_GOALS: 'Total Goals O/U',
  KO_CUP_WINNER: 'Cup Winner Last 8',
};

export function getSpecialLabel(matchId) {
  if (!matchId) return null;
  if (SPECIAL_LABEL_OVERRIDES[matchId]) return SPECIAL_LABEL_OVERRIDES[matchId];
  if (matchId.startsWith('HT_')) {
    return matchId.slice(3).toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  const s = SPECIALS.find(s => s.matchId === matchId);
  return s ? s.title : null;
}

export function isSpecialBet(bet) {
  return bet.kind && bet.kind !== 'match';
}

/**
 * Resolve display labels for any bet row. Returns { matchLabel, pickLabel }.
 * Works server-side (leaderboard API) and client-side (graph tooltips).
 *
 * opts.getMatchFn: match_id → match object (getMatch from data.js or array .find)
 * opts.getTeamFn: code → team object (getTeam from data.js)
 * opts.fmtStageFn: match_id → stage tag string (fmtKnockoutStage from data.js)
 * opts.allUsers: optional, used for r32_loser/r32_winner pick labels
 */
export function formatBetLabels(bet, { getMatchFn, getTeamFn, fmtStageFn, allUsers } = {}) {
  const matchId = bet.match_id;
  const specialLabel = getSpecialLabel(matchId);

  let matchLabel = specialLabel || matchId;
  let pickLabel = bet.pick;

  if (specialLabel) {
    const def = getSpecial(bet.kind);
    if (def?.formatPick) {
      pickLabel = def.formatPick(bet.pick);
    }
    if ((bet.kind === 'r32_loser' || bet.kind === 'r32_winner') && allUsers?.length) {
      const u = allUsers.find(u => u.id === bet.pick);
      if (u) pickLabel = u.display_name || u.username || pickLabel;
    }
    if ((matchId === 'CUP_WINNER' || matchId === 'KO_CUP_WINNER') && getTeamFn) {
      const pt = getTeamFn(bet.pick);
      if (pt) pickLabel = pt.name;
    }
  } else {
    const m = getMatchFn ? getMatchFn(matchId) : null;
    const stageTag = fmtStageFn ? fmtStageFn(matchId) : null;
    if (m && m.home && m.away && getTeamFn) {
      const h = getTeamFn(m.home);
      const a = getTeamFn(m.away);
      matchLabel = stageTag ? `${stageTag}: ${h.code} vs ${a.code}` : `${h.code} vs ${a.code}`;
      if (bet.pick === 'home') pickLabel = h.name;
      else if (bet.pick === 'away') pickLabel = a.name;
      else if (bet.pick === 'draw') pickLabel = 'Draw';
    } else if (stageTag) {
      matchLabel = stageTag;
      if (bet.pick === 'home') pickLabel = 'Home';
      else if (bet.pick === 'away') pickLabel = 'Away';
      else if (bet.pick === 'draw') pickLabel = 'Draw';
    }
  }

  return { matchLabel, pickLabel };
}

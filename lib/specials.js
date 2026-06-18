import { TEAM } from '@/lib/data';

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
    id: 'goalscorer',
    matchId: null,
    title: 'Anytime Goalscorer',
    description: 'Pick a player to score in any group stage match',
    emoji: '⚽',
    options: [],
    optionType: 'player',
    multiPick: false,
    formatPick: (pick) => pick,
  },
];

export function getSpecial(id) {
  return SPECIALS.find(s => s.id === id) || null;
}

export function getSpecialByMatchId(matchId) {
  return SPECIALS.find(s => s.matchId === matchId) || null;
}

export function isSpecialBet(bet) {
  return bet.kind && bet.kind !== 'match';
}

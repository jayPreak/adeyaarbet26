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

export const HALFTIME_PERFORMERS = [
  'Shakira', 'Coldplay', 'Justin Bieber', 'Burna Boy', 'Sabrina Carpenter',
  'Drake', 'Karol G', 'Jennifer Lopez', 'Wizkid', 'J Balvin',
  'Maluma', 'Bad Bunny', 'Ariana Grande', 'Feid', 'Camila Cabello',
  'Daddy Yankee', 'Rauw Alejandro', 'Charli XCX', 'Pitbull', 'Jay-Z',
  'Olivia Rodrigo', 'Harry Styles', 'Kendrick Lamar', 'Bruno Mars', 'Nicki Minaj',
  'Myke Towers', 'Ed Sheeran', 'David Guetta', 'Beyoncé', 'Cardi B',
];

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
    formatPick: (pick) => {
      const t = TEAM[pick];
      return t ? t.name : pick;
    },
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
  {
    id: 'continent',
    matchId: 'CONTINENT',
    title: 'Winning Continent',
    description: 'Which confederation will the World Cup winner come from?',
    emoji: '🌍',
    options: CONFEDERATION_OPTIONS,
    optionType: 'continent',
    multiPick: false,
    formatPick: (pick) => {
      const conf = CONFEDERATIONS[pick];
      return conf ? conf.label : pick;
    },
  },
  {
    id: 'halftime',
    matchId: null, // each performer is its own pool: HT_SHAKIRA, HT_COLDPLAY, etc.
    title: 'Halftime Show',
    description: 'Who will perform at the World Cup halftime show?',
    emoji: '🎤',
    image: '/halftime-show.webp',
    options: HALFTIME_PERFORMERS.map(name => ({
      value: name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      label: name,
    })),
    optionType: 'performer',
    multiPick: true,
    disclaimer: 'Only counts if they are one of the MAIN performers — guest appearances, introductions, and side cameos do NOT count.',
    formatPick: (pick) => {
      const opt = HALFTIME_PERFORMERS.find(p => p.toLowerCase().replace(/[^a-z0-9]/g, '_') === pick);
      return opt || pick;
    },
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

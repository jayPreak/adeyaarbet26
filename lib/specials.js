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

export const GOLDEN_BOOT_CANDIDATES = [
  { name: 'Kylian Mbappe', country: 'FRA' },
  { name: 'Harry Kane', country: 'ENG' },
  { name: 'Mikel Oyarzabal', country: 'ESP' },
  { name: 'Erling Haaland', country: 'NOR' },
  { name: 'Michael Olise', country: 'FRA' },
  { name: 'Lionel Messi', country: 'ARG' },
  { name: 'Julian Alvarez', country: 'ARG' },
  { name: 'Cristiano Ronaldo', country: 'POR' },
  { name: 'Lamine Yamal', country: 'ESP' },
  { name: 'Ferran Torres', country: 'ESP' },
  { name: 'Raphinha', country: 'BRA' },
  { name: 'Vinicius Junior', country: 'BRA' },
  { name: 'Ousmane Dembele', country: 'FRA' },
  { name: 'Igor Thiago', country: 'BEL' },
  { name: 'Cody Gakpo', country: 'NED' },
  { name: 'Luis Diaz', country: 'COL' },
  { name: 'Lautaro Martinez', country: 'ARG' },
  { name: 'Bruno Fernandes', country: 'POR' },
  { name: 'Deniz Undav', country: 'GER' },
  { name: 'Luis Suarez', country: 'URU' },
  { name: 'Desire Doue', country: 'FRA' },
  { name: 'Memphis Depay', country: 'NED' },
  { name: 'Viktor Gyokeres', country: 'SWE' },
  { name: 'Dani Olmo', country: 'ESP' },
  { name: 'Mohamed Salah', country: 'EGY' },
  { name: 'Bukayo Saka', country: 'ENG' },
  { name: 'Jude Bellingham', country: 'ENG' },
  { name: 'Sadio Mane', country: 'SEN' },
  { name: 'Rafael Leao', country: 'POR' },
  { name: 'Pedri', country: 'ESP' },
  { name: 'Scott McTominay', country: 'SCO' },
  { name: 'Amad Diallo', country: 'CIV' },
  { name: 'Heung-Min Son', country: 'KOR' },
  { name: 'Edin Dzeko', country: 'BIH' },
  { name: 'Ivan Perisic', country: 'CRO' },
  { name: 'Andrej Kramaric', country: 'CRO' },
  { name: 'Antoine Semenyo', country: 'GHA' },
  { name: 'Noah Okafor', country: 'SUI' },
  { name: 'Rodrygo', country: 'BRA' },
  { name: 'Marcus Thuram', country: 'FRA' },
  { name: 'Federico Valverde', country: 'URU' },
  { name: 'Serge Gnabry', country: 'GER' },
  { name: 'Bradley Barcola', country: 'FRA' },
  { name: 'Dion Beljo', country: 'CRO' },
];

function playerSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

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
    deadlineTs: '2026-06-19T23:59:00Z',
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
    deadlineTs: '2026-06-19T23:59:00Z',
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
    id: 'golden_boot',
    matchId: 'GOLDEN_BOOT',
    title: 'Golden Boot Winner',
    description: 'Who wins the Golden Boot (most goals) at the 2026 World Cup?',
    emoji: '👟',
    options: GOLDEN_BOOT_CANDIDATES.map(p => ({ value: playerSlug(p.name), label: p.name, country: p.country })),
    optionType: 'player',
    multiPick: true,
    deadlineTs: '2026-06-19T23:59:00Z',
    resolvesTs: '2026-07-19T19:00:00Z',
    formatPick: (pick) => {
      const candidate = GOLDEN_BOOT_CANDIDATES.find(p => playerSlug(p.name) === pick);
      return candidate ? candidate.name : pick;
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

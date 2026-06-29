// AdeYaar 2026 — Real Data Layer
// FIFA World Cup 2026: 48 teams, 12 groups, hosted USA/CAN/MEX

export const FRIENDS = [
  { id: 'ashin',     name: 'Ashin',     balance: 5000 },
  { id: 'pratyush',  name: 'Pratyush',  balance: 5000 },
  { id: 'manan',     name: 'Manan',     balance: 5000 },
  { id: 'boidushya', name: 'Boidushya', balance: 5000 },
  { id: 'jayesh',    name: 'Jayesh',    balance: 5000 },
  { id: 'rahul',     name: 'Rahul',     balance: 5000 },
  { id: 'rohan',     name: 'Rohan',     balance: 5000 },
  { id: 'aryan',     name: 'Aryan',     balance: 5000 },
];

export const ME_ID = 'rahul';

export const TEAM = {
  // Group A
  MEX: { code: 'MEX', name: 'Mexico',             flag: '🇲🇽', group: 'A' },
  RSA: { code: 'RSA', name: 'South Africa',        flag: '🇿🇦', group: 'A' },
  KOR: { code: 'KOR', name: 'South Korea',         flag: '🇰🇷', group: 'A' },
  CZE: { code: 'CZE', name: 'Czech Republic',      flag: '🇨🇿', group: 'A' },
  // Group B
  CAN: { code: 'CAN', name: 'Canada',              flag: '🇨🇦', group: 'B' },
  BIH: { code: 'BIH', name: 'Bosnia-Herzegovina', flag: '🇧🇦', group: 'B' },
  QAT: { code: 'QAT', name: 'Qatar',               flag: '🇶🇦', group: 'B' },
  SUI: { code: 'SUI', name: 'Switzerland',         flag: '🇨🇭', group: 'B' },
  // Group C
  BRA: { code: 'BRA', name: 'Brazil',              flag: '🇧🇷', group: 'C' },
  MAR: { code: 'MAR', name: 'Morocco',             flag: '🇲🇦', group: 'C' },
  HAI: { code: 'HAI', name: 'Haiti',               flag: '🇭🇹', group: 'C' },
  SCO: { code: 'SCO', name: 'Scotland',            flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', group: 'C' },
  // Group D
  USA: { code: 'USA', name: 'USA',                 flag: '🇺🇸', group: 'D' },
  PAR: { code: 'PAR', name: 'Paraguay',            flag: '🇵🇾', group: 'D' },
  AUS: { code: 'AUS', name: 'Australia',           flag: '🇦🇺', group: 'D' },
  TUR: { code: 'TUR', name: 'Turkey',              flag: '🇹🇷', group: 'D' },
  // Group E
  GER: { code: 'GER', name: 'Germany',             flag: '🇩🇪', group: 'E' },
  CUW: { code: 'CUW', name: 'Curaçao',            flag: '🇨🇼', group: 'E' },
  CIV: { code: 'CIV', name: 'Ivory Coast',         flag: '🇨🇮', group: 'E' },
  ECU: { code: 'ECU', name: 'Ecuador',             flag: '🇪🇨', group: 'E' },
  // Group F
  NED: { code: 'NED', name: 'Netherlands',         flag: '🇳🇱', group: 'F' },
  JPN: { code: 'JPN', name: 'Japan',               flag: '🇯🇵', group: 'F' },
  SWE: { code: 'SWE', name: 'Sweden',              flag: '🇸🇪', group: 'F' },
  TUN: { code: 'TUN', name: 'Tunisia',             flag: '🇹🇳', group: 'F' },
  // Group G: Belgium, Egypt, Iran, New Zealand
  BEL: { code: 'BEL', name: 'Belgium',             flag: '🇧🇪', group: 'G' },
  EGY: { code: 'EGY', name: 'Egypt',               flag: '🇪🇬', group: 'G' },
  IRN: { code: 'IRN', name: 'Iran',                flag: '🇮🇷', group: 'G' },
  NZL: { code: 'NZL', name: 'New Zealand',         flag: '🇳🇿', group: 'G' },
  // Group H: Spain, Cape Verde, Saudi Arabia, Uruguay
  ESP: { code: 'ESP', name: 'Spain',               flag: '🇪🇸', group: 'H' },
  CPV: { code: 'CPV', name: 'Cape Verde',          flag: '🇨🇻', group: 'H' },
  SAU: { code: 'SAU', name: 'Saudi Arabia',        flag: '🇸🇦', group: 'H' },
  URU: { code: 'URU', name: 'Uruguay',             flag: '🇺🇾', group: 'H' },
  // Group I
  FRA: { code: 'FRA', name: 'France',              flag: '🇫🇷', group: 'I' },
  SEN: { code: 'SEN', name: 'Senegal',             flag: '🇸🇳', group: 'I' },
  IRQ: { code: 'IRQ', name: 'Iraq',                flag: '🇮🇶', group: 'I' },
  NOR: { code: 'NOR', name: 'Norway',              flag: '🇳🇴', group: 'I' },
  // Group J
  ARG: { code: 'ARG', name: 'Argentina',           flag: '🇦🇷', group: 'J' },
  ALG: { code: 'ALG', name: 'Algeria',             flag: '🇩🇿', group: 'J' },
  AUT: { code: 'AUT', name: 'Austria',             flag: '🇦🇹', group: 'J' },
  JOR: { code: 'JOR', name: 'Jordan',              flag: '🇯🇴', group: 'J' },
  // Group K
  POR: { code: 'POR', name: 'Portugal',            flag: '🇵🇹', group: 'K' },
  COD: { code: 'COD', name: 'DR Congo',            flag: '🇨🇩', group: 'K' },
  UZB: { code: 'UZB', name: 'Uzbekistan',          flag: '🇺🇿', group: 'K' },
  COL: { code: 'COL', name: 'Colombia',            flag: '🇨🇴', group: 'K' },
  // Group L
  ENG: { code: 'ENG', name: 'England',             flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', group: 'L' },
  CRO: { code: 'CRO', name: 'Croatia',             flag: '🇭🇷', group: 'L' },
  GHA: { code: 'GHA', name: 'Ghana',               flag: '🇬🇭', group: 'L' },
  PAN: { code: 'PAN', name: 'Panama',              flag: '🇵🇦', group: 'L' },
};

export const VENUE = {
  MET:   'MetLife Stadium, New Jersey',
  SOFI:  'SoFi Stadium, Los Angeles',
  AZT:   'Estadio Azteca, Mexico City',
  MB:    'Mercedes-Benz Stadium, Atlanta',
  ATT:   'AT&T Stadium, Dallas',
  BMO:   'BMO Field, Toronto',
  GIL:   'Gillette Stadium, Boston',
  LIN:   'Lincoln Financial Field, Philadelphia',
  LUM:   'Lumen Field, Seattle',
  ARR:   'Arrowhead Stadium, Kansas City',
  HARD:  'Hard Rock Stadium, Miami',
  LEV:   "Levi's Stadium, San Francisco",
  BCP:   'BC Place, Vancouver',
  AKRON: 'Estadio Akron, Guadalajara',
  BBVA:  'Estadio BBVA, Monterrey',
  NRG:   'NRG Stadium, Houston',
};

// All times UTC. status/score come from FIFA API; static data is schedule only.
export const MATCHES = [
  // ── GROUP A ─────────────────────────────────────────────────────────────
  { id: 'A1', group:'A', md:1, venue: VENUE.AZT,   home:'MEX', away:'RSA' },
  { id: 'A2', group:'A', md:1, venue: VENUE.AKRON, home:'KOR', away:'CZE' },
  { id: 'A3', group:'A', md:2, venue: VENUE.MB,    home:'CZE', away:'RSA' },
  { id: 'A4', group:'A', md:2, venue: VENUE.AKRON, home:'MEX', away:'KOR' },
  { id: 'A5', group:'A', md:3, venue: VENUE.AZT,   home:'CZE', away:'MEX' },
  { id: 'A6', group:'A', md:3, venue: VENUE.BBVA,  home:'RSA', away:'KOR' },

  // ── GROUP B ─────────────────────────────────────────────────────────────
  { id: 'B1', group:'B', md:1, venue: VENUE.BMO,  home:'CAN', away:'BIH' },
  { id: 'B2', group:'B', md:1, venue: VENUE.LEV,  home:'QAT', away:'SUI' },
  { id: 'B3', group:'B', md:2, venue: VENUE.SOFI, home:'SUI', away:'BIH' },
  { id: 'B4', group:'B', md:2, venue: VENUE.BCP,  home:'CAN', away:'QAT' },
  { id: 'B5', group:'B', md:3, venue: VENUE.BCP,  home:'SUI', away:'CAN' },
  { id: 'B6', group:'B', md:3, venue: VENUE.LUM,  home:'BIH', away:'QAT' },

  // ── GROUP C ─────────────────────────────────────────────────────────────
  { id: 'C1', group:'C', md:1, venue: VENUE.GIL,  home:'HAI', away:'SCO' },
  { id: 'C2', group:'C', md:1, venue: VENUE.MET,  home:'BRA', away:'MAR' },
  { id: 'C3', group:'C', md:2, venue: VENUE.LIN,  home:'BRA', away:'HAI' },
  { id: 'C4', group:'C', md:2, venue: VENUE.GIL,  home:'SCO', away:'MAR' },
  { id: 'C5', group:'C', md:3, venue: VENUE.HARD, home:'SCO', away:'BRA' },
  { id: 'C6', group:'C', md:3, venue: VENUE.MB,   home:'MAR', away:'HAI' },

  // ── GROUP D ─────────────────────────────────────────────────────────────
  { id: 'D1', group:'D', md:1, venue: VENUE.SOFI, home:'USA', away:'PAR' },
  { id: 'D2', group:'D', md:1, venue: VENUE.BCP,  home:'AUS', away:'TUR' },
  { id: 'D3', group:'D', md:2, venue: VENUE.LUM,  home:'USA', away:'AUS' },
  { id: 'D4', group:'D', md:2, venue: VENUE.LEV,  home:'TUR', away:'PAR' },
  { id: 'D5', group:'D', md:3, venue: VENUE.SOFI, home:'TUR', away:'USA' },
  { id: 'D6', group:'D', md:3, venue: VENUE.LEV,  home:'PAR', away:'AUS' },

  // ── GROUP E ─────────────────────────────────────────────────────────────
  { id: 'E1', group:'E', md:1, venue: VENUE.NRG,  home:'GER', away:'CUW' },
  { id: 'E2', group:'E', md:1, venue: VENUE.LIN,  home:'CIV', away:'ECU' },
  { id: 'E3', group:'E', md:2, venue: VENUE.BMO,  home:'GER', away:'CIV' },
  { id: 'E4', group:'E', md:2, venue: VENUE.ARR,  home:'ECU', away:'CUW' },
  { id: 'E5', group:'E', md:3, venue: VENUE.LIN,  home:'CUW', away:'CIV' },
  { id: 'E6', group:'E', md:3, venue: VENUE.MET,  home:'ECU', away:'GER' },

  // ── GROUP F ─────────────────────────────────────────────────────────────
  { id: 'F1', group:'F', md:1, venue: VENUE.BBVA, home:'SWE', away:'TUN' },
  { id: 'F2', group:'F', md:1, venue: VENUE.ATT,  home:'NED', away:'JPN' },
  { id: 'F3', group:'F', md:2, venue: VENUE.NRG,  home:'NED', away:'SWE' },
  { id: 'F4', group:'F', md:2, venue: VENUE.BBVA, home:'TUN', away:'JPN' },
  { id: 'F5', group:'F', md:3, venue: VENUE.ATT,  home:'JPN', away:'SWE' },
  { id: 'F6', group:'F', md:3, venue: VENUE.ARR,  home:'TUN', away:'NED' },

  // ── GROUP G ─────────────────────────────────────────────────────────────
  { id: 'G1', group:'G', md:1, venue: VENUE.LUM,  home:'BEL', away:'EGY' },
  { id: 'G2', group:'G', md:1, venue: VENUE.SOFI, home:'IRN', away:'NZL' },
  { id: 'G3', group:'G', md:2, venue: VENUE.SOFI, home:'BEL', away:'IRN' },
  { id: 'G4', group:'G', md:2, venue: VENUE.BCP,  home:'NZL', away:'EGY' },
  { id: 'G5', group:'G', md:3, venue: VENUE.LUM,  home:'EGY', away:'IRN' },
  { id: 'G6', group:'G', md:3, venue: VENUE.BCP,  home:'NZL', away:'BEL' },

  // ── GROUP H ─────────────────────────────────────────────────────────────
  { id: 'H1', group:'H', md:1, venue: VENUE.MB,   home:'ESP', away:'CPV' },
  { id: 'H2', group:'H', md:1, venue: VENUE.HARD, home:'SAU', away:'URU' },
  { id: 'H3', group:'H', md:2, venue: VENUE.MB,   home:'ESP', away:'SAU' },
  { id: 'H4', group:'H', md:2, venue: VENUE.HARD, home:'URU', away:'CPV' },
  { id: 'H5', group:'H', md:3, venue: VENUE.NRG,  home:'CPV', away:'SAU' },
  { id: 'H6', group:'H', md:3, venue: VENUE.AKRON,home:'URU', away:'ESP' },

  // ── GROUP I ─────────────────────────────────────────────────────────────
  { id: 'I1', group:'I', md:1, venue: VENUE.MET,  home:'FRA', away:'SEN' },
  { id: 'I2', group:'I', md:1, venue: VENUE.GIL,  home:'IRQ', away:'NOR' },
  { id: 'I3', group:'I', md:2, venue: VENUE.LIN,  home:'FRA', away:'IRQ' },
  { id: 'I4', group:'I', md:2, venue: VENUE.MET,  home:'NOR', away:'SEN' },
  { id: 'I5', group:'I', md:3, venue: VENUE.GIL,  home:'NOR', away:'FRA' },
  { id: 'I6', group:'I', md:3, venue: VENUE.BMO,  home:'SEN', away:'IRQ' },

  // ── GROUP J ─────────────────────────────────────────────────────────────
  { id: 'J1', group:'J', md:1, venue: VENUE.ARR,  home:'ARG', away:'ALG' },
  { id: 'J2', group:'J', md:1, venue: VENUE.LEV,  home:'AUT', away:'JOR' },
  { id: 'J3', group:'J', md:2, venue: VENUE.ATT,  home:'ARG', away:'AUT' },
  { id: 'J4', group:'J', md:2, venue: VENUE.LEV,  home:'JOR', away:'ALG' },
  { id: 'J5', group:'J', md:3, venue: VENUE.ARR,  home:'ALG', away:'AUT' },
  { id: 'J6', group:'J', md:3, venue: VENUE.ATT,  home:'JOR', away:'ARG' },

  // ── GROUP K ─────────────────────────────────────────────────────────────
  { id: 'K1', group:'K', md:1, venue: VENUE.AZT,  home:'UZB', away:'COL' },
  { id: 'K2', group:'K', md:1, venue: VENUE.NRG,  home:'POR', away:'COD' },
  { id: 'K3', group:'K', md:2, venue: VENUE.AKRON,home:'COL', away:'COD' },
  { id: 'K4', group:'K', md:2, venue: VENUE.NRG,  home:'POR', away:'UZB' },
  { id: 'K5', group:'K', md:3, venue: VENUE.HARD, home:'COL', away:'POR' },
  { id: 'K6', group:'K', md:3, venue: VENUE.MB,   home:'COD', away:'UZB' },

  // ── GROUP L ─────────────────────────────────────────────────────────────
  { id: 'L1', group:'L', md:1, venue: VENUE.ATT,  home:'ENG', away:'CRO' },
  { id: 'L2', group:'L', md:1, venue: VENUE.BMO,  home:'GHA', away:'PAN' },
  { id: 'L3', group:'L', md:2, venue: VENUE.GIL,  home:'ENG', away:'GHA' },
  { id: 'L4', group:'L', md:2, venue: VENUE.BMO,  home:'PAN', away:'CRO' },
  { id: 'L5', group:'L', md:3, venue: VENUE.MET,  home:'PAN', away:'ENG' },
  { id: 'L6', group:'L', md:3, venue: VENUE.LIN,  home:'CRO', away:'GHA' },
];

export const BRACKET = {
  R32: Array.from({ length: 16 }, (_, i) => ({ id: `R32-${i+1}`, home: 'TBD', away: 'TBD' })),
  R16: Array.from({ length: 8 },  (_, i) => ({ id: `R16-${i+1}`, home: 'TBD', away: 'TBD' })),
  QF:  Array.from({ length: 4 },  (_, i) => ({ id: `QF-${i+1}`,  home: 'TBD', away: 'TBD' })),
  SF:  Array.from({ length: 2 },  (_, i) => ({ id: `SF-${i+1}`,  home: 'TBD', away: 'TBD' })),
  F:   [{ id: 'FIN-1', home: 'TBD', away: 'TBD' }],
};

export const GROUPS = [
  { id:'A', teams:[
    { code:'MEX', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'CZE', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'KOR', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'RSA', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
  ]},
  { id:'B', teams:[
    { code:'CAN', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'SUI', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'BIH', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'QAT', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
  ]},
  { id:'C', teams:[
    { code:'BRA', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'SCO', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'MAR', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'HAI', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
  ]},
  { id:'D', teams:[
    { code:'USA', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'TUR', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'PAR', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'AUS', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
  ]},
  { id:'E', teams:[
    { code:'GER', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'ECU', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'CIV', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'CUW', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
  ]},
  { id:'F', teams:[
    { code:'NED', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'SWE', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'TUN', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'JPN', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
  ]},
  { id:'G', teams:[
    { code:'BEL', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'EGY', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'IRN', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'NZL', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
  ]},
  { id:'H', teams:[
    { code:'ESP', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'CPV', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'SAU', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'URU', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
  ]},
  { id:'I', teams:[
    { code:'FRA', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'NOR', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'SEN', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'IRQ', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
  ]},
  { id:'J', teams:[
    { code:'ARG', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'AUT', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'ALG', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'JOR', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
  ]},
  { id:'K', teams:[
    { code:'POR', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'COL', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'COD', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'UZB', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
  ]},
  { id:'L', teams:[
    { code:'ENG', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'CRO', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'GHA', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
    { code:'PAN', p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 },
  ]},
];

// BETS and ACTIVITY are now managed by lib/bet-store.js and lib/mock-activity.js

// ── Helpers ──────────────────────────────────────────────────────
export function getTeam(code) {
  return TEAM[code] || { code, name: code, flag: '🏳️' };
}
export function getFriend(id) {
  return FRIENDS.find(f => f.id === id);
}
export function getMatch(id) {
  return MATCHES.find(m => m.id === id);
}
// Kickoff time comes from the DB (match_schedule via /api/schedule), merged onto
// the match object as `kickoffTs`. The value may be an ISO timestamp string
// (as returned by Supabase timestamptz) or epoch milliseconds — normalize to ms.
export function getMatchKickoffTs(idOrMatch) {
  const m = typeof idOrMatch === 'string' ? getMatch(idOrMatch) : idOrMatch;
  if (!m || m.kickoffTs == null) return null;
  const ts = typeof m.kickoffTs === 'number' ? m.kickoffTs : new Date(m.kickoffTs).getTime();
  return Number.isFinite(ts) ? ts : null;
}
export const MATCH_BET_CUTOFF_MS = 30 * 1000;
export function isMatchBettingOpen(match, now = Date.now()) {
  const ts = getMatchKickoffTs(match);
  if (ts == null) return false; // schedule not loaded yet — fail safe (closed)
  return now < ts - MATCH_BET_CUTOFF_MS;
}
export function fmtMoney(n) {
  if (n == null) return '—';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}
// Note: prefer importing fmtMoney from @/lib/currency for new code
export function fmtCompact(n) {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return String(n);
}
export function fmtDay(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}
export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
export function fmtTimeIST(utcTime) {
  if (!utcTime) return '—';
  const [h, m] = utcTime.split(':').map(Number);
  const totalMin = h * 60 + m + 330; // UTC+5:30
  const istH = Math.floor(totalMin / 60) % 24;
  const istM = totalMin % 60;
  const period = istH >= 12 ? 'PM' : 'AM';
  const h12 = istH % 12 || 12;
  return `${h12}:${String(istM).padStart(2, '0')} ${period} IST`;
}

export function fmtKickoffIST(isoTs) {
  if (!isoTs) return '—';
  const d = new Date(isoTs);
  const ist = new Date(d.getTime() + 330 * 60000);
  const h = ist.getUTCHours();
  const m = ist.getUTCMinutes();
  const day = ist.getUTCDate();
  const mon = ist.toLocaleString('en', { month: 'short', timeZone: 'UTC' });
  return `${day} ${mon}, ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const KO_STAGE_LABELS = { R32: 'R32', R16: 'R16', QF: 'QF', SF: 'SF', FIN: 'Final', '3RD': '3rd Place' };
export function fmtKnockoutStage(matchId) {
  if (!matchId) return null;
  const m = matchId.match(/^(R32|R16|QF|SF|FIN|3RD)-/);
  if (!m) return null;
  return KO_STAGE_LABELS[m[1]] || m[1];
}

export function fmtCountdown(isoTs) {
  if (!isoTs) return '—';
  const diff = new Date(isoTs).getTime() - Date.now();
  if (diff <= 0) return 'Now';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 48) return `${Math.floor(h / 24)}d`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

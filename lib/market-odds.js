// Real-world MARKET odds (what the betting world thinks) — distinct from our
// parimutuel pool odds in lib/odds.js.
//
// Source: The Odds API (https://the-odds-api.com), `soccer_fifa_world_cup`,
// `markets=h2h`, `oddsFormat=decimal`. It returns events keyed by full team
// NAMES (e.g. "Germany"), with bookmaker decimal odds per outcome. We map those
// names back to our static match IDs (A1..L6) so the UI can look them up the
// same way it looks up pool odds.
//
// These odds move with the real market — squad announcements, injuries, etc. —
// which is the whole point. They do NOT affect payouts (settlement still uses
// the pool). They are context only.

import { MATCHES, TEAM } from '@/lib/data';

// Full team name (lowercased) → our team code. Built from TEAM. A few common
// aliases The Odds API uses that differ from our names.
const NAME_ALIASES = {
  'usa': 'USA',
  'united states': 'USA',
  'south korea': 'KOR',
  'korea republic': 'KOR',
  'iran': 'IRN',
  'ir iran': 'IRN',
  'czechia': 'CZE',
  'czech republic': 'CZE',
};

function buildNameToCode() {
  const map = { ...NAME_ALIASES };
  for (const code of Object.keys(TEAM)) {
    map[TEAM[code].name.toLowerCase()] = code;
  }
  return map;
}

export function nameToCode(name) {
  if (!name) return null;
  return buildNameToCode()[String(name).trim().toLowerCase()] || null;
}

// Resolve a pair of team codes to a static match id, regardless of home/away
// orientation in the feed. Returns { id, flipped } where flipped=true means the
// feed's home is our away (so home/away odds must be swapped).
export function resolveMatchId(codeA, codeB) {
  if (!codeA || !codeB) return null;
  for (const m of MATCHES) {
    if (m.home === codeA && m.away === codeB) return { id: m.id, flipped: false };
    if (m.home === codeB && m.away === codeA) return { id: m.id, flipped: true };
  }
  return null;
}

// Pull median decimal odds for home/away/draw out of one Odds-API event.
// Averages across bookmakers for a stable number. Returns {home, away, draw}.
export function extractDecimalOdds(event) {
  const home = event.home_team;
  const away = event.away_team;
  const acc = { home: [], away: [], draw: [] };
  for (const bk of event.bookmakers || []) {
    const h2h = (bk.markets || []).find(mk => mk.key === 'h2h');
    if (!h2h) continue;
    for (const oc of h2h.outcomes || []) {
      if (oc.name === home) acc.home.push(oc.price);
      else if (oc.name === away) acc.away.push(oc.price);
      else if (oc.name === 'Draw') acc.draw.push(oc.price);
    }
  }
  const avg = arr => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null);
  return { home: avg(acc.home), away: avg(acc.away), draw: avg(acc.draw) };
}

// Decimal market odds → normalized win probabilities (vig removed).
// Returns {home, away, draw} summing to ~1, nulls where odds missing.
export function impliedProbsFromDecimal({ home, away, draw }) {
  const raw = {
    home: home ? 1 / home : 0,
    away: away ? 1 / away : 0,
    draw: draw ? 1 / draw : 0,
  };
  const overround = raw.home + raw.away + raw.draw;
  if (overround <= 0) return { home: null, away: null, draw: null };
  return {
    home: home ? raw.home / overround : null,
    away: away ? raw.away / overround : null,
    draw: draw ? raw.draw / overround : null,
  };
}

// Turn a full Odds-API response array into { [matchId]: {home,away,draw, probs, updatedAt} }
// keyed by our static match IDs.
export function buildMarketOddsMap(events) {
  const out = {};
  for (const ev of events || []) {
    const codeH = nameToCode(ev.home_team);
    const codeA = nameToCode(ev.away_team);
    const match = resolveMatchId(codeH, codeA);
    if (!match) continue;
    let odds = extractDecimalOdds(ev);
    if (match.flipped) odds = { home: odds.away, away: odds.home, draw: odds.draw };
    out[match.id] = {
      ...odds,
      probs: impliedProbsFromDecimal(odds),
      commenceTime: ev.commence_time || null,
    };
  }
  return out;
}

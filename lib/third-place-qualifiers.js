import { GROUPS } from '@/lib/data';
import { TEAM_CODE_ALIAS } from '@/lib/schedule-sync';

function groupLetter(fifaMatch) {
  const g = fifaMatch.GroupName?.[0]?.Description;
  return g ? g.replace('Group ', '').trim() : null;
}

function teamCode(team) {
  const c = team?.Abbreviation;
  return (c && TEAM_CODE_ALIAS[c]) || c;
}

/**
 * Given an array of FIFA match results, returns the 8 third-place team codes
 * that qualify for the Round of 32, or null if not all 12 groups have finished
 * all 3 matches per team (i.e. group stage isn't complete yet).
 */
export function computeThirdPlaceQualifiers(fifaResults) {
  const groupStats = {};

  for (const fm of fifaResults) {
    if (fm.MatchStatus !== 0) continue;
    const g = groupLetter(fm);
    if (!g) continue;
    const hc = teamCode(fm.Home);
    const ac = teamCode(fm.Away);
    if (!hc || !ac) continue;
    const hg = fm.HomeTeamScore;
    const ag = fm.AwayTeamScore;
    if (hg == null || ag == null) continue;

    if (!groupStats[g]) groupStats[g] = {};
    if (!groupStats[g][hc]) groupStats[g][hc] = { code: hc, pts: 0, gf: 0, ga: 0, gp: 0 };
    if (!groupStats[g][ac]) groupStats[g][ac] = { code: ac, pts: 0, gf: 0, ga: 0, gp: 0 };

    groupStats[g][hc].gf += hg; groupStats[g][hc].ga += ag; groupStats[g][hc].gp++;
    groupStats[g][ac].gf += ag; groupStats[g][ac].ga += hg; groupStats[g][ac].gp++;

    if (hg > ag)      { groupStats[g][hc].pts += 3; }
    else if (ag > hg) { groupStats[g][ac].pts += 3; }
    else              { groupStats[g][hc].pts += 1; groupStats[g][ac].pts += 1; }
  }

  // All 12 groups must have 4 teams each with 3 games played (full group stage done)
  const groupIds = GROUPS.map(g => g.id);
  for (const gid of groupIds) {
    const teams = groupStats[gid] ? Object.values(groupStats[gid]) : [];
    if (teams.length < 4 || teams.some(t => t.gp < 3)) return null;
  }

  const thirds = [];
  for (const gid of groupIds) {
    const sorted = Object.values(groupStats[gid]).sort((a, b) =>
      b.pts - a.pts ||
      (b.gf - b.ga) - (a.gf - a.ga) ||
      b.gf - a.gf ||
      a.code.localeCompare(b.code)
    );
    thirds.push({ ...sorted[2], group: gid });
  }

  thirds.sort((a, b) =>
    b.pts - a.pts ||
    (b.gf - b.ga) - (a.gf - a.ga) ||
    b.gf - a.gf ||
    a.group.localeCompare(b.group)
  );

  return thirds.slice(0, 8).map(t => t.code);
}

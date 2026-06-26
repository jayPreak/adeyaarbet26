import { GROUPS } from '@/lib/data';
import { TEAM_CODE_ALIAS } from '@/lib/schedule-sync';

function teamCode(team) {
  const c = team?.Abbreviation;
  return (c && TEAM_CODE_ALIAS[c]) || c;
}

function groupLetter(fifaMatch) {
  const g = fifaMatch.GroupName?.[0]?.Description;
  return g ? g.replace('Group ', '').trim() : null;
}

// Compute the top 8 third-place qualifiers from all finished FIFA match data.
//
// Returns an array of 8 team codes when:
//   1. J6 (Jordan vs Argentina, the last group game) is finished in fifaResults
//   2. All 12 groups have all 4 teams with exactly 3 games played
//
// Returns null if either condition isn't met, so auto-resolve can retry on
// subsequent page loads without permanently mis-settling.
//
// Note: tiebreaker is pts → GD → GF → group letter (alphabetical). The
// group-letter fallback is deterministic but may not match FIFA's official
// cross-group tiebreaker sequence (which can involve disciplinary points and
// drawing of lots). Verify against the official qualified set before relying
// on auto-settlement for edge cases at the 8th/9th boundary.
export function computeThirdPlaceQualifiers(fifaResults) {
  // Gate 1: J6 must be present and finished (order-independent)
  const j6Finished = fifaResults.some(
    fm =>
      fm.MatchStatus === 0 && (
        (teamCode(fm.Home) === 'JOR' && teamCode(fm.Away) === 'ARG') ||
        (teamCode(fm.Home) === 'ARG' && teamCode(fm.Away) === 'JOR')
      )
  );
  if (!j6Finished) return null;

  // Build per-group stats, tracking games played per team
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
    if (!groupStats[g][hc]) groupStats[g][hc] = { code: hc, pts: 0, gf: 0, ga: 0, p: 0 };
    if (!groupStats[g][ac]) groupStats[g][ac] = { code: ac, pts: 0, gf: 0, ga: 0, p: 0 };

    groupStats[g][hc].gf += hg; groupStats[g][hc].ga += ag; groupStats[g][hc].p++;
    groupStats[g][ac].gf += ag; groupStats[g][ac].ga += hg; groupStats[g][ac].p++;

    if (hg > ag)      { groupStats[g][hc].pts += 3; }
    else if (ag > hg) { groupStats[g][ac].pts += 3; }
    else              { groupStats[g][hc].pts += 1; groupStats[g][ac].pts += 1; }
  }

  // Gate 2: every group must have all 4 teams with 3 games each
  const groupIds = GROUPS.map(g => g.id);
  for (const gid of groupIds) {
    const teams = groupStats[gid] ? Object.values(groupStats[gid]) : [];
    if (teams.length < 4 || teams.some(t => t.p < 3)) return null;
  }

  // Extract 3rd-place from each group, sort the 12 thirds, return top 8 codes
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

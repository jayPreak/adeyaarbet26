'use client';

import { useState } from 'react';
import { GROUPS, BRACKET, MATCHES, getTeam } from '@/lib/data';

// ── Shared standings computation ─────────────────────────────

function computeGroupStandings(group, matches) {
  const stats = {};
  for (const t of group.teams) {
    stats[t.code] = { code: t.code, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  }
  for (const m of matches.filter(m => m.group === group.id && m.status === 'finished' && m.score)) {
    const [hg, ag] = m.score;
    const h = stats[m.home], a = stats[m.away];
    if (!h || !a) continue;
    h.p++; a.p++; h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg;
    if (hg > ag)      { h.w++; h.pts += 3; a.l++; }
    else if (hg < ag) { a.w++; a.pts += 3; h.l++; }
    else              { h.d++; a.d++; h.pts++; a.pts++; }
  }
  return Object.values(stats).sort((a, b) =>
    b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf
  );
}

// ── Knockout bracket ─────────────────────────────────────────

function BracketMatch({ home, away }) {
  const tbd = !home || home === 'TBD';
  if (tbd) {
    return (
      <div className="bracket-match" style={{ opacity: 0.5 }}>
        {['a','b'].map(k => (
          <div key={k} className="bracket-team">
            <div className="bracket-team__name">
              <span style={{ width: 16, color: 'var(--ink-3)' }}>—</span>
              <span style={{ color: 'var(--ink-3)' }}>TBD</span>
            </div>
            <span className="bracket-score" style={{ color: 'var(--ink-3)' }}>·</span>
          </div>
        ))}
      </div>
    );
  }
  const h = getTeam(home), a = getTeam(away);
  return (
    <div className="bracket-match">
      {[h, a].map(t => (
        <div key={t.code} className="bracket-team">
          <div className="bracket-team__name">
            <span style={{ fontSize: 13 }}>{t.flag}</span>
            <span>{t.name}</span>
          </div>
          <span className="bracket-score">—</span>
        </div>
      ))}
    </div>
  );
}

function KnockoutView() {
  return (
    <>
      <div style={{ padding: '4px 20px 8px', fontSize: 11, color: 'var(--ink-3)' }}>
        Scroll right to see later rounds →
      </div>
      <div className="bracket-scroll">
        <div className="bracket">
          <div className="bracket-round">
            <div className="bracket-round__title">Round of 32</div>
            {BRACKET.R32.slice(0, 8).map(m => (
              <BracketMatch key={m.id} home={m.home} away={m.away} />
            ))}
          </div>
          <div className="bracket-round">
            <div className="bracket-round__title">Round of 16</div>
            {[0,1,2,3].map(i => <BracketMatch key={i} />)}
          </div>
          <div className="bracket-round">
            <div className="bracket-round__title">Quarterfinals</div>
            {[0,1].map(i => <BracketMatch key={i} />)}
          </div>
          <div className="bracket-round">
            <div className="bracket-round__title">Semifinal</div>
            <BracketMatch />
          </div>
          <div className="bracket-round" style={{ justifyContent: 'center' }}>
            <div className="bracket-round__title" style={{ color: 'var(--gold)' }}>
              Final · Jul 19
            </div>
            <div className="bracket-match" style={{ borderColor: 'var(--gold)', background: 'var(--gold-soft)' }}>
              <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--gold)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em' }}>METLIFE · NJ</div>
                <div style={{ fontSize: 22, marginTop: 4 }}>🏆</div>
                <div style={{ fontSize: 10, marginTop: 4, color: 'rgba(255,200,80,0.7)' }}>TBD vs TBD</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Group standings ───────────────────────────────────────────

// 14px rank | 16px flag | 1fr name | 18×3 W/D/L | 22×2 GF/GA | 24px Pts
const COLS = '14px 16px 1fr 18px 18px 18px 22px 22px 24px';

function GroupCard({ group, matches }) {
  const standings = computeGroupStandings(group, matches);
  return (
    <div className="group-card" style={{ overflow: 'hidden' }}>
      <div className="group-card__title">Group <em>{group.id}</em></div>

      {/* Column header */}
      <div style={{
        display: 'grid', gridTemplateColumns: COLS, gap: 2,
        padding: '0 0 4px', fontSize: 8.5, color: 'var(--ink-3)',
        fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
        borderBottom: '1px solid var(--line)', marginBottom: 2,
      }}>
        <span>#</span><span /><span />
        <span style={{ textAlign: 'center' }}>W</span>
        <span style={{ textAlign: 'center' }}>D</span>
        <span style={{ textAlign: 'center' }}>L</span>
        <span style={{ textAlign: 'center' }}>GF</span>
        <span style={{ textAlign: 'center' }}>GA</span>
        <span style={{ textAlign: 'right', color: 'var(--gold)' }}>Pts</span>
      </div>

      {standings.map((t, i) => {
        const team = getTeam(t.code);
        const q = i < 2;
        return (
          <div
            key={t.code}
            style={{
              margin: '1px -12px',
              padding: q ? '4px 12px 4px 9px' : '4px 12px',
              borderLeft: q ? '3px solid var(--win)' : '3px solid transparent',
              background: q ? 'rgba(54,211,153,0.07)' : 'transparent',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 2, alignItems: 'center' }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9,
                color: q ? 'var(--win)' : 'var(--ink-3)',
              }}>
                {i + 1}
              </span>
              <span style={{ fontSize: 13, opacity: q ? 1 : 0.65 }}>{team.flag}</span>
              <span style={{
                fontWeight: q ? 700 : 500, fontSize: 10.5,
                overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                color: q ? 'var(--ink)' : 'var(--ink-3)',
              }}>
                {team.name}
              </span>
              {[t.w, t.d, t.l, t.gf, t.ga].map((v, j) => (
                <span key={j} style={{
                  fontFamily: 'var(--font-mono)', textAlign: 'center', fontSize: 10,
                  color: q ? 'var(--ink-2)' : 'var(--ink-3)',
                }}>
                  {v}
                </span>
              ))}
              <span style={{
                fontFamily: 'var(--font-mono)', fontWeight: 700,
                textAlign: 'right', fontSize: 11,
                color: q ? 'var(--gold)' : 'var(--ink-3)',
              }}>
                {t.pts}
              </span>
            </div>
          </div>
        );
      })}

      <div style={{
        fontSize: 9, color: 'var(--ink-3)', marginTop: 7, paddingTop: 5,
        borderTop: '1px solid var(--line)',
      }}>
        Top 2 advance · best 8 third-place teams also qualify
      </div>
    </div>
  );
}

function GroupsView({ matches }) {
  return (
    <div className="groups-grid">
      {GROUPS.map(g => <GroupCard key={g.id} group={g} matches={matches} />)}
    </div>
  );
}

// ── 3rd Place Race ────────────────────────────────────────────

function ThirdPlaceView({ matches }) {
  const thirds = GROUPS.map(g => {
    const standings = computeGroupStandings(g, matches);
    if (standings.length < 3) return null;
    return { ...standings[2], group: g.id };
  }).filter(Boolean);

  thirds.sort((a, b) =>
    b.pts - a.pts ||
    (b.gf - b.ga) - (a.gf - a.ga) ||
    b.gf - a.gf ||
    a.group.localeCompare(b.group)
  );

  const allZero = thirds.every(t => t.pts === 0 && t.gf === 0);

  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 14, lineHeight: 1.5 }}>
        Best 8 of 12 third-place teams advance to the Round of 32.{' '}
        {allZero ? 'Standings update as matches complete.' : 'Updated live.'}
      </div>

      {thirds.map((t, i) => {
        const team = getTeam(t.code);
        const q = i < 8;
        const gd = t.gf - t.ga;
        return (
          <div
            key={t.code}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10, marginBottom: 5,
              background: q ? 'rgba(54,211,153,0.06)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${q ? 'rgba(54,211,153,0.18)' : 'rgba(255,255,255,0.06)'}`,
            }}
          >
            {/* Rank circle */}
            <div style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: q ? 'rgba(54,211,153,0.15)' : 'rgba(255,255,255,0.06)',
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
              color: q ? 'var(--win)' : 'var(--ink-3)',
            }}>
              {i + 1}
            </div>

            {/* Flag */}
            <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0, opacity: q ? 1 : 0.6 }}>
              {team.flag}
            </span>

            {/* Name + stats */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: 700, fontSize: 13,
                color: q ? 'var(--ink)' : 'var(--ink-3)',
                overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
              }}>
                {team.name}
              </div>
              <div style={{
                fontSize: 10, color: 'var(--ink-3)',
                fontFamily: 'var(--font-mono)', marginTop: 1,
              }}>
                Grp {t.group} · {t.w}W {t.d}D {t.l}L · GD {gd > 0 ? '+' : ''}{gd} · GF {t.gf} GA {t.ga}
              </div>
            </div>

            {/* Pts */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 18, lineHeight: 1,
                color: q ? 'var(--gold)' : 'var(--ink-3)',
              }}>
                {t.pts}
              </div>
              <div style={{ fontSize: 9, color: 'var(--ink-3)' }}>pts</div>
            </div>

            {/* Q badge / spacer */}
            <div style={{ width: 22, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
              {q && (
                <span style={{
                  fontSize: 9, fontWeight: 800, padding: '2px 4px', borderRadius: 4,
                  background: 'rgba(54,211,153,0.2)', color: 'var(--win)',
                  letterSpacing: '0.05em',
                }}>
                  Q
                </span>
              )}
            </div>
          </div>
        );
      })}

      {thirds.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)', fontSize: 13 }}>
          No group matches completed yet
        </div>
      )}

      <div style={{
        fontSize: 9.5, color: 'var(--ink-3)', marginTop: 10,
        textAlign: 'center', lineHeight: 1.5,
      }}>
        Tiebreakers: Pts → GD → GF → alphabetical group
      </div>
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────

const TABS = [
  { id: 'groups',   label: 'Groups' },
  { id: 'thirds',   label: '3rd Place Race' },
  { id: 'knockout', label: 'Bracket' },
];

export default function BracketScreen({ matches = MATCHES, onBack }) {
  const [view, setView] = useState('groups');

  return (
    <div>
      {onBack ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 8px' }}>
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none', color: 'var(--ink-2)',
              fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1,
            }}
          >
            ←
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Tournament</span>
          <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 2 }}>48 teams · 12 groups</span>
        </div>
      ) : (
        <div className="section-head" style={{ marginTop: 8 }}>
          <div className="section-head__title display">Tournament</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>48 teams · 12 groups</div>
        </div>
      )}

      <div className="chip-row" style={{ marginBottom: 16 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={'chip ' + (view === t.id ? 'active' : '')}
            onClick={() => setView(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === 'groups'   && <GroupsView matches={matches} />}
      {view === 'thirds'   && <ThirdPlaceView matches={matches} />}
      {view === 'knockout' && <KnockoutView />}
    </div>
  );
}

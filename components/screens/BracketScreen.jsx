'use client';

import { useState } from 'react';
import { GROUPS, BRACKET, MATCHES, getTeam } from '@/lib/data';
import { Flag } from '@/components';

function BracketMatch({ home, away, tbd }) {
  if (tbd) {
    return (
      <div className="bracket-match" style={{ opacity: 0.5 }}>
        <div className="bracket-team">
          <div className="bracket-team__name">
            <span style={{ width: 16, color: 'var(--ink-3)' }}>—</span>
            <span style={{ color: 'var(--ink-3)' }}>TBD</span>
          </div>
          <span className="bracket-score" style={{ color: 'var(--ink-3)' }}>·</span>
        </div>
        <div className="bracket-team">
          <div className="bracket-team__name">
            <span style={{ width: 16, color: 'var(--ink-3)' }}>—</span>
            <span style={{ color: 'var(--ink-3)' }}>TBD</span>
          </div>
          <span className="bracket-score" style={{ color: 'var(--ink-3)' }}>·</span>
        </div>
      </div>
    );
  }
  const h = getTeam(home), a = getTeam(away);
  return (
    <div className="bracket-match">
      <div className="bracket-team">
        <div className="bracket-team__name">
          <span style={{ fontSize: 14 }}>{h.flag}</span>
          <span>{h.name}</span>
        </div>
        <span className="bracket-score">—</span>
      </div>
      <div className="bracket-team">
        <div className="bracket-team__name">
          <span style={{ fontSize: 14 }}>{a.flag}</span>
          <span>{a.name}</span>
        </div>
        <span className="bracket-score">—</span>
      </div>
    </div>
  );
}

function KnockoutView() {
  const r32 = BRACKET.R32.slice(0, 8);
  return (
    <>
      <div style={{ padding: '0 20px 8px', fontSize: 11, color: 'var(--ink-3)' }}>
        Swipe horizontally to see full bracket →
      </div>
      <div className="bracket-scroll">
        <div className="bracket">
          <div className="bracket-round">
            <div className="bracket-round__title">Round of 32</div>
            {r32.map(m => <BracketMatch key={m.id} home={m.home} away={m.away} />)}
          </div>
          <div className="bracket-round">
            <div className="bracket-round__title">Round of 16</div>
            {[0,1,2,3].map(i => <BracketMatch key={i} tbd />)}
          </div>
          <div className="bracket-round">
            <div className="bracket-round__title">Quarterfinals</div>
            {[0,1].map(i => <BracketMatch key={i} tbd />)}
          </div>
          <div className="bracket-round">
            <div className="bracket-round__title">Semifinal</div>
            <BracketMatch tbd />
          </div>
          <div className="bracket-round" style={{ justifyContent: 'center' }}>
            <div className="bracket-round__title" style={{ color: 'var(--gold)' }}>Final · Jul 19</div>
            <div className="bracket-match" style={{ borderColor: 'var(--gold)', background: 'var(--gold-soft)' }}>
              <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--gold)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em' }}>METLIFE</div>
                <div style={{ fontSize: 24, marginTop: 4 }}>🏆</div>
                <div style={{ fontSize: 10, marginTop: 4 }}>TBD vs TBD</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function computeGroupStandings(group, matches) {
  const stats = {};
  for (const t of group.teams) {
    stats[t.code] = { code: t.code, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  }
  const groupMatches = matches.filter(m => m.group === group.id && m.status === 'finished' && m.score);
  for (const m of groupMatches) {
    const [hg, ag] = m.score;
    const h = stats[m.home], a = stats[m.away];
    if (!h || !a) continue;
    h.p++; a.p++;
    h.gf += hg; h.ga += ag;
    a.gf += ag; a.ga += hg;
    if (hg > ag) { h.w++; h.pts += 3; a.l++; }
    else if (hg < ag) { a.w++; a.pts += 3; h.l++; }
    else { h.d++; a.d++; h.pts += 1; a.pts += 1; }
  }
  return Object.values(stats).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
}

export default function BracketScreen({ matches = MATCHES }) {
  const [view, setView] = useState('groups');

  return (
    <div>
      <div className="section-head" style={{ marginTop: 8 }}>
        <div className="section-head__title display">Tournament</div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>48 teams · 12 groups</div>
      </div>

      <div className="chip-row" style={{ marginBottom: 16 }}>
        {[
          { id: 'groups',   label: 'Group stage' },
          { id: 'knockout', label: 'Knockout' },
        ].map(t => (
          <button
            key={t.id}
            className={'chip ' + (view === t.id ? 'active' : '')}
            onClick={() => setView(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === 'groups' && (
        <div className="groups-grid">
          {GROUPS.map(g => {
            const standings = computeGroupStandings(g, matches);
            const groupMatches = matches.filter(m => m.group === g.id);
            const cities = [...new Set(groupMatches.map(m => m.venue?.split(',').pop()?.trim()).filter(Boolean))];
            return (
              <div key={g.id} className="group-card">
                <div className="group-card__title">Group <em>{g.id}</em></div>
                {standings.map((t, i) => {
                  const team = getTeam(t.code);
                  return (
                    <div key={t.code} className={'group-row ' + (i < 2 ? 'q' : '')}>
                      <span className="rk">{i + 1}</span>
                      <span style={{ fontSize: 14 }}>{team.flag}</span>
                      <span style={{ fontSize: 11, fontWeight: 600 }}>{team.code}</span>
                      <span className="pts">{t.pts}</span>
                    </div>
                  );
                })}
                <div style={{
                  fontSize: 9, color: 'var(--ink-3)', marginTop: 6, paddingTop: 6,
                  borderTop: '1px solid var(--line)', letterSpacing: '0.05em',
                }}>
                  Top 2 + best 3rds advance
                  {cities.length > 0 && (
                    <span style={{ marginLeft: 6, opacity: 0.7 }}>· {cities.join(' · ')}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'knockout' && <KnockoutView />}
    </div>
  );
}

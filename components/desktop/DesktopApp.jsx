'use client';

import { useState, useEffect } from 'react';
import {
  GROUPS, BRACKET, MATCHES,
  getTeam, getMatch,
  fmtCompact, fmtDay, fmtDate, fmtTimeIST,
} from '@/lib/data';
import { fmtMoney, fmtNet, CURRENCY_SYMBOL } from '@/lib/currency';

import { Flag, LiveDot } from '@/components';
import MiniCountdown from '@/components/MiniCountdown';
import CupWinnerCTA from '@/components/CupWinnerCTA';

function formatDeskActivity(a) {
  const isCupWinner = a.payload?.kind === 'cup_winner';
  const match = (!isCupWinner && a.payload?.match_id) ? getMatch(a.payload.match_id) : null;
  const matchLabel = isCupWinner
    ? 'to win the Cup'
    : match
      ? `${getTeam(match.home).name} vs ${getTeam(match.away).name}`
      : '';
  if (a.type === 'bet_placed' && a.payload) {
    const pickTeam = isCupWinner
      ? getTeam(a.payload.team).name
      : match
        ? (a.payload.pick === 'home' ? getTeam(match.home).name : a.payload.pick === 'away' ? getTeam(match.away).name : 'Draw')
        : a.payload.pick;
    return `bet ${CURRENCY_SYMBOL}${a.payload.amount} on ${pickTeam} · ${matchLabel}`;
  }
  if (a.type === 'bet_cancelled' && a.payload) {
    return `cancelled · refund ${CURRENCY_SYMBOL}${a.payload.refunded} · ${matchLabel}`;
  }
  if (a.type === 'bet_won' && a.payload) {
    return `won ${CURRENCY_SYMBOL}${a.payload.payout} · ${matchLabel}`;
  }
  return a.type;
}

// ── Desktop icons ─────────────────────────────────────────────
const DIcon = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-7 9 7v9a2 2 0 01-2 2h-4v-7H9v7H5a2 2 0 01-2-2z"/></svg>,
  ball: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/></svg>,
  bracket: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h5l3 3M3 18h5l3-3M21 12h-4l-3-3M14 15l3-3"/></svg>,
  trophy: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4h10v6a5 5 0 01-10 0V4z"/><path d="M7 7H4v3a3 3 0 003 3M17 7h3v3a3 3 0 01-3 3"/><path d="M9 21h6M12 18v3"/></svg>,
  receipt: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>,
  bell: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M14 21a2 2 0 01-4 0"/></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 005 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 005 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 5h.09A1.65 1.65 0 0010.5 4V3a2 2 0 114 0v.09A1.65 1.65 0 0016 4.5a1.65 1.65 0 001.82.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0020 9h.09a2 2 0 110 4H20a1.65 1.65 0 00-1.51 1z"/></svg>,
};

// ── Desktop Shell ─────────────────────────────────────────────
function DesktopShell({ tab, onNav, balance, children, title, sub, hideSearch, user, onLogout }) {
  const me = user;
  const [showMenu, setShowMenu] = useState(false);

  const navItems = [
    { id: 'home',    label: 'Dashboard', icon: DIcon.home },
    { id: 'matches', label: 'Fixtures',  icon: DIcon.ball,    badge: '12' },
    { id: 'leaders', label: 'Leaderboard', icon: DIcon.trophy },
    { id: 'bets',    label: 'My Bets',   icon: DIcon.receipt },
  ];

  return (
    <div className="desk" data-theme="midnight">
      <aside className="desk-sidebar">
        <div className="desk-brand">
          <div className="desk-brand__mark">A</div>
          <div>
            <div className="desk-brand__name">AdeYaar <em>26</em></div>
            <div className="desk-brand__sub">Group · Friends</div>
          </div>
        </div>

        <nav className="desk-nav">
          <div className="desk-nav__sect">Tournament</div>
          {navItems.map(n => (
            <button
              key={n.id}
              className={'desk-nav__btn ' + (tab === n.id ? 'active' : '')}
              onClick={() => onNav(n.id)}
            >
              {n.icon}
              <span>{n.label}</span>
              {n.badge && <span className="badge">{n.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="desk-balance">
          <div className="desk-balance__label">My position · World Cup</div>
          <div className="desk-balance__amt" style={{ color: balance >= 0 ? 'var(--win)' : 'var(--loss)' }}>
            {fmtNet(balance)}
          </div>
        </div>

        <div className="desk-user" style={{ position: 'relative' }}>
          <div className="desk-user__avatar">{me?.display_name?.[0] || me?.username?.[0] || '?'}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="desk-user__name">{me?.display_name || me?.username}</div>
            <div className="desk-user__id">@{me?.username}</div>
          </div>
          <button className="desk-icon-btn" style={{ width: 32, height: 32 }} onClick={() => setShowMenu(!showMenu)}>
            {DIcon.settings}
          </button>
          {showMenu && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, right: 0,
              marginBottom: 8, background: 'var(--surface-2)', border: '1px solid var(--line)',
              borderRadius: 8, padding: 4, zIndex: 100,
            }}>
              <button
                onClick={onLogout}
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 13, fontWeight: 500,
                  background: 'none', border: 'none', color: 'var(--loss)',
                  cursor: 'pointer', borderRadius: 6, textAlign: 'left',
                }}
                onMouseEnter={e => e.target.style.background = 'var(--surface-3)'}
                onMouseLeave={e => e.target.style.background = 'none'}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="desk-main">
        <div className="desk-topbar">
          <div>
            <div className="desk-topbar__title">{title}</div>
            {sub && <div className="desk-topbar__sub">{sub}</div>}
          </div>
          {!hideSearch && (
            <div className="desk-search">
              {DIcon.search}
              <span>Search teams, matches, friends…</span>
              <kbd>⌘K</kbd>
            </div>
          )}
          <div className="desk-topbar__actions">
            <MiniCountdown variant="desktop" />
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: balance >= 0 ? 'var(--win)' : 'var(--loss)', marginRight: 12 }}>
              {fmtNet(balance)}
            </div>
            <button className="desk-icon-btn" onClick={onLogout} title="Log out">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            </button>
          </div>
        </div>

        <div className="desk-content">
          {children}
        </div>
      </main>
    </div>
  );
}

// ── Desktop fixture row ───────────────────────────────────────
function DeskFix({ match, onBet, myBets = [], poolData }) {
  const home = getTeam(match.home);
  const away = getTeam(match.away);
  const IS_LIVE = match.status === 'live';
  const IS_FINISHED = match.status === 'finished';
  const myTotal = myBets.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="desk-fix">
      <div className="desk-fix__row">
      <div className="desk-fix__time">
        <b>{IS_LIVE ? 'LIVE' : IS_FINISHED ? 'FT' : fmtTimeIST(match.time)}</b>
        <span>{fmtDay(match.date).slice(0,3)} · {fmtDate(match.date)}</span>
        {myTotal > 0 && (
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--gold)', fontFamily: 'var(--font-mono)' }}>
            {fmtMoney(myTotal)}
          </span>
        )}
      </div>
      <div className="desk-fix__teams">
        <div className="desk-fix__team">
          <Flag code={match.home} size="sm" />
          <span>{home.name}</span>
          {(IS_LIVE || IS_FINISHED) && match.score && (
            <span className="form mono" style={{ marginLeft: 'auto', color: 'var(--ink)' }}>{match.score[0]}</span>
          )}
        </div>
        <div className="desk-fix__team">
          <Flag code={match.away} size="sm" />
          <span>{away.name}</span>
          {(IS_LIVE || IS_FINISHED) && match.score && (
            <span className="form mono" style={{ marginLeft: 'auto', color: 'var(--ink)' }}>{match.score[1]}</span>
          )}
        </div>
      </div>
      {!IS_FINISHED && (
        <div className="desk-fix__odds">
          {[
            { k: 'home', l: home.code, v: match.odds?.home },
            { k: 'draw', l: 'X',       v: match.odds?.draw },
            { k: 'away', l: away.code, v: match.odds?.away },
          ].map(o => (
            <button
              key={o.k}
              className={'odds-btn ' + (myBets.some(b => b.pick === o.k) ? 'fav' : '')}
              onClick={() => onBet(match, o.k)}
            >
              <span className="odds-btn__label">{o.l}</span>
              {o.v != null && <span className="odds-btn__val">{o.v.toFixed(2)}</span>}
            </button>
          ))}
        </div>
      )}
      </div>
      {!IS_FINISHED && poolData && poolData.bets && poolData.bets.length > 0 && (
        <DeskPoolTable poolData={poolData} home={home} away={away} />
      )}
    </div>
  );
}

function DeskPoolTable({ poolData, home, away }) {
  const homeBets = poolData.bets.filter(b => b.pick === 'home');
  const awayBets = poolData.bets.filter(b => b.pick === 'away');
  const drawBets = poolData.bets.filter(b => b.pick === 'draw');

  const tdStyle = { padding: '2px 6px', fontSize: 11, borderBottom: '1px solid var(--border-light, rgba(255,255,255,0.06))' };
  const thStyle = { ...tdStyle, fontWeight: 600, color: 'var(--ink-3)', fontSize: 10, textTransform: 'uppercase' };

  const renderSide = (bets, label) => {
    if (!bets.length) return null;
    return (
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-2)', textAlign: 'center', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>User</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Bet</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Win</th>
            </tr>
          </thead>
          <tbody>
            {bets.map((b, i) => (
              <tr key={i}>
                <td style={tdStyle}>{b.display_name}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{CURRENCY_SYMBOL}{b.amount}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--win)' }}>{CURRENCY_SYMBOL}{b.possible_win}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ margin: '6px 0 0', padding: '6px 8px', background: 'var(--bg-2, rgba(0,0,0,0.15))', borderRadius: 6, border: '1px solid var(--border-light, rgba(255,255,255,0.06))' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ink-3)', textAlign: 'center', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Pool: {CURRENCY_SYMBOL}{poolData.total} · {poolData.bettorCount} bettor{poolData.bettorCount !== 1 ? 's' : ''}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {renderSide(homeBets, home.name)}
        {renderSide(awayBets, away.name)}
      </div>
      {drawBets.length > 0 && <div style={{ marginTop: 4 }}>{renderSide(drawBets, 'Draw')}</div>}
      {poolData.total > 0 && (() => {
        const hPct = (poolData.bySide?.home || 0) / poolData.total * 100;
        const aPct = (poolData.bySide?.away || 0) / poolData.total * 100;
        const dPct = (poolData.bySide?.draw || 0) / poolData.total * 100;
        return (
          <div style={{ marginTop: 6, height: 5, borderRadius: 3, overflow: 'hidden', display: 'flex', background: 'rgba(255,255,255,0.08)' }}>
            {hPct > 0 && <div style={{ width: `${hPct}%`, background: '#4ade80' }} />}
            {dPct > 0 && <div style={{ width: `${dPct}%`, background: '#6b7280' }} />}
            {aPct > 0 && <div style={{ width: `${aPct}%`, background: '#f87171' }} />}
          </div>
        );
      })()}
    </div>
  );
}

// ── Desktop Home ──────────────────────────────────────────────
function DHomeScreen({ matches, balance, onBet, onNav, user, bets = [], poolMap = {}, onCancelBet, myCupWinnerBet, onOpenCupWinner, cupWinnerDeadlineTs }) {
  const live = matches.filter(m => m.status === 'live');
  const upcoming = matches.filter(m => m.status === 'upcoming').slice(0, 6);
  const featured = live[0] || upcoming[0];

  const [leaderboard, setLeaderboard] = useState([]);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/leaderboard').then(r => r.json()).then(d => { if (Array.isArray(d)) setLeaderboard(d); }).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/activity?limit=6').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setActivity(d.map(a => ({
        id: a.id,
        username: a.profiles?.display_name || a.profiles?.username || 'Unknown',
        text: formatDeskActivity(a),
        createdAt: a.created_at,
      })));
    }).catch(() => {});
  }, [user, bets]);

  const myOpenBets = bets.filter(b => b.status === 'pending');
  const totalStake = myOpenBets.reduce((s, b) => s + b.amount, 0);
  const myWon = bets.filter(b => b.status === 'won')
    .reduce((s, b) => s + ((b.payout || 0) - b.amount), 0);

  const sorted = leaderboard.slice(0, 5);

  if (!featured) return <div className="eyebrow" style={{ padding: 24 }}>Loading…</div>;

  const home = getTeam(featured.home);
  const away = getTeam(featured.away);
  const IS_LIVE = featured.status === 'live';
  const favOdds = featured.odds ? Math.min(featured.odds.home, featured.odds.draw, featured.odds.away) : null;

  return (
    <>
      {/* Featured / live hero */}
      <section className="dhero">
        <div className="dhero__top">
          <div className="eyebrow" style={{ color: IS_LIVE ? 'var(--live)' : 'var(--gold)' }}>
            {IS_LIVE ? '★ Live · Group Watching' : 'Featured · Group Stage'}
          </div>
          {IS_LIVE
            ? <LiveDot minute={featured.minute} />
            : <span className="mono" style={{ color: 'var(--ink-3)', fontSize: 12 }}>
                {fmtDay(featured.date)} · {fmtTimeIST(featured.time)} · {featured.venue}
              </span>
          }
        </div>

        <div className="dhero__matchup">
          <div className="dhero__team">
            <Flag code={featured.home} size="xl" />
            <div>
              <div className="dhero__team-name">{home.name}</div>
              <div className="dhero__team-meta">Group {home.group} · FIFA 2026</div>
            </div>
          </div>
          {IS_LIVE && featured.score ? (
            <div>
              <div className="dhero__score">{featured.score[0]} : {featured.score[1]}</div>
              <div className="dhero__vs-time" style={{ textAlign: 'center' }}>{featured.minute}&apos;</div>
            </div>
          ) : (
            <div>
              <div className="dhero__vs">VS</div>
              <div className="dhero__vs-time">{fmtTimeIST(featured.time)}</div>
            </div>
          )}
          <div className="dhero__team right">
            <Flag code={featured.away} size="xl" />
            <div>
              <div className="dhero__team-name">{away.name}</div>
              <div className="dhero__team-meta">Group {away.group} · FIFA 2026</div>
            </div>
          </div>
        </div>

        {featured.status !== 'finished' && (
          <div className="dhero__odds">
            {[
              { k: 'home', l: `${home.code} to win`, v: featured.odds?.home },
              { k: 'draw', l: 'Draw',                v: featured.odds?.draw },
              { k: 'away', l: `${away.code} to win`, v: featured.odds?.away },
            ].map(o => (
              <button
                key={o.k}
                className={'odds-btn ' + (o.v != null && o.v === favOdds ? 'fav' : '')}
                onClick={() => onBet(featured, o.k)}
              >
                <span className="odds-btn__label">{o.l}</span>
                {o.v != null && <span className="odds-btn__val">{o.v.toFixed(2)}</span>}
              </button>
            ))}
          </div>
        )}
        {(() => {
          const myBets = bets.filter(b => (b.match_id || b.matchId) === featured.id && b.status === 'pending');
          const myTotal = myBets.reduce((s, b) => s + b.amount, 0);
          if (myTotal <= 0) return null;
          const myPick = myBets[0]?.pick;
          const pickLabel = myPick === 'home' ? home.code : myPick === 'away' ? away.code : 'Draw';
          return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--win)', fontWeight: 600 }}>Your bet: {fmtMoney(myTotal)} on {pickLabel}</span>
              {featured.status !== 'live' && onCancelBet && (
                <button
                  onClick={() => onCancelBet(featured.id)}
                  style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                >Cancel</button>
              )}
            </div>
          );
        })()}
        {poolMap[featured.id] && poolMap[featured.id].bets && poolMap[featured.id].bets.length > 0 && (
          <DeskPoolTable poolData={poolMap[featured.id]} home={home} away={away} />
        )}
      </section>

      <CupWinnerCTA myCupWinnerBet={myCupWinnerBet} onOpen={onOpenCupWinner} deadlineTs={cupWinnerDeadlineTs} />

      {/* Stat tiles */}
      <div className="desk-stats" style={{ marginTop: 22 }}>
        <div className="desk-stat gold">
          <div className="desk-stat__label">Open stake</div>
          <div className="desk-stat__val">{fmtMoney(totalStake)}</div>
          <div className="desk-stat__sub">{myOpenBets.length} live bets</div>
        </div>
        <div className="desk-stat gold">
          <div className="desk-stat__label">Net this week</div>
          <div className="desk-stat__val">+{fmtCompact(myWon)}</div>
          <div className="desk-stat__sub">3 won · 1 lost</div>
        </div>
        <div className="desk-stat">
          <div className="desk-stat__label">Group rank</div>
          <div className="desk-stat__val">#{(leaderboard.findIndex(p => p.id === user?.id) + 1) || '-'}<span style={{ color: 'var(--ink-3)', fontSize: 16, fontWeight: 600 }}> /{leaderboard.length}</span></div>
          <div className="desk-stat__sub">of {leaderboard.length} friends</div>
        </div>
        <div className="desk-stat">
          <div className="desk-stat__label">Pot total</div>
          <div className="desk-stat__val">{fmtCompact(leaderboard.reduce((s, p) => s + p.balance, 0))}</div>
          <div className="desk-stat__sub">across {leaderboard.length} friends</div>
        </div>
      </div>

      <div className="desk-grid split">
        <div className="desk-section">
          <div className="desk-section__head">
            <h3>Today&apos;s fixtures</h3>
            <button className="more" onClick={() => onNav('matches')}>See all →</button>
          </div>
          {[...live, ...upcoming].slice(0, 5).map(m => (
            <DeskFix key={m.id} match={m} onBet={onBet} poolData={poolMap[m.id]} />
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="desk-section">
            <div className="desk-section__head">
              <h3>Group leaderboard</h3>
              <button className="more" onClick={() => onNav('leaders')}>Full board →</button>
            </div>
            <div className="desk-lb">
              {sorted.map((f, i) => (
                <div key={f.id} className={'desk-lb__row ' + (user && f.id === user.id ? 'me' : '')}>
                  <span className="desk-lb__rank">{i + 1}</span>
                  <div className="desk-lb__avatar">{(f.display_name || f.username)[0]}</div>
                  <span className="desk-lb__name">
                    {f.display_name || f.username}
                    {user && f.id === user.id && (
                      <span style={{ marginLeft: 6, color: 'var(--gold)', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>YOU</span>
                    )}
                  </span>
                  <span className="desk-lb__amt">{fmtMoney(f.balance)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="desk-section">
            <div className="desk-section__head">
              <h3>Friend activity</h3>
              <span className="more mono" style={{ color: 'var(--gold)' }}>● live</span>
            </div>
            <div className="desk-feed">
              {activity.length === 0 && (
                <div style={{ padding: 16, color: 'var(--ink-3)', fontSize: 13 }}>No activity yet</div>
              )}
              {activity.map(a => (
                <div key={a.id} className="desk-feed__item">
                  <div className="desk-feed__avatar">{a.username[0]}</div>
                  <div className="desk-feed__text">
                    <b>{a.username}</b> {a.text}
                  </div>
                  <span className="desk-feed__when">{a.createdAt ? new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Desktop Matches ───────────────────────────────────────────
function DMatchesScreen({ matches, onBet, bets = [], poolMap = {} }) {
  const [tab, setTab] = useState('upcoming');

  const upcoming = matches.filter(m => m.status !== 'finished').sort((a, b) => (a.kickoffTs || '').localeCompare(b.kickoffTs || ''));
  const completed = matches.filter(m => m.status === 'finished').sort((a, b) => (b.kickoffTs || '').localeCompare(a.kickoffTs || ''));
  const list = tab === 'upcoming' ? upcoming : completed;

  const byDate = {};
  list.forEach(m => {
    const key = m.kickoffTs ? m.kickoffTs.split('T')[0] : (m.date || 'tbd');
    (byDate[key] = byDate[key] || []).push(m);
  });
  const dates = Object.keys(byDate).sort((a, b) => {
    if (a === 'tbd') return 1;
    if (b === 'tbd') return -1;
    return tab === 'upcoming' ? a.localeCompare(b) : b.localeCompare(a);
  });

  return (
    <>
      <div className="desk-chiprow">
        <button className={'chip ' + (tab === 'upcoming' ? 'active' : '')} onClick={() => setTab('upcoming')}>
          Upcoming{upcoming.some(m => m.status === 'live') ? ' / Live' : ''} · {upcoming.length}
        </button>
        <button className={'chip ' + (tab === 'completed' ? 'active' : '')} onClick={() => setTab('completed')}>
          Completed · {completed.length}
        </button>
      </div>

      {dates.map(date => (
        <div key={date} style={{ marginBottom: 22 }}>
          <div className="desk-section__head" style={{ marginBottom: 12 }}>
            <h3>{date === 'tbd' ? 'Unknown' : fmtDay(date)} · <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{date === 'tbd' ? '' : fmtDate(date)}</span></h3>
            <span className="more mono">{byDate[date].length} matches</span>
          </div>
          <div className="desk-grid fixtures" style={{ marginTop: 0 }}>
            {byDate[date].map(m => {
              const myBets = bets.filter(b => (b.match_id || b.matchId) === m.id && b.status === 'pending');
              return <DeskFix key={m.id} match={m} onBet={onBet} myBets={myBets} poolData={poolMap[m.id]} />;
            })}
          </div>
        </div>
      ))}
    </>
  );
}

// ── Desktop Bracket ───────────────────────────────────────────
function DBracketScreen({ matches = MATCHES }) {
  const [view, setView] = useState('groups');

  const r32 = BRACKET.R32?.slice(0, 8) || [];

  return (
    <>
      <div className="desk-chiprow">
        {[
          { id: 'groups',   label: 'Group stage' },
          { id: 'knockout', label: 'Knockout bracket' },
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
        <div className="desk-groups">
          {GROUPS.map(g => {
            const groupMatches = matches.filter(m => m.group === g.id);
            const cities = [...new Set(groupMatches.map(m => m.venue?.split(',').pop()?.trim()).filter(Boolean))];
            return (
              <div key={g.id} className="group-card">
                <div className="group-card__title">Group <em>{g.id}</em></div>
                {g.teams.map((t, i) => {
                  const team = getTeam(t.code);
                  return (
                    <div key={t.code} className={'group-row ' + (i < 2 ? 'q' : '')}>
                      <span className="rk">{i + 1}</span>
                      <span style={{ fontSize: 14 }}>{team.flag}</span>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{team.name}</span>
                      <span className="pts">{t.pts}</span>
                    </div>
                  );
                })}
                <div style={{
                  fontSize: 9.5, color: 'var(--ink-3)', marginTop: 8, paddingTop: 6,
                  borderTop: '1px solid var(--line)', letterSpacing: '0.06em',
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

      {view === 'knockout' && (
        <div className="desk-bracket">
          <div style={{ padding: '0 0 8px', fontSize: 11, color: 'var(--ink-3)' }}>
            Scroll horizontally to navigate the bracket →
          </div>
          <div className="bracket-scroll">
            <div className="bracket">
              <div className="bracket-round">
                <div className="bracket-round__title">Round of 32</div>
                {r32.map((m, i) => (
                  <DBracketMatch key={i} home={m.home} away={m.away} />
                ))}
              </div>
              <div className="bracket-round">
                <div className="bracket-round__title">Round of 16</div>
                {[0,1,2,3].map(i => <DBracketMatch key={i} tbd />)}
              </div>
              <div className="bracket-round">
                <div className="bracket-round__title">Quarterfinals</div>
                {[0,1].map(i => <DBracketMatch key={i} tbd />)}
              </div>
              <div className="bracket-round">
                <div className="bracket-round__title">Semifinal</div>
                <DBracketMatch tbd />
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
        </div>
      )}
    </>
  );
}

function DBracketMatch({ home, away, tbd }) {
  if (tbd) {
    return (
      <div className="bracket-match" style={{ opacity: 0.55 }}>
        <div className="bracket-team">
          <div className="bracket-team__name"><span style={{ color: 'var(--ink-3)' }}>TBD</span></div>
          <span className="bracket-score" style={{ color: 'var(--ink-3)' }}>·</span>
        </div>
        <div className="bracket-team">
          <div className="bracket-team__name"><span style={{ color: 'var(--ink-3)' }}>TBD</span></div>
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

// ── Desktop Leaderboard ───────────────────────────────────────
function DLeaderboardScreen({ user }) {
  const [sorted, setSorted] = useState([]);
  const [settlementResolved, setSettlementResolved] = useState([]);
  const [settlementWithPending, setSettlementWithPending] = useState([]);
  const [settlementBasis, setSettlementBasis] = useState('resolved');

  useEffect(() => {
    fetch('/api/leaderboard').then(r => r.json()).then(d => { if (Array.isArray(d)) setSorted(d); }).catch(() => {});
    fetch('/api/settlement')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.resolved?.transactions)) setSettlementResolved(d.resolved.transactions);
        if (Array.isArray(d.withPending?.transactions)) setSettlementWithPending(d.withPending.transactions);
      })
      .catch(() => {});
  }, []);

  const settlementTxs = settlementBasis === 'resolved' ? settlementResolved : settlementWithPending;

  const top3 = sorted.slice(0, 3);

  return (
    <>
      <div className="desk-grid split" style={{ marginTop: 0 }}>
        {top3.length >= 3 && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 14, padding: '28px 28px 24px',
        }}>
          <div className="eyebrow" style={{ marginBottom: 18 }}>Top of the table</div>
          <div className="podium" style={{ padding: 0, marginBottom: 0 }}>
            {[
              { ...top3[1], rank: 2 },
              { ...top3[0], rank: 1 },
              { ...top3[2], rank: 3 },
            ].map(f => (
              <div key={f.id} className={'podium-block rank' + f.rank}>
                <div className="podium-avatar">{(f.display_name || f.username)[0]}</div>
                <div className="podium-name">{f.display_name || f.username}</div>
                <div className="podium-amt">{fmtMoney(f.balance)}</div>
                <div className="podium-bar">{f.rank}</div>
              </div>
            ))}
          </div>
          <div style={{
            textAlign: 'center', fontSize: 11.5, color: 'var(--ink-3)',
            marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--line)',
          }}>
            Settled at end of tournament · Winner takes the pot
          </div>
        </div>
        )}

        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
          {sorted.map((f, i) => {
            const IS_ME = user && f.id === user.id;
            return (
              <div key={f.id} className={'lb-row ' + (IS_ME ? 'me' : '')} style={{ padding: '13px 18px' }}>
                <span className="lb-rank">{i + 1}</span>
                <div className="lb-avatar">{(f.display_name || f.username)[0]}</div>
                <div className="lb-name">
                  {f.display_name || f.username}
                  {IS_ME && (
                    <span style={{
                      marginLeft: 8, fontSize: 9, padding: '2px 6px',
                      background: 'var(--gold)', color: '#051912',
                      borderRadius: 4, fontWeight: 800, letterSpacing: '0.06em',
                    }}>YOU</span>
                  )}
                </div>
                <span className={'lb-amt ' + (f.balance >= 0 ? 'win' : 'loss')} style={{ color: f.balance >= 0 ? 'var(--win)' : 'var(--loss)' }}>
                  {fmtNet(f.balance)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Settlement plan */}
      <div style={{
        marginTop: 24, background: 'var(--surface)',
        border: '1px solid var(--line)', borderRadius: 14, padding: '22px 24px',
      }}>
        <div className="row between center" style={{ marginBottom: 14 }}>
          <div className="eyebrow" style={{ margin: 0 }}>Settlement plan</div>
          <div style={{
            display: 'inline-flex', gap: 4, padding: 3, borderRadius: 10,
            background: 'var(--surface-2)', border: '1px solid var(--line)',
          }}>
            <button
              onClick={() => setSettlementBasis('resolved')}
              style={{
                padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                background: settlementBasis === 'resolved' ? 'var(--gold-soft)' : 'transparent',
                color: settlementBasis === 'resolved' ? 'var(--gold)' : 'var(--ink-3)',
              }}
            >Resolved only</button>
            <button
              onClick={() => setSettlementBasis('withPending')}
              style={{
                padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                background: settlementBasis === 'withPending' ? 'var(--gold-soft)' : 'transparent',
                color: settlementBasis === 'withPending' ? 'var(--gold)' : 'var(--ink-3)',
              }}
            >Including pending</button>
          </div>
        </div>

        {settlementTxs.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
            {settlementBasis === 'resolved'
              ? 'All square — no payments needed yet'
              : 'No matched debts yet — once anyone has a payout, pending stakes will pair with creditors'}
          </div>
        ) : (
          <div>
            {settlementTxs.map((tx, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 0',
                borderBottom: i < settlementTxs.length - 1 ? '1px solid var(--line)' : 'none',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--loss)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, flexShrink: 0,
                }}>
                  {tx.from.name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600 }}>
                  <span style={{ color: 'var(--loss)' }}>{tx.from.name}</span>
                  <span style={{ color: 'var(--ink-3)' }}> pays </span>
                  <span style={{ color: 'var(--win)' }}>{tx.to.name}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16, color: 'var(--gold)', flexShrink: 0 }}>
                  {CURRENCY_SYMBOL}{tx.amount.toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{
          marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)',
          fontSize: 11.5, color: 'var(--ink-3)', textAlign: 'center',
        }}>
          {settlementBasis === 'resolved'
            ? 'If WC ended now (pending bets refunded) · finalised at end of tournament'
            : 'Treats pending stakes as already spent — early in the tournament most debts have no creditor yet'}
        </div>
      </div>
    </>
  );
}

// ── Desktop My Bets ───────────────────────────────────────────
function DBetsScreen({ user, onCancelBet, bets = [] }) {
  const [tab, setTab] = useState('pending');

  const mine = bets;
  const filtered = tab === 'all' ? mine : mine.filter(b => b.status === tab);

  const totalOpen = mine.filter(b => b.status === 'pending').reduce((s, b) => s + b.amount, 0);
  const totalWon  = mine.filter(b => b.status === 'won').reduce((s, b) => s + ((b.payout || 0) - b.amount), 0);
  const winRate   = (() => {
    const settled = mine.filter(b => b.status === 'won' || b.status === 'lost');
    if (!settled.length) return 0;
    return Math.round(100 * mine.filter(b => b.status === 'won').length / settled.length);
  })();

  return (
    <>
      <div className="desk-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 22 }}>
        <div className="desk-stat gold">
          <div className="desk-stat__label">Open stake</div>
          <div className="desk-stat__val">{fmtMoney(totalOpen)}</div>
          <div className="desk-stat__sub">{mine.filter(b => b.status === 'pending').length} live bets</div>
        </div>
        <div className="desk-stat gold">
          <div className="desk-stat__label">Lifetime won</div>
          <div className="desk-stat__val">+{fmtMoney(totalWon)}</div>
          <div className="desk-stat__sub">across {mine.filter(b => b.status === 'won').length} bets</div>
        </div>
        <div className="desk-stat">
          <div className="desk-stat__label">Win rate</div>
          <div className="desk-stat__val">{winRate}%</div>
          <div className="desk-stat__sub">last 30 days</div>
        </div>
      </div>

      <div className="desk-chiprow">
        {[
          { id: 'pending', label: 'Open · ' + mine.filter(b => b.status === 'pending').length },
          { id: 'won',  label: 'Won · '  + mine.filter(b => b.status === 'won').length  },
          { id: 'lost', label: 'Lost · ' + mine.filter(b => b.status === 'lost').length },
          { id: 'all',  label: 'All bets' },
        ].map(t => (
          <button
            key={t.id}
            className={'chip ' + (tab === t.id ? 'active' : '')}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '90px 1fr 130px 110px 110px 80px',
        gap: 16, padding: '0 18px 8px',
        fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        color: 'var(--ink-3)', textTransform: 'uppercase',
      }}>
        <span>Date</span>
        <span>Match</span>
        <span>Pick</span>
        <span style={{ textAlign: 'right' }}>Stake</span>
        <span style={{ textAlign: 'right' }}>Return</span>
        <span style={{ textAlign: 'right' }}>Status</span>
      </div>

      <div className="desk-bets">
        {filtered.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--ink-3)' }}>
            No {tab} bets
          </div>
        )}
        {filtered.map(b => {
          const m = getMatch(b.match_id);
          if (!m) return null;
          const h = getTeam(m.home);
          const a = getTeam(m.away);
          const pickName = b.pick === 'home' ? h.name : b.pick === 'away' ? a.name : 'Draw';
          const ret = b.status === 'won' ? (b.payout || 0) : b.status === 'lost' ? 0 : null;
          return (
            <div key={b.id} className="desk-bet">
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                <div style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 12 }}>{fmtTimeIST(m.time)}</div>
                {fmtDate(m.date)}
              </div>
              <div className="desk-bet__match">
                <span style={{ fontSize: 14 }}>{h.flag}</span>
                <span>{h.code}</span>
                <span className="vs">vs</span>
                <span>{a.code}</span>
                <span style={{ fontSize: 14 }}>{a.flag}</span>
                {m.status === 'live' && <LiveDot minute={m.minute} />}
              </div>
              <div className="desk-bet__pick">
                {pickName}
                <span className="odds">pool</span>
              </div>
              <div className="desk-bet__num">{fmtMoney(b.amount)}</div>
              <div className={'desk-bet__num ' + (b.status === 'won' ? 'win' : b.status === 'lost' ? 'loss' : 'gold')}>
                {b.status === 'lost' ? '—' : ret != null ? fmtMoney(ret) : 'Pending'}
              </div>
              <div className="desk-bet__status">
                {b.status === 'pending' && m.status === 'upcoming' && onCancelBet ? (
                  <button
                    onClick={() => onCancelBet(b.match_id)}
                    style={{
                      background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.25)',
                      borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600,
                      color: 'var(--loss)', cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                ) : (
                  <span className={'bet-card__status ' + b.status}>{b.status}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Desktop App (root) ────────────────────────────────────────
export default function DesktopApp({ tab, setTab, balance, openBet, matches, user, onLogout, bets = [], onCancelBet, poolMap = {}, myCupWinnerBet, onOpenCupWinner, cupWinnerDeadlineTs }) {
  const titles = {
    home:    { title: 'Dashboard',    sub: 'FIFA World Cup 2026 · Group stage underway' },
    matches: { title: 'Fixtures',     sub: 'All matches · group stage + knockout' },
    bracket: { title: 'Tournament',   sub: '48 teams · 12 groups · single elimination' },
    leaders: { title: 'Leaderboard',  sub: 'Friends · friend betting pool' },
    bets:    { title: 'My Bets',      sub: 'Your stakes across the tournament' },
  };
  const t = titles[tab] || titles.home;

  return (
    <DesktopShell
      tab={tab} onNav={setTab} balance={balance}
      title={t.title} sub={t.sub}
      hideSearch={false} user={user} onLogout={onLogout}
    >
      {tab === 'home'    && <DHomeScreen matches={matches} balance={balance} onBet={openBet} onNav={setTab} user={user} bets={bets} poolMap={poolMap} onCancelBet={onCancelBet} myCupWinnerBet={myCupWinnerBet} onOpenCupWinner={onOpenCupWinner} cupWinnerDeadlineTs={cupWinnerDeadlineTs} />}
      {tab === 'matches' && <DMatchesScreen matches={matches} onBet={openBet} bets={bets} poolMap={poolMap} />}
      {tab === 'leaders' && <DLeaderboardScreen user={user} />}
      {tab === 'bets'    && <DBetsScreen user={user} onCancelBet={onCancelBet} bets={bets} />}
    </DesktopShell>
  );
}

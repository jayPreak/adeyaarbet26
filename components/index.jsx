'use client';

import { getTeam, getFriend, fmtCompact, fmtDate, fmtDay, getMatch, fmtTimeIST, isMatchBettingOpen } from '@/lib/data';
import { fmtMoney, CURRENCY_SYMBOL, MAX_BET } from '@/lib/currency';
import { useState, useEffect } from 'react';
import MiniCountdown from './MiniCountdown';

// ── Icons ────────────────────────────────────────────────────
export const Icon = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-7 9 7v9a2 2 0 01-2 2h-4v-7H9v7H5a2 2 0 01-2-2z"/>
    </svg>
  ),
  ball: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/>
    </svg>
  ),
  bracket: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h5l3 3M3 18h5l3-3M21 12h-4l-3-3M14 15l3-3"/>
    </svg>
  ),
  trophy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4h10v6a5 5 0 01-10 0V4z"/>
      <path d="M7 7H4v3a3 3 0 003 3M17 7h3v3a3 3 0 01-3 3"/>
      <path d="M9 21h6M12 18v3"/>
    </svg>
  ),
  receipt: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3z"/>
      <path d="M9 8h6M9 12h6M9 16h4"/>
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18"/>
    </svg>
  ),
};

// ── Flag ─────────────────────────────────────────────────────
export function Flag({ code, size = 'md' }) {
  const team = getTeam(code);
  const [imgFailed, setImgFailed] = useState(false);
  const cls = size === 'xl' ? 'flag xl' : size === 'lg' ? 'flag lg' : size === 'sm' ? 'flag sm' : 'flag';
  return (
    <div className={cls}>
      {imgFailed ? (
        <span>{team.flag}</span>
      ) : (
        <img
          src={`https://api.fifa.com/api/v3/picture/flags-sq-5/${code}`}
          alt={team.name}
          onError={() => setImgFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit', display: 'block' }}
        />
      )}
    </div>
  );
}

// ── Live dot ─────────────────────────────────────────────────
export function LiveDot({ minute }) {
  return (
    <span className="live-dot">
      <span>Live{minute ? ` · ${minute}'` : ''}</span>
    </span>
  );
}

// ── News Ticker ─────────────────────────────────────────────
export function NewsTicker({ matches = [], bets = [], user }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const items = [];

  const live = matches.filter(m => m.status === 'live');
  const upcoming = matches
    .filter(m => m.status === 'upcoming' && m.kickoffTs != null)
    .sort((a, b) => a.kickoffTs - b.kickoffTs);
  const next = upcoming[0];

  if (live.length > 0) {
    live.forEach(m => {
      const h = getTeam(m.home);
      const a = getTeam(m.away);
      const score = m.score ? ` ${m.score[0]}–${m.score[1]}` : '';
      items.push(`🔴 LIVE: ${h.name} vs ${a.name}${score}${m.minute ? ` (${m.minute}')` : ''}`);
    });
  }

  if (next) {
    const h = getTeam(next.home);
    const a = getTeam(next.away);
    const matchTime = new Date(next.kickoffTs);
    const diff = matchTime - now;
    if (diff > 0) {
      const days = Math.floor(diff / 86400000);
      const hrs = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hrs > 0) parts.push(`${hrs}h`);
      parts.push(`${mins}m`);
      items.push(`⚽ Next: ${h.name} vs ${a.name} in ${parts.join(' ')}`);
    }

    if (user) {
      const hasBetOnNext = bets.some(b => (b.match_id || b.matchId) === next.id && b.status === 'pending');
      if (!hasBetOnNext) {
        items.push(`🚨 You haven't placed your bet for ${getTeam(next.home).name} vs ${getTeam(next.away).name}!`);
      }
    }
  }

  if (items.length === 0) {
    items.push('🏆 FIFA World Cup 2026 · AdeYaar Betting League');
  }

  const text = items.join('     ·     ');

  return (
    <div style={{
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      background: 'rgba(0,0,0,0.4)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      padding: '6px 0',
      position: 'relative',
    }}>
      <div style={{
        display: 'inline-block',
        animation: 'marquee 20s linear infinite',
        paddingLeft: '100%',
        fontSize: 12,
        fontWeight: 700,
        background: 'linear-gradient(90deg, #ff0000, #ff7700, #ffff00, #00ff00, #0077ff, #8b00ff, #ff0000)',
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        animation: 'marquee 18s linear infinite, rainbow 3s linear infinite',
      }}>
        {text}
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }
        @keyframes rainbow {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>
    </div>
  );
}

// ── App Header ───────────────────────────────────────────────
export function AppHeader({ balance, onTap, user, betsLoaded }) {
  return (
    <>
      <div className="app-header">
        <div className="app-header__brand">
          <div className="brand-mark">A</div>
          <div className="brand-name">AdeYaar <em>26</em></div>
        </div>
        <div className="app-header__right">
          {user && <span className="app-header__user">{user.display_name || user.username}</span>}
          <button className="balance-pill" onClick={onTap}>
            <div className="balance-pill__icon" style={user?.avatar_url ? { backgroundImage: `url(${user.avatar_url})`, backgroundSize: 'cover', backgroundPosition: 'center', fontSize: 0 } : undefined}>
              {!user?.avatar_url && (user?.display_name?.[0] || '₹')}
            </div>
            {betsLoaded === false
              ? <span className="balance-pill__amt skeleton-text" style={{ width: 48 }}>&nbsp;</span>
              : <span className="balance-pill__amt">{fmtMoney(balance)}</span>
            }
          </button>
        </div>
      </div>
      <MiniCountdown variant="mobile" />
    </>
  );
}

// ── Tab bar ──────────────────────────────────────────────────
export function TabBar({ active, onChange }) {
  const tabs = [
    { id: 'home',     label: 'Home',     icon: Icon.home },
    { id: 'fixtures', label: 'Matches', icon: Icon.ball },
    { id: 'leaders',  label: 'Leaders',  icon: Icon.trophy },
    { id: 'bets',     label: 'Account',  icon: Icon.receipt },
  ];
  return (
    <div className="tabbar">
      {tabs.map(t => (
        <button
          key={t.id}
          className={'tabbar__btn ' + (active === t.id ? 'active' : '')}
          onClick={() => onChange(t.id)}
        >
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Section head ─────────────────────────────────────────────
export function SectionHead({ title, more, onMore }) {
  return (
    <div className="section-head">
      <div className="section-head__title display">{title}</div>
      {more && (
        <button className="section-head__more" onClick={onMore}>
          {more} →
        </button>
      )}
    </div>
  );
}

// ── Match card ───────────────────────────────────────────────
export function MatchCard({ match, onBet, myBets = [], onCancelBet, poolData, allUsers = [] }) {
  const home = getTeam(match.home);
  const away = getTeam(match.away);
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const bettingOpen = !isLive && !isFinished && isMatchBettingOpen(match);

  const stageLabel = match.group ? `Group ${match.group}` : 'Knockout';
  const city = match.venue?.split(',').pop()?.trim();
  const myTotal = myBets.reduce((s, b) => s + b.amount, 0);

  const hasBet = myTotal > 0;
  const myPick = myBets[0]?.pick;
  const pickLabel = myPick === 'home' ? home.code : myPick === 'away' ? away.code : myPick === 'draw' ? 'Draw' : '';

  return (
    <div className="match-card">
      <div className="match-card__head">
        <span>{stageLabel} · {fmtDate(match.date)}{city ? ` · ${city}` : ''}</span>
        {isLive ? <LiveDot minute={match.minute} /> :
         isFinished ? <span style={{ color: 'var(--ink-3)' }}>FT</span> :
         <span style={{ fontFamily: 'var(--font-mono)' }}>{fmtTimeIST(match.time)}</span>}
      </div>

      <div className="match-card__teams">
        <div className="match-card__team">
          <Flag code={match.home} size="lg" />
          <div className="match-card__team-name">{home.name}</div>
        </div>

        <div className="match-card__vs">
          {(isLive || isFinished) && match.score ? (
            <div className="match-card__score">{match.score[0]}–{match.score[1]}</div>
          ) : (
            <div className="match-card__vs-time">{fmtTimeIST(match.time)}</div>
          )}
        </div>

        <div className="match-card__team">
          <Flag code={match.away} size="lg" />
          <div className="match-card__team-name">{away.name}</div>
        </div>
      </div>

      {!isFinished && (
        <div className="match-card__odds">
          {[
            { key: 'home', label: home.code },
            { key: 'draw', label: 'X' },
            { key: 'away', label: away.code },
          ].map(o => (
            <button
              key={o.key}
              className={'odds-btn' + (hasBet && myPick === o.key ? ' odds-btn--active' : '')}
              disabled={!bettingOpen}
              onClick={(e) => { e.stopPropagation(); if (bettingOpen) onBet?.(match, o.key); }}
              style={!bettingOpen ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
            >
              <span className="odds-btn__label">{o.label}</span>
            </button>
          ))}
        </div>
      )}

      {!isFinished && poolData && poolData.bets && poolData.bets.length > 0 && (
        <MatchPoolTable poolData={poolData} home={home} away={away} allUsers={allUsers} />
      )}

      {!isFinished && (
        <div className={`match-card__footer ${hasBet ? 'has-bet' : 'no-bet'}`}>
          {hasBet ? (
            <>
              <span>Your bet: {fmtMoney(myTotal)} on {pickLabel}</span>
              {!isLive && onCancelBet && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCancelBet(match.id); }}
                  style={{
                    background: 'none', border: 'none', color: 'var(--loss)',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline',
                  }}
                >
                  Cancel
                </button>
              )}
            </>
          ) : (
            <span>No bet placed</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Pool table (bets per side with possible winnings) ────────
function MatchPoolTable({ poolData, home, away, allUsers = [] }) {
  const homeBets = poolData.bets.filter(b => b.pick === 'home');
  const awayBets = poolData.bets.filter(b => b.pick === 'away');
  const drawBets = poolData.bets.filter(b => b.pick === 'draw');

  const bettorIds = new Set(poolData.bets.map(b => b.user_id));
  const notBet = allUsers.filter(u => !bettorIds.has(u.id));

  const renderSideTable = (bets, label) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.5px', color: '#fff', marginBottom: 6,
        textAlign: 'center',
      }}>{label}</div>
      {bets.length === 0 ? (
        <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.3)', padding: '8px 0' }}>
          —
        </div>
      ) : (
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: '3px 6px', textAlign: 'left', fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>User</th>
              <th style={{ padding: '3px 6px', textAlign: 'right', fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Bet</th>
              <th style={{ padding: '3px 6px', textAlign: 'right', fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Win</th>
            </tr>
          </thead>
          <tbody>
            {bets.map((b, i) => (
              <tr key={i}>
                <td style={{ padding: '4px 6px', color: 'rgba(255,255,255,0.9)', fontSize: 12 }}>{(b.display_name || b.username || '?').split(' ')[0]}</td>
                <td style={{ padding: '4px 6px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>{CURRENCY_SYMBOL}{b.amount}</td>
                <td style={{ padding: '4px 6px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#4ade80', fontSize: 11 }}>{CURRENCY_SYMBOL}{b.possible_win}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div style={{
      margin: '10px 0 6px',
      padding: '12px',
      background: 'rgba(0,0,0,0.3)',
      borderRadius: 10,
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.8px', color: 'rgba(255,255,255,0.5)', marginBottom: 10,
        textAlign: 'center',
      }}>
        Pool: {CURRENCY_SYMBOL}{poolData.total} · {poolData.bettorCount} bettor{poolData.bettorCount !== 1 ? 's' : ''}
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        {renderSideTable(homeBets, home.name)}
        <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
        {renderSideTable(awayBets, away.name)}
      </div>
      {drawBets.length > 0 && (
        <div style={{ marginTop: 10, maxWidth: '60%', marginLeft: 'auto', marginRight: 'auto' }}>
          {renderSideTable(drawBets, 'Draw')}
        </div>
      )}
      {/* Proportional bar */}
      {poolData.total > 0 && (() => {
        const hPct = (poolData.bySide?.home || 0) / poolData.total * 100;
        const aPct = (poolData.bySide?.away || 0) / poolData.total * 100;
        const dPct = (poolData.bySide?.draw || 0) / poolData.total * 100;
        return (
          <div style={{
            marginTop: 10, height: 6, borderRadius: 3, overflow: 'hidden',
            display: 'flex', background: 'rgba(255,255,255,0.1)',
          }}>
            {hPct > 0 && <div style={{ width: `${hPct}%`, background: '#4ade80' }} />}
            {dPct > 0 && <div style={{ width: `${dPct}%`, background: '#6b7280' }} />}
            {aPct > 0 && <div style={{ width: `${aPct}%`, background: '#f87171' }} />}
          </div>
        );
      })()}
      {notBet.length > 0 && (
        <div style={{
          marginTop: 8, paddingTop: 6,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          fontSize: 11, color: 'rgba(255,255,255,0.3)',
          textAlign: 'center',
        }}>
          Haven&apos;t bet: {notBet.map(u => (u.display_name || u.username || '?').split(' ')[0]).join(', ')}
        </div>
      )}
    </div>
  );
}

// ── Hero match ───────────────────────────────────────────────
export function HeroMatch({ match, onBet, poolData, allUsers = [], myBets = [], onCancelBet }) {
  const home = getTeam(match.home);
  const away = getTeam(match.away);
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const bettingOpen = !isLive && !isFinished && isMatchBettingOpen(match);
  const myTotal = myBets.reduce((s, b) => s + b.amount, 0);
  const hasBet = myTotal > 0;
  const myPick = myBets[0]?.pick;
  const pickLabel = myPick === 'home' ? home.code : myPick === 'away' ? away.code : myPick === 'draw' ? 'Draw' : '';

  return (
    <div className="hero">
      <div className="row between center">
        <div className="hero__stage">
          {isLive ? '★ Live now' : 'Group Stage · Featured'}
        </div>
        {isLive && <LiveDot minute={match.minute} />}
      </div>

      <div className="hero__matchup">
        <div className="hero__team">
          <Flag code={match.home} size="xl" />
          <div className="hero__team-name">{home.name}</div>
        </div>
        <div className="col center" style={{ gap: 6 }}>
          {isLive && match.score ? (
            <div className="match-card__score" style={{ fontSize: 32 }}>
              {match.score[0]}–{match.score[1]}
            </div>
          ) : (
            <>
              <div className="hero__vs">VS</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                {fmtTimeIST(match.time)}
              </div>
            </>
          )}
        </div>
        <div className="hero__team">
          <Flag code={match.away} size="xl" />
          <div className="hero__team-name">{away.name}</div>
        </div>
      </div>

      <div className="hero__cta-row">
        <button className="btn primary lg" disabled={!bettingOpen} onClick={() => bettingOpen && onBet(match, 'home')} style={!bettingOpen ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}>
          {bettingOpen ? `Bet ${home.code}` : 'Betting closed'}
        </button>
        <button className="btn lg" disabled={!bettingOpen} onClick={() => bettingOpen && onBet(match, 'away')} style={!bettingOpen ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}>
          {bettingOpen ? `Bet ${away.code}` : 'Betting closed'}
        </button>
      </div>

      {hasBet && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--win)' }}>Your bet: {fmtMoney(myTotal)} on {pickLabel}</span>
          {!isLive && onCancelBet && (
            <button
              onClick={() => onCancelBet(match.id)}
              style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 11, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
            >Cancel</button>
          )}
        </div>
      )}

      {poolData && poolData.bets && poolData.bets.length > 0 && (
        <MatchPoolTable poolData={poolData} home={home} away={away} allUsers={allUsers} />
      )}
    </div>
  );
}

// ── Place bet sheet ──────────────────────────────────────────
export function PlaceBetSheet({ match, pick, onClose, onConfirm, balance, poolInfo, existingBets = [] }) {
  const presets = [100, 250, 500, 1000];
  const [amount, setAmount] = useState(250);
  const [side, setSide] = useState(pick || 'home');
  const [submitting, setSubmitting] = useState(false);

  const home = getTeam(match.home);
  const away = getTeam(match.away);
  const sideName = side === 'home' ? home.name : side === 'away' ? away.name : 'Draw';

  const existingPick = existingBets.length > 0 ? existingBets[0].pick : null;
  const existingTotal = existingBets.reduce((s, b) => s + b.amount, 0);
  const isSwitching = existingPick && existingPick !== side;

  const overMax = amount > MAX_BET;

  // Compute potential payout from pool info
  const pool = poolInfo || {};
  const bySide = pool.bySide || { home: 0, away: 0, draw: 0 };
  const totalPool = (pool.total || 0) + amount;
  const sideTotal = (bySide[side] || 0) + amount;
  const potentialPayout = sideTotal > 0 ? Math.round((amount / sideTotal) * totalPool) : 0;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="sheet-handle" />

        <div className="row between center" style={{ marginBottom: 14 }}>
          <div className="eyebrow">Place your bet</div>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}
          >
            {Icon.close}
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>

        {/* Pool info */}
        {pool.bettorCount > 0 && (
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12, textAlign: 'center' }}>
            {pool.bettorCount} friend{pool.bettorCount !== 1 ? 's' : ''} bet on this match · Pool: {fmtMoney(pool.total)}
          </div>
        )}

        {/* Match preview */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row between" style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 10 }}>
            <span>{match.group ? `Group ${match.group}` : 'Knockout'} · {fmtDay(match.date)} {fmtTimeIST(match.time)}</span>
            <span className="mono">{match.id}</span>
          </div>
          <div className="row between center" style={{ gap: 10 }}>
            <div className="row center" style={{ gap: 8 }}>
              <Flag code={match.home} />
              <span style={{ fontWeight: 600 }}>{home.name}</span>
            </div>
            <span className="mono" style={{ color: 'var(--ink-3)' }}>vs</span>
            <div className="row center" style={{ gap: 8 }}>
              <span style={{ fontWeight: 600 }}>{away.name}</span>
              <Flag code={match.away} />
            </div>
          </div>
        </div>

        {/* Side picker */}
        <div className="eyebrow" style={{ marginBottom: 8 }}>Your pick</div>
        <div className="match-card__odds" style={{ marginBottom: 18 }}>
          {[
            { k: 'home', l: home.name },
            { k: 'draw', l: 'Draw' },
            { k: 'away', l: away.name },
          ].map(o => (
            <button
              key={o.k}
              className={'odds-btn ' + (side === o.k ? 'fav' : '')}
              style={side === o.k ? { borderColor: 'var(--gold)', background: 'var(--gold-soft)' } : {}}
              onClick={() => setSide(o.k)}
            >
              <span className="odds-btn__label">
                {o.l.length > 8 ? (o.k === 'home' ? home.code : o.k === 'away' ? away.code : 'X') : o.l}
              </span>
            </button>
          ))}
        </div>

        {/* Switch warning */}
        {isSwitching && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 14,
            background: 'rgba(231, 76, 60, 0.08)', border: '1px solid rgba(231, 76, 60, 0.2)',
            fontSize: 12, color: 'var(--loss)', lineHeight: 1.4,
          }}>
            You have {fmtMoney(existingTotal)} on <b>{existingPick === 'home' ? home.name : existingPick === 'away' ? away.name : 'Draw'}</b>.
            Switching to <b>{sideName}</b> will cancel your previous bet and refund it.
          </div>
        )}

        {/* Same-side existing bet info */}
        {existingPick && existingPick === side && !isSwitching && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 14,
            background: 'rgba(74, 222, 128, 0.08)', border: '1px solid rgba(74, 222, 128, 0.2)',
            fontSize: 12, color: 'var(--win)', lineHeight: 1.4,
          }}>
            You already have <b>{fmtMoney(existingTotal)}</b> on <b>{sideName}</b>. Cancel your existing bet first to place a new one.
          </div>
        )}

        {/* Amount */}
        <div className="eyebrow" style={{ marginBottom: 10 }}>Amount</div>

        <div style={{
          textAlign: 'center', padding: '14px 0',
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 36,
          color: 'var(--ink)',
        }}>
          {CURRENCY_SYMBOL}{amount.toLocaleString('en-IN')}
        </div>

        <input
          type="range" className="slider"
          min={50} max={MAX_BET} step={50}
          value={amount}
          onChange={e => setAmount(Number(e.target.value))}
          style={{ marginBottom: 14 }}
        />

        <div className="amount-presets" style={{ marginBottom: 18 }}>
          {presets.map(p => (
            <button key={p} className={amount === p ? 'active' : ''} onClick={() => setAmount(p)}>
              {CURRENCY_SYMBOL}{p}
            </button>
          ))}
        </div>

        {/* Potential payout — prominent */}
        {potentialPayout > 0 && (
          <div style={{
            textAlign: 'center', marginBottom: 14,
            padding: '10px 0',
            borderRadius: 'var(--radius)',
            background: 'rgba(39, 174, 96, 0.08)',
            border: '1px solid rgba(39, 174, 96, 0.2)',
          }}>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 2 }}>If {sideName} wins, you get</div>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28,
              color: 'var(--win)',
            }}>
              {fmtMoney(potentialPayout)}
            </div>
            {potentialPayout > amount && (
              <div style={{ fontSize: 11, color: 'var(--win)', opacity: 0.8 }}>
                +{fmtMoney(potentialPayout - amount)} profit
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        <div style={{
          padding: '14px 16px', borderRadius: 'var(--radius)',
          background: 'var(--surface-2)', marginBottom: 16,
          border: '1px solid var(--line)',
        }}>
          <div className="row between" style={{ marginBottom: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>Pick</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{sideName}</span>
          </div>
          <div className="row between" style={{ marginBottom: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>Stake</span>
            <span className="mono" style={{ fontWeight: 700 }}>{fmtMoney(amount)}</span>
          </div>
          <div className="row between">
            <span className="muted" style={{ fontSize: 12 }}>Pool size (with your bet)</span>
            <span className="mono" style={{ fontWeight: 700 }}>{fmtMoney(totalPool)}</span>
          </div>
        </div>

        </div>

        <button
          className="btn primary block lg"
          style={{ flexShrink: 0, marginTop: 12 }}
          disabled={overMax || submitting || (existingPick === side)}
          onClick={async () => {
            setSubmitting(true);
            try { await onConfirm({ matchId: match.id, pick: side, amount }); }
            catch { /* parent handles */ }
            finally { setSubmitting(false); }
          }}
        >
          {submitting ? 'Placing...' : (existingPick === side) ? 'Already placed — cancel to change' : overMax ? `Max bet ${CURRENCY_SYMBOL}${MAX_BET.toLocaleString('en-IN')}` : `Place ${CURRENCY_SYMBOL}${amount.toLocaleString('en-IN')} bet`}
        </button>
      </div>
    </div>
  );
}

// ── Toast ────────────────────────────────────────────────────
export function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [onDone]);
  const isError = message?.startsWith('Error');
  return (
    <div className="toast" style={isError ? { borderColor: 'var(--loss)' } : undefined}>
      <span>{isError ? '✗' : '✓'}</span>
      <span>{message}</span>
    </div>
  );
}

// ── Bet card (My Bets screen) ────────────────────────────────
export function BetCard({ bet, onCancelBet }) {
  const match = getMatch(bet.match_id || bet.matchId);
  if (!match) return null;
  const home = getTeam(match.home);
  const away = getTeam(match.away);
  const pickedTeam = bet.pick === 'home' ? home : bet.pick === 'away' ? away : null;
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const canCancel = bet.status === 'pending' && !isLive && !isFinished && onCancelBet;

  return (
    <div className="bet-card">
      <div className="bet-card__head">
        <span>{fmtDay(match.date)} · {fmtTimeIST(match.time)}</span>
        <span className={'bet-card__status ' + bet.status}>{bet.status}</span>
      </div>

      <div className="row between center">
        <div className="row center" style={{ gap: 8 }}>
          <Flag code={match.home} size="sm" />
          <span style={{ fontWeight: 500, fontSize: 13 }}>{home.code}</span>
          <span className="mono" style={{ color: 'var(--ink-3)', fontSize: 11 }}>
            {match.score ? `${match.score[0]}-${match.score[1]}` : 'v'}
          </span>
          <span style={{ fontWeight: 500, fontSize: 13 }}>{away.code}</span>
          <Flag code={match.away} size="sm" />
        </div>
        {isLive && <LiveDot minute={match.minute} />}
      </div>

      <div className="bet-card__pick">
        <span className="eyebrow">Pick</span>
        <span style={{ fontWeight: 600, fontSize: 13 }}>
          {pickedTeam ? pickedTeam.name : 'Draw'}
        </span>
        <span className="mono dim" style={{ fontSize: 12 }}>parimutuel</span>
      </div>

      <div className="bet-card__amounts">
        <div>
          <span>Stake</span>
          <span>{fmtMoney(bet.amount)}</span>
        </div>
        <div>
          <span>{bet.status === 'won' ? 'Payout' : bet.status === 'lost' ? 'Lost' : 'Status'}</span>
          <span className={bet.status === 'won' ? 'win' : bet.status === 'lost' ? 'loss' : 'gold'}>
            {bet.status === 'won' ? fmtMoney(bet.payout) :
             bet.status === 'lost' ? '−' + fmtMoney(bet.amount) :
             'Pending'}
          </span>
        </div>
      </div>

      {canCancel && (
        <button
          onClick={() => onCancelBet(bet.match_id || bet.matchId)}
          style={{
            width: '100%', marginTop: 10, padding: '9px 0',
            background: 'rgba(231, 76, 60, 0.08)', border: '1px solid rgba(231, 76, 60, 0.25)',
            borderRadius: 8, color: 'var(--loss)', fontSize: 12, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancel bet · Refund {fmtMoney(bet.amount)}
        </button>
      )}
    </div>
  );
}

